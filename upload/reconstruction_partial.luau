--!nonstrict
-- Verified partial reconstruction of:
-- upload/message - 2026-11-10T202216.560.txt
--
-- STATUS: PARTIAL, NOT A DROP-IN REPLACEMENT.
-- This module contains only behavior that can be established from the recovered text.
-- The missing Luraph runtime functions and unresolved prototype stores are not recreated.

local Reconstructed = {}

-- payload_fn_2:
-- Appends the low byte of a value to a byte table and advances its 1-based cursor.
function Reconstructed.appendByte(bytes, cursor, value)
	cursor += 1
	bytes[cursor] = value % 256
	return cursor
end

-- payload_fn_3:
-- Writes the requested number of least-significant bytes, least-significant first.
function Reconstructed.appendIntegerLittleEndian(bytes, cursor, value, byteCount)
	for _ = 1, byteCount do
		local byte = value % 256
		cursor += 1
		bytes[cursor] = byte
		value = (value - byte) / 256
	end

	return cursor
end

-- payload_fn_10:
-- FNV-1a 32-bit hashing, followed by the recovered final XOR constant.
-- The original byte count came from a captured upvalue; callers must provide it.
function Reconstructed.hashBytePrefix(source, byteCount)
	local hash = 2166136261

	for index = 1, byteCount do
		hash = bit32.bxor(hash, string.byte(source, index))

		-- Multiply by the FNV prime 16,777,619 modulo 2^32
		-- using 16-bit pieces to preserve exact integer arithmetic.
		local low = hash % 65536
		local high = (hash - low) / 65536
		hash = ((high * 403 + low * 256) * 65536 + low * 403) % 4294967296
	end

	return bit32.bxor(hash, 178550505)
end

-- payload_fn_28:
-- The recovered function consists of this single property assignment.
function Reconstructed.setParent(child, parent)
	child.Parent = parent
end

local function attempt(results, name, callback)
	local ok, value = pcall(callback)
	table.insert(results, {
		name = name,
		ok = ok,
		detail = if ok then nil else tostring(value),
	})
end

-- Re-expresses the observable calls in payload_fn_13 as grouped feature checks.
-- Unlike the original, each group is protected so a missing API is reported rather
-- than preventing the remaining groups from being inspected.
function Reconstructed.runKnownApiSurfaceProbe()
	local results = {}

	attempt(results, "Luau standard-library surface", function()
		local environment = getfenv(0)
		local values = { "probe" }
		assert(type(environment) == "table")
		assert(typeof(0) == "number")
		assert(select("#", 1, 2, 3) == 3)
		assert(tonumber("1") == 1)
		assert(tostring(1) == "1")
		assert(rawequal(values, values))
		assert(next(values) ~= nil)
		assert(pairs(values)(values) ~= nil)
		assert(ipairs(values)(values, 1) ~= nil)
		assert(rawlen(values) == 1)
		assert(rawget(values, 1) == "probe")
		rawset(values, 2, "value")
		local meta = getmetatable(values)
		setmetatable(values, {})
		setmetatable(values, nil)
		return meta
	end)

	attempt(results, "bit32 operations", function()
		bit32.bor(109, 208)
		bit32.bxor(204, 75)
		bit32.band(228, 31)
		bit32.bnot(134)
		bit32.lshift(26, 24)
		bit32.rshift(110, 19)
		bit32.lrotate(57, 1)
		bit32.rrotate(125, 25)
		bit32.countlz(104)
		bit32.countrz(190)
	end)

	attempt(results, "buffer operations", function()
		local data = buffer.create(128)
		buffer.len(data)
		buffer.fromstring("")
		buffer.tostring(data)
		buffer.readi8(data, 17)
		buffer.readu8(data, 20)
		buffer.readi16(data, 20)
		buffer.readu16(data, 9)
		buffer.readi32(data, 9)
		buffer.readu32(data, 4)
		buffer.readf32(data, 12)
		buffer.readf64(data, 26)
		buffer.writei8(data, 29, -95)
		buffer.writeu8(data, 13, 123)
		buffer.writei16(data, 13, -22529)
		buffer.writeu16(data, 27, 58383)
		buffer.writei32(data, 17, -2061910737)
		buffer.writeu32(data, 2, 1282658724)
		buffer.writef32(data, 24, 14252)
		buffer.writef64(data, 18, 28899)
		buffer.readstring(data, 14, 11)
		buffer.writestring(data, 21, "Luraph", 0)
		buffer.readbits(data, 211, 24)
		buffer.writebits(data, 38, 3, 818490583)
		buffer.copy(data, 32, data, 0, 16)
		buffer.fill(data, 0, 239, 21)
	end)

	attempt(results, "Random API", function()
		local random = Random.new()
		random:NextInteger(15, 384)
		random:NextNumber(9, 787)
		random:NextUnitVector()
		random:NextNumber()
		random:Shuffle({})
		random:Clone()
	end)

	attempt(results, "CFrame and Vector3 APIs", function()
		local first = Vector3.new(0.36199006, 0.25054455, 0.3590625)
		local second = Vector3.new(0.24420778, 0.6849509, 0.57623744)
		local xAxis = Vector3.new(1, 0, 0)
		local yAxis = Vector3.new(0, 1, 0)
		local frame = CFrame.new()
		local other = CFrame.new(first)
		CFrame.Angles(0.60603588149602461, 0.80395399956728986, 0.1583023104331942)
		CFrame.new(first, first + second)
		CFrame.new(first.X, first.Y, first.Z)
		CFrame.new(first.X, first.Y, first.Z, 0, 0, 0, 1)
		CFrame.new(first.X, first.Y, first.Z, 1, 0, 0, 0, 1, 0, 0, 0, 1)
		CFrame.lookAt(first, first + second, yAxis)
		CFrame.lookAlong(first, second, yAxis)
		CFrame.fromEulerAnglesXYZ(0.60603588149602461, 0.80395399956728986, 0.1583023104331942)
		CFrame.fromEulerAnglesYXZ(0.60603588149602461, 0.80395399956728986, 0.1583023104331942)
		CFrame.fromOrientation(0.60603588149602461, 0.80395399956728986, 0.1583023104331942)
		CFrame.fromAxisAngle(second.Unit, 0.60603588149602461)
		CFrame.fromRotationBetweenVectors(xAxis, yAxis)
		CFrame.fromMatrix(first, xAxis, yAxis, Vector3.new(0, 0, 1))
		CFrame.fromEulerAngles(0.60603588149602461, 0.80395399956728986, 0.1583023104331942, Enum.RotationOrder.XYZ)
		frame:Inverse()
		frame:Orthonormalize()
		frame:Lerp(other, 0.61426829366405467)
		frame:ToWorldSpace(other)
		frame:ToObjectSpace(other)
		frame:ToEulerAnglesXYZ()
		frame:ToEulerAnglesYXZ()
		frame:PointToWorldSpace(first)
		frame:PointToObjectSpace(first)
		frame:VectorToWorldSpace(second)
		frame:VectorToObjectSpace(second)
		frame:ToEulerAngles(Enum.RotationOrder.XYZ)
		frame:GetComponents()
		frame:ToOrientation()
		frame:ToAxisAngle()
		frame:FuzzyEq(other)
		frame:AngleBetween(other)
		Vector3.FromAxis(Enum.Axis.X)
		Vector3.FromNormalId(Enum.NormalId.Top)
		first:Abs()
		first:Ceil()
		first:Floor()
		first:Sign()
		first:Dot(second)
		first:Cross(second)
		first:Angle(second)
		first:FuzzyEq(second)
		first:Lerp(second, 0.61537441201469489)
		first:Max(second)
		first:Min(second)
	end)

	attempt(results, "Vector2 APIs", function()
		local first = Vector2.new(0.61152452230453491, 0.2495693564414978)
		local second = Vector2.new(0.94483035802841187, 0.49274951219558716)
		first:Abs()
		first:Ceil()
		first:Floor()
		first:Sign()
		first:Dot(second)
		first:Cross(second)
		first:Angle(second)
		first:FuzzyEq(second)
		first:Lerp(second, 0.46336529077172073)
		first:Max(second)
		first:Min(second)
	end)

	attempt(results, "UDim and UDim2 APIs", function()
		local unit = UDim.new(0.73319336911837918, 31)
		local first = UDim2.new(-0.64045628619113204, -121, 0.6835776353190457, 72)
		local second = UDim2.new(-0.015610496258734452, 103, 0.20573810514279023, -119)
		unit:Lerp(unit, 0.5)
		first:Lerp(second, 0.93009658864657185)
	end)

	attempt(results, "Enum APIs", function()
		local item = Enum.HumanoidRigType:FromValue(0)
		local rigType = item.EnumType:FromName("R6")
		local roundTrip = rigType.EnumType.R6.EnumType:FromValue(1)
		local enumType = roundTrip.EnumType
		enumType:GetEnumItems()
		enumType:FromName(roundTrip.Name)
		enumType:FromValue(roundTrip.Value)
	end)

	attempt(results, "UTF-8 APIs", function()
		local text = utf8.char(39, 994, 474887)
		utf8.codepoint(text, 1, #text)
		utf8.len(text)
		utf8.offset(text, 1)
		utf8.offset(text, -1)
		local iterator, state, initial = utf8.codes(text)
		iterator(state, initial)
		iterator(state, utf8.offset(text, 1))
		local other = utf8.char(99, 854)
		utf8.nfcnormalize(other)
		utf8.nfdnormalize(text)
		utf8.graphemes(other, 1, #other)()
	end)

	return results
end

-- The recovered chunk's final section validates an Instance and its event/signal
-- contract. The original used hidden comparison/reporting callbacks; this version
-- expresses the checks as ordinary assertions and exposes the expected class name.
function Reconstructed.verifyInstanceContract(instance, expectedClassName)
	assert(type(instance) == "userdata", "Expected an Instance-like userdata value")
	assert(typeof(instance) == "Instance", "Expected typeof(value) == 'Instance'")

	local parent = instance.Parent
	assert(parent == instance.Parent, "Parent property was not stable")

	local name = instance.Name
	assert(type(name) == "string", "Instance.Name must be a string")
	assert(name == instance.Name, "Name property was not stable")
	assert(#name == #instance.Name, "Name length was not stable")
	assert(tostring(instance) == name, "tostring(instance) did not match Name")
	assert(instance.ClassName == expectedClassName, "ClassName did not match expected value")

	local attributeChanged = instance.AttributeChanged
	assert(attributeChanged == instance.AttributeChanged, "AttributeChanged signal was not stable")
	assert(type(attributeChanged.Connect) == "function", "AttributeChanged.Connect is unavailable")
	assert(type(attributeChanged.Wait) == "function", "AttributeChanged.Wait is unavailable")

	local changedConnection = instance.Changed:Connect(function()
		-- The original only needed a callback to create a connection.
	end)
	assert(type(changedConnection.Disconnect) == "function", "Connection.Disconnect is unavailable")
	changedConnection:Disconnect()
	assert(changedConnection.Connected == false, "Connection remained connected after Disconnect")

	local thread = coroutine.create(function()
		return attributeChanged:Wait()
	end)
	local resumed = coroutine.resume(thread)
	assert(resumed, "Waiting on AttributeChanged failed to resume")
	assert(coroutine.status(thread) == "suspended", "Signal Wait did not suspend the coroutine")

	local closeOk, closeResult = pcall(coroutine.close, thread)
	assert(closeOk and closeResult, "Could not close the suspended signal-wait coroutine")
	assert(coroutine.status(thread) == "dead", "Closed coroutine was not dead")

	assert(getmetatable(instance) == "The metatable is locked", "Unexpected Instance metatable")
	return true
end

return Reconstructed
