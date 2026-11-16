"""Human-readable recovery summary for the top of a devirtualized file.

The lifted output is mostly real recovered code, but it opens with Luraph's
own runtime stubs and machine register names, so at a glance it can look like
junk even when 95%+ of it is the actual script. This builds an honest header
that says what was recovered, what the leftover markers mean, and where the
real script starts -- without inventing any behaviour.
"""

import re

# A real Roblox/Luau API use (a call or a property access), not the API name
# appearing as a bare quoted string in one of Luraph's own lookup tables.
_API = re.compile(
    r"[:.](?:GetService|WaitForChild|FindFirstChild|FireServer|InvokeServer|"
    r"FireAllClients|Connect|GetChildren|GetDescendants|Kick|Destroy|Clone|new)\s*\(|"
    r"\bgame:\s*\w|\bworkspace\b|\bLocalPlayer\b|\bPlayerAdded\b|\brequire\s*\("
)


def build(finished, stats):
    """A comment block (str, trailing blank line) summarising `finished`."""
    stats = stats or {}
    lines = finished.split("\n")
    total = len(lines)

    runtime_stubs = len(re.findall(r"^local function luraph_runtime\d+\(", finished, re.M))
    # (what is left in the text: the strip and the in-place lifting remove most)
    orphan_protos = len(re.findall(r"^local function recovered_proto_\w+\(", finished, re.M))
    undecrypted_refs = finished.count("luraph_undecrypted_function") - (1 if "local function luraph_undecrypted_function" in finished else 0)
    recovered_fns = len(re.findall(r"^\s*(?:local\s+)?function\b", finished, re.M)) - runtime_stubs \
        - (1 if "local function luraph_undecrypted_function" in finished else 0)
    if recovered_fns < 0:
        recovered_fns = 0
    # what the reader sees: the error("devirt: ...") lines left in the text
    unlifted = len(re.findall(r"^\s*error\([\"']devirt:", finished, re.M))
    api_hits = len(_API.findall(finished))

    out = []
    out.append("-- ============================================================")
    out.append("--  DAILY DEOBF recovery summary (Luraph v14.x)")
    out.append("-- ------------------------------------------------------------")
    out.append("--  recovered functions : %d" % recovered_fns)
    if orphan_protos:
        out.append("--  runtime-built funcs : %d (lifted separately: named from what they do, else recovered_proto_*)" % orphan_protos)
    out.append("--  output lines         : %d" % total)
    out.append("--  Roblox API calls     : %d" % api_hits)
    if runtime_stubs:
        out.append("--  Luraph runtime stubs : %d (luraph_runtime1..%d -- Luraph's own VM" % (runtime_stubs, runtime_stubs))
        out.append("--                         helpers, not your script; they return nil)")
    if undecrypted_refs > 0:
        out.append("--  never-run functions  : %d (luraph_undecrypted_function: Luraph decrypts" % undecrypted_refs)
        out.append("--                         a function on its first call; these never ran)")
    if unlifted:
        out.append("--  unlifted VM blocks   : %d (shown as error(\"devirt: ...\") lines)" % unlifted)
    out.append("-- ------------------------------------------------------------")
    if api_hits <= 2 and total > 1500:
        out.append("--  NOTE: this file is almost all computation / Luraph protection")
        out.append("--  math -- it makes very few Roblox API calls. Any gameplay the")
        out.append("--  script decrypts at run time (LPH_ENCFUNC) stays behind the")
        out.append("--  luraph_runtime* helpers, which cannot be resolved without")
        out.append("--  running the script. What is below IS the recovered code, not")
        out.append("--  a trace -- there just is not much game logic in this file.")
        out.append("-- ------------------------------------------------------------")
    out.append("--  The real script starts after this header and the stubs below.")
    out.append("-- ============================================================")
    out.append("")
    out.append("")
    return "\n".join(out)
