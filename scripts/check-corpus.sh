#!/usr/bin/env bash
# Parse every MIB module under a directory and compare the files that fail
# against a list of known-bad files.
#
#   scripts/check-corpus.sh <corpus-dir> [known-failures-file]
#
# Exits non-zero if a file that is not on the known-failures list fails to
# parse (a regression). Files on the list that now parse are reported so the
# list can be trimmed, but do not fail the run.
set -euo pipefail

corpus=${1:?usage: check-corpus.sh <corpus-dir> [known-failures-file]}
known=${2:-test/corpus-known-failures.txt}
corpus=${corpus%/}

work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

# A "MIB" is any file that contains a module header; this skips READMEs,
# scripts and other non-MIB files that live alongside them.
find "$corpus" -type f -size -3M \
  ! -path '*/.git/*' ! -path '*/EXTRAS/*' ! -name '*.md' -print0 |
  xargs -0 grep -l -E '^[[:space:]]*[A-Za-z][A-Za-z0-9-]*[[:space:]]+DEFINITIONS' |
  LC_ALL=C sort > "$work/files"

total=$(wc -l < "$work/files" | tr -d ' ')

tree-sitter parse -q --paths "$work/files" > "$work/out" 2>&1 || true

# Lines for failing files look like "<path>   <TAB>Parse: ... (ERROR [r, c] - ...)".
grep -E '\((ERROR|MISSING)' "$work/out" |
  cut -f1 | sed -e 's/[[:space:]]*$//' -e "s|^$corpus/||" |
  LC_ALL=C sort -u > "$work/failed" || true

sed -e "s/#.*//" -e "s/[[:space:]]*$//" "$known" | grep -v "^$" | LC_ALL=C sort -u > "$work/known" || true

failed=$(wc -l < "$work/failed" | tr -d ' ')
LC_ALL=C comm -23 "$work/failed" "$work/known" > "$work/new"
LC_ALL=C comm -13 "$work/failed" "$work/known" > "$work/fixed"

awk -v t="$total" -v f="$failed" 'BEGIN {
  printf "Parsed %d MIB files: %d failed (%.2f%% clean)\n", t, f, t ? 100 * (t - f) / t : 0
}'

if [ -s "$work/fixed" ]; then
  echo
  echo "Known failures that now parse (remove them from $known):"
  sed 's/^/  /' "$work/fixed"
fi

if [ -s "$work/new" ]; then
  echo
  echo "New parse failures:"
  while read -r f; do
    echo "  $f"
    grep -F "$corpus/$f" "$work/out" | grep -oE '\((ERROR|MISSING)[^)]*\)' | head -1 | sed 's/^/    /'
  done < "$work/new"
  exit 1
fi
