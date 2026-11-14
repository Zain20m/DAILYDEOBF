"""Round-trip tests for zstd.luau (the offline EncodingService model).

Reference data comes from the system's official libzstd (via ctypes; no
package install needed): many inputs x compression levels are compressed by
libzstd, decompressed by zstd.luau under the real luau interpreter, and must
match byte for byte. Also checks CompressBuffer -> DecompressBuffer round
trips, libzstd reading zstd.luau's own frames, and Base64.
Skips (exit 0) when libzstd or the luau binary is not available.
"""

import ctypes
import ctypes.util
import glob
import os
import random
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))


def _luau():
    for d in (os.path.join(HERE, "bin"), os.path.join(HERE, "..", "luraph-v15-engine", "bin"),
              os.path.join(HERE, "..", "luraph-v15.1-engine", "bin")):
        p = os.path.join(d, "luau")
        if os.path.isfile(p):
            return os.path.abspath(p)
    return None


def _libzstd():
    name = ctypes.util.find_library("zstd")
    if not name:
        return None
    lib = ctypes.CDLL(name)
    lib.ZSTD_compressBound.restype = ctypes.c_size_t
    lib.ZSTD_compressBound.argtypes = [ctypes.c_size_t]
    lib.ZSTD_compress.restype = ctypes.c_size_t
    lib.ZSTD_compress.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t, ctypes.c_int]
    lib.ZSTD_decompress.restype = ctypes.c_size_t
    lib.ZSTD_decompress.argtypes = [ctypes.c_void_p, ctypes.c_size_t, ctypes.c_void_p, ctypes.c_size_t]
    lib.ZSTD_isError.restype = ctypes.c_uint
    lib.ZSTD_isError.argtypes = [ctypes.c_size_t]
    return lib


def compress(lib, data, level):
    cap = lib.ZSTD_compressBound(len(data))
    dst = ctypes.create_string_buffer(cap)
    n = lib.ZSTD_compress(dst, cap, data, len(data), level)
    assert not lib.ZSTD_isError(n), "libzstd compress failed"
    return dst.raw[:n]


def decompress(lib, data, size):
    dst = ctypes.create_string_buffer(max(size, 1))
    n = lib.ZSTD_decompress(dst, max(size, 1), data, len(data))
    assert not lib.ZSTD_isError(n), "libzstd decompress failed"
    return dst.raw[:n]


def inputs():
    rnd = random.Random(1234)
    text = open(os.path.join(HERE, "unflatten.py"), "rb").read()
    yield "empty", b""
    yield "one byte", b"A"
    yield "short text", b"hello hello hello world"
    yield "text", text
    yield "text x6", text * 6
    yield "random 1k", bytes(rnd.randrange(256) for _ in range(1000))
    yield "random 70k", bytes(rnd.randrange(256) for _ in range(70000))
    yield "zeros 200k", b"\x00" * 200000
    yield "repeat pattern", (b"abcdefghij" * 5000) + b"tail"
    yield "low entropy 150k", bytes(rnd.choice(b"aaaaabbbcd\n") for _ in range(150000))
    yield "mixed", b"".join(bytes(rnd.randrange(256) for _ in range(rnd.randrange(1, 40))) +
                            text[rnd.randrange(0, 4000):][:rnd.randrange(10, 300)] for _ in range(400))


def main():
    luau, lib = _luau(), _libzstd()
    if not luau or not lib:
        print("SKIP: luau binary or libzstd not available")
        return 0
    cases = []
    for name, data in inputs():
        for level in (-5, 1, 3, 9, 19):
            cases.append(("%s @%d" % (name, level), compress(lib, data, level), data))
    # Go's zstd test vectors (real-world frames), when a Go toolchain is installed
    for path in sorted(glob.glob("/usr/local/go*/src/internal/zstd/testdata/*.zst"))[:12]:
        raw = open(path, "rb").read()
        try:
            want = decompress(lib, raw, 64 << 20)
        except AssertionError:
            continue
        cases.append((os.path.basename(path), raw, want))

    lines = ['local Z = require("./zstd")',
             'local function hex(b) local t = {} for i = 0, buffer.len(b) - 1 do t[#t+1] = string.format("%02x", buffer.readu8(b, i)) end return table.concat(t) end',
             'local function fromhex(h) local b = buffer.create(#h // 2) for i = 0, #h // 2 - 1 do buffer.writeu8(b, i, tonumber(string.sub(h, 2*i+1, 2*i+2), 16)) end return b end',
             'local fails = 0']
    for i, (name, comp, want) in enumerate(cases):
        lines.append('do local ok, r = pcall(Z.decompress, fromhex("%s")) '
                     'if not ok then print("FAIL %s: " .. tostring(r)) fails += 1 '
                     'elseif buffer.len(r) ~= %d or hex(r) ~= "%s" then print("FAIL %s: wrong output (" .. buffer.len(r) .. " bytes)") fails += 1 end end'
                     % (comp.hex(), name, len(want), want.hex(), name))
    # our own frames: round trip, and print one for libzstd to read back
    lines.append('do local src = buffer.fromstring(string.rep("roblox ", 30000) .. "end") '
                 'local c = Z.compress(src) local d = Z.decompress(c) '
                 'if buffer.tostring(d) ~= buffer.tostring(src) then print("FAIL compress round trip") fails += 1 end '
                 'if Z.contentSize(c) ~= buffer.len(src) then print("FAIL contentSize") fails += 1 end '
                 'print("FRAME " .. hex(Z.compress(buffer.fromstring("written by zstd.luau"))) ) end')
    lines.append('do local s = "Many hands make light work." '
                 'local e = buffer.tostring(Z.base64Encode(buffer.fromstring(s))) '
                 'if e ~= "TWFueSBoYW5kcyBtYWtlIGxpZ2h0IHdvcmsu" then print("FAIL base64 encode " .. e) fails += 1 end '
                 'if buffer.tostring(Z.base64Decode(buffer.fromstring(e))) ~= s then print("FAIL base64 decode") fails += 1 end '
                 'for n = 0, 5 do local x = string.sub(s, 1, n) if buffer.tostring(Z.base64Decode(Z.base64Encode(buffer.fromstring(x)))) ~= x then print("FAIL base64 len " .. n) fails += 1 end end end')
    lines.append('print("FAILS " .. fails)')
    with tempfile.TemporaryDirectory() as d:
        with open(os.path.join(d, "zstd.luau"), "w") as f:
            f.write(open(os.path.join(HERE, "zstd.luau")).read())
        with open(os.path.join(d, "t.luau"), "w") as f:
            f.write("\n".join(lines))
        r = subprocess.run([luau, "t.luau"], cwd=d, capture_output=True, text=True, timeout=600)
    out = r.stdout + r.stderr
    for ln in out.splitlines():
        if ln.startswith("FAIL"):
            print(ln)
    frame = [ln[6:] for ln in out.splitlines() if ln.startswith("FRAME ")]
    failures = 0
    if not frame or decompress(lib, bytes.fromhex(frame[0]), 1 << 16) != b"written by zstd.luau":
        print("FAIL libzstd could not read a zstd.luau frame")
        failures += 1
    tail = [ln for ln in out.splitlines() if ln.startswith("FAILS ")]
    if not tail:
        print("FAIL luau run did not finish:\n" + out[-2000:])
        return 1
    failures += int(tail[0].split()[1])
    print("%d libzstd/Go vectors decoded" % len(cases))
    if failures:
        print("%d FAILURE(S)" % failures)
        return 1
    print("all zstd checks passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
