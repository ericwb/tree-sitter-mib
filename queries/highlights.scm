; Highlights are applied so that later patterns override earlier ones for the
; same node (tree-sitter CLI and Neovim both behave this way), so the generic
; fallbacks come first and the more specific patterns follow.

; Any value reference (OID components, object lists, DEFVAL, ...)
(identifier) @variable

(type_reference) @type

; Comments and literals ----------------------------------------------------

(comment) @comment @spell

(string) @string

[
  (hex_string)
  (binary_string)
] @string.special

[
  (number)
  (negative_number)
] @number

; Keywords -----------------------------------------------------------------

[
  "DEFINITIONS"
  "BEGIN"
  "END"
  "MACRO"
  "TAGS"
  "AUTOMATIC"
] @keyword

[
  "IMPORTS"
  "EXPORTS"
  "FROM"
] @keyword.import

; Macro invocations (OBJECT-TYPE, MODULE-IDENTITY, ...) and their names when
; they appear in IMPORTS/EXPORTS lists.
[
  "OBJECT-TYPE"
  "MODULE-IDENTITY"
  "OBJECT-IDENTITY"
  "NOTIFICATION-TYPE"
  "TEXTUAL-CONVENTION"
  "OBJECT-GROUP"
  "NOTIFICATION-GROUP"
  "MODULE-COMPLIANCE"
  "AGENT-CAPABILITIES"
  "TRAP-TYPE"
] @keyword.type

(macro_name) @keyword.type

; Clause keywords
[
  "SYNTAX"
  "WRITE-SYNTAX"
  "UNITS"
  "ACCESS"
  "MAX-ACCESS"
  "MIN-ACCESS"
  "STATUS"
  "DESCRIPTION"
  "REFERENCE"
  "INDEX"
  "IMPLIED"
  "AUGMENTS"
  "DEFVAL"
  "DISPLAY-HINT"
  "LAST-UPDATED"
  "ORGANIZATION"
  "CONTACT-INFO"
  "REVISION"
  "OBJECTS"
  "NOTIFICATIONS"
  "ENTERPRISE"
  "VARIABLES"
  "MODULE"
  "MANDATORY-GROUPS"
  "GROUP"
  "PRODUCT-RELEASE"
  "SUPPORTS"
  "INCLUDES"
  "VARIATION"
  "CREATION-REQUIRES"
] @keyword

[
  "SIZE"
  "OF"
  "IMPLICIT"
  "EXPLICIT"
  "APPLICATION"
  "UNIVERSAL"
  "PRIVATE"
  "MIN"
  "MAX"
] @keyword.modifier

; Clause values such as read-only, current, mandatory
(access) @constant.builtin
(status) @constant.builtin

; Types --------------------------------------------------------------------

[
  "INTEGER"
  "OCTET"
  "STRING"
  "BITS"
  (null_type)
  "SEQUENCE"
  "CHOICE"
] @type.builtin

(object_identifier_type) @type.builtin

(defined_type
  name: (type_reference) @type)

(type_assignment
  name: (type_reference) @type.definition)

(textual_convention
  name: (type_reference) @type.definition)

(macro_definition
  name: (_) @type.definition)

(tag
  number: (number) @number)

; Modules ------------------------------------------------------------------

(module_reference
  (type_reference) @module)

; Definitions --------------------------------------------------------------

(object_identifier_assignment
  name: (identifier) @constant)

(value_assignment
  name: (identifier) @constant)

[
  (module_identity name: (identifier) @function)
  (object_identity name: (identifier) @function)
  (object_type name: (identifier) @function)
  (notification_type name: (identifier) @function)
  (trap_type name: (identifier) @function)
  (object_group name: (identifier) @function)
  (notification_group name: (identifier) @function)
  (module_compliance name: (identifier) @function)
  (agent_capabilities name: (identifier) @function)
]

; Fields of a SEQUENCE / CHOICE
(named_type
  name: (identifier) @property)

; Enumeration and BITS labels
(named_number
  name: (identifier) @constant)

; Punctuation --------------------------------------------------------------

[
  "::="
  "|"
  ".."
] @operator

[
  "{"
  "}"
  "("
  ")"
  "["
  "]"
] @punctuation.bracket

[
  ","
  ";"
  "."
] @punctuation.delimiter
