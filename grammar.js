/**
 * @file Tree-sitter grammar for SNMP MIB modules (SMIv1 and SMIv2)
 * @author Eric Brown
 * @license MIT
 *
 * Covers the ASN.1 subset used by the Structure of Management Information:
 *   - SMIv1: RFC 1155 (SMI), RFC 1212 (OBJECT-TYPE), RFC 1215 (TRAP-TYPE)
 *   - SMIv2: RFC 2578 (SMI), RFC 2579 (TEXTUAL-CONVENTION), RFC 2580 (conformance)
 *   - ASN.1 MACRO definitions found in the SMI base modules (parsed as a token stream)
 *
 * Clauses inside each macro invocation are accepted in any order. The RFCs fix
 * the order, but real-world MIBs often get it wrong and a highlighter or
 * outline tool is more useful when it keeps going. Validation is left to tools
 * such as smilint.
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

const commaSep1 = (rule) => seq(rule, repeat(seq(',', rule)));
// Vendor MIBs frequently drop the comma between list items or leave a
// trailing one before the closing brace; accept both.
const looseList1 = (rule) => seq(rule, repeat(seq(optional(','), rule)), optional(','));
const commaSepTrailing = (rule) => optional(looseList1(rule));
const braced = (rule) => seq('{', rule, '}');

// Macro names that may appear in IMPORTS / EXPORTS lists.
const MACRO_NAMES = [
  'OBJECT-TYPE',
  'MODULE-IDENTITY',
  'OBJECT-IDENTITY',
  'NOTIFICATION-TYPE',
  'TEXTUAL-CONVENTION',
  'OBJECT-GROUP',
  'NOTIFICATION-GROUP',
  'MODULE-COMPLIANCE',
  'AGENT-CAPABILITIES',
  'TRAP-TYPE',
];

module.exports = grammar({
  name: 'mib',

  extras: ($) => [/\s/, $.comment],

  rules: {
    source_file: ($) => repeat($.module_definition),

    // ------------------------------------------------------------------
    // Module structure
    // ------------------------------------------------------------------

    module_definition: ($) =>
      seq(
        field('name', $.module_reference),
        optional(field('oid', $.object_identifier_value)),
        'DEFINITIONS',
        optional($.tag_default),
        '::=',
        'BEGIN',
        optional($.exports),
        optional($.imports),
        repeat($._assignment),
        'END',
      ),

    module_reference: ($) => $.type_reference,

    tag_default: (_) => seq(choice('IMPLICIT', 'EXPLICIT', 'AUTOMATIC'), 'TAGS'),

    exports: ($) => seq('EXPORTS', commaSepTrailing($._symbol), ';'),

    imports: ($) => seq('IMPORTS', repeat($.import_group), ';'),

    import_group: ($) =>
      seq(
        field('symbols', $.symbol_list),
        'FROM',
        field('module', $.module_reference),
        optional(field('oid', $.object_identifier_value)),
      ),

    symbol_list: ($) => looseList1($._symbol),

    _symbol: ($) => choice($.identifier, $.type_reference, $.macro_name),

    macro_name: (_) => choice(...MACRO_NAMES),

    // ------------------------------------------------------------------
    // Assignments
    // ------------------------------------------------------------------

    _assignment: ($) =>
      choice(
        $.object_identifier_assignment,
        $.value_assignment,
        $.type_assignment,
        $.textual_convention,
        $.module_identity,
        $.object_identity,
        $.object_type,
        $.notification_type,
        $.trap_type,
        $.object_group,
        $.notification_group,
        $.module_compliance,
        $.agent_capabilities,
        $.macro_definition,
      ),

    // internet OBJECT IDENTIFIER ::= { iso org(3) dod(6) 1 }
    object_identifier_assignment: ($) =>
      seq(
        field('name', $._value_reference),
        'OBJECT',
        'IDENTIFIER',
        '::=',
        field('value', $.object_identifier_value),
      ),

    // zeroDotZero INTEGER ::= 0  (rare, but legal ASN.1)
    value_assignment: ($) =>
      seq(
        field('name', $._value_reference),
        field('type', choice($.integer_type, $.octet_string_type, $.type_reference)),
        '::=',
        field('value', $._simple_value),
      ),

    // DisplayString ::= OCTET STRING (SIZE (0..255))
    type_assignment: ($) =>
      seq(field('name', $._type_name), '::=', field('type', $._type)),

    // Type names should start upper-case; some vendor MIBs write
    // "fooEntry ::= SEQUENCE { ... }". Accept it as a type reference.
    _type_name: ($) => choice($.type_reference, alias($.identifier, $.type_reference)),

    // DisplayString ::= TEXTUAL-CONVENTION DISPLAY-HINT "255a" ...
    textual_convention: ($) =>
      seq(
        field('name', $._type_name),
        '::=',
        'TEXTUAL-CONVENTION',
        repeat(
          choice(
            $.display_hint_clause,
            $.status_clause,
            $.description_clause,
            $.reference_clause,
            $.syntax_clause,
          ),
        ),
      ),

    module_identity: ($) =>
      seq(
        field('name', $._value_reference),
        'MODULE-IDENTITY',
        repeat(
          choice(
            $.last_updated_clause,
            $.organization_clause,
            $.contact_info_clause,
            $.description_clause,
            $.revision_clause,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    object_identity: ($) =>
      seq(
        field('name', $._value_reference),
        'OBJECT-IDENTITY',
        repeat(choice($.status_clause, $.description_clause, $.reference_clause)),
        '::=',
        field('value', $.object_identifier_value),
      ),

    object_type: ($) =>
      seq(
        field('name', $._value_reference),
        'OBJECT-TYPE',
        repeat(
          choice(
            $.syntax_clause,
            $.units_clause,
            $.access_clause,
            $.status_clause,
            $.description_clause,
            $.reference_clause,
            $.index_clause,
            $.augments_clause,
            $.defval_clause,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    notification_type: ($) =>
      seq(
        field('name', $._value_reference),
        'NOTIFICATION-TYPE',
        repeat(
          choice(
            $.objects_clause,
            $.status_clause,
            $.description_clause,
            $.reference_clause,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    // SMIv1 (RFC 1215): the value is the specific trap number.
    trap_type: ($) =>
      seq(
        field('name', $._value_reference),
        'TRAP-TYPE',
        repeat(
          choice(
            $.enterprise_clause,
            $.variables_clause,
            $.description_clause,
            $.reference_clause,
          ),
        ),
        '::=',
        field('value', $.number),
      ),

    object_group: ($) =>
      seq(
        field('name', $._value_reference),
        'OBJECT-GROUP',
        repeat(
          choice(
            $.objects_clause,
            $.status_clause,
            $.description_clause,
            $.reference_clause,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    notification_group: ($) =>
      seq(
        field('name', $._value_reference),
        'NOTIFICATION-GROUP',
        repeat(
          choice(
            $.notifications_clause,
            $.status_clause,
            $.description_clause,
            $.reference_clause,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    module_compliance: ($) =>
      seq(
        field('name', $._value_reference),
        'MODULE-COMPLIANCE',
        repeat(
          choice(
            $.status_clause,
            $.description_clause,
            $.reference_clause,
            $.compliance_module,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    agent_capabilities: ($) =>
      seq(
        field('name', $._value_reference),
        'AGENT-CAPABILITIES',
        repeat(
          choice(
            $.product_release_clause,
            $.status_clause,
            $.description_clause,
            $.reference_clause,
            $.supports_module,
          ),
        ),
        '::=',
        field('value', $.object_identifier_value),
      ),

    // OBJECT-TYPE MACRO ::= BEGIN ... END
    // The body is ASN.1 macro notation; it is kept as a flat token stream.
    macro_definition: ($) =>
      seq(
        field('name', choice($.macro_name, $.type_reference)),
        'MACRO',
        '::=',
        'BEGIN',
        optional(field('body', $.macro_body)),
        'END',
      ),

    macro_body: ($) =>
      repeat1(
        choice(
          $.type_reference,
          $.identifier,
          $.string,
          $.number,
          $.negative_number,
          $.hex_string,
          $.binary_string,
          '::=',
          '|',
          '(',
          ')',
          '{',
          '}',
          '[',
          ']',
          '<',
          '>',
          ',',
          '.',
          '..',
          ';',
        ),
      ),

    // ------------------------------------------------------------------
    // Clauses
    // ------------------------------------------------------------------

    syntax_clause: ($) => seq('SYNTAX', field('type', $._syntax_type)),
    write_syntax_clause: ($) => seq('WRITE-SYNTAX', field('type', $._type)),

    units_clause: ($) => seq('UNITS', field('value', $.string)),

    access_clause: ($) =>
      seq(
        field('keyword', choice('ACCESS', 'MAX-ACCESS', 'MIN-ACCESS')),
        field('value', $.access),
      ),

    access: (_) =>
      choice(
        'read-only',
        'read-write',
        'read-create',
        'write-only',
        'not-accessible',
        'accessible-for-notify',
        'not-implemented',
      ),

    status_clause: ($) => seq('STATUS', field('value', $.status)),

    status: (_) => choice('current', 'deprecated', 'obsolete', 'mandatory', 'optional'),

    description_clause: ($) => seq('DESCRIPTION', field('value', $.string)),
    reference_clause: ($) => seq('REFERENCE', field('value', $.string)),
    display_hint_clause: ($) => seq('DISPLAY-HINT', field('value', $.string)),
    last_updated_clause: ($) => seq('LAST-UPDATED', field('value', $.string)),
    organization_clause: ($) => seq('ORGANIZATION', field('value', $.string)),
    contact_info_clause: ($) => seq('CONTACT-INFO', field('value', $.string)),
    product_release_clause: ($) => seq('PRODUCT-RELEASE', field('value', $.string)),

    revision_clause: ($) =>
      seq(
        'REVISION',
        field('date', $.string),
        'DESCRIPTION',
        field('description', $.string),
      ),

    index_clause: ($) => seq('INDEX', braced(commaSepTrailing($.index_item))),

    index_item: ($) =>
      seq(
        optional('IMPLIED'),
        // RFC 1212 also allows a type here instead of an object name;
        // an upper-case name such as NetworkAddress parses as a reference.
        choice(
          $._value_reference,
          $.integer_type,
          $.octet_string_type,
          $.object_identifier_type,
        ),
      ),

    augments_clause: ($) => seq('AUGMENTS', braced(commaSepTrailing($._value_reference))),

    defval_clause: ($) => seq('DEFVAL', braced(field('value', $._defval_value))),

    _defval_value: ($) => choice($._simple_value, $.braced_value),

    // A BITS set "{ flagA, flagB }", the empty set "{ }", or an OID "{ 0 0 }".
    // These cannot be told apart syntactically, so they share one node.
    braced_value: ($) => braced(repeat(choice($._oid_component, ','))),

    objects_clause: ($) => seq('OBJECTS', $.object_list),
    notifications_clause: ($) => seq('NOTIFICATIONS', $.object_list),
    variables_clause: ($) => seq('VARIABLES', $.object_list),
    object_list: ($) => braced(commaSepTrailing($._value_reference)),

    enterprise_clause: ($) =>
      seq('ENTERPRISE', field('value', choice($._value_reference, $.object_identifier_value))),

    // MODULE-COMPLIANCE ------------------------------------------------

    compliance_module: ($) =>
      prec.right(
        seq(
          'MODULE',
          optional(
            seq(
              field('module', $.module_reference),
              optional(field('oid', $.object_identifier_value)),
            ),
          ),
          repeat(
            choice($.mandatory_groups_clause, $.compliance_group, $.compliance_object),
          ),
        ),
      ),

    mandatory_groups_clause: ($) => seq('MANDATORY-GROUPS', $.object_list),

    compliance_group: ($) =>
      seq('GROUP', field('name', $._value_reference), $.description_clause),

    compliance_object: ($) =>
      seq(
        'OBJECT',
        field('name', $._value_reference),
        repeat(choice($.syntax_clause, $.write_syntax_clause, $.access_clause)),
        $.description_clause,
      ),

    // AGENT-CAPABILITIES -----------------------------------------------

    supports_module: ($) =>
      prec.right(
        seq(
          'SUPPORTS',
          field('module', $.module_reference),
          optional(field('oid', $.object_identifier_value)),
          'INCLUDES',
          $.object_list,
          repeat($.variation),
        ),
      ),

    variation: ($) =>
      seq(
        'VARIATION',
        field('name', $._value_reference),
        repeat(
          choice(
            $.syntax_clause,
            $.write_syntax_clause,
            $.access_clause,
            $.creation_requires_clause,
            $.defval_clause,
          ),
        ),
        $.description_clause,
      ),

    creation_requires_clause: ($) => seq('CREATION-REQUIRES', $.object_list),

    // ------------------------------------------------------------------
    // Types
    // ------------------------------------------------------------------

    _type: ($) =>
      choice(
        $.integer_type,
        $.octet_string_type,
        $.object_identifier_type,
        $.bits_type,
        $.null_type,
        $.sequence_type,
        $.sequence_of_type,
        $.choice_type,
        $.tagged_type,
        $.defined_type,
      ),

    integer_type: ($) =>
      prec.right(
        seq(
          'INTEGER',
          optional(choice($.named_number_list, $.constraint)),
        ),
      ),

    octet_string_type: ($) =>
      prec.right(seq('OCTET', 'STRING', optional($.constraint))),

    object_identifier_type: (_) => seq('OBJECT', 'IDENTIFIER'),

    bits_type: ($) => prec.right(seq('BITS', optional($.named_number_list))),

    null_type: (_) => 'NULL',

    // Integer32 (1..10), DisplayString (SIZE (0..32)), Foo { a(1), b(2) }
    defined_type: ($) =>
      prec.right(
        seq(
          optional(seq(field('module', $.module_reference), '.')),
          field('name', $.type_reference),
          optional(choice($.named_number_list, $.constraint)),
        ),
      ),

    sequence_type: ($) => seq('SEQUENCE', braced(commaSepTrailing($.named_type))),

    sequence_of_type: ($) => seq('SEQUENCE', 'OF', field('type', $._syntax_type)),

    // Some vendor MIBs name the row type with a lower-case initial
    // ("SEQUENCE OF fooEntry"); accept it where a type is unambiguous.
    _syntax_type: ($) => choice($._type, alias($._lowercase_type, $.defined_type)),

    _lowercase_type: ($) => field('name', alias($.identifier, $.type_reference)),

    choice_type: ($) => seq('CHOICE', braced(commaSepTrailing($.named_type))),

    named_type: ($) => seq(field('name', $._value_reference), field('type', $._type)),

    // [APPLICATION 0] IMPLICIT OCTET STRING (SIZE (4))
    tagged_type: ($) =>
      seq($.tag, optional(choice('IMPLICIT', 'EXPLICIT')), field('type', $._type)),

    tag: ($) =>
      seq(
        '[',
        optional(field('class', choice('APPLICATION', 'UNIVERSAL', 'PRIVATE'))),
        field('number', $.number),
        ']',
      ),

    named_number_list: ($) => braced(commaSepTrailing($.named_number)),

    named_number: ($) =>
      seq(
        // Some vendor MIBs use upper-case enumeration labels.
        // Labels such as "10mbitHalfDuplex" are invalid ASN.1 but common.
        field('name', choice($._value_reference, alias($._numeric_label, $.identifier))),
        '(',
        field('value', choice($.number, $.negative_number)),
        ')',
      ),

    constraint: ($) => seq('(', choice($.size_constraint, $.value_range_list), ')'),

    size_constraint: ($) => seq('SIZE', '(', $.value_range_list, ')'),

    value_range_list: ($) => seq($.value_range, repeat(seq('|', $.value_range))),

    value_range: ($) =>
      seq(
        field('lower', $._range_value),
        optional(seq('..', field('upper', $._range_value))),
      ),

    _range_value: ($) =>
      choice(
        $.number,
        $.negative_number,
        $.hex_string,
        $.binary_string,
        'MIN',
        'MAX',
        $._value_reference,
      ),

    // ------------------------------------------------------------------
    // Values
    // ------------------------------------------------------------------

    _simple_value: ($) =>
      choice(
        $.number,
        $.negative_number,
        $.string,
        $.hex_string,
        $.binary_string,
        $._value_reference,
      ),

    // { iso org(3) dod(6) 1 }  /  { mib-2 1 }  /  { 0 0 }
    object_identifier_value: ($) => braced(repeat($._oid_component)),

    _oid_component: ($) => choice($._value_reference, $.number, $.named_number),

    // A value reference should start with a lower-case letter, but plenty of
    // vendor MIBs name objects "TrafficShield4100" or use TRUE/FALSE labels.
    // Those are accepted and surfaced as ordinary identifiers.
    _value_reference: ($) => choice($.identifier, alias($.type_reference, $.identifier)),

    // ------------------------------------------------------------------
    // Lexical
    // ------------------------------------------------------------------

    // ASN.1 value reference (lower-case initial) and type reference
    // (upper-case initial). Hyphens are allowed but not doubled or trailing.
    identifier: (_) => /[a-z][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*/,
    type_reference: (_) => /[A-Z][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*/,

    _numeric_label: (_) => /[0-9]+[A-Za-z][A-Za-z0-9_]*(-[A-Za-z0-9_]+)*/,

    number: (_) => /[0-9]+/,
    negative_number: (_) => /-[0-9]+/,

    // ASN.1 doubles a quote to escape it: "a ""quoted"" word"
    string: (_) => /"([^"]|"")*"/,

    hex_string: (_) => /'[0-9A-Fa-f\s]*'[hH]/,
    binary_string: (_) => /'[01\s]*'[bB]/,

    // ASN.1 comments start with "--" and end at "--" or the end of the
    // line. MIBs routinely draw rules of dashes ("-------"), so a comment is
    // treated as running to the end of the line, which is what net-snmp and
    // most MIB browsers do in practice.
    comment: (_) => token(seq('--', /[^\n]*/)),
  },
});
