"""
Variable names for devirtualized output (text pass, scope-aware).

The lifter names locals after VM registers (r12, s3_1, ...). This pass parses
the finished Luau with luau-ast, infers a name for every such local from how
it is defined, and rewrites exactly the declaration and reference positions:

  Instance.new("Frame")          -> frame          GetService("Players") -> Players
  x:FindFirstChild("Humanoid")   -> humanoid       x.Character           -> character
  x:GetChildren()                -> children       pcall(...)            -> ok, result
  for _ in ipairs(players)       -> i, player      for _ in pairs(t)     -> k, v
  numeric for                    -> i              require(a.Foo)        -> Foo

A name is taken only if it cannot change what any reference resolves to: no
reference of another local with that name lies inside this local's scope
(shadowing), and names of globals are never used.

    python names.py file.luau [-o out.luau]
"""
import json
import os
import re
import subprocess
import sys

try:
    from obfuscators.luraph_v14_9.vmmap import luau_ast_executable
except ImportError:     # (the same file serves the v15.1 engine as core/names_refine.py)
    def luau_ast_executable():
        import harness
        exe = harness.luau_ast()
        if not os.path.exists(exe):
            import shutil
            exe = shutil.which("luau-ast.exe" if os.name == "nt" else "luau-ast") or exe
        return exe

HERE = os.path.dirname(os.path.abspath(__file__))
GENERATED = re.compile(r"^(?:[a-z]\d+(?:_\d+)*|arg\d+_*)$")
# a second pass over the finished text (refine_text) also renames the names
# the first pass fell back on when it had no evidence
GENERIC = re.compile(r"^(?:[a-z]\d+(?:_\d+)*|arg\d*_*|v|tbl\d*|str\d*|n\d*|flag\d*|list\d*|fn\d*|result\d+|"
                     r"clone\d*|obj\d*|value\d+|item\d+|[A-Za-z]_\d+)$")
# the value a UI library hands a component's Callback
UI_CALLBACK_PARAM = {"Toggle": "enabled", "Checkbox": "checked", "Dropdown": "option", "Input": "text",
                     "Textbox": "text", "TextBox": "text", "Slider": "value", "Keybind": "key",
                     "Colorpicker": "color", "ColorPicker": "color"}
KEYWORDS = {"and", "break", "do", "else", "elseif", "end", "false", "for", "function", "if", "in", "local",
            "nil", "not", "or", "repeat", "return", "then", "true", "until", "while", "continue", "type",
            "export", "self"}
DATATYPES = {"Color3": "color", "Vector3": "vector", "Vector2": "vector2", "UDim2": "udim2", "UDim": "udim",
             "CFrame": "cframe", "TweenInfo": "tweenInfo", "ColorSequence": "colorSequence",
             "NumberSequence": "numberSequence", "NumberRange": "numberRange", "Rect": "rect",
             "RaycastParams": "raycastParams", "OverlapParams": "overlapParams", "Ray": "ray",
             "BrickColor": "brickColor", "Font": "font", "PhysicalProperties": "physicalProperties"}
METHOD_NAMES = {"GetChildren": "children", "GetDescendants": "descendants", "GetPlayers": "players",
                "Clone": "clone", "Connect": "connection", "Once": "connection", "Create": "tween",
                "GetPropertyChangedSignal": "signal", "GetMouse": "mouse", "Raycast": "hit",
                "InvokeServer": "response", "HttpGet": "response", "GetAsync": "response",
                "JSONDecode": "data", "JSONEncode": "json", "match": "match", "gsub": "str", "sub": "str",
                "lower": "str", "upper": "str", "format": "str", "rep": "str", "find": "pos", "split": "parts",
                "GetAttribute": "attribute", "IsA": "isA", "Wait": "result"}
# UI-library builder methods (WindUI, Rayfield, Orion, Fluent, ...): the local
# that holds the result is named after the component it makes.
UI_COMPONENTS = {"Window": "window", "CreateWindow": "window", "Section": "section",
                 "Tab": "tab", "CreateTab": "tab", "Toggle": "toggle", "Button": "button",
                 "Dropdown": "dropdown", "Slider": "slider", "Input": "input", "Textbox": "textbox",
                 "Paragraph": "paragraph", "Label": "label", "Keybind": "keybind",
                 "ColorPicker": "colorPicker", "Divider": "divider", "AddTab": "tab",
                 "AddSection": "section", "AddToggle": "toggle", "AddButton": "button",
                 "AddDropdown": "dropdown", "AddSlider": "slider", "AddLabel": "label",
                 "Groupbox": "groupbox", "Tabbox": "tabbox", "CreateToggle": "toggle"}
GLOBAL_CALLS = {"tick": "now", "time": "now", "os.clock": "now", "os.time": "now", "type": "kind",
                "typeof": "kind", "tostring": "str", "tonumber": "num", "setmetatable": "obj",
                "loadstring": "chunk", "getgenv": "genv", "getfenv": "env", "gethui": "hui",
                "string.format": "str", "string.rep": "str", "string.sub": "str", "table.concat": "str",
                "math.floor": "n", "math.clamp": "n", "math.min": "n", "math.max": "n", "math.abs": "n",
                "math.random": "n", "select": "value", "unpack": "value", "table.unpack": "value",
                "coroutine.create": "thread", "task.spawn": "thread", "task.delay": "thread",
                "Instance.new": "instance", "newproxy": "proxy", "rawget": "value", "next": "key"}


WEAK = {"str", "n", "tbl", "flag", "fn", "value", "key", "kind", "num", "obj", "result"}
# parameters of callbacks connected to these signals (same table as envlog's SIGNAL_PARAMS)
SIGNAL_PARAMS = {
    "PlayerAdded": ["player"], "PlayerRemoving": ["player"],
    "CharacterAdded": ["character"], "CharacterRemoving": ["character"], "CharacterAppearanceLoaded": ["character"],
    "Touched": ["hit"], "TouchEnded": ["hit"],
    "InputBegan": ["input", "gameProcessed"], "InputEnded": ["input", "gameProcessed"],
    "InputChanged": ["input", "gameProcessed"],
    "Heartbeat": ["deltaTime"], "RenderStepped": ["deltaTime"], "PreSimulation": ["deltaTime"],
    "PostSimulation": ["deltaTime"], "PreRender": ["deltaTime"], "Stepped": ["time", "deltaTime"],
    "ChildAdded": ["child"], "ChildRemoved": ["child"],
    "DescendantAdded": ["descendant"], "DescendantRemoving": ["descendant"],
    "HealthChanged": ["health"], "Chatted": ["message"],
    "FocusLost": ["enterPressed", "inputObject"], "Triggered": ["player"],
    "PromptTriggered": ["prompt", "player"], "PromptButtonHoldBegan": ["prompt", "player"],
    "Idled": ["idleTime"], "MouseButton1Down": ["x", "y"], "Activated": ["inputObject", "clickCount"],
    "AncestryChanged": ["child", "parent"], "AttributeChanged": ["attribute"],
    "StateChanged": ["old", "new"], "MoveToFinished": ["reached"], "Completed": ["playbackState"],
}


def _table_field_str(node, keys):
    """The string value of the first of `keys` in a table literal, or None."""
    if not node or node.get("type") != "AstExprTable":
        return None
    for item in node.get("items", []):
        k = item.get("key")
        if k and k.get("type") == "AstExprConstantString" and k.get("value") in keys:
            v = item.get("value")
            if v and v.get("type") == "AstExprConstantString":
                return v.get("value")
    return None


def str_arg_name(call):
    """f("RouterClient") -> RouterClient, x.get("TradeAPI/SendTrade") -> sendTrade:
    a call whose first argument names what it returns."""
    args = call.get("args") or []
    s = const_str(args[0]) if args else None
    if not s:
        return None
    last = re.split(r"[/.:\\]", s)[-1]
    if re.match(r"^[A-Za-z_]\w{1,40}$", last) and last not in KEYWORDS:
        return last if last[:1].isupper() and not last.isupper() else camel(last)
    return None


def loc(s):
    a, b = s.split(" - ")
    l1, c1 = a.split(",")
    l2, c2 = b.split(",")
    return (int(l1), int(c1)), (int(l2), int(c2))


def camel(s):
    """'UICorner' -> 'uiCorner', 'Humanoid Root' -> 'humanoidRoot'; None if unusable."""
    parts = re.findall(r"[A-Za-z0-9]+", s)
    if not parts:
        return None
    if len(parts) > 1:
        # TARGET_BRAINROTS -> targetBrainrots (FOV Circle -> fovCircle)
        parts = [p.capitalize() if p.isupper() else p for p in parts]
    w = "".join(p[:1].upper() + p[1:] for p in parts)
    m = re.match(r"^([A-Z]+)([A-Z][a-z].*)$", w)
    if m:
        w = m.group(1).lower() + m.group(2)
    else:
        m = re.match(r"^([A-Z]+)$", w)
        w = w.lower() if m else w[:1].lower() + w[1:]
    if w[:1].isdigit():
        w = "n" + w
    return w[:32] if w else None


def singular(name):
    if not name:
        return None
    if name == "children":
        return "child"
    if name.endswith("ies") and len(name) > 4:
        return name[:-3] + "y"
    if name.endswith("s") and not name.endswith("ss") and len(name) > 3:
        return name[:-1]
    return None


def const_str(e):
    return e.get("value") if e and e.get("type") == "AstExprConstantString" else None


def dotted(e):
    """'a.b.c' for global/index-name chains, else None."""
    if e.get("type") == "AstExprGlobal":
        return e["global"]
    if e.get("type") == "AstExprIndexName" and e.get("op") == ".":
        d = dotted(e["expr"])
        return d + "." + e["index"] if d else None
    return None


class Namer:
    def __init__(self, text, refine=False):
        self.generated = GENERIC if refine else GENERATED
        import tempfile
        self.text = text
        with tempfile.NamedTemporaryFile("w", suffix=".luau", delete=False, encoding="utf-8", newline="\n") as f:
            f.write(text)
            path = f.name
        try:
            exe = luau_ast_executable()
            result = subprocess.run([exe, path], capture_output=True)
            if result.returncode != 0:
                detail = result.stderr.decode("latin-1", errors="replace").strip()
                raise RuntimeError("luau-ast failed: " + (detail or str(result.returncode)))
            self.root = json.loads(result.stdout.decode("latin-1"))["root"]
        finally:
            os.remove(path)
        self.signal_ctx = []    # signals whose :Connect callback is being visited
        self.method_ctx = []    # field names of `x.Name = function` being visited
        self.pending_roles = []  # (decl location, name) for locals made from a param role
        self.self_candidates = []  # first params of functions stored in a field
        self.locals = {}        # decl location -> info
        self.globals = set()
        self.order = []

    # ---- collection
    def local_info(self, node, scope):
        key = node["location"]
        info = self.locals.get(key)
        if info is None:
            info = self.locals[key] = {"name": node["name"], "decl": loc(key)[0], "scope": scope,
                                       "refs": [loc(key)[0]], "spans": [loc(key)], "hint": None, "hints": []}
            self.order.append(key)
        return info

    def collect(self):
        self.visit_block(self.root)

    def visit_block(self, blk):
        end = loc(blk["location"])[1]
        for st in blk["body"]:
            self.visit_stat(st, end)

    def visit_stat(self, st, block_end):
        t = st["type"]
        if t == "AstStatLocal":
            for v in st.get("values", []):
                self.visit_expr(v)
            stend = loc(st["location"])[1]
            vals = st.get("values", [])
            for var, v in zip(st["vars"], vals):
                # `local cb = param or function() end`: param is a callback;
                # `local s = param or "Toggle"` inside x.Toggle = function: a title
                if v.get("type") == "AstExprBinary" and v.get("op") == "Or" \
                        and v["left"].get("type") == "AstExprLocal":
                    pinfo = self.locals.get(v["left"]["local"]["location"])
                    if pinfo is None or pinfo["hint"] != "arg":
                        continue
                    if v["right"].get("type") == "AstExprFunction":
                        pinfo["role"], role = "userCallback", "callback"
                    elif self.method_ctx and const_str(v["right"]) == self.method_ctx[-1]:
                        pinfo["role"], role = "text", "title"
                    else:
                        continue
                    self.pending_roles.append((var["location"], role))
            for i, var in enumerate(st["vars"]):
                # `local f = function` becomes `local function f` later (localfuncs.py):
                # its scope then covers the body too
                start = loc(st["location"])[0] if len(st["vars"]) == 1 and len(vals) == 1 \
                    and vals[0]["type"] == "AstExprFunction" else stend
                info = self.local_info(var, (start, block_end))
                if i < len(vals):
                    info["hints"].append((vals[i], 0))
                elif vals and vals[-1]["type"] == "AstExprCall":
                    info["hints"].append((vals[-1], i - len(vals) + 1))
            return
        if t == "AstStatLocalFunction":
            info = self.local_info(st["name"], (loc(st["location"])[0], block_end))
            info["hints"].append((st["func"], 0))
            self.visit_expr(st["func"])
            return
        if t == "AstStatAssign":
            for v in st["vars"]:
                self.visit_expr(v)
            vals = st["values"]
            for i, v in enumerate(vals):
                var = st["vars"][i] if i < len(st["vars"]) else {}
                method = var.get("type") == "AstExprIndexName" and v.get("type") == "AstExprFunction"
                if method:
                    self.method_ctx.append(var["index"])
                    if len(v.get("args") or []) >= 2:
                        # x.Name = function(a, ...): a is self if it is never used
                        self.self_candidates.append(v["args"][0]["location"])
                try:
                    self.visit_expr(v)
                finally:
                    if method:
                        self.method_ctx.pop()
            for var, v in zip(st["vars"], vals):
                # obj.Text = x / obj.BackgroundColor3 = x or default: x is a text / color
                if v.get("type") == "AstExprBinary" and v.get("op") == "Or":
                    v = v["left"]
                if var.get("type") == "AstExprIndexName" and v.get("type") == "AstExprLocal":
                    info = self.locals.get(v["local"]["location"])
                    if info is not None:
                        info.setdefault("prop", camel(var["index"]))
            for var, v in zip(st["vars"], vals):
                if var.get("type") == "AstExprIndexName" and var["expr"].get("type") == "AstExprLocal" \
                        and v.get("type") == "AstExprFunction":
                    info = self.locals.get(var["expr"]["local"]["location"])
                    if info is not None:
                        info["methods"] = info.get("methods", 0) + 1
            for i, var in enumerate(st["vars"]):
                if var["type"] == "AstExprLocal":
                    info = self.locals.get(var["local"]["location"])
                    if info is not None and i < len(vals) and vals[i].get("type") == "AstExprConstantBool" \
                            and self.signal_ctx:
                        info.setdefault("boolsets", set()).add((self.signal_ctx[-1], bool(vals[i].get("value"))))
                    if info is not None:
                        if i < len(vals):
                            info["hints"].append((vals[i], 0))
                        elif vals and vals[-1]["type"] == "AstExprCall":
                            info["hints"].append((vals[-1], i - len(vals) + 1))
            return
        if t == "AstStatFor":
            for k in ("from", "to", "step"):
                if st.get(k):
                    self.visit_expr(st[k])
            body = loc(st["body"]["location"])
            info = self.local_info(st["var"], (body[0], body[1]))
            info["hint"] = "i"
            self.visit_block(st["body"])
            return
        if t == "AstStatForIn":
            for v in st["values"]:
                self.visit_expr(v)
            body = loc(st["body"]["location"])
            names = self.forin_names(st)
            for var, nm in zip(st["vars"], names):
                info = self.local_info(var, (body[0], body[1]))
                info["hint"] = nm
            self.visit_block(st["body"])
            return
        if t in ("AstStatBlock",):
            self.visit_block(st)
            return
        if t == "AstStatIf":
            self.visit_expr(st["condition"])
            self.visit_block(st["thenbody"])
            e = st.get("elsebody")
            if e is not None:
                if e["type"] == "AstStatIf":
                    self.visit_stat(e, block_end)
                else:
                    self.visit_block(e)
            return
        if t == "AstStatWhile":
            self.visit_expr(st["condition"])
            self.visit_block(st["body"])
            return
        if t == "AstStatRepeat":
            self.visit_block(st["body"])
            self.visit_expr(st["condition"])
            return
        if t == "AstStatCompoundAssign":
            var = st["var"]
            if var.get("type") == "AstExprLocal" and st.get("op") in ("Add", "Sub") \
                    and st["value"].get("type") == "AstExprConstantNumber" and st["value"].get("value") == 1:
                info = self.locals.get(var["local"]["location"])
                if info is not None:
                    info["counter"] = True
            self.visit_expr(st["var"])
            self.visit_expr(st["value"])
            return
        # generic: expressions anywhere below
        for k, v in st.items():
            if isinstance(v, dict) and v.get("type", "").startswith("AstExpr"):
                self.visit_expr(v)
            elif isinstance(v, list):
                for x in v:
                    if isinstance(x, dict) and x.get("type", "").startswith("AstExpr"):
                        self.visit_expr(x)

    def visit_expr(self, e):
        t = e.get("type")
        if t == "AstExprLocal":
            info = self.locals.get(e["local"]["location"])
            if info is not None:
                a, b = loc(e["location"])
                info["refs"].append(a)
                info["spans"].append((a, b))
            return
        if t == "AstExprGlobal":
            self.globals.add(e["global"])
            return
        if t == "AstExprIndexName" and e["expr"].get("type") == "AstExprLocal":
            # x.Field / x:Method(): how a local is used names it (use_name)
            info = self.locals.get(e["expr"]["local"]["location"])
            if info is not None:
                info.setdefault("fields", set()).add(e["index"])
        if t == "AstExprCall":
            f = e.get("func", {})
            if f.get("type") == "AstExprIndexName" and f.get("index") in ("Connect", "Once") \
                    and f["expr"].get("type") == "AstExprIndexName" and not getattr(self, "_in_connect", False):
                # remember which signal's callback a flag is set in (use_name)
                self.signal_ctx.append(f["expr"]["index"])
                self._in_connect = True
                try:
                    self.visit_expr(e)
                finally:
                    self._in_connect = False
                    self.signal_ctx.pop()
                return
            self._in_connect = False
            # t[k](...) with a computed key: t is a dispatch table
            # a parameter passed straight to a known API is named after that
            # API's argument (TweenInfo.new(p) -> duration, x:Create(_, _, p) -> goal)
            d0 = dotted(f)
            roles = {}
            if d0 == "TweenInfo.new":
                roles = {0: "duration"}
            elif d0 == "Instance.new":
                roles = {0: "className", 1: "parent"}
            elif d0 in ("task.wait", "wait", "task.delay", "delay"):
                roles = {0: "seconds"}
            elif f.get("type") == "AstExprIndexName" and f.get("index") == "Create" and len(e.get("args") or []) == 3:
                roles = {0: "target", 2: "goal"}
            for i, nm in roles.items():
                args = e.get("args") or []
                if i < len(args) and args[i].get("type") == "AstExprLocal":
                    pinfo = self.locals.get(args[i]["local"]["location"])
                    if pinfo is not None and pinfo["hint"] == "arg" and not pinfo.get("role"):
                        pinfo["role"] = nm
            if dotted(f) == "table.insert" and e.get("args") and e["args"][0].get("type") == "AstExprLocal":
                info = self.locals.get(e["args"][0]["local"]["location"])
                if info is not None:
                    info["list"] = True
            if f.get("type") == "AstExprIndexExpr" and f["expr"].get("type") == "AstExprLocal"                     and const_str(f.get("index")) is None:
                info = self.locals.get(f["expr"]["local"]["location"])
                if info is not None:
                    info["dispatch"] = True
            # signal:Connect(function(input, gameProcessed) ...): parameters from the signal
            if f.get("type") == "AstExprIndexName" and f.get("index") in ("Connect", "Once", "ConnectParallel") \
                    and f["expr"].get("type") == "AstExprIndexName" and e.get("args"):
                params = SIGNAL_PARAMS.get(f["expr"]["index"])
                if params:
                    for k, v in e.items():
                        if k != "args" and isinstance(v, dict) and v.get("type", "").startswith("AstExpr"):
                            self.visit_expr(v)
                    for a in e["args"]:
                        self.visit_expr(a)
                    self.callback_params(e["args"][0], params)
                    return
        if t == "AstExprBinary" and e.get("op") == "Concat" and e["right"].get("type") == "AstExprLocal":
            # "Speed: " .. n  ->  speed
            m = re.match(r"^([A-Za-z][A-Za-z ]{0,30}?)\s*[:=]\s*$", const_str(e["left"]) or "")
            info = self.locals.get(e["right"]["local"]["location"]) if m else None
            if info is not None:
                info.setdefault("label", camel(m.group(1)))
        if t == "AstExprFunction":
            body = loc(e["body"]["location"])
            for a in e["args"]:
                info = self.local_info(a, (loc(e["location"])[0], body[1]))
                info["hint"] = info["hint"] or "arg"
            self.visit_block(e["body"])
            return
        for k, v in e.items():
            if isinstance(v, dict) and "type" in v:
                if v["type"] == "AstStatBlock":
                    self.visit_block(v)
                elif v["type"].startswith("AstExpr"):
                    self.visit_expr(v)
            elif isinstance(v, list):
                for x in v:
                    if isinstance(x, dict) and x.get("type", "").startswith("AstExpr"):
                        self.visit_expr(x)
                    elif isinstance(x, dict) and "value" in x and isinstance(x["value"], dict):
                        # table items {key=..., value=...}
                        if isinstance(x.get("key"), dict):
                            self.visit_expr(x["key"])
                        self.visit_expr(x["value"])

    # ---- inference
    def callback_params(self, fn, params):
        """Name the parameters of a function (literal, or a local holding one) after the signal's."""
        if fn.get("type") == "AstExprLocal":
            info = self.locals.get(fn["local"]["location"])
            funcs = [h for h, _ in (info or {}).get("hints", []) if h.get("type") == "AstExprFunction"]
            if not funcs:
                return
            fn = funcs[0]
        if fn.get("type") != "AstExprFunction":
            return
        for a, nm in zip(fn["args"], params):
            info = self.locals.get(a["location"])
            if info is not None and info["hint"] in (None, "arg"):
                info["hint"] = nm

    def function_name(self, fn):
        """toggleShield for `function() S.Shield = not S.Shield ...`, createFrame for a
        function returning the local it made with Instance.new("Frame")."""
        body = fn.get("body", {}).get("body", [])
        if not body:
            return None
        nm = self.body_pattern_name(fn, body)
        if nm:
            return nm
        st = body[0]
        if st["type"] == "AstStatAssign" and len(st["vars"]) == 1 and len(st["values"]) == 1:
            var, val = st["vars"][0], st["values"][0]
            if var.get("type") == "AstExprIndexName" and val.get("type") == "AstExprUnary" \
                    and val.get("op") == "Not" and self.same(var, val["expr"]):
                return camel("toggle " + var["index"])
        last = body[-1]
        if last["type"] == "AstStatReturn" and len(last.get("list", [])) == 1 \
                and last["list"][0].get("type") == "AstExprLocal":
            where = last["list"][0]["local"]["location"]
            for st in body:
                if st["type"] == "AstStatLocal" and len(st["vars"]) == 1 and st.get("values") \
                        and st["vars"][0]["location"] == where:
                    v = st["values"][0]
                    if v.get("type") == "AstExprCall" and dotted(v["func"]) in ("Instance.new", "Drawing.new") \
                            and v.get("args") and const_str(v["args"][0]):
                        return camel("create " + const_str(v["args"][0]))
        return None

    def body_pattern_name(self, fn, body):
        """Names from what a whole function does: returning one method's
        result (`return HttpService:GenerateGUID(false)` -> generateGUID), a
        recursive table copy (deepCopy), a predicate search (findKey)."""
        def walk(n):
            st = [n]
            while st:
                x = st.pop()
                if isinstance(x, list):
                    st.extend(x)
                elif isinstance(x, dict):
                    yield x
                    st.extend(v for v in x.values() if isinstance(v, (dict, list)))
        if len(body) == 1 and body[0]["type"] == "AstStatReturn" and len(body[0].get("list", [])) == 1:
            r = body[0]["list"][0]
            if r.get("type") == "AstExprCall" and r["func"].get("type") == "AstExprIndexName" \
                    and r["func"].get("op") == ":":
                m = r["func"]["index"]
                if re.match(r"^[A-Z]\w+$", m):
                    return m[:1].lower() + m[1:]
        nodes = list(walk(body))
        params = [a["location"] for a in fn.get("args", [])]
        # if type(x) ~= "table" then return x end ... for k, v in pairs(x) do t[k] = f(v) end
        if params and any(n.get("type") == "AstExprConstantString" and n.get("value") == "table" for n in nodes) \
                and any(n.get("type") == "AstStatForIn" for n in nodes) \
                and any(n.get("type") == "AstExprTable" and not n.get("items") for n in nodes):
            calls = [n for n in nodes if n.get("type") == "AstExprCall" and n["func"].get("type") == "AstExprLocal"]
            if calls and any(c.get("args") and c["args"][0].get("type") == "AstExprLocal" for c in calls):
                for a in fn.get("args", [])[:1]:
                    info = self.locals.get(a["location"])
                    if info is not None and info["hint"] in (None, "arg") and self.generated.match(info["name"]):
                        info["hint"] = "value"
                return "deepCopy"
        # update("pet_char_wrappers", function(list) ... table.remove(list, i) ... end)
        keyed = [n for n in nodes if n.get("type") == "AstExprCall" and len(n.get("args", [])) == 2
                 and const_str(n["args"][0]) and n["args"][1].get("type") == "AstExprFunction"
                 and re.match(r"^[a-z][a-z0-9_]*$", const_str(n["args"][0]))]
        if len(keyed) == 1 and len(body) <= 3:
            key = const_str(keyed[0]["args"][0])
            inner = list(walk(keyed[0]["args"][1].get("body", {})))
            verb = "update"
            if any(n.get("type") == "AstExprCall" and dotted(n.get("func", {})) == "table.remove" for n in inner):
                verb = "remove"
            elif any(n.get("type") == "AstExprCall" and dotted(n.get("func", {})) == "table.insert" for n in inner) \
                    or any(n.get("type") == "AstStatAssign" and any(v.get("type") == "AstExprIndexExpr"
                           and v.get("index", {}).get("type") == "AstExprBinary" for v in n.get("vars", []))
                           for n in inner):
                verb = "add"
            noun = camel(singular(key) if verb in ("add", "remove") and singular(key) else key)
            if noun:
                return verb + noun[:1].upper() + noun[1:]
        # for k, v in pairs(t) do if pred(v, k) then return k end end return nil
        if len(params) == 2:
            for n in nodes:
                if n.get("type") == "AstStatForIn" and len(n.get("vars", [])) == 2:
                    k = n["vars"][0]["location"]
                    for x in walk(n.get("body", {})):
                        if x.get("type") == "AstStatReturn" and len(x.get("list", [])) == 1 \
                                and x["list"][0].get("type") == "AstExprLocal" \
                                and x["list"][0]["local"]["location"] == k:
                            return "findKey"
        return None

    def same(self, a, b):
        """Same variable path (locals by declaration, globals by name, .x chains)."""
        if a.get("type") != b.get("type"):
            return False
        t = a["type"]
        if t == "AstExprLocal":
            return a["local"]["location"] == b["local"]["location"]
        if t == "AstExprGlobal":
            return a["global"] == b["global"]
        if t == "AstExprIndexName":
            return a["index"] == b["index"] and self.same(a["expr"], b["expr"])
        return False

    def forin_names(self, st):
        n = len(st["vars"])
        vals = st["values"]
        first = vals[0] if vals else {}
        fn = dotted(first.get("func", {})) if first.get("type") == "AstExprCall" else None
        base = None
        if first.get("type") == "AstExprCall" and first.get("args"):
            a = first["args"][0]
            if a.get("type") == "AstExprLocal":
                base = ("local", a["local"]["location"])
            elif a.get("type") == "AstExprCall" and a["func"].get("type") == "AstExprIndexName":
                base = ("name", METHOD_NAMES.get(a["func"]["index"]))
            elif a.get("type") == "AstExprIndexName":
                base = ("name", camel(a["index"]))      # pairs(data.Lines) -> line
        if first.get("type") == "AstExprCall" and first["func"].get("type") == "AstExprIndexName"                 and first["func"]["index"] == "gmatch":
            return (["match"] + ["match%d" % i for i in range(2, n + 1)])[:n]
        key = "i" if fn == "ipairs" else "k"
        names = [key, ("v", base)] + ["v%d" % i for i in range(3, n + 1)]
        return names[:n]

    def call_result_name(self, e):
        f = e.get("func", {})
        if f.get("type") != "AstExprLocal":
            return None
        nm = f["local"]["name"]
        if GENERIC.match(nm):
            return None
        if nm in ("get", "getData", "load"):
            return "value"
        m = re.match(r"^(?:get|find|create|make|new|load|read|fetch|build|generate|deep)([A-Z]\w*)$", nm)
        if m:
            w = m.group(1)
            return w[:1].lower() + w[1:]
        return None

    def infer(self, e, idx=0):
        t = e.get("type")
        if t == "AstExprCall":
            f = e["func"]
            d = dotted(f)
            if d in ("pcall", "xpcall"):
                return ["ok", "result"][min(idx, 1)]
            if idx > 0:
                return None
            got = self.call_result_name(e)
            if got:
                return got
            if d == "require" and e["args"]:
                a = e["args"][0]
                if a.get("type") == "AstExprIndexName":
                    return a["index"]
                if a.get("type") == "AstExprCall" and a["func"].get("type") == "AstExprIndexName" \
                        and a["func"]["index"] in ("WaitForChild", "FindFirstChild") and a.get("args"):
                    nm = const_str(a["args"][0])
                    if nm and re.match(r"^[A-Za-z_]\w*$", nm):
                        return nm
                return "module"
            if d == "table.pack" and len(e.get("args") or []) == 1 and e["args"][0].get("type") == "AstExprCall" \
                    and re.match(r"^o_\d+$", dotted(e["args"][0].get("func", {})) or ""):
                return "step"       # one step of a lowered generic for: {more, key, value}
            if d in ("Instance.new", "Drawing.new") and e["args"] and const_str(e["args"][0]):
                return camel(const_str(e["args"][0]))
            if d and "." in d and d.split(".")[0] in DATATYPES:
                return DATATYPES[d.split(".")[0]]
            if d in GLOBAL_CALLS:
                return GLOBAL_CALLS[d]
            if f.get("type") == "AstExprIndexName" and f.get("op") == ":":
                m = f["index"]
                arg = const_str(e["args"][0]) if e["args"] else None
                if m == "GetService" and arg and re.match(r"^[A-Za-z]\w*$", arg):
                    return arg
                if m in ("FindFirstChild", "WaitForChild", "FindFirstChildOfClass", "FindFirstChildWhichIsA",
                         "FindFirstAncestor", "FindFirstAncestorOfClass", "FindFirstAncestorWhichIsA") and arg:
                    return camel(arg)
                if m == "IsA" and arg:
                    return camel("is " + arg)
                if m in METHOD_NAMES:
                    return METHOD_NAMES[m]
                # UI library components: x:CreateWindow{...}/x:Section{...}/x:Tab{...}
                # return the thing they create; name the local after its Title
                # (short ones only), else after the component type.
                if m in UI_COMPONENTS:
                    comp = UI_COMPONENTS[m]
                    title = _table_field_str(e["args"][0] if e["args"] else None, ("Title", "Name", "Text"))
                    if title:
                        base = re.sub(r"\s*[\(\[].*$", "", title).strip()   # drop "(FR/NFR/MFR)" suffixes
                        words = re.findall(r"[A-Za-z][A-Za-z0-9]*", base)[:3]
                        if 1 <= len(words) <= 3 and sum(len(w) for w in words) <= 24:
                            nm = camel(" ".join(words) + " " + comp)
                            if nm and nm not in KEYWORDS:
                                return nm
                    return comp
                # a builder method: strip Create/Make/New/Build/Add/Get and name
                # after the rest (CreateWindow -> window, AddButton -> button)
                mp = re.match(r"^(?:Create|Make|New|Build|Add|Get|Register)([A-Z]\w+)$", m)
                if mp:
                    return camel(mp.group(1))
                return str_arg_name(e)
            if f.get("type") == "AstExprCall":
                inner = dotted(f.get("func", {}))
                if inner == "loadstring":
                    return "lib"
            if f.get("type") == "AstExprLocal":
                # a helper of the script: its first word-like string argument
                # (createButton(page, "Save Position", 8) -> savePosition)
                nm = str_arg_name(e)
                if nm:
                    return nm
                for a in e.get("args") or []:
                    s = const_str(a)
                    if s is not None:
                        s = re.sub(r"\s*:\s*\w*$", "", s)     # "Skeleton: ON" -> skeleton
                        # a label ("Shield", "Save Position"), not an option string ("s", "slanf")
                        ok = re.match(r"^[A-Z][A-Za-z0-9 _]{1,30}$", s) and camel(s) not in KEYWORDS
                        return camel(s) if ok else None
            return str_arg_name(e)
        if t == "AstExprIndexName":
            d = dotted(e)
            if d and d.split(".")[0] in DATATYPES:
                return DATATYPES[d.split(".")[0]]     # Vector3.zero -> vector
            return camel(e["index"])
        if t == "AstExprIndexExpr":
            s = const_str(e.get("index"))
            if s:
                return camel(s)
            # petCharWrappers[i] -> petCharWrapper
            base = e.get("expr", {})
            if base.get("type") == "AstExprLocal":
                nm = base["local"]["name"]
                if not GENERIC.match(nm):
                    return singular(nm)
            return None
        if t == "AstExprFunction":
            return self.function_name(e) or "fn"
        if t == "AstExprTable":
            return "tbl"
        if t == "AstExprBinary":
            if e["op"] == "Or":
                # `x or default`: named after x
                left = self.infer(e["left"])
                if left and left not in WEAK:
                    return left
                return self.infer(e["right"]) or left
            if e["op"] == "And":
                return self.infer(e["right"]) or self.infer(e["left"])
            if e["op"].startswith("Compare"):
                return "flag"
            if e["op"] == "Concat":
                return "str"
            return "n"
        if t == "AstExprUnary":
            return "flag" if e["op"] == "Not" else "n"
        if t == "AstExprConstantBool":
            return "flag"
        if t == "AstExprConstantString":
            return "str"
        if t == "AstExprConstantNumber":
            return "n"
        if t == "AstExprGroup":
            return self.infer(e["expr"], idx)
        return None

    GUI_MEMBERS = {"AbsolutePosition", "AbsoluteSize", "AbsoluteRotation", "BackgroundColor3",
                   "BackgroundTransparency", "BorderSizePixel", "TextColor3", "TextSize", "TextTransparency",
                   "InputBegan", "InputEnded", "MouseEnter", "MouseLeave", "MouseButton1Click",
                   "MouseButton1Down", "Activated", "ZIndex", "AnchorPoint", "ClipsDescendants",
                   "AutoButtonColor", "CanvasSize", "CanvasPosition", "ImageColor3", "Image"}
    OPTION_FIELDS = {"Callback", "Default", "Title", "Min", "Max", "Options", "Threshold", "Cutoff",
                     "Placeholder", "Description", "TweenTime", "Multi", "Increment", "Rounding",
                     "Keybind", "MinSize", "MaxSize", "Step", "Precision", "MinItemCount", "MaxItemCount",
                     "Items", "Values", "Value", "Suffix", "Prefix", "Format", "Decimals", "Range"}

    def use_name(self, info):
        """A name from how the local is used (fields read or written, methods
        called on it, what is done to it), or None. Facts only: each rule
        needs members no other kind of value has."""
        sets = info.get("boolsets") or set()
        if all(h.get("type") == "AstExprConstantBool" for h, _ in info["hints"]) and sets:
            if ("MouseEnter", True) in sets and ("MouseLeave", False) in sets:
                return "hovering"
            if ("InputBegan", True) in sets and ("InputEnded", False) in sets:
                return "dragging"
        if len(info["hints"]) > 1:
            # assigned again later: the lifter reuses one local (a VM register)
            # for unrelated values, so its uses do not describe one value
            return None
        f = info.get("fields") or set()
        if f & {"UserInputType", "KeyCode", "UserInputState"}:
            return "input"
        if f & self.GUI_MEMBERS:
            return "button" if f & {"MouseButton1Click", "MouseButton1Down", "Activated", "AutoButtonColor"} \
                else "guiObject"
        if f & {"Character", "UserId", "DisplayName", "Backpack", "PlayerGui"}:
            return "player"
        if f & {"Health", "MaxHealth", "WalkSpeed", "JumpPower", "MoveDirection"}:
            return "humanoid"
        if info.get("methods", 0) >= 2:
            return "object"
        if f & self.OPTION_FIELDS and not (f - self.OPTION_FIELDS - {"Name", "Text", "Type", "Flag"}):
            return "options"
        if "Disconnect" in f and f <= {"Disconnect", "Connected"}:
            return "connection"
        if info.get("list"):
            return "list"
        if info.get("counter"):
            return "count"
        return None

    def base_name(self, info):
        if info.get("role") and len(info["hints"]) <= 1:
            return info["role"]
        nm = self._base_name(info)
        if nm in WEAK or nm in ("arg", "v", "fn", "list", "clone") or nm is None:
            better = self.use_name(info)
            if better:
                return better
            stored = self.stored_name(info)
            if stored:
                return stored
        return nm

    def stored_name(self, info):
        """`{ unique = v }` / `t.unique = v` / `t["unique"] = v`: the one field
        name the value is stored under (assigned once, used for that)."""
        keys = info.get("stored") or {}
        if len(info["hints"]) > 1 or len(keys) != 1:
            return None
        nm = camel(next(iter(keys)))
        if not nm or nm in KEYWORDS or len(nm) < 2 or GENERIC.match(nm):
            return None
        return nm

    def usage_facts(self):
        """Evidence the statement walk does not record: the field a local is
        stored under, the key a callback is registered for, the value a UI
        component's Callback gets."""
        def local_of(e):
            if isinstance(e, dict) and e.get("type") == "AstExprLocal":
                return self.locals.get(e["local"]["location"])
            return None

        def store(info, key):
            if info is not None and isinstance(key, str) and re.match(r"^[A-Za-z_]\w*$", key):
                info.setdefault("stored", {})
                info["stored"][key] = info["stored"].get(key, 0) + 1

        def name_params(fn, names):
            for a, nm in zip(fn.get("args", []), names):
                info = self.locals.get(a["location"])
                if nm and info is not None and info["hint"] in (None, "arg") and self.generated.match(info["name"]):
                    info["hint"] = nm

        # name -> functions declared with it (local function f / local f = function)
        funcs = {}
        calls = {}
        stack = [self.root]
        while stack:
            n = stack.pop()
            if isinstance(n, list):
                stack.extend(n)
                continue
            if not isinstance(n, dict):
                continue
            if n.get("type") == "AstStatLocalFunction":
                funcs.setdefault(n["name"]["location"], []).append(n["func"])
            elif n.get("type") == "AstStatLocal" and len(n.get("vars", [])) == 1 and n.get("values") \
                    and n["values"][0].get("type") == "AstExprFunction":
                funcs.setdefault(n["vars"][0]["location"], []).append(n["values"][0])
            elif n.get("type") == "AstExprCall" and n["func"].get("type") == "AstExprLocal":
                calls.setdefault(n["func"]["local"]["location"], []).append(n.get("args", []))
            stack.extend(v for v in n.values() if isinstance(v, (dict, list)))

        def arg_name(a):
            if a.get("type") == "AstExprLocal":
                nm = a["local"]["name"]
                return None if GENERIC.match(nm) or nm in ("self",) else nm
            if a.get("type") == "AstExprIndexName":
                return camel(a["index"])
            return None
        # f(arg.pet_unique) everywhere -> f's parameter is petUnique
        for key, fl in funcs.items():
            if len(fl) != 1 or key not in calls:
                continue
            fn = fl[0]
            sites = calls[key]
            for i, p in enumerate(fn.get("args", [])):
                got = {arg_name(args[i]) if i < len(args) else None for args in sites}
                if len(got) == 1 and None not in got:
                    name_params(fn, [None] * i + [got.pop()])
                elif all(i < len(args) and const_str(args[i]) is not None for args in sites):
                    name_params(fn, [None] * i + ["key"])
            # update("inventory", function(inventory) ... end) at every call
            finfo = self.locals.get(key)
            if finfo is not None and self.generated.match(finfo["name"]) and len(sites) >= 2 and all(
                    len(a) == 2 and const_str(a[0]) is not None and a[1].get("type") == "AstExprFunction"
                    for a in sites):
                finfo["hint"] = "modifyData"
            # addPetCharWrapper(petCharWrapper)
            m = re.match(r"^(?:add|insert|remove|spawn|destroy|equip|unequip)([A-Z]\w*)$", finfo["name"] if finfo else "")
            if m and len(fn.get("args", [])) == 1:
                name_params(fn, [m.group(1)[:1].lower() + m.group(1)[1:]])

        stack = [self.root]
        while stack:
            n = stack.pop()
            if isinstance(n, list):
                stack.extend(n)
                continue
            if not isinstance(n, dict):
                continue
            t = n.get("type")
            if t == "AstStatAssign":
                for var, val in zip(n.get("vars", []), n.get("values", [])):
                    # X.get = function(key) ... end
                    if var.get("type") == "AstExprIndexName" and val.get("type") == "AstExprFunction" \
                            and var.get("index") in ("get", "Get", "load", "Load") and len(val.get("args", [])) == 1:
                        name_params(val, ["key"])
                    if var.get("type") == "AstExprIndexName":
                        store(local_of(val), var.get("index"))
                    elif var.get("type") == "AstExprIndexExpr" and const_str(var.get("index")):
                        store(local_of(val), const_str(var["index"]))
            elif t == "AstExprTable":
                for item in n.get("items", []):
                    if item.get("kind") == "record" and const_str(item.get("key")):
                        store(local_of(item.get("value")), const_str(item["key"]))
            elif t == "AstExprCall":
                args = n.get("args", [])
                # update("inventory", function(inventory) ... end)
                for i, a in enumerate(args):
                    if a.get("type") == "AstExprFunction" and i > 0 and const_str(args[i - 1]):
                        key = camel(const_str(args[i - 1]))
                        np = len(a.get("args", []))
                        if key and np == 1:
                            name_params(a, [key])
                        elif key and np == 2:
                            name_params(a, [None, key])
                fname = n.get("func", {})
                fnm = fname["local"]["name"] if fname.get("type") == "AstExprLocal" else dotted(fname)
                # findKey(petCharWrappers, function(petCharWrapper) ... end)
                if fnm and re.match(r"^find\w*$", fnm) and len(args) == 2 \
                        and args[1].get("type") == "AstExprFunction" and args[0].get("type") == "AstExprLocal":
                    one = singular(args[0]["local"]["name"])
                    if one and not GENERIC.match(args[0]["local"]["name"]):
                        name_params(args[1], [one])
                # table.sort(list, function(a, b) ... end)
                if fnm == "table.sort" and len(args) == 2 and args[1].get("type") == "AstExprFunction":
                    name_params(args[1], ["a", "b"])
                # tab:Toggle({ ..., Callback = function(enabled) ... end })
                f = n.get("func", {})
                comp = f.get("index") if f.get("type") == "AstExprIndexName" else None
                if comp in UI_CALLBACK_PARAM and args and args[0].get("type") == "AstExprTable":
                    for item in args[0].get("items", []):
                        if item.get("kind") == "record" and const_str(item.get("key")) == "Callback" \
                                and item.get("value", {}).get("type") == "AstExprFunction":
                            name_params(item["value"], [UI_CALLBACK_PARAM[comp]])
            for v in n.values():
                if isinstance(v, (dict, list)):
                    stack.append(v)
        self.param_roles()

    def param_roles(self):
        """Parameters with no other evidence, named from their one role: only
        called (callback), only iterated (list), only used as a key (key)."""
        uses = {}
        stack = [(self.root, None)]
        while stack:
            n, parent = stack.pop()
            if isinstance(n, list):
                stack.extend((x, parent) for x in n)
                continue
            if not isinstance(n, dict):
                continue
            if n.get("type") == "AstExprLocal":
                pk = parent.get("type") if parent else None
                role = "other"
                if pk == "AstExprCall" and parent.get("func") is n:
                    role = "call"
                elif pk == "AstExprCall" and dotted(parent.get("func", {})) in ("pairs", "ipairs") \
                        and parent.get("args", [None])[0] is n:
                    role = "iter"
                elif pk == "AstExprIndexExpr" and parent.get("index") is n:
                    role = "key"
                uses.setdefault(n["local"]["location"], set()).add(role)
            for v in n.values():
                if isinstance(v, (dict, list)):
                    stack.append((v, n))
        names = {"call": "callback", "iter": "list", "key": "key"}
        stack = [self.root]
        while stack:
            n = stack.pop()
            if isinstance(n, list):
                stack.extend(n)
                continue
            if not isinstance(n, dict):
                continue
            if n.get("type") == "AstExprFunction":
                for a in n.get("args", []):
                    info = self.locals.get(a["location"])
                    r = uses.get(a["location"])
                    if info is not None and r and len(r) == 1 and next(iter(r)) in names \
                            and info["hint"] in (None, "arg") and self.generated.match(info["name"]):
                        info["hint"] = names[next(iter(r))]
            stack.extend(v for v in n.values() if isinstance(v, (dict, list)))

    def _base_name(self, info):
        h = info["hint"]
        if h == "arg" and (info.get("label") or info.get("prop")):
            return info.get("label") or info["prop"]      # a parameter: named from use
        if isinstance(h, tuple):
            key, base = h
            if base is not None:
                if base[0] == "local":
                    src = self.locals.get(base[1])
                    nm = singular(src.get("new")) if src else None
                    if nm:
                        return nm
                else:
                    nm = singular(base[1])
                    if nm:
                        return nm
            return key
        if h:
            return h
        for expr, idx in info["hints"]:
            nm = self.infer(expr, idx)
            if nm:
                if nm == "tbl" and info.get("dispatch"):
                    return "handlers"
                if nm in WEAK and (info.get("label") or info.get("prop")):
                    return info.get("label") or info["prop"]
                return nm
        return info.get("label") or "v"

    # ---- naming
    def run(self):
        self.collect()
        self.usage_facts()
        for key in self.self_candidates:
            info = self.locals.get(key)
            if info is not None and len(info["refs"]) == 1 and not info["hints"]:
                info["role"] = "self"
        for key, role in self.pending_roles:
            info = self.locals.get(key)
            if info is not None and len(info["hints"]) <= 1:
                info["role"] = role
        taken = {}          # name -> [infos]
        reserved = self.globals | KEYWORDS
        for key in self.order:
            info = self.locals[key]
            info["refs"].sort()
            if not self.generated.match(info["name"]):
                info["new"] = info["name"]
                taken.setdefault(info["name"], []).append(info)
        for key in sorted(self.order, key=lambda k: self.locals[k]["decl"]):     # numbered in reading order
            info = self.locals[key]
            if "new" in info:
                continue
            base = self.base_name(info)
            if not base or not re.match(r"^[A-Za-z_]\w*$", base) or (base in reserved and info.get("role") != "self"):
                base = (base or "v") + "_"
                if not re.match(r"^[A-Za-z_]\w*$", base):
                    base = "v"
            n = 1
            while True:
                cand = base if n == 1 else "%s%d" % (base, n)
                if (cand not in reserved or (cand == "self" and info.get("role") == "self")) \
                        and self.fits(cand, info, taken):
                    break
                n += 1
            info["new"] = cand
            taken.setdefault(cand, []).append(info)
        return self.rewrite()

    def fits(self, cand, info, taken):
        """No other local named `cand` has a scope overlapping this one's: a
        generated name never shadows (Luau lint: LocalShadow), even where it
        would be legal because the outer one isn't referenced inside."""
        s0, s1 = info["scope"]
        if cand == "self" and info.get("role") == "self" and not any(
                s0 < r < s1 for o in taken.get(cand, ()) for r in o["refs"][1:]):
            # an unused self parameter: shadowing changes no reference (no
            # other self is used inside this function)
            return True
        for other in taken.get(cand, ()):
            o0, o1 = other["scope"]
            if s0 < o1 and o0 < s1:
                return False
        return True

    def rewrite(self):
        lines = self.text.split("\n")
        edits = {}
        for info in self.locals.values():
            if info["new"] == info["name"]:
                continue
            for (a, b) in info["spans"]:
                edits.setdefault(a[0], []).append((a[1], b[1], info["name"], info["new"]))
        for ln, lst in edits.items():
            s = lines[ln].encode("utf-8")       # luau-ast columns are byte offsets
            for c0, c1, old, new in sorted(lst, reverse=True):
                if s[c0:c1] == old.encode("utf-8"):
                    s = s[:c0] + new.encode("utf-8") + s[c1:]
            lines[ln] = s.decode("utf-8")
        return "\n".join(lines)


def rename_text(text):
    return Namer(text).run()


def refine_text(text):
    """Second naming pass over the finished text: renames only the names the
    first pass had no evidence for (v12, arg, tbl3, fn20, ...)."""
    return Namer(text, refine=True).run()


def main():
    import argparse
    ap = argparse.ArgumentParser()
    ap.add_argument("file")
    ap.add_argument("-o", "--output")
    a = ap.parse_args()
    with open(a.file, encoding="utf-8") as f:
        text = f.read()
    out = rename_text(text)
    with open(a.output or a.file, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)


if __name__ == "__main__":
    main()
