"""Tree-sitter-backed Luau scope and recovery analysis.

This module deliberately analyzes source structure only. It does not attempt to
execute scripts or synthesize missing bytecode/devirtualized expressions.
"""
from __future__ import annotations

import re
from functools import lru_cache
from typing import Callable

from tree_sitter import Language, Parser
import tree_sitter_luau


WEAK_NAME = re.compile(
    r"^(?:v\d*|u\d+|p\d+|a\d+|r\d+|t\d+|t_\d+|f\d+|fn\d+|tbl\d*|"
    r"arg\d*|Arg\d+|s\d+|S\d+|var_\d+|_l\d+|[A-Z]_\d+|L_\d+|loc\d+|"
    r"PROTO_\d+|STACK\d*|REGISTER\d*|R\d+|n\d*|flag\d*|"
    r"handleEvent\d*|sendRemoteEvent\d*|value\d*|numericValue\d*|"
    r"remoteArgument\d*|eventConnection\d*|isFeatureEnabled\d*|"
    r"UPVALUE_\d+|upvalue_?\d*)$"
)

TYPE_NODES = {
    "type", "builtin_type", "tuple_type", "function_type", "generic_type",
    "object_type", "empty_type", "field_type", "intersection_type",
    "union_type", "optional_type", "literal_type", "variadic_type",
    "object_field_type", "generic_type_list", "type_definition", "attribute",
}

_PARSE_CACHE_SIZE = 4
_ANALYSIS_CACHE: dict[str, dict] = {}


@lru_cache(maxsize=_PARSE_CACHE_SIZE)
def _parse(source: str):
    parser = Parser(Language(tree_sitter_luau.language()))
    return parser.parse(source.encode("utf-8"))


def _byte_to_char_map(source: str) -> list[int]:
    raw = source.encode("utf-8")
    offsets = [0] * (len(raw) + 1)
    byte_pos = char_pos = 0
    for character in source:
        width = len(character.encode("utf-8"))
        for position in range(byte_pos, byte_pos + width):
            offsets[position] = char_pos
        byte_pos += width
        char_pos += 1
        offsets[byte_pos] = char_pos
    return offsets


def _field_children(node, field_name: str) -> list:
    return [
        child for index, child in enumerate(node.children)
        if node.field_name_for_child(index) == field_name
    ]


def _find_descendant(node, node_type: str):
    stack = list(reversed(node.named_children))
    while stack:
        current = stack.pop()
        if current.type == node_type:
            return current
        stack.extend(reversed(current.named_children))
    return None


def _identifier_leaf(node):
    if node is None:
        return None
    if node.type == "identifier":
        return node
    stack = [node]
    while stack:
        current = stack.pop()
        if current.type == "identifier":
            return current
        stack.extend(reversed(current.named_children))
    return None


def _text(node, raw: bytes) -> str:
    if node is None:
        return ""
    return raw[node.start_byte:node.end_byte].decode("utf-8", errors="replace")


def _field_is(node, child, field_name: str) -> bool:
    for index, candidate in enumerate(node.children):
        if candidate.id == child.id:
            return node.field_name_for_child(index) == field_name
    return False


def _inside_type(node) -> bool:
    current = node.parent
    while current is not None:
        if current.type in TYPE_NODES:
            return True
        if current.type in ("block", "chunk", "function_definition", "function_declaration"):
            return False
        current = current.parent
    return False


def _is_reference_identifier(node) -> bool:
    if _inside_type(node):
        return False
    parent = node.parent
    if parent is None or parent.type in ("comment", "comment_content", "label_statement"):
        return False

    if parent.type == "dot_index_expression":
        field_node = parent.child_by_field_name("field")
        if field_node is not None and field_node.id == node.id:
            return False
    if parent.type == "method_index_expression":
        method_node = parent.child_by_field_name("method")
        if method_node is not None and method_node.id == node.id:
            return False
    if parent.type == "field":
        name_node = parent.child_by_field_name("name")
        if name_node is not None and name_node.type == "identifier" and name_node.id == node.id:
            return False

    # Names in local declarations and generic-for headers are declarations.
    if parent.type == "variable_list":
        grandparent = parent.parent
        if grandparent is not None and grandparent.type == "variable_declaration":
            return False
        if grandparent is not None and grandparent.type == "assignment_statement":
            great_grandparent = grandparent.parent
            if great_grandparent is not None and great_grandparent.type == "variable_declaration":
                return False
        if grandparent is not None and grandparent.type == "for_generic_clause":
            return False
    if parent.type == "parameter":
        return False
    if parent.type == "for_numeric_clause" and _field_is(parent, node, "name"):
        return False
    ancestor = parent
    while ancestor is not None and ancestor.type not in ("block", "chunk", "function_definition"):
        if ancestor.type == "function_declaration":
            name_node = ancestor.child_by_field_name("name")
            if name_node is not None and name_node.start_byte <= node.start_byte and node.end_byte <= name_node.end_byte:
                return False
            break
        ancestor = ancestor.parent
    if parent.type == "generic_type_list":
        return False
    if parent.type == "attribute":
        return False
    return True


def _node_features(function_node, raw: bytes) -> dict[str, list[str]]:
    calls: list[str] = []
    members: list[str] = []
    strings: list[str] = []
    controls: list[str] = []
    stack = [function_node]
    while stack:
        node = stack.pop()
        if node is not function_node and node.type in ("function_declaration", "function_definition"):
            continue
        if node.type == "function_call":
            calls.append(_text(node.child_by_field_name("name"), raw))
        elif node.type == "dot_index_expression":
            members.append(_text(node.child_by_field_name("field"), raw))
        elif node.type == "method_index_expression":
            members.append(_text(node.child_by_field_name("method"), raw))
        elif node.type == "string":
            strings.append(_text(node, raw))
        elif node.type in ("if_statement", "for_statement", "while_statement", "repeat_statement"):
            controls.append(node.type)
        stack.extend(reversed(node.named_children))
    return {"calls": calls, "members": members, "strings": strings, "control": controls}


def build_ast_bindings(source: str, all_tokens: list, binding_type, scope_type, function_context: Callable):
    """Return scope-aware bindings from a partial or complete Luau syntax tree."""
    tree = _parse(source)
    if tree is None or tree.root_node is None or tree.root_node.type != "chunk":
        return None

    raw = source.encode("utf-8")
    byte_map = _byte_to_char_map(source)
    tokens = [token for token in all_tokens if token.kind != "comment"]
    token_by_start = {token.start: index for index, token in enumerate(tokens)}
    root = scope_type(None, 0, len(source) + 1, label="root")
    scopes = [root]
    bindings = []
    declarations = {}
    references = []

    def char_pos(byte_pos: int) -> int:
        return byte_map[max(0, min(byte_pos, len(byte_map) - 1))]

    def token_index(node) -> int | None:
        start = char_pos(node.start_byte)
        exact = token_by_start.get(start)
        if exact is not None:
            return exact
        for index, token in enumerate(tokens):
            if token.start <= start < token.end:
                return index
        return None

    def make_scope(parent, node, label: str):
        scope = scope_type(parent, char_pos(node.start_byte), char_pos(node.end_byte), label=label)
        scopes.append(scope)
        return scope

    def add_binding(name_node, scope, role: str, active_from: int, function_node=None):
        identifier = _identifier_leaf(name_node)
        if identifier is None:
            return None
        index = token_index(identifier)
        if index is None:
            return None
        binding = binding_type(_text(identifier, raw), index, scope, active_from, role=role)
        scope.bindings.append(binding)
        bindings.append(binding)
        declarations[index] = binding
        if function_node is not None:
            body = function_node.child_by_field_name("body")
            binding.function_body = _text(body, raw)
            binding.ast_features = _node_features(function_node, raw)
            function_index = token_index(function_node)
            binding.function_context = function_context(tokens, function_index) if function_index is not None else ""
        return binding

    def add_variable_list(variable_list, scope, active_from: int, role: str):
        for name in _field_children(variable_list, "name"):
            add_binding(name, scope, role, active_from)

    def visit_block_contents(block, scope):
        if block is not None:
            for child in block.named_children:
                visit(child, scope)

    def visit_function(node, scope):
        node_index = token_index(node)
        function_index = node_index
        local_function = False
        if node.type in ("function_declaration", "function_definition") and node_index is not None:
            if tokens[node_index].value == "local":
                local_function = (
                    node_index + 1 < len(tokens)
                    and tokens[node_index + 1].value == "function"
                )
                if local_function:
                    function_index = node_index + 1
            elif tokens[node_index].value == "function":
                local_function = (
                    node_index > 0 and tokens[node_index - 1].value == "local"
                )

        name_node = node.child_by_field_name("name")
        if local_function and name_node is not None:
            add_binding(name_node, scope, "local", char_pos(name_node.start_byte), node)
        elif name_node is not None:
            visit(name_node, scope)

        name = _text(name_node, raw) or "anonymous"
        function_scope = make_scope(scope, node, "function:" + name)
        body = node.child_by_field_name("body")
        parameters = node.child_by_field_name("parameters")
        active_from = char_pos(body.start_byte) if body is not None else char_pos(node.end_byte)
        function_scope.start = active_from
        if parameters is not None:
            for parameter in parameters.named_children:
                if parameter.type != "parameter":
                    continue
                parameter_name = next(
                    (child for child in parameter.named_children if child.type == "identifier"),
                    None,
                )
                if parameter_name is not None:
                    add_binding(parameter_name, function_scope, "parameter", active_from)

        function_scope.function_token = function_index
        function_end_char = char_pos(node.end_byte)
        function_scope.function_end = max(
            (index for index, token in enumerate(tokens) if token.end <= function_end_char),
            default=function_index or 0,
        )
        function_scope.function_context = function_context(tokens, function_index) if function_index is not None else ""
        visit_block_contents(body, function_scope)

    def visit_for(node, scope):
        clause = node.child_by_field_name("clause")
        body = node.child_by_field_name("body")
        loop_scope = make_scope(scope, node, "for-loop")
        active_from = char_pos(body.start_byte) if body is not None else char_pos(node.end_byte)
        if clause is not None and clause.type == "for_generic_clause":
            variables = _find_descendant(clause, "variable_list")
            if variables is not None:
                add_variable_list(variables, loop_scope, active_from, "loop")
            for child in clause.named_children:
                if child.id != variables.id:
                    visit(child, scope)
        elif clause is not None and clause.type == "for_numeric_clause":
            name_node = clause.child_by_field_name("name")
            if name_node is not None:
                add_binding(name_node, loop_scope, "loop", active_from)
            for field_name in ("start", "end", "step"):
                expression = clause.child_by_field_name(field_name)
                if expression is not None:
                    visit(expression, scope)
        visit_block_contents(body, loop_scope)

    def visit_repeat(node, scope):
        repeat_scope = make_scope(scope, node, "repeat-loop")
        body = node.child_by_field_name("body")
        condition = node.child_by_field_name("condition")
        visit_block_contents(body, repeat_scope)
        if condition is not None:
            visit(condition, repeat_scope)

    def visit(node, scope):
        node_type = node.type
        if node_type in TYPE_NODES:
            return
        if node_type == "chunk":
            for child in node.named_children:
                visit(child, scope)
            return
        if node_type == "block":
            block_scope = make_scope(scope, node, "block")
            visit_block_contents(node, block_scope)
            return
        if node_type in ("function_declaration", "function_definition"):
            visit_function(node, scope)
            return
        if node_type == "variable_declaration":
            variable_list = _find_descendant(node, "variable_list")
            local_bindings = []
            if variable_list is not None:
                for name_node in _field_children(variable_list, "name"):
                    binding = add_binding(name_node, scope, "local", char_pos(node.end_byte))
                    if binding is not None:
                        local_bindings.append(binding)

            # A local assigned directly to an anonymous function gets that function's
            # AST facts, so semantic naming can describe the helper on later passes.
            assignment = _find_descendant(node, "assignment_statement")
            expression_list = _find_descendant(assignment, "expression_list") if assignment is not None else None
            if expression_list is not None:
                values = list(expression_list.named_children)
                for binding, value in zip(local_bindings, values):
                    if value.type == "function_definition":
                        body = value.child_by_field_name("body")
                        binding.function_body = _text(body, raw)
                        binding.ast_features = _node_features(value, raw)
                        function_index = token_index(value)
                        binding.function_context = function_context(tokens, function_index) if function_index is not None else ""

            for child in node.named_children:
                if child.id != variable_list.id:
                    visit(child, scope)
            return
        if node_type == "for_statement":
            visit_for(node, scope)
            return
        if node_type == "repeat_statement":
            visit_repeat(node, scope)
            return
        if node_type == "identifier":
            if _is_reference_identifier(node):
                references.append((char_pos(node.start_byte), scope))
            return
        for child in node.named_children:
            visit(child, scope)

    visit(tree.root_node, root)

    token_scopes = {}
    for index, token in enumerate(tokens):
        selected = root
        selected_span = root.end - root.start
        for scope in scopes[1:]:
            if scope.start <= token.start < scope.end:
                span = scope.end - scope.start
                if span <= selected_span:
                    selected = scope
                    selected_span = span
        token_scopes[index] = selected

    free_function_refs: dict[str, list[dict]] = {}
    for position, scope in references:
        index = token_by_start.get(position)
        if index is None:
            continue
        name = tokens[index].value
        current = scope
        resolved = None
        while current is not None:
            for candidate in reversed(current.bindings):
                if candidate.name == name and position >= candidate.active_from:
                    resolved = candidate
                    break
            if resolved is not None:
                break
            current = current.parent
        if resolved is not None:
            resolved.refs.append(index)
        elif WEAK_NAME.fullmatch(name):
            function_scope = scope
            while function_scope is not None and not function_scope.label.startswith("function:"):
                function_scope = function_scope.parent
            if function_scope is not None:
                function_name = function_scope.label.split(":", 1)[1]
                free_function_refs.setdefault(name, []).append({
                    "line": tokens[index].line,
                    "function": function_name,
                })

    syntax_nodes = []
    stack = [tree.root_node]
    while stack:
        node = stack.pop()
        if node.type == "ERROR" or node.is_missing:
            syntax_nodes.append(node)
        stack.extend(reversed(node.children))

    partial_functions = []
    function_nodes = []
    stack = [tree.root_node]
    while stack:
        node = stack.pop()
        if node.type in ("function_declaration", "function_definition"):
            function_nodes.append(node)
        stack.extend(reversed(node.named_children))

    syntax_error_details = []
    for error_node in syntax_nodes:
        start = error_node.start_byte
        end = max(start + 1, error_node.end_byte)
        excerpt = raw[start:min(len(raw), end + 60)].decode("utf-8", errors="replace")
        detail = {
            "node_type": error_node.type,
            "line": error_node.start_point.row + 1,
            "excerpt": excerpt[:180],
        }
        syntax_error_details.append(detail)

    diagnostics = []
    if syntax_nodes:
        diagnostics.append(
            f"Tree-sitter recovered a partial Luau AST with {len(syntax_nodes)} syntax-error node(s)."
        )
        for detail in syntax_error_details:
            diagnostics.append(
                f"AST syntax {detail['node_type']} at line {detail['line']}: {detail['excerpt']}"
            )
    for node in function_nodes:
        body = node.child_by_field_name("body")
        start = body.start_byte if body is not None else node.start_byte
        end = body.end_byte if body is not None else node.end_byte
        affected = [error for error in syntax_nodes if start <= error.start_byte <= end or start <= error.end_byte <= end]
        if affected:
            name_node = node.child_by_field_name("name")
            name = _text(name_node, raw) or "anonymous function"
            line = affected[0].start_point.row + 1
            partial_functions.append({"name": name, "line": line})
            diagnostics.append(f"Partially recovered function {name!r}; syntax error near line {line}.")

    devirtualization_markers = [
        {"line": line_number, "text": line.strip()}
        for line_number, line in enumerate(source.splitlines(), start=1)
        if re.search(r"\bdevirt\s*:", line, re.IGNORECASE)
    ]
    metadata = {
        "ast_backend": "tree-sitter-luau",
        "ast_syntax_errors": len(syntax_nodes),
        "syntax_error_nodes": syntax_error_details,
        "partial_functions": partial_functions,
        "devirtualization_markers": devirtualization_markers,
        "possible_missing_upvalues": [
            {
                "name": name,
                "occurrences": len(items),
                "lines": sorted({item["line"] for item in items}),
                "functions": sorted({item["function"] for item in items}),
                "classification": "possible missing upvalue or external global",
            }
            for name, items in sorted(free_function_refs.items())
        ],
        "scope_count": len(scopes),
    }
    _ANALYSIS_CACHE[source] = metadata
    if len(_ANALYSIS_CACHE) > _PARSE_CACHE_SIZE:
        _ANALYSIS_CACHE.pop(next(iter(_ANALYSIS_CACHE)))
    return tokens, bindings, declarations, token_scopes, diagnostics


def get_ast_report(source: str) -> dict:
    """Return metadata from the most recent AST binding pass for this input."""
    return _ANALYSIS_CACHE.get(source, {
        "ast_backend": "lexical-fallback",
        "ast_syntax_errors": None,
        "syntax_error_nodes": [],
        "partial_functions": [],
        "possible_missing_upvalues": [],
        "devirtualization_markers": [],
        "scope_count": 0,
    })
