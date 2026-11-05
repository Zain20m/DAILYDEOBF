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
    match = re.search(r"Centurion (v[\d.]+)", source)
    result = {
        "file": os.path.basename(path),
        "bytes": len(source),
        "tag": match.group(0) if match else "unknown",
        "sha8": hashlib.sha256(source.encode("latin-1")).hexdigest()[:16],
        "h8": source.count("h8"),
        "getfenv": source.count("getfenv"),
        "ha_refs": len(re.findall(r"HA\[", source)),
        "c3_refs": len(re.findall(r"c3\[", source)),
        "func_z": len(re.findall(r"=function\(Z\)", source)),
        "while_z": len(re.findall(r"while z", source)),
        "invokeserver": source.count("InvokeServer"),
    }
    if result["c3_refs"] >= 50 and result["func_z"] > 20:
        result["route"] = "v6-static"
    elif result["tag"] == "Centurion v6.1":
        result["route"] = "v6.1-sandbox"
    else:
        result["route"] = "unknown"
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


def harvest_table_spans_ast(source, table_name):
    ast_tool = find_luau_ast()
    tmp = None
    try:
        with tempfile.NamedTemporaryFile(
            mode="w",
            encoding="latin-1",
            newline="\n",
            prefix="centurion-ast-",
            suffix=".lua",
            delete=False,
        ) as stream:
            stream.write(source)
            tmp = stream.name
        result = subprocess.run(
            [ast_tool, tmp], capture_output=True, timeout=120, check=False
        )
    finally:
        if tmp:
            try:
                os.remove(tmp)
            except OSError:
                pass
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
                        if not isinstance(expression, dict):
                            continue
                        if expression.get("type") != "AstExprGlobal":
                            continue
                        if expression.get("global") != table_name:
                            continue
                        if value.get("type") != "AstExprFunction":
                            continue
                        location = value.get("location", "")
                        try:
                            start, end = location.split(" - ")
                            start = int(start.split(",")[1])
                            end = int(end.split(",")[1])
                        except Exception:
                            continue
                        index = target.get("index")
                        number = index.get("value") if isinstance(index, dict) else index
                        spans.append((number, start, end))
            for child in node.values():
                walk(child)
        elif isinstance(node, list):
            for child in node:
                walk(child)

    walk(ast)
    spans.sort(key=lambda item: item[1])
    return spans


def deobfuscate_v6_static(input_path, output_dir):
    source = read_text(input_path)
    spans = harvest_table_spans_ast(source, "c3")
    if not spans:
        raise RuntimeError("No Centurion v6 c3 factory functions were found by the Luau AST parser.")
    header = (
        "--[[ PARTIAL Centurion v6 static extraction: %s\n"
        "   Extracted %d payload factory functions and decoded string escapes.\n"
        "   Factory imports and VM boot order are not reconstructed by this stage.\n"
        "   This file is an analysis result, not a complete runnable script. ]]\n\n"
        "local c3 = {}\n"
    ) % (os.path.basename(input_path), len(spans))
    parts = [header]
    for number, start, end in spans:
        parts.append("-- ===== c3[%s] =====\nc3[%s]=" % (number, number) + clean_escapes(source[start:end]))
    output = "\n\n".join(parts)
    output = re.sub(r"\bconst\b", "local", output)
    base = os.path.splitext(os.path.basename(input_path))[0]
    output_path = os.path.join(output_dir, base + "_deobf_stage1.lua")
    index_path = os.path.join(output_dir, base + "_deobf_index.txt")
    with open(output_path, "w", encoding="utf-8", newline="\n") as stream:
        stream.write(output + ("" if output.endswith("\n") else "\n"))
    index = [
        "-- Centurion v6 static index",
        "-- payload factories extracted: %d" % len(spans),
        "-- InvokeServer calls: %d" % output.count("InvokeServer"),
        "-- FireServer calls: %d" % output.count("FireServer"),
        "-- output is stage-one static extraction, not full reconstruction",
    ]
    with open(index_path, "w", encoding="utf-8", newline="\n") as stream:
        stream.write("\n".join(index) + "\n")
    return {"verdict": "PARTIAL", "factories": len(spans), "files": [output_path, index_path]}


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
    if detected["route"] != "v6-static":
        print(json.dumps({
            "verdict": "NEEDS",
            "reason": "unknown family (not Centurion v6/v6.1 shape)",
        }, indent=1))
        return 3
    result = deobfuscate_v6_static(input_path, output_dir)
    print(json.dumps({"fingerprint": detected, **result}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
