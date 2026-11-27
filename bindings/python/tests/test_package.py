"""Checks run against the installed package (also by cibuildwheel on each wheel)."""

from unittest import TestCase

from tree_sitter import Language, Parser, Query, QueryCursor

import tree_sitter_mib

MIB = b"""\
TEST-MIB DEFINITIONS ::= BEGIN
IMPORTS OBJECT-TYPE, Integer32 FROM SNMPv2-SMI;

testCount OBJECT-TYPE
    SYNTAX      Integer32 (0..10)
    MAX-ACCESS  read-only
    STATUS      current
    DESCRIPTION "A counter."
    ::= { testObjects 1 }
END
"""


class TestPackage(TestCase):
    def setUp(self):
        self.language = Language(tree_sitter_mib.language())
        self.tree = Parser(self.language).parse(MIB)

    def test_parses_without_errors(self):
        root = self.tree.root_node
        self.assertFalse(root.has_error)
        module = root.child(0)
        self.assertEqual(module.type, "module_definition")
        self.assertEqual(module.child_by_field_name("name").text, b"TEST-MIB")

    def test_tags_query(self):
        query = Query(self.language, tree_sitter_mib.TAGS_QUERY)
        captures = QueryCursor(query).captures(self.tree.root_node)
        names = {node.text for node in captures["name"]}
        self.assertIn(b"testCount", names)

    def test_highlights_query(self):
        query = Query(self.language, tree_sitter_mib.HIGHLIGHTS_QUERY)
        captures = QueryCursor(query).captures(self.tree.root_node)
        self.assertIn("keyword.type", captures)
