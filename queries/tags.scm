; Module

(module_definition
  name: (module_reference) @name) @definition.module

; Registered objects (anything that is assigned an OID)

(object_identifier_assignment name: (identifier) @name) @definition.constant
(module_identity name: (identifier) @name) @definition.constant
(object_identity name: (identifier) @name) @definition.constant
(object_type name: (identifier) @name) @definition.constant
(notification_type name: (identifier) @name) @definition.constant
(trap_type name: (identifier) @name) @definition.constant
(object_group name: (identifier) @name) @definition.constant
(notification_group name: (identifier) @name) @definition.constant
(module_compliance name: (identifier) @name) @definition.constant
(agent_capabilities name: (identifier) @name) @definition.constant
(value_assignment name: (identifier) @name) @definition.constant

; Types

(type_assignment name: (type_reference) @name) @definition.type
(textual_convention name: (type_reference) @name) @definition.type
(macro_definition name: (_) @name) @definition.macro

; References

(object_identifier_value . (identifier) @name) @reference.constant
(object_list (identifier) @name) @reference.constant
(defined_type name: (type_reference) @name) @reference.type
(import_group module: (module_reference) @name) @reference.module
