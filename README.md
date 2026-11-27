# tree-sitter-mib

[![CI](https://github.com/ericwb/tree-sitter-mib/actions/workflows/ci.yml/badge.svg)](https://github.com/ericwb/tree-sitter-mib/actions/workflows/ci.yml)

A [tree-sitter](https://tree-sitter.github.io/) grammar for SNMP MIB modules:
the ASN.1 subset defined by the Structure of Management Information.

| Covers | RFCs |
| --- | --- |
| SMIv1 modules, `OBJECT-TYPE`, `TRAP-TYPE` | 1155, 1212, 1215 |
| SMIv2 `MODULE-IDENTITY`, `OBJECT-IDENTITY`, `OBJECT-TYPE`, `NOTIFICATION-TYPE` | 2578 |
| `TEXTUAL-CONVENTION` | 2579 |
| `OBJECT-GROUP`, `NOTIFICATION-GROUP`, `MODULE-COMPLIANCE`, `AGENT-CAPABILITIES` | 2580 |
| ASN.1 types (`SEQUENCE`, `SEQUENCE OF`, `CHOICE`, tagged `[APPLICATION n] IMPLICIT`), size/range constraints, `MACRO` definitions | X.208 subset |

## Real-world coverage

The parser was run against three collections of MIBs:

| Corpus | Files | Parsed without errors |
| --- | ---: | ---: |
| net-snmp standard MIBs (`/usr/share/snmp/mibs`) | 63 | 100% |
| VMware / IBM vendor MIBs | 13 | 100% |
| [netdisco-mibs](https://github.com/netdisco/netdisco-mibs) (≈200 vendors) | 4,849 | 99.77% |

The 11 netdisco files that do not parse are malformed. They are listed, with
the reason for each, in [`test/corpus-known-failures.txt`](https://github.com/ericwb/tree-sitter-mib/blob/main/test/corpus-known-failures.txt).
CI re-parses the whole collection on every change and fails on any new failure.

## Being forgiving

The grammar aims to give a useful tree for the MIBs people actually have,
rather than to validate them (use [`smilint`](https://www.ibr.cs.tu-bs.de/projects/libsmi/)
for that). Specifically, it accepts:

- clauses of a macro invocation in any order;
- missing or trailing commas in `IMPORTS`, enumerations, `SEQUENCE` bodies and object lists;
- object names with an upper-case initial (`TrafficShield4100 OBJECT IDENTIFIER ::= …`),
  which appear as ordinary `identifier` nodes;
- type names with a lower-case initial (`fooEntry ::= SEQUENCE …`, `SYNTAX SEQUENCE OF fooEntry`);
- enumeration labels that start with a digit (`10mbitHalfDuplex(2)`);
- identifiers as range bounds (`Unsigned32 (1..maxGroups)`).

Known simplifications:

- A comment runs from `--` to the end of the line. Strict ASN.1 also lets a
  second `--` close a comment mid-line, but MIBs routinely draw lines of dashes
  and almost nothing relies on the strict rule, so this grammar follows what
  net-snmp does in practice.
- The body of a `MACRO ::= BEGIN … END` definition (found only in the SMI base
  modules) is kept as a flat `macro_body` token stream.
- A `DEFVAL { … }` holding a BITS set or an OID becomes a single `braced_value`
  node, because `{ a }` can mean either.

## Tree shape

```mib
ifIndex OBJECT-TYPE
    SYNTAX      InterfaceIndex
    MAX-ACCESS  read-only
    STATUS      current
    DESCRIPTION "A unique value for each interface."
    ::= { ifEntry 1 }
```

```scheme
(object_type
  name: (identifier)
  (syntax_clause type: (defined_type name: (type_reference)))
  (access_clause value: (access))
  (status_clause value: (status))
  (description_clause value: (string))
  value: (object_identifier_value (identifier) (number)))
```

## Using it from Python

```sh
pip install "tree-sitter-mib[core]"   # "core" pulls in the tree-sitter runtime
```

```python
import tree_sitter_mib
from tree_sitter import Language, Parser, Query, QueryCursor

language = Language(tree_sitter_mib.language())
parser = Parser(language)
tree = parser.parse(open("IF-MIB.txt", "rb").read())

# Every object, notification, group, ... that is assigned an OID
tags = Query(language, tree_sitter_mib.TAGS_QUERY)
for node in QueryCursor(tags).captures(tree.root_node).get("name", []):
    print(node.text.decode())
```

`tree_sitter_mib.HIGHLIGHTS_QUERY` holds the highlighting query.

## Queries

- `queries/highlights.scm`: syntax highlighting. Generic captures come first and
  specific ones later, because later patterns win in both the tree-sitter CLI
  and Neovim.
- `queries/tags.scm`: definitions (`definition.module`, `definition.constant`
  for anything assigned an OID, `definition.type`, `definition.macro`) and
  references, for code navigation.
- `queries/folds.scm`: folding for macro invocations, imports and type bodies.

## Development

The tree-sitter CLI is pinned to an exact version as `tree-sitter-cli` in
`package.json`, and CI and the release workflow install that same version. CI
fails if `src/` differs from what it generates, so use the pinned CLI through
`npx` rather than a globally installed one:

```sh
npm install
npx tree-sitter generate      # regenerate src/ after editing grammar.js
npx tree-sitter test          # corpus, highlight and tag tests
npx tree-sitter parse -q -s path/to/*.mib

# Re-run the real-world corpus check that CI runs
git clone https://github.com/netdisco/netdisco-mibs /tmp/netdisco-mibs
PATH="$PWD/node_modules/.bin:$PATH" scripts/check-corpus.sh /tmp/netdisco-mibs
```

To move to a newer CLI, change the pinned version in `package.json`, run
`npm install` and `npx tree-sitter generate`, and commit the result.

The grammar is in `grammar.js`, the tests are in `test/corpus`,
`test/highlight` and `test/tags`, and `examples/` holds a sample module.

Bindings for C, Node, Python and Rust were generated by `tree-sitter init`.
Everything is configured in `tree-sitter.json`.

## CI and releases

- **CI** (`.github/workflows/ci.yml`) runs on pushes to `main` and on pull
  requests, on Linux, macOS and Windows. It checks that `src/` is up to date,
  runs `tree-sitter test`, tests the Rust, Node and Python bindings, and
  re-parses the netdisco-mibs corpus. It also builds the same Python sdist and
  wheels a release would upload (six platforms, each wheel installed and
  tested), without publishing them.
- **Release** (`.github/workflows/release.yml`) runs when a release is
  published on GitHub (**Releases → Draft a new release**, choose a tag such
  as `v0.2.0`, then **Publish release**). The tag is the version: the package
  manifests in the repository stay at a `0.0.0` placeholder, and each release
  job writes the tag's version into them before building. Nothing needs to be
  bumped or committed beforehand.

  Every release gets a Wasm build and a complete source tarball attached, with
  build-provenance attestations. Publishing to package registries is opt-in
  per registry, and releases marked as a pre-release are never published to
  them. Tags must look like `v1.2.3`.

  | Registry | Turn on | Credentials |
  | --- | --- | --- |
  | PyPI | variable `PUBLISH_PYPI=true` | none: [Trusted Publishing](https://docs.pypi.org/trusted-publishers/) with workflow `release.yml` and environment `pypi` |
  | npm | variable `PUBLISH_NPM=true` | secret `NPM_TOKEN` |
  | crates.io | variable `PUBLISH_CRATES=true` | secret `CARGO_REGISTRY_TOKEN` |

## License

MIT
