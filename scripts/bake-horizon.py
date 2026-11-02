#!/usr/bin/env python3
"""Bakes the islands seen from Kayama on the horizon (the start island's decision, 2026-10-27 §3: the islands round
about shown as they stand, from the land's own data) — 小浜島, 竹富島, 西表島, 石垣島, 黒島 and the small ones between.

Sources (出典：国土地理院):
  - the digital elevation model (dem_png: zoom 12 for the whole, 14 near)
  - seamless aerial photographs (seamlessphoto: zoom 12 for the whole, 14 near), for the colour seen from afar
Kayama itself (src/ocean/land.ts, bake-kayama.py) is left out.

Writes, x east and z south of the world's origin (as bake-kayama.py), rows north to south:
  public/land/horizon_far_c.png  over the whole of it, 150 m a cell: the photograph's colour
  public/land/horizon_far_h.png  the same cells: the height of the land, 2.2 m a step (0: sea, or Kayama)
  public/land/horizon_near_*.png within 6 km of the origin, 50 m a cell (the island to the south is 2.6 km off), the same
  public/land/horizon.json       each one's place: its west and north edge (m), its cell (m), its size (cells)
Usage: python3 scripts/bake-horizon.py   (needs numpy, scipy, Pillow)
"""
import io, json, math, os, subprocess
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
from scipy import ndimage as nd

LAT, LON = 24.36107, 123.99674      # the world's origin (bake-kayama.py)
K, COSL = 111320.0, math.cos(math.radians(LAT))
KAYAMA = (320.0, -270.0, 760.0)     # the island's own land (x, z, half): left out, it is drawn as itself
OUT = 'public/land'
STEP = 2.2                          # metres a height step (石垣島's 526 m within 255)
GRIDS = [
    # (name, west, north, east, south (m), cell (m), dem zoom, photo zoom)
    ('far', (123.655 - LON) * K * COSL, (LAT - 24.625) * K, (124.345 - LON) * K * COSL, (LAT - 24.175) * K, 150.0, 12, 12),
    ('near', -6000.0, -6000.0, 6000.0, 6000.0, 50.0, 14, 14),
]

def get(url):
    for _ in range(4):
        d = subprocess.run(['curl', '-s', '-m', '30', url], capture_output=True).stdout
        try: return Image.open(io.BytesIO(d))
        except Exception: pass
    return None

def merc(lat): return np.log(np.tan(np.pi / 4 + np.radians(lat) / 2))
def tile_xy(lat, lon, z):
    n = 2 ** z
    return (lon + 180) / 360 * n, (1 - merc(lat) / math.pi) / 2 * n
def latlon(x, zs): return LAT - zs / K, LON + x / (K * COSL)

def mosaic(url, z, mode, w, n, e, s, fill):
    (xa, ya), (xb, yb) = tile_xy(*latlon(w, n), z), tile_xy(*latlon(e, s), z)
    x0, y0, x1, y1 = int(xa), int(ya), int(xb), int(yb)
    img = Image.new(mode, ((x1 - x0 + 1) * 256, (y1 - y0 + 1) * 256), fill)
    jobs = [(i, j) for j in range(y0, y1 + 1) for i in range(x0, x1 + 1)]
    with ThreadPoolExecutor(8) as ex:
        for (i, j), t in zip(jobs, ex.map(lambda q: get(url.format(z=z, x=q[0], y=q[1])), jobs)):
            if t is not None: img.paste(t.convert(mode), ((i - x0) * 256, (j - y0) * 256))
    def to_px(xm, zm):
        fx, fy = tile_xy(*latlon(xm, zm), z)
        return (fx - x0) * 256, (fy - y0) * 256
    return img, to_px

os.makedirs(OUT, exist_ok=True)
meta = {}
for name, w, n, e, s, cell, dz, pz in GRIDS:
    nx, nz = int(round((e - w) / cell)), int(round((s - n) / cell))
    xs, zs = w + (np.arange(nx) + 0.5) * cell, n + (np.arange(nz) + 0.5) * cell
    X, Z = np.meshgrid(xs, zs)
    dem, dpx = mosaic('https://cyberjapandata.gsi.go.jp/xyz/dem_png/{z}/{x}/{y}.png', dz, 'RGB', w, n, e, s, (128, 0, 0))
    D = np.asarray(dem).astype(np.int64)
    v = D[..., 0] * 65536 + D[..., 1] * 256 + D[..., 2]
    h = (np.where(v == 0x800000, 0, np.where(v >= 2 ** 23, v - 2 ** 24, v)) * 0.01).astype(np.float32)
    del dem, D, v
    # (each cell the highest of the land within it — a ridge is not smoothed away — but land only where at least a
    # third of it is land, so the coast is where the map's is)
    px, py = dpx(X, Z)
    r = max(1, int(round(cell / (40075016 * COSL / 2 ** dz / 256))))   # (the dem's pixels a cell)
    hmax = nd.maximum_filter(h, size=r)
    land = nd.uniform_filter((h > 0.5).astype(np.float32), size=r)
    H = nd.map_coordinates(hmax, [py - 0.5, px - 0.5], order=1, mode='nearest') * (nd.map_coordinates(land, [py - 0.5, px - 0.5], order=1, mode='nearest') > 0.33)
    # Kayama left out (with a margin round its own square)
    kx, kz, kh = KAYAMA
    H[(np.abs(X - kx) < kh + 60) & (np.abs(Z - kz) < kh + 60)] = 0
    if name == 'far':   # (the near grid's square drawn from it instead)
        H[(np.abs(X) < 6000 - cell) & (np.abs(Z) < 6000 - cell)] = 0
    photo, ppx = mosaic('https://cyberjapandata.gsi.go.jp/xyz/seamlessphoto/{z}/{x}/{y}.jpg', pz, 'RGB', w, n, e, s, (40, 60, 70))
    P = np.asarray(photo).astype(np.float32)
    del photo
    qx, qy = ppx(X, Z)
    rp = max(1.0, cell / (40075016 * COSL / 2 ** pz / 256) / 2)
    C = np.stack([nd.map_coordinates(nd.gaussian_filter(P[..., c], rp), [qy - 0.5, qx - 0.5], order=1, mode='nearest') for c in range(3)], -1)
    A = np.clip(np.round(H / STEP), 0, 255).astype(np.uint8)
    Image.fromarray(np.clip(C, 0, 255).astype(np.uint8), 'RGB').save(f'{OUT}/horizon_{name}_c.png', optimize=True)
    Image.fromarray(A, 'L').save(f'{OUT}/horizon_{name}_h.png', optimize=True)
    meta[name] = {'west': w, 'north': n, 'cell': cell, 'nx': nx, 'nz': nz}
    print(name, nx, 'x', nz, 'land cells', int((H > 0.5).sum()), 'highest', round(float(H.max()), 1))
meta['step'] = STEP
json.dump(meta, open(f'{OUT}/horizon.json', 'w'), indent=1)
