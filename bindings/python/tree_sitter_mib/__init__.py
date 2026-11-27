"""SNMP MIB (SMIv1/SMIv2) grammar for tree-sitter"""

from ._binding import language


def _read_query(file):
    from importlib.resources import files
    from pathlib import Path

    # Installed wheels carry the queries inside the package. An editable
    # install (pip install -e .) runs from the source tree, where they live
    # in the repository's top-level queries/ directory.
    candidates = [
        files(__package__) / "queries" / file,
        Path(__file__).resolve().parents[3] / "queries" / file,
    ]
    for candidate in candidates:
        if candidate.is_file():
            return candidate.read_text(encoding="utf-8")
    raise FileNotFoundError(f"{__package__}: query file {file!r} not found")


_QUERIES = {
    "HIGHLIGHTS_QUERY": "highlights.scm",
    "TAGS_QUERY": "tags.scm",
}


def __getattr__(name):
    if name in _QUERIES:
        query = _read_query(_QUERIES[name])
        globals()[name] = query
        return query

    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


__all__ = [
    "language",
    "HIGHLIGHTS_QUERY",
    "TAGS_QUERY",
]


def __dir__():
    return sorted(__all__ + [
        "__all__", "__builtins__", "__cached__", "__doc__", "__file__",
        "__loader__", "__name__", "__package__", "__path__", "__spec__",
    ])
