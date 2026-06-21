#!/usr/bin/env python3
"""Generate ic_launcher.png with stdlib only (no PIL). Simple moto-speed icon."""
import zlib, struct, math, sys, os

S = 192
def lerp(a, b, t): return tuple(int(a[i] + (b[i]-a[i])*t) for i in range(3))

def gen():
    top = (255, 90, 30); bot = (160, 20, 90)        # speed gradient
    buf = bytearray()
    cx, cy = S*0.5, S*0.58
    for y in range(S):
        buf.append(0)  # png filter type 0 per scanline
        for x in range(S):
            # rounded square mask
            r = 34
            inx = min(max(x, r), S-1-r); iny = min(max(y, r), S-1-r)
            d = math.hypot(x-inx, y-iny)
            a = 255 if d <= r else max(0, int(255*(1-(d-r))))
            col = list(lerp(top, bot, y/S))
            # diagonal speed streaks
            if (x + y) % 26 < 3:
                col = [min(255, c+40) for c in col]
            # white wheel ring
            dw = math.hypot(x-cx, y-cy)
            if 44 <= dw <= 58:
                col = [245, 245, 245]
            if dw <= 16:
                col = [245, 245, 245]
            # hub spokes
            ang = math.atan2(y-cy, x-cx)
            if 16 < dw < 44 and (int((ang+math.pi)/(math.pi/4)) % 1 == 0) and abs((dw)% 14) < 2:
                col = [230, 230, 230]
            buf += bytes([col[0], col[1], col[2], a])
    return bytes(buf)

def png(raw):
    def chunk(typ, data):
        c = struct.pack(">I", len(data)) + typ + data
        return c + struct.pack(">I", zlib.crc32(typ + data) & 0xffffffff)
    sig = b"\x89PNG\r\n\x1a\n"
    ihdr = struct.pack(">IIBBBBB", S, S, 8, 6, 0, 0, 0)
    idat = zlib.compress(raw, 9)
    return sig + chunk(b"IHDR", ihdr) + chunk(b"IDAT", idat) + chunk(b"IEND", b"")

out = sys.argv[1] if len(sys.argv) > 1 else "ic_launcher.png"
os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
open(out, "wb").write(png(gen()))
print("wrote", out)
