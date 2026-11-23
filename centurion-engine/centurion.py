#!/usr/bin/env python3
"""Centurion v6 static route adapter for DAILY DEOBF.

The supplied Centurion archive's v6.1 route also requires the separate
sandbox-copy-luraph runtime. This adapter keeps v6 static extraction usable
without pretending that the omitted v6.1 runtime is present.
"""
import hashlib
import json
import os
import re
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def read_text(path):
    with open(path, "rb") as stream:
        return stream.read().decode("latin-1")


def find_luau_ast():
    value = os.environ.get("CENT_LUAU_AST")
    if value and os.path.isfile(value):
        return value
    exe = "luau-ast.exe" if os.name == "nt" else "luau-ast"
    candidates = [
        os.path.join(HERE, "..", "luraph-v15-engine", "bin", exe),
        os.path.join(HERE, "..", "luraph-v15.1-engine", "bin", exe),
    ]
    for candidate in candidates:
        if os.path.isfile(candidate):
            return os.path.abspath(candidate)
    raise RuntimeError("The shared Luau AST binary was not found.")


def fingerprint(path):
    source = read_text(path)
    tag_match = re.search(r"Centurion\s*\(?\s*(v[\d.]+)", source, re.IGNORECASE)
    tag = ("Centurion " + tag_match.group(1)) if tag_match else "unknown"

    # Count syntax variants rather than requiring one minified spelling.
    c3_refs = len(re.findall(r"\bc3\s*\[", source))
    func_z = len(re.findall(
        r"(?:=\s*)?function\s*\(\s*Z\s*\)", source
    ))
    returned_table = bool(re.search(
        r"\breturn\s*\(?\s*\{\s*getfenv\s*\(", source, re.IGNORECASE
    ))
    inline_functions = len(re.findall(r"\bfunction\s*\(", source))
    result = {
        "file": os.path.basename(path),
        "bytes": len(source),
        "tag": tag,
        "sha8": hashlib.sha256(source.encode("latin-1")).hexdigest()[:16],
        "h8": len(re.findall(r"\bh8\b", source)),
        "getfenv": len(re.findall(r"\bgetfenv\b", source)),
        "ha_refs": len(re.findall(r"\bHA\s*\[", source)),
        "c3_refs": c3_refs,
        "func_z": func_z,
        "inline_functions": inline_functions,
        "returned_table": returned_table,
        "while_z": len(re.findall(r"\bwhile\s+z\b", source, re.IGNORECASE)),
        "invokeserver": len(re.findall(r"\bInvokeServer\b", source)),
    }

    version = tag_match.group(1).lower() if tag_match else ""
    if version == "v6.1":
        result["route"] = "v6.1-sandbox"
        result["route_reason"] = "The v6.1 version tag is present; its separate sandbox runtime is not bundled."
    elif version in ("v6", "v6.0") and c3_refs > 0:
        result["route"] = "v6-static"
        result["route_reason"] = "The Centurion v6 c3 factory-table layout is present."
    elif version in ("v6", "v6.0") and returned_table and inline_functions > 0:
        result["route"] = "v6-static-return-table"
        result["route_reason"] = "The Centurion v6 tag and returned-table function layout match the alternate v6 sample format."
    elif not version and c3_refs >= 8 and func_z >= 3:
        result["route"] = "v6-static"
        result["route_reason"] = "No version tag was found, but multiple c3 references and Z-parameter factories match the v6 static shape."
    else:
        result["route"] = "unknown"
        result["route_reason"] = "Insufficient Centurion v6 evidence. Checked c3 factories and the alternate returned-table layout."
    return result

def esc_byte(value):
    if value == 34:
        return '\\"'
    if value == 92:
        return "\\\\"
    if value == 10:
        return "\\10"
    if value == 13:
        return "\\13"
    if value == 0:
        return "\\0"
    return chr(value)


def clean_escapes(code):
    """Decode escaped bytes inside quoted strings without touching comments or long strings."""
    out = []
    i = 0
    n = len(code)

    def long_bracket_open(index):
        if index >= n or code[index] != "[":
            return None
        cursor = index + 1
        while cursor < n and code[cursor] == "=":
            cursor += 1
        if cursor < n and code[cursor] == "[":
            level = cursor - index - 1
            return cursor + 1, "]" + ("=" * level) + "]"
        return None

    while i < n:
        ch = code[i]

        # Lua line comments and long comments are copied verbatim.
        if code.startswith("--", i):
            opener = long_bracket_open(i + 2)
            if opener:
                content_start, closing = opener
                close_at = code.find(closing, content_start)
                if close_at < 0:
                    out.append(code[i:])
                    break
                end = close_at + len(closing)
                out.append(code[i:end])
                i = end
                continue

            newline = code.find("\n", i)
            if newline < 0:
                out.append(code[i:])
                break
            out.append(code[i:newline + 1])
            i = newline + 1
            continue

        # Long-bracket strings are not escape-decoded.
        if ch == "[":
            opener = long_bracket_open(i)
            if opener:
                content_start, closing = opener
                close_at = code.find(closing, content_start)
                if close_at < 0:
                    out.append(code[i:])
                    break
                end = close_at + len(closing)
                out.append(code[i:end])
                i = end
                continue

        if ch not in ('"', "'"):
            out.append(ch)
            i += 1
            continue

        quote = ch
        out.append(ch)
        i += 1
        while i < n:
            ch = code[i]
            if ch == quote:
                out.append(ch)
                i += 1
                break
            if ch != "\\":
                out.append(ch)
                i += 1
                continue

            if i + 1 >= n:
                out.append("\\")
                i += 1
                break

            nxt = code[i + 1]
            if nxt in ("x", "X") and i + 3 < n and all(
                c in "0123456789abcdefABCDEF" for c in code[i + 2:i + 4]
            ):
                out.append(esc_byte(int(code[i + 2:i + 4], 16)))
                i += 4
                continue

            if nxt == "u" and i + 2 < n and code[i + 2] == "{":
                end = code.find("}", i + 3)
                if end > 0:
                    try:
                        out.append(chr(int(code[i + 3:end], 16)))
                        i = end + 1
                        continue
                    except (ValueError, OverflowError):
                        pass

            if nxt == "z":
                i += 2
                while i < n and code[i] in " \t\n\r\v\f":
                    i += 1
                continue

            if nxt.isdigit():
                end = i + 1
                while end < n and end < i + 4 and code[end].isdigit():
                    end += 1
                value = int(code[i + 1:end])
                out.append(esc_byte(value % 256))
                i = end
                continue

            # Keep other Lua escapes exactly as written (\\, \n, escaped quotes, etc.).
            out.extend((ch, nxt))
            i += 2

    return "".join(out)


def parse_ast(source):
    ast_tool = find_luau_ast()
    tmp = None
    result = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w", encoding="latin-1", newline="\n",
            prefix="centurion-ast-", suffix=".lua", delete=False,
        ) as stream:
            stream.write(source)
            tmp = stream.name
        result = subprocess.run([ast_tool, tmp], capture_output=True, timeout=120, check=False)
    finally:
        if tmp:
            try:
                os.remove(tmp)
            except OSError:
                pass
    if result is None:
        raise RuntimeError("luau-ast did not run.")
    ast = None
    for encoding in ("utf-8", "utf-16", "latin-1"):
        try:
            ast = json.loads(result.stdout.decode(encoding))
            break
        except Exception:
            continue
    if ast is None:
        detail = result.stderr.decode("utf-8", "replace")[-500:]
        raise RuntimeError("luau-ast did not return valid JSON. " + detail)
    return ast


def ast_span(node):
    location = node.get("location", "") if isinstance(node, dict) else ""
    try:
        start, end = location.split(" - ")
        return int(start.split(",")[1]), int(end.split(",")[1])
    except Exception:
        return None


def harvest_table_spans_ast(source, table_name):
    ast = parse_ast(source)
    spans = []

    def walk(node):
        if isinstance(node, dict):
            if node.get("type") == "AstStatAssign":
                targets = node.get("targets", node.get("vars", []))
                values = node.get("values", [])
                if isinstance(targets, list) and isinstance(values, list):
                    for target, value in zip(targets, values + [None] * len(targets)):
                        if not isinstance(target, dict) or not isinstance(value, dict):
                            continue
                        if target.get("type") != "AstExprIndex":
                            continue
                        expression = target.get("expr")
                        if not isinstance(expression, dict) or expression.get("type") != "AstExprGlobal":
                            continue
                        if expression.get("global") != table_name or value.get("type") != "AstExprFunction":
                            continue
                        span = ast_span(value)
                        if span:
                            index = target.get("index")
                            number = index.get("value") if isinstance(index, dict) else index
                            spans.append((number, span[0], span[1]))
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(ast)
    spans.sort(key=lambda item: item[1])
    return spans


def harvest_return_table_spans_ast(source):
    """Extract function entries from a returned array table across AST schemas."""
    ast = parse_ast(source)
    return_nodes = []

    def collect_returns(node):
        if isinstance(node, dict):
            if node.get("type") == "AstStatReturn":
                return_nodes.append(node)
                return
            for child in node.values():
                collect_returns(child)
        elif isinstance(node, list):
            for child in node:
                collect_returns(child)

    collect_returns(ast)

    def unwrap(node):
        while isinstance(node, dict) and node.get("type") in (
            "AstExprGroup", "AstExprParen", "AstExprTypeAssertion"
        ):
            children = [
                value for key, value in node.items()
                if key not in ("type", "location") and isinstance(value, dict)
            ]
            if not children:
                break
            node = children[0]
        return node

    def find_returned_tables(node):
        """Find table expressions without depending on return-value field names."""
        found = []
        def visit(value):
            if isinstance(value, dict):
                value = unwrap(value)
                if not isinstance(value, dict):
                    return
                if value.get("type") == "AstExprTable":
                    found.append(value)
                    return
                for key, child in value.items():
                    if key not in ("type", "location"):
                        visit(child)
            elif isinstance(value, list):
                for child in value:
                    visit(child)
        visit(node)
        return found

    def direct_table_functions(table):
        """Collect each function value, stopping at it so nested closures aren't entries."""
        functions = []
        def visit(node):
            if isinstance(node, dict):
                if node.get("type") == "AstExprFunction":
                    functions.append(node)
                    return
                for key, child in node.items():
                    if key not in ("type", "location"):
                        visit(child)
            elif isinstance(node, list):
                for child in node:
                    visit(child)
        # Traverse all table payload fields. This supports serializer variants
        # where entries are named items, fields, array, or stored directly.
        for key, child in table.items():
            if key not in ("type", "location"):
                visit(child)
        return functions

    for return_node in return_nodes:
        for table in find_returned_tables(return_node):
            functions = direct_table_functions(table)
            spans = []
            for position, function_node in enumerate(functions, 1):
                span = ast_span(function_node)
                if span:
                    spans.append((position, span[0], span[1]))
            if spans:
                spans.sort(key=lambda item: item[1])
                return spans
    return []

def deobfuscate_v6_static(input_path, output_dir, route="v6-static"):
    source = read_text(input_path)
    if route == "v6-static-return-table":
        spans = harvest_return_table_spans_ast(source)
        table_name = "returned_table"
    else:
        spans = harvest_table_spans_ast(source, "c3")
        table_name = "c3"
    if not spans:
        expected = "direct function entries in the returned table" if table_name == "returned_table" else "c3 factory functions"
        raise RuntimeError("No Centurion v6 " + expected + " were found by the Luau AST parser.")
    header = (
        "--[[ PARTIAL Centurion v6 static extraction: %s\n"
        "   Layout: %s\n"
        "   Extracted %d function bodies and decoded string escapes.\n"
        "   VM boot order and runtime dependencies are not reconstructed.\n"
        "   This is an analysis result, not a complete runnable script. ]]\n\n"
        "local %s = {}\n"
    ) % (os.path.basename(input_path), table_name, len(spans), table_name)
    parts = [header]
    for number, start, end in spans:
        parts.append("-- ===== %s[%s] =====\n%s[%s]=" % (table_name, number, table_name, number) + clean_escapes(source[start:end]))
    output = "\n\n".join(parts)
    output = re.sub(r"\bconst\b", "local", output)
    base = os.path.splitext(os.path.basename(input_path))[0]
    output_path = os.path.join(output_dir, base + "_deobf_stage1.lua")
    index_path = os.path.join(output_dir, base + "_deobf_index.txt")
    with open(output_path, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(output + ("" if output.endswith("\n") else "\n"))
    index = [
        "-- Centurion v6 static index",
        "-- layout: %s" % table_name,
        "-- function bodies extracted: %d" % len(spans),
        "-- InvokeServer calls: %d" % output.count("InvokeServer"),
        "-- FireServer calls: %d" % output.count("FireServer"),
        "-- output is stage-one static extraction, not full reconstruction",
    ]
    with open(index_path, "w", encoding="utf-8", newline="\n") as stream:
        stream.write("\n".join(index) + "\n")
    return {"verdict": "PARTIAL", "factories": len(spans), "layout": table_name, "files": [output_path, index_path]}
def main(argv):
    if len(argv) < 3 or argv[1] not in ("fingerprint", "deobfuscate"):
        print("Usage: centurion.py fingerprint <file> | deobfuscate <file> --out-dir DIR")
        return 2
    command, input_path = argv[1], argv[2]
    if command == "fingerprint":
        print(json.dumps(fingerprint(input_path), indent=1))
        return 0
    output_dir = os.path.dirname(os.path.abspath(input_path))
    if "--out-dir" in argv:
        index = argv.index("--out-dir")
        if index + 1 >= len(argv):
            print("error: --out-dir requires a directory", file=sys.stderr)
            return 2
        output_dir = argv[index + 1]
    os.makedirs(output_dir, exist_ok=True)
    detected = fingerprint(input_path)
    if detected["route"] == "v6.1-sandbox":
        print(json.dumps({
            "verdict": "NEEDS",
            "reason": "Centurion v6.1 requires the sandbox-copy-luraph runtime folder, which was not included in the uploaded archive.",
        }, indent=1))
        return 3
    if detected["route"] not in ("v6-static", "v6-static-return-table"):
        print(json.dumps({
            "verdict": "NEEDS",
            "reason": "unknown family (not Centurion v6/v6.1 shape)",
        }, indent=1))
        return 3
    result = deobfuscate_v6_static(input_path, output_dir, detected["route"])
    print(json.dumps({"fingerprint": detected, **result}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
