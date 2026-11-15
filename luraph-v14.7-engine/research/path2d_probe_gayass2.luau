-- Path2D probe for one Luraph 14.9 file (gayass2): repeats the exact 12
-- Path2D calls that file's environment check makes, and prints the engine's
-- answers in the engine's .path2d cache format (key<TAB>value per line).
--
-- Run it in Roblox Studio's command bar (or any client), copy the printed
-- lines into a file named like the input with the .path2d extension
-- (input.lua -> input.path2d) next to it, and the 14.x engine replays
-- these real answers instead of its offline model.
-- It only creates a ScreenGui/Frame/Path2D, never parents them anywhere, and
-- destroys them at the end.

local function enc(v)
	local t = typeof(v)
	if t == "number" then return string.format("n:%.17g", v) end
	if t == "UDim2" then
		return string.format("u:%.17g,%.17g,%.17g,%.17g", v.X.Scale, v.X.Offset, v.Y.Scale, v.Y.Offset)
	end
	if t == "Vector2" then return string.format("v:%.17g,%.17g", v.X, v.Y) end
	if t == "nil" then return "z:" end
	return "?" .. t
end

local gui = Instance.new("ScreenGui")
local frame = Instance.new("Frame")
frame.Position = UDim2.new(0, 0, 0, 0)
frame.Size = UDim2.new(0, 196, 0, 154)
frame.Parent = gui
local p = Instance.new("Path2D")
p.Parent = frame
p:SetControlPoints({
	Path2DControlPoint.new(UDim2.new(0, 0, 0, 8), UDim2.new(0, -1, 0, 5), UDim2.new(0, -6, -0.125, -2)),
	Path2DControlPoint.new(UDim2.new(0, -5, 0.125, 8), UDim2.new(0, 0, 0, 0), UDim2.new(-0.125, 7, 0, 0)),
	Path2DControlPoint.new(UDim2.new(0, 8, 0.25, -5), UDim2.new(0, -6, 0, -3), UDim2.new(0.125, -2, 0, -7)),
})

-- the arguments exactly as the script passes them (float32 values)
local calls = {
	{ "GetLength" },
	{ "GetPositionOnCurve", 0.1428571492433548 },
	{ "GetPositionOnCurve", 0.90909093618392944 },
	{ "GetTangentOnCurve", 0.40000000596046448 },
	{ "GetTangentOnCurve", 0.3333333432674408 },
	{ "GetTangentOnCurve", 0.1875 },
	{ "GetTangentOnCurve", 0.23076923191547394 },
	{ "GetPositionOnCurveArcLength", 0.066666670143604279 },
	{ "GetPositionOnCurveArcLength", 0.75 },
	{ "GetTangentOnCurveArcLength", 0.71428573131561279 },
	{ "GetTangentOnCurveArcLength", 0.60000002384185791 },
	{ "GetTangentOnCurveArcLength", 0.25 },
}
local out = {}
for _, c in calls do
	local name, arg = c[1], c[2]
	local key = arg and (name .. "|" .. string.format("%.17g", arg)) or name
	local ok, res
	if arg then ok, res = pcall(p[name], p, arg) else ok, res = pcall(p[name], p) end
	out[#out + 1] = key .. "\t" .. (ok and enc(res) or ("ERROR " .. tostring(res)))
end
gui:Destroy()
print("---- copy from here ----\n" .. table.concat(out, "\n") .. "\n---- to here ----")
