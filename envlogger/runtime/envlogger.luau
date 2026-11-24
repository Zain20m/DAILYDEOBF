--[[ ENVLOGGER v4 runtime — sandbox + Luau behavior reconstruction ]]
local CFG = __ENVLOGGER_CFG or rawget(_G, "__ENVLOGGER_CFG") or {}
local MARK = "EL|"
local START = os.clock()
local MAX_STMTS = tonumber(CFG.max_stmts) or 12000
local TIME_BUDGET = tonumber(CFG.time_budget) or 25
local CAPTURE_LOADSTRING = CFG.capture_loadstring ~= false

local stmtCount = 0
local lines = {}
local behavior = {}
local urls = {}
local remotes = {}
local loadstrings = {}
local services = {}
local errors = {}
local unknownGlobals = {}
local prints = {}
local memberAccesses = {}
local simulatedWait = 0

local function now()
	return string.format("%.3f", os.clock() - START)
end
local function trunc(s, n)
	s = tostring(s or "")
	n = n or 160
	if #s > n then return s:sub(1, n) .. "…" end
	return s
end
local function emit(kind, msg)
	if stmtCount >= MAX_STMTS then return end
	stmtCount += 1
	lines[#lines + 1] = string.format("[%s] #%d %s %s", now(), stmtCount, kind, msg)
end
local function beh(line)
	behavior[#behavior + 1] = line
end
local function typeSummary(value)
  local kind = type(value)
  if kind == "string" then return "string[" .. tostring(#value) .. "]" end
  return kind
end

local function safeUrl(value)
  local url = tostring(value or "")
  url = string.gsub(url, "([?&][%w_%-]*token[%w_%-]*=)[^&%s]+", "%1[REDACTED]")
  url = string.gsub(url, "([?&][%w_%-]*key[%w_%-]*=)[^&%s]+", "%1[REDACTED]")
  url = string.gsub(url, "([?&][%w_%-]*secret[%w_%-]*=)[^&%s]+", "%1[REDACTED]")
  url = string.gsub(url, "([?&][%w_%-]*auth[%w_%-]*=)[^&%s]+", "%1[REDACTED]")
  url = string.gsub(url, "(discord%.com/api/webhooks/%d+/)[^/%s?]+", "%1[REDACTED]")
  return url
end

local function noteError(where, err)
	errors[#errors + 1] = where .. ": " .. trunc(err, 240)
	emit("ERROR", where .. " -> " .. trunc(err, 240))
end

local ENV = {}

local function svc(name)
	name = tostring(name)
	services[name] = (services[name] or 0) + 1
	emit("SERVICE", "GetService(" .. name .. ")")
	beh(string.format('local %s = game:GetService(%q)', name:gsub("%W", "_"), name))
	local o = { Name = name, ClassName = name }
	return setmetatable(o, {
		__index = function(_, k)
			local member = name .. "." .. tostring(k)
			memberAccesses[member] = (memberAccesses[member] or 0) + 1
			emit("MEMBER", member)
			if k == "GetService" then
				return function(_, n) return svc(tostring(n)) end
			end
			if k == "FindFirstChild" or k == "WaitForChild" or k == "FindFirstChildOfClass" then
				return function(_, n)
					emit("INSTANCE", name .. ":" .. k .. "(" .. tostring(n) .. ")")
					beh(string.format("-- %s:%s(%q)", name, k, tostring(n)))
					return svc(tostring(n))
				end
			end
			if k == "FireServer" or k == "InvokeServer" or k == "Fire" or k == "Invoke" then
				return function(...)
					local args = table.pack(...)
					local parts = {}
					for i = 2, args.n do parts[#parts + 1] = typeSummary(args[i]) end
					remotes[#remotes + 1] = name .. ":" .. k .. "(args=" .. tostring(math.max(0, args.n - 1)) .. "; types=" .. table.concat(parts, ", ") .. ")"
					emit("REMOTE", name .. ":" .. k)
					beh(string.format("%s:%s(...)", name, k))
				end
			end
			if k == "LocalPlayer" then
				return {
					UserId = 1, Name = "Player", Character = nil,
					Kick = function(_, msg)
						emit("KICK", trunc(msg, 120))
						beh(string.format("-- LocalPlayer:Kick(%q)", trunc(msg, 80)))
					end,
				}
			end
			if k == "Connect" or k == "connect" then
				return function(_, fn)
					emit("SIGNAL", name .. ".Connect")
					if type(fn) == "function" then pcall(fn) end
					return { Disconnect = function() end }
				end
			end
			return function() end
		end,
	})
end

local gameObj = svc("game")
ENV.game = gameObj
ENV.Game = gameObj
ENV.workspace = svc("Workspace")
ENV.Workspace = ENV.workspace
ENV._G = ENV
ENV._VERSION = "Luau"
ENV.type = type
ENV.typeof = function(v)
	if v == gameObj or (type(v) == "table" and v.ClassName) then return "Instance" end
	return type(v)
end
ENV.print = function(...)
	local n = select("#", ...)
	local parts = {}
	for i = 1, n do parts[i] = tostring(select(i, ...)) end
	local msg = table.concat(parts, "\t")
	prints[#prints + 1] = msg
	emit("PRINT", trunc(msg, 200))
	local q = {}
	for i = 1, n do q[i] = string.format("%q", parts[i]) end
	beh("print(" .. table.concat(q, ", ") .. ")")
end
ENV.warn = function(...)
	local n = select("#", ...)
	local parts = {}
	for i = 1, n do parts[i] = tostring(select(i, ...)) end
	emit("WARN", trunc(table.concat(parts, "\t"), 200))
	beh("-- warn(...)")
end
ENV.pcall = pcall
ENV.xpcall = xpcall
ENV.pairs = pairs
ENV.ipairs = ipairs
ENV.next = next
ENV.select = select
ENV.tostring = tostring
ENV.tonumber = tonumber
ENV.rawget = rawget
ENV.rawset = rawset
ENV.setmetatable = setmetatable
ENV.getmetatable = getmetatable
ENV.error = error
ENV.assert = function(cond, msg)
	if not cond then
		emit("ASSERT", trunc(msg, 160))
		local m = tostring(msg or "")
		if string.find(m, "decompression", 1, true) or string.find(m, "Obscura", 1, true) then
			return cond
		end
		error(m ~= "" and m or "assertion failed!", 2)
	end
	return cond
end
ENV.string = string
ENV.table = table
ENV.math = math
ENV.bit32 = bit32 or {}
ENV.buffer = buffer
ENV.utf8 = utf8
ENV.coroutine = coroutine
ENV.os = { clock = os.clock, time = os.time, date = os.date }
ENV.tick = function() return 1700000000 + os.clock() end
ENV.task = {
	wait = function(t)
		local delay = math.max(0, tonumber(t) or 0)
		simulatedWait += delay
		emit("TASK", "task.wait(" .. tostring(delay) .. ") [simulated; total=" .. string.format("%.2f", simulatedWait) .. "s]")
		beh(string.format("task.wait(%s) -- simulated in sandbox", tostring(delay)))
		return delay
	end,
	spawn = function(fn)
		emit("TASK", "task.spawn")
		beh("task.spawn(function() ... end)")
		if type(fn) == "function" then pcall(fn) end
	end,
	delay = function(t, fn)
		emit("TASK", "task.delay")
		if type(fn) == "function" then pcall(fn) end
	end,
	defer = function(fn)
		emit("TASK", "task.defer [executed immediately in sandbox]")
		if type(fn) == "function" then pcall(fn) end
	end,
	cancel = function() end,
}
ENV.wait = ENV.task.wait
ENV.spawn = ENV.task.spawn
ENV.delay = ENV.task.delay
ENV.debug = {
	getinfo = function() return { source = "=sandbox", what = "Lua", namewhat = "", nups = 0, short_src = "sandbox" } end,
	info = function() return { source = "=sandbox", what = "Lua" } end,
	gethook = function() return nil end,
	traceback = debug and debug.traceback or function() return "" end,
}
ENV.getgenv = function()
	return setmetatable({}, {
		__newindex = function(_, k, v)
			emit("GETGENV", "write " .. tostring(k))
			beh(string.format("getgenv().%s = ...", tostring(k)))
			rawset(ENV, k, v)
		end,
		__index = function(_, k) return ENV[k] end,
	})
end
ENV.getrenv = function() return ENV end
ENV.identifyexecutor = function() return "ENVLOGGER", "4.0" end
ENV.getexecutorname = ENV.identifyexecutor
local function recordRequest(method, url)
	local cleanUrl = safeUrl(url)
	urls[#urls + 1] = tostring(method) .. " " .. cleanUrl
	emit("HTTP", tostring(method) .. " " .. trunc(cleanUrl, 180) .. " [network blocked]")
	beh(string.format("-- sandbox blocked %s %q", tostring(method), trunc(cleanUrl, 120)))
	return { Success = false, StatusCode = 0, StatusMessage = "Blocked by ENVLOGGER sandbox", Body = "", Headers = {} }
end

ENV.HttpGet = function(_, url)
	recordRequest("GET", url)
	return ""
end
ENV.HttpPost = function(_, url)
	recordRequest("POST", url)
	return ""
end
ENV.request = function(options)
	local opts = type(options) == "table" and options or {}
	return recordRequest(opts.Method or opts.method or "GET", opts.Url or opts.url or "")
end
ENV.http_request = ENV.request
ENV.syn = { request = ENV.request }
gameObj.HttpGet = ENV.HttpGet
gameObj.HttpPost = ENV.HttpPost

local function soft_repair_source(src)
	local fixed = src
	fixed = string.gsub(fixed, "(#[%w_]+)do([^%w_])", "%1 do%2")
	fixed = string.gsub(fixed, "(#[%w_]+)do$", "%1 do")
	fixed = string.gsub(fixed, "(__s%[[^%]]+%])%s*~%s*(%b())", "bit32.bxor(%1,%2)")
	fixed = string.gsub(fixed, "{%s*;", "{")
	fixed = string.gsub(fixed, ",%s*;", ",")
	fixed = string.gsub(fixed, ";%s*}", "}")
	fixed = string.gsub(fixed, ";;+", ";")
	fixed = string.gsub(fixed, "(%f[%w]do)%s*;", "%1 ")
	fixed = string.gsub(fixed, "(%f[%w]then)%s*;", "%1 ")
	return fixed
end

ENV.loadstring = function(src, chunkname)
	local size = type(src) == "string" and #src or 0
	emit("LOADSTRING", "loadstring(" .. tostring(size) .. " bytes)")
	beh(string.format("-- loadstring(%d bytes)", size))
	if type(src) == "string" and CAPTURE_LOADSTRING and size > 0 then
		loadstrings[#loadstrings + 1] = { size = size, head = src:sub(1, 400), body = src }
		if string.find(src, "__PID", 1, true) or string.find(src, "__ENT", 1, true)
			or string.find(src, "__venv", 1, true) or string.find(src, "envlog", 1, true) then
			emit("ANTIVM", "loadstring body scans for envlogger/sandbox markers")
		end
	end
	if type(src) ~= "string" then return nil, "invalid source" end
	local fn, err = loadstring(src, chunkname or "=envlogger_chunk")
	if not fn then
		local fixed = soft_repair_source(src)
		if fixed ~= src then
			fn, err = loadstring(fixed, chunkname or "=envlogger_chunk_fixed")
			if fn then emit("LOADSTRING", "soft-repaired minifier glue") end
		end
	end
	if not fn then
		emit("LOADSTRING", "compile failed: " .. trunc(err, 160))
		return nil, err
	end
	if setfenv then pcall(setfenv, fn, ENV) end
	return fn
end
ENV.load = ENV.loadstring

setmetatable(ENV, {
	__index = function(_, k)
		unknownGlobals[k] = (unknownGlobals[k] or 0) + 1
		emit("PROBE", "unknown global " .. tostring(k))
		return setmetatable({}, {
			__call = function() return nil end,
			__index = function() return function() end end,
		})
	end,
})

local source = __ENVLOGGER_SOURCE
if type(source) ~= "string" or #source == 0 then
	source = rawget(_G, "__ENVLOGGER_SOURCE")
end
if type(source) ~= "string" or #source == 0 then
	print(MARK .. "FATAL no source")
	return
end

beh("-- ENVLOGGER reconstructed behavior (sandbox observation, not original source)")
beh("-- bytes=" .. tostring(#source))
beh("")

emit("BOOT", "envlogger start bytes=" .. tostring(#source))
local chunk, cerr = loadstring(source, "=target")
if not chunk then
	local fixed = soft_repair_source(source)
	chunk, cerr = loadstring(fixed, "=target_fixed")
end
if not chunk then
	noteError("compile", cerr)
else
	if setfenv then setfenv(chunk, ENV) end
	local ok, err = pcall(chunk)
	if not ok then noteError("runtime", err) end
end
emit("BOOT", "envlogger end stmts=" .. tostring(stmtCount))

print(MARK .. "BEGIN")
print(string.format("-- ENVLOGGER report  stmts=%d  elapsed=%.2fs  simulated_wait=%.2f  source=%d bytes", stmtCount, os.clock() - START, simulatedWait, #source))
print("-- status: " .. (#errors == 0 and "finished" or ("errors=" .. tostring(#errors))))
if next(services) then
	print("-- services:")
	for name, n in pairs(services) do print(string.format("--   %s x%d", name, n)) end
end
if #urls > 0 then
	print("-- urls:")
	for _, u in ipairs(urls) do print("--   " .. trunc(u, 220)) end
end
if #remotes > 0 then
	print("-- remotes:")
	for _, r in ipairs(remotes) do print("--   " .. trunc(r, 220)) end
end
if #prints > 0 then
	print("-- prints:")
	for _, p in ipairs(prints) do print("--   " .. trunc(p, 220)) end
end
if #loadstrings > 0 then
	print("-- loadstring captures:")
	for i, ls in ipairs(loadstrings) do
		print(string.format("--   [%d] %d bytes head=%q", i, ls.size, trunc(ls.head, 120)))
		if ls.body and #ls.body <= 16000 then
			print("--   --- begin dump [" .. tostring(i) .. "] ---")
			for line in string.gmatch(ls.body, "[^\n]*") do print("--   | " .. line) end
			print("--   --- end dump [" .. tostring(i) .. "] ---")
		end
	end
end
if next(memberAccesses) then
	print("-- member accesses:")
	for member, n in pairs(memberAccesses) do print(string.format("--   %s x%d", member, n)) end
end
if next(unknownGlobals) then
	print("-- unknown globals:")
	for k, n in pairs(unknownGlobals) do print(string.format("--   %s x%d", k, n)) end
end
if #errors > 0 then
	print("-- errors:")
	for _, e in ipairs(errors) do print("--   " .. e) end
end
print("-- behavior_script:")
print("-- ===BEGIN_BEHAVIOR_LUA===")
for _, line in ipairs(behavior) do print(line) end
print("-- ===END_BEHAVIOR_LUA===")
print("-- trace:")
for _, line in ipairs(lines) do print(line) end
print(MARK .. "END")
