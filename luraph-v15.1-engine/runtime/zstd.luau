--!nocheck
-- Zstandard (RFC 8878) for the offline Roblox model: EncodingService's
-- DecompressBuffer / CompressBuffer / GetDecompressedBufferSize and
-- Base64Encode / Base64Decode. Scripts (e.g. Luraph 14.7 payloads) ship a
-- zstd-compressed buffer and decompress it at run time; without this the
-- trace stops at the first buffer read of the result.
--
-- The decoder covers the whole format except dictionaries: raw / RLE /
-- compressed blocks, raw / RLE / Huffman (1 and 4 streams, treeless reuse)
-- literals, FSE sequences in predefined / RLE / compressed / repeat modes,
-- repeat offsets, multiple and skippable frames. The checksum is skipped.
-- The encoder writes valid frames of raw blocks (no compression): enough
-- for a script that decompresses what it compressed itself.
-- Self-contained: captures the real buffer library at load time.

local buffer = buffer
local floor = math.floor
local readu8 = buffer.readu8

local P2 = {}
do
	local v = 1
	for i = 0, 53 do
		P2[i] = v
		v = v * 2
	end
end

local function fail(msg)
	error("zstd: " .. msg, 0)
end

local function highbit(v) -- floor(log2(v)), v >= 1
	local n = 0
	while v >= 2 do
		v = floor(v / 2)
		n = n + 1
	end
	return n
end

-- ---- growable output ------------------------------------------------------
local Out = {}
Out.__index = Out

local function newOut(cap)
	return setmetatable({ b = buffer.create(math.max(cap, 64)), n = 0 }, Out)
end

function Out:reserve(extra)
	local need = self.n + extra
	local cap = buffer.len(self.b)
	if need > cap then
		local nc = cap
		while nc < need do
			nc = nc * 2
		end
		local nb = buffer.create(nc)
		buffer.copy(nb, 0, self.b, 0, self.n)
		self.b = nb
	end
end

function Out:finish()
	local r = buffer.create(self.n)
	buffer.copy(r, 0, self.b, 0, self.n)
	return r
end

-- ---- forward bit reader (FSE table descriptions) ----------------------------
local function fwdBits(src, start, limit)
	local r = { pos = start * 8, limit = limit }
	function r.read(n)
		if n == 0 then
			return 0
		end
		local p = r.pos
		local byte = floor(p / 8)
		local shift = p % 8
		local acc, mul = 0, 1
		local k = 0
		while k * 8 < n + shift do
			local b = byte + k < r.limit and readu8(src, byte + k) or 0
			acc = acc + b * mul
			mul = mul * 256
			k = k + 1
		end
		r.pos = p + n
		return floor(acc / P2[shift]) % P2[n]
	end
	function r.peek(n)
		local save = r.pos
		local v = r.read(n)
		r.pos = save
		return v
	end
	return r
end

-- ---- backward bit reader (Huffman streams, FSE bitstreams) ------------------
-- The stream's last byte holds a 1-marker above the data; bits are read from
-- the end towards the start, most significant first. Positions below the
-- start read as zero (the decoders detect that "overflow" themselves).
local function bwdBits(src, start, size)
	if size <= 0 then
		fail("empty bitstream")
	end
	local last = readu8(src, start + size - 1)
	if last == 0 then
		fail("bitstream without end marker")
	end
	local r = { pos = (size - 1) * 8 + highbit(last) }
	local function get(p, n) -- n bits at bit position p (may be negative)
		if n == 0 then
			return 0
		end
		local lo = p
		local skip = 0
		if lo < 0 then
			skip = -lo
			if skip >= n then
				return 0
			end
			lo = 0
		end
		local m = n - skip
		local byte = floor(lo / 8)
		local shift = lo % 8
		local acc, mul = 0, 1
		local k = 0
		while k * 8 < m + shift do
			local bi = byte + k
			local b = bi < size and readu8(src, start + bi) or 0
			acc = acc + b * mul
			mul = mul * 256
			k = k + 1
		end
		return (floor(acc / P2[shift]) % P2[m]) * P2[skip]
	end
	function r.read(n)
		r.pos = r.pos - n
		return get(r.pos, n)
	end
	function r.peek(n)
		return get(r.pos - n, n)
	end
	return r
end

-- ---- FSE ---------------------------------------------------------------------
local function buildFSE(norm, nsym, al)
	local size = P2[al]
	local sym, nb, base = {}, {}, {}
	local high = size - 1
	local nextS = {}
	for s = 0, nsym - 1 do
		if norm[s] == -1 then
			sym[high] = s
			high = high - 1
			nextS[s] = 1
		else
			nextS[s] = norm[s]
		end
	end
	local step = floor(size / 2) + floor(size / 8) + 3
	local mask = size - 1
	local pos = 0
	for s = 0, nsym - 1 do
		local c = norm[s]
		if c > 0 then
			for _ = 1, c do
				sym[pos] = s
				repeat
					pos = (pos + step) % (mask + 1)
				until pos <= high
			end
		end
	end
	if pos ~= 0 then
		fail("bad FSE spread")
	end
	for u = 0, size - 1 do
		local s = sym[u]
		local ns = nextS[s]
		nextS[s] = ns + 1
		local bits = al - highbit(ns)
		nb[u] = bits
		base[u] = ns * P2[bits] - size
	end
	return { sym = sym, nb = nb, base = base, al = al }
end

local function readFSE(src, at, limit, maxAL, maxSym)
	local br = fwdBits(src, at, limit)
	local al = br.read(4) + 5
	if al > maxAL then
		fail("FSE accuracy too large")
	end
	local remaining = P2[al] + 1
	local threshold = P2[al]
	local nbBits = al + 1
	local s = 0
	local norm = {}
	local prev0 = false
	while remaining > 1 and s <= maxSym do
		if prev0 then
			local r = br.read(2)
			while true do
				for _ = 1, r do
					norm[s] = 0
					s = s + 1
				end
				if r ~= 3 then
					break
				end
				r = br.read(2)
			end
			if s > maxSym then
				break
			end
		end
		local max = (2 * threshold - 1) - remaining
		local low = br.peek(nbBits - 1)
		local count
		if low < max then
			count = low
			br.read(nbBits - 1)
		else
			count = br.peek(nbBits)
			if count >= threshold then
				count = count - max
			end
			br.read(nbBits)
		end
		count = count - 1
		remaining = remaining - (count < 0 and -count or count)
		norm[s] = count
		s = s + 1
		prev0 = count == 0
		while remaining < threshold do
			nbBits = nbBits - 1
			threshold = threshold / 2
		end
	end
	if remaining ~= 1 then
		fail("bad FSE table description")
	end
	for k = s, maxSym do
		norm[k] = 0
	end
	local used = math.ceil((br.pos - at * 8) / 8)
	return buildFSE(norm, maxSym + 1, al), used
end

local function fromList(list, al)
	local norm = {}
	for i, v in ipairs(list) do
		norm[i - 1] = v
	end
	return buildFSE(norm, #list, al)
end

local LL_DEF = fromList({ 4, 3, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 2, 3, 2, 1, 1, 1, 1, 1,
	-1, -1, -1, -1 }, 6)
local ML_DEF = fromList({ 1, 4, 3, 2, 2, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
	1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1, -1 }, 6)
local OF_DEF = fromList({ 1, 1, 1, 1, 1, 1, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1 }, 5)

local function rleTable(symbol)
	return { sym = { [0] = symbol }, nb = { [0] = 0 }, base = { [0] = 0 }, al = 0 }
end

local LL_BASE = { [0] = 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 20, 22, 24, 28, 32, 40, 48, 64,
	128, 256, 512, 1024, 2048, 4096, 8192, 16384, 32768, 65536 }
local LL_BITS = { [0] = 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 3, 3, 4, 6, 7, 8, 9, 10, 11,
	12, 13, 14, 15, 16 }
local ML_BASE, ML_BITS = {}, {}
for i = 0, 31 do
	ML_BASE[i] = i + 3
	ML_BITS[i] = 0
end
do
	local b = { 35, 37, 39, 41, 43, 47, 51, 59, 67, 83, 99, 131, 259, 515, 1027, 2051, 4099, 8195, 16387, 32771, 65539 }
	local n = { 1, 1, 1, 1, 2, 2, 3, 3, 4, 4, 5, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 }
	for i = 1, #b do
		ML_BASE[31 + i] = b[i]
		ML_BITS[31 + i] = n[i]
	end
end

-- ---- Huffman ------------------------------------------------------------------
local function buildHuf(weights, n)
	-- weights[0..n-2] given; the last symbol's weight is implied
	local total = 0
	for i = 0, n - 2 do
		local w = weights[i]
		if w > 0 then
			total = total + P2[w - 1]
		end
	end
	if total == 0 then
		fail("empty Huffman weights")
	end
	local maxBits = highbit(total) + 1
	local rest = P2[maxBits] - total
	if rest ~= P2[highbit(rest)] then
		fail("bad Huffman weights")
	end
	weights[n - 1] = highbit(rest) + 1
	if maxBits > 11 then
		fail("Huffman code too long")
	end
	local sym, nb = {}, {}
	local pos = 0
	for w = 1, maxBits do
		for s = 0, n - 1 do
			if weights[s] == w then
				local len = P2[w - 1]
				local bits = maxBits + 1 - w
				for k = pos, pos + len - 1 do
					sym[k] = s
					nb[k] = bits
				end
				pos = pos + len
			end
		end
	end
	if pos ~= P2[maxBits] then
		fail("bad Huffman table")
	end
	return { sym = sym, nb = nb, maxBits = maxBits }
end

local function readHuf(src, at, limit)
	local hb = readu8(src, at)
	local weights = {}
	local n
	local used
	if hb >= 128 then
		n = hb - 127
		local bytes = math.ceil(n / 2)
		for i = 0, n - 1 do
			local b = readu8(src, at + 1 + floor(i / 2))
			weights[i] = (i % 2 == 0) and floor(b / 16) or (b % 16)
		end
		used = 1 + bytes
		n = n + 1
	else
		if at + 1 + hb > limit then
			fail("Huffman description overruns the block")
		end
		local fse, tused = readFSE(src, at + 1, at + 1 + hb, 6, 255)
		local br = bwdBits(src, at + 1 + tused, hb - tused)
		local s1 = br.read(fse.al)
		local s2 = br.read(fse.al)
		local k = 0
		while true do
			weights[k] = fse.sym[s1]
			k = k + 1
			s1 = fse.base[s1] + br.read(fse.nb[s1])
			if br.pos < 0 then
				weights[k] = fse.sym[s2]
				k = k + 1
				break
			end
			weights[k] = fse.sym[s2]
			k = k + 1
			s2 = fse.base[s2] + br.read(fse.nb[s2])
			if br.pos < 0 then
				weights[k] = fse.sym[s1]
				k = k + 1
				break
			end
			if k > 255 then
				fail("too many Huffman weights")
			end
		end
		n = k + 1
		used = 1 + hb
	end
	return buildHuf(weights, n), used
end

local function hufStream(src, at, size, huf, out, count)
	local br = bwdBits(src, at, size)
	local mb = huf.maxBits
	local sym, nb = huf.sym, huf.nb
	for _ = 1, count do
		local v = br.peek(mb)
		out[#out + 1] = sym[v]
		br.pos = br.pos - nb[v]
	end
end

-- ---- blocks -------------------------------------------------------------------
local function literalsSection(src, at, limit, st)
	local b0 = readu8(src, at)
	local ltype = b0 % 4
	local sf = floor(b0 / 4) % 4
	local lits = {}
	if ltype == 0 or ltype == 1 then
		local size, hsize
		if sf == 0 or sf == 2 then
			size, hsize = floor(b0 / 8), 1
		elseif sf == 1 then
			size, hsize = floor(b0 / 16) + readu8(src, at + 1) * 16, 2
		else
			size, hsize = floor(b0 / 16) + readu8(src, at + 1) * 16 + readu8(src, at + 2) * 4096, 3
		end
		if ltype == 0 then
			for i = 0, size - 1 do
				lits[i + 1] = readu8(src, at + hsize + i)
			end
			return lits, hsize + size
		end
		local v = readu8(src, at + hsize)
		for i = 1, size do
			lits[i] = v
		end
		return lits, hsize + 1
	end
	-- Huffman-compressed (2) or treeless (3)
	local hsize, bits, streams
	if sf == 0 then
		hsize, bits, streams = 3, 10, 1
	elseif sf == 1 then
		hsize, bits, streams = 3, 10, 4
	elseif sf == 2 then
		hsize, bits, streams = 4, 14, 4
	else
		hsize, bits, streams = 5, 18, 4
	end
	local value = 0
	for i = hsize - 1, 0, -1 do
		value = value * 256 + readu8(src, at + i)
	end
	local regen = floor(value / 16) % P2[bits]
	local comp = floor(value / P2[4 + bits]) % P2[bits]
	local p = at + hsize
	local huf
	if ltype == 2 then
		local used
		huf, used = readHuf(src, p, p + comp)
		st.huf = huf
		p = p + used
		comp = comp - used
	else
		huf = st.huf
		if not huf then
			fail("treeless literals without a previous Huffman table")
		end
	end
	if streams == 1 then
		hufStream(src, p, comp, huf, lits, regen)
	else
		local s1 = readu8(src, p) + readu8(src, p + 1) * 256
		local s2 = readu8(src, p + 2) + readu8(src, p + 3) * 256
		local s3 = readu8(src, p + 4) + readu8(src, p + 5) * 256
		local s4 = comp - 6 - s1 - s2 - s3
		if s4 < 0 then
			fail("bad literal stream sizes")
		end
		local seg = floor((regen + 3) / 4)
		local q = p + 6
		hufStream(src, q, s1, huf, lits, seg)
		hufStream(src, q + s1, s2, huf, lits, seg)
		hufStream(src, q + s1 + s2, s3, huf, lits, seg)
		hufStream(src, q + s1 + s2 + s3, s4, huf, lits, regen - 3 * seg)
	end
	return lits, (p - at) + comp
end

local function pickTable(src, p, mode, def, prevKey, st, maxAL, maxSym)
	if mode == 0 then
		st[prevKey] = def
		return def, 0
	elseif mode == 1 then
		local t = rleTable(readu8(src, p))
		st[prevKey] = t
		return t, 1
	elseif mode == 2 then
		local t, used = readFSE(src, p, st.blockEnd, maxAL, maxSym)
		st[prevKey] = t
		return t, used
	end
	local t = st[prevKey]
	if not t then
		fail("repeat mode without a previous table")
	end
	return t, 0
end

local function compressedBlock(src, at, size, out, st)
	local limit = at + size
	st.blockEnd = limit
	local lits, used = literalsSection(src, at, limit, st)
	local p = at + used
	local b0 = readu8(src, p)
	local nseq
	if b0 == 0 then
		nseq = 0
		p = p + 1
	elseif b0 < 128 then
		nseq = b0
		p = p + 1
	elseif b0 < 255 then
		nseq = (b0 - 128) * 256 + readu8(src, p + 1)
		p = p + 2
	else
		nseq = readu8(src, p + 1) + readu8(src, p + 2) * 256 + 0x7F00
		p = p + 3
	end
	local nlit = #lits
	if nseq == 0 then
		out:reserve(nlit)
		for i = 1, nlit do
			buffer.writeu8(out.b, out.n, lits[i])
			out.n = out.n + 1
		end
		return
	end
	local modes = readu8(src, p)
	p = p + 1
	local llT, ofT, mlT, u
	llT, u = pickTable(src, p, floor(modes / 64) % 4, LL_DEF, "ll", st, 9, 35)
	p = p + u
	ofT, u = pickTable(src, p, floor(modes / 16) % 4, OF_DEF, "of", st, 8, 31)
	p = p + u
	mlT, u = pickTable(src, p, floor(modes / 4) % 4, ML_DEF, "ml", st, 9, 52)
	p = p + u
	local br = bwdBits(src, p, limit - p)
	local sLL = br.read(llT.al)
	local sOF = br.read(ofT.al)
	local sML = br.read(mlT.al)
	local rep = st.rep
	local li = 1
	local ob = out
	for i = 1, nseq do
		local ofCode = ofT.sym[sOF]
		local llCode = llT.sym[sLL]
		local mlCode = mlT.sym[sML]
		if ofCode == nil or llCode == nil or mlCode == nil or ofCode > 31 or llCode > 35 or mlCode > 52 then
			fail("corrupt sequence")
		end
		local ofv = P2[ofCode] + br.read(ofCode)
		local ml = ML_BASE[mlCode] + br.read(ML_BITS[mlCode])
		local ll = LL_BASE[llCode] + br.read(LL_BITS[llCode])
		local offset
		if ofv > 3 then
			offset = ofv - 3
			rep[3], rep[2], rep[1] = rep[2], rep[1], offset
		else
			local idx = ofv + (ll == 0 and 1 or 0)
			if idx == 1 then
				offset = rep[1]
			elseif idx == 2 then
				offset = rep[2]
				rep[2], rep[1] = rep[1], offset
			elseif idx == 3 then
				offset = rep[3]
				rep[3], rep[2], rep[1] = rep[2], rep[1], offset
			else
				offset = rep[1] - 1
				if offset == 0 then
					offset = 1
				end
				rep[3], rep[2], rep[1] = rep[2], rep[1], offset
			end
		end
		if i < nseq then
			sLL = llT.base[sLL] + br.read(llT.nb[sLL])
			sML = mlT.base[sML] + br.read(mlT.nb[sML])
			sOF = ofT.base[sOF] + br.read(ofT.nb[sOF])
		end
		ob:reserve(ll + ml)
		local b = ob.b
		local n = ob.n
		for k = 0, ll - 1 do
			local v = lits[li + k]
			if v == nil then
				fail("literal length past the literals")
			end
			buffer.writeu8(b, n + k, v)
		end
		li = li + ll
		n = n + ll
		if offset > n then
			fail("match offset before the start of the output")
		end
		local from = n - offset
		if offset >= ml then
			buffer.copy(b, n, b, from, ml)
		else
			for k = 0, ml - 1 do
				buffer.writeu8(b, n + k, readu8(b, from + k))
			end
		end
		ob.n = n + ml
	end
	local restN = nlit - li + 1
	if restN > 0 then
		ob:reserve(restN)
		for k = 0, restN - 1 do
			buffer.writeu8(ob.b, ob.n + k, lits[li + k])
		end
		ob.n = ob.n + restN
	end
end

-- ---- frames -------------------------------------------------------------------
local function u32(src, p)
	return readu8(src, p) + readu8(src, p + 1) * 256 + readu8(src, p + 2) * 65536 + readu8(src, p + 3) * 16777216
end

local function frameHeader(src, p)
	local d = readu8(src, p)
	local fcsFlag = floor(d / 64)
	local single = floor(d / 32) % 2 == 1
	local checksum = floor(d / 4) % 2 == 1
	local dictFlag = d % 4
	if floor(d / 8) % 2 == 1 then
		fail("reserved frame header bit set")
	end
	local q = p + 1
	if not single then
		q = q + 1
	end
	local dsz = ({ [0] = 0, 1, 2, 4 })[dictFlag]
	local dict = 0
	for i = dsz - 1, 0, -1 do
		dict = dict * 256 + readu8(src, q + i)
	end
	q = q + dsz
	if dict ~= 0 then
		fail("dictionaries are not supported")
	end
	local fsz = ({ [0] = single and 1 or 0, 2, 4, 8 })[fcsFlag]
	local fcs = nil
	if fsz > 0 then
		fcs = 0
		for i = fsz - 1, 0, -1 do
			fcs = fcs * 256 + readu8(src, q + i)
		end
		if fsz == 2 then
			fcs = fcs + 256
		end
	end
	return q + fsz, fcs, checksum
end

local M = {}

function M.decompress(src)
	if type(src) ~= "buffer" then
		fail("buffer expected")
	end
	local len = buffer.len(src)
	local out = newOut(len * 4)
	local p = 0
	local frames = 0
	while p < len do
		if p + 4 > len then
			fail("truncated frame")
		end
		local magic = u32(src, p)
		if magic >= 0x184D2A50 and magic <= 0x184D2A5F then
			p = p + 8 + u32(src, p + 4) -- skippable frame
		elseif magic == 0xFD2FB528 then
			local q, fcs, checksum = frameHeader(src, p + 4)
			if fcs then
				out:reserve(fcs)
			end
			local st = { rep = { 1, 4, 8 } }
			while true do
				if q + 3 > len then
					fail("truncated block header")
				end
				local h = readu8(src, q) + readu8(src, q + 1) * 256 + readu8(src, q + 2) * 65536
				q = q + 3
				local last = h % 2 == 1
				local btype = floor(h / 2) % 4
				local bsize = floor(h / 8)
				if btype == 0 then
					if q + bsize > len then
						fail("truncated raw block")
					end
					out:reserve(bsize)
					buffer.copy(out.b, out.n, src, q, bsize)
					out.n = out.n + bsize
					q = q + bsize
				elseif btype == 1 then
					local v = readu8(src, q)
					out:reserve(bsize)
					buffer.fill(out.b, out.n, v, bsize)
					out.n = out.n + bsize
					q = q + 1
				elseif btype == 2 then
					if q + bsize > len then
						fail("truncated compressed block")
					end
					compressedBlock(src, q, bsize, out, st)
					q = q + bsize
				else
					fail("reserved block type")
				end
				if last then
					break
				end
			end
			if checksum then
				q = q + 4
			end
			p = q
			frames = frames + 1
		else
			fail("not a zstd frame")
		end
	end
	if frames == 0 then
		fail("no zstd frame")
	end
	return out:finish()
end

function M.contentSize(src)
	if type(src) ~= "buffer" or buffer.len(src) < 6 or u32(src, 0) ~= 0xFD2FB528 then
		fail("not a zstd frame")
	end
	local _, fcs = frameHeader(src, 4)
	return fcs
end

-- valid zstd of raw blocks (Roblox's own output would be smaller, but any
-- conforming decoder -- this one included -- reads it back exactly)
function M.compress(src)
	if type(src) ~= "buffer" then
		fail("buffer expected")
	end
	local len = buffer.len(src)
	local MAXB = 131072
	local nblocks = math.max(1, math.ceil(len / MAXB))
	local out = buffer.create(4 + 1 + 8 + nblocks * 3 + len)
	buffer.writeu32(out, 0, 0xFD2FB528)
	buffer.writeu8(out, 4, 0xE0) -- FCS 8 bytes, single segment, no checksum, no dict
	buffer.writeu32(out, 5, len % 4294967296)
	buffer.writeu32(out, 9, floor(len / 4294967296))
	local p = 13
	local s = 0
	for b = 1, nblocks do
		local n = math.min(MAXB, len - s)
		local h = (b == nblocks and 1 or 0) + n * 8 -- raw block
		buffer.writeu8(out, p, h % 256)
		buffer.writeu8(out, p + 1, floor(h / 256) % 256)
		buffer.writeu8(out, p + 2, floor(h / 65536) % 256)
		p = p + 3
		buffer.copy(out, p, src, s, n)
		p = p + n
		s = s + n
	end
	return out
end

-- ---- base64 (EncodingService works on buffers) ------------------------------
local ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"
local ENC, DEC = {}, {}
for i = 1, 64 do
	local c = string.byte(ALPHA, i)
	ENC[i - 1] = c
	DEC[c] = i - 1
end

function M.base64Encode(src)
	local len = buffer.len(src)
	local out = buffer.create(math.ceil(len / 3) * 4)
	local o = 0
	for i = 0, len - 1, 3 do
		local a = readu8(src, i)
		local b = i + 1 < len and readu8(src, i + 1) or 0
		local c = i + 2 < len and readu8(src, i + 2) or 0
		local v = a * 65536 + b * 256 + c
		buffer.writeu8(out, o, ENC[floor(v / 262144) % 64])
		buffer.writeu8(out, o + 1, ENC[floor(v / 4096) % 64])
		buffer.writeu8(out, o + 2, i + 1 < len and ENC[floor(v / 64) % 64] or 61)
		buffer.writeu8(out, o + 3, i + 2 < len and ENC[v % 64] or 61)
		o = o + 4
	end
	return out
end

function M.base64Decode(src)
	local len = buffer.len(src)
	local vals = {}
	for i = 0, len - 1 do
		local d = DEC[readu8(src, i)]
		if d then
			vals[#vals + 1] = d
		end
	end
	local n = floor(#vals * 6 / 8)
	local out = buffer.create(n)
	local o = 0
	local acc, bits = 0, 0
	for _, d in ipairs(vals) do
		acc = acc * 64 + d
		bits = bits + 6
		if bits >= 8 then
			bits = bits - 8
			local byte = floor(acc / P2[bits])
			acc = acc % P2[bits]
			if o < n then
				buffer.writeu8(out, o, byte)
				o = o + 1
			end
		end
	end
	return out
end

return M
