"""Qumanity app logo generator — "Quantum + Humanity".

The 10-country Indian Sub-continent (one white shape, the same outline the website highlights)
sits at the nucleus of an atom: three orbits (quantum) circle the land and its people
(humanity), each carrying a glowing particle. Colours: saffron, gold and sky blue on deep space.

    python make_logo.py logo.svg          # app icon: on a deep-space background
    python make_logo.py mark.svg --mark   # transparent mark used inside the app
"""
import json
import math
import sys
from pathlib import Path

OUT = Path(sys.argv[1] if len(sys.argv) > 1 else "logo.svg")
MARK = "--mark" in sys.argv
DATA = Path.home() / "Desktop/Qumanity_DPG/static/data/subcontinent.geojson"

W = 1024
C = W / 2
MAP_BOX = 470  # the map fits in a square this big, centred on the nucleus
MIN_STEP = 1.2

# ---------------------------------------------------------------- the Sub-continent outline
features = json.loads(DATA.read_text())["features"]
outline = next(f for f in features if f["properties"].get("role") == "outline")
rings = [p[0] for p in outline["geometry"]["coordinates"]]

lon_min = min(x for r in rings for x, _ in r)
lon_max = max(x for r in rings for x, _ in r)
lat_min = min(y for r in rings for _, y in r)
lat_max = max(y for r in rings for _, y in r)
k = math.cos(math.radians((lat_min + lat_max) / 2))  # equirectangular, corrected at mid-latitude
span_x, span_y = (lon_max - lon_min) * k, lat_max - lat_min
scale = MAP_BOX / max(span_x, span_y)
ox = C - span_x * scale / 2
oy = C - span_y * scale / 2 + 10  # optical centring: the peninsula makes the shape bottom-heavy


def xy(lon, lat):
    return ox + (lon - lon_min) * k * scale, oy + (lat_max - lat) * scale


def ring_path(ring):
    pts, last = [], None
    for lon, lat in ring:
        x, y = xy(lon, lat)
        if last is None or math.hypot(x - last[0], y - last[1]) >= MIN_STEP:
            pts.append((x, y))
            last = (x, y)
    if len(pts) < 3:
        return ""
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts) + "Z"


LAND = "".join(ring_path(r) for r in rings)
mx, my = xy(73.5, 3.2)  # the Maldives: too small to draw, so a dot at their real position

# ---------------------------------------------------------------- orbits and particles
ORBITS = [  # (tilt in degrees, colour, particle position along the orbit in degrees)
    (-30, "#ffb13b", 208),
    (30, "#ffd84a", 330),
    (90, "#5cc2ff", 62),
]
RX, RY = 430, 150


def particle(tilt, t):
    a, th = math.radians(t), math.radians(tilt)
    x, y = RX * math.cos(a), RY * math.sin(a)
    return C + x * math.cos(th) - y * math.sin(th), C + x * math.sin(th) + y * math.cos(th)


orbit_svg, glow_svg, dot_svg = [], [], []
for i, (tilt, col, t) in enumerate(ORBITS):
    orbit_svg.append(
        f'<ellipse cx="{C}" cy="{C}" rx="{RX}" ry="{RY}" fill="none" stroke="url(#orb{i})" stroke-width="16" '
        f'transform="rotate({tilt} {C} {C})"/>'
    )
    px, py = particle(tilt, t)
    glow_svg.append(f'<circle cx="{px:.1f}" cy="{py:.1f}" r="58" fill="url(#glow{i})"/>')
    dot_svg.append(
        f'<circle cx="{px:.1f}" cy="{py:.1f}" r="22" fill="{col}"/>'
        f'<circle cx="{px - 6:.1f}" cy="{py - 7:.1f}" r="7" fill="#fff" opacity="0.8"/>'
    )

orbit_grads = "".join(
    f'<linearGradient id="orb{i}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="{col}" stop-opacity="0.95"/>'
    f'<stop offset="0.5" stop-color="{col}" stop-opacity="0.35"/><stop offset="1" stop-color="{col}" stop-opacity="0.95"/></linearGradient>'
    f'<radialGradient id="glow{i}"><stop offset="0" stop-color="{col}" stop-opacity="0.75"/><stop offset="1" stop-color="{col}" stop-opacity="0"/></radialGradient>'
    for i, (_, col, _) in enumerate(ORBITS)
)

background = "" if MARK else (
    f'<rect width="{W}" height="{W}" fill="url(#space)"/>'
    f'<circle cx="{C}" cy="{C}" r="470" fill="none" stroke="#ffffff" stroke-opacity="0.05" stroke-width="2"/>'
)

VIEW = "40 40 944 944" if MARK else f"0 0 {W} {W}"  # the mark is cropped close so it reads at small sizes
svg = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="{VIEW}" width="{W}" height="{W}" role="img" aria-label="Qumanity">
<defs>
  <radialGradient id="space" cx="50%" cy="45%" r="75%"><stop offset="0" stop-color="#14204a"/><stop offset="0.6" stop-color="#070b1c"/><stop offset="1" stop-color="#02030a"/></radialGradient>
  <radialGradient id="nucleus" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#ffcf5a" stop-opacity="0.45"/><stop offset="0.55" stop-color="#ff9a2e" stop-opacity="0.14"/><stop offset="1" stop-color="#ff9a2e" stop-opacity="0"/></radialGradient>
  <linearGradient id="land" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#fff1cf"/></linearGradient>
  {orbit_grads}
</defs>
{background}
<circle cx="{C}" cy="{C}" r="330" fill="url(#nucleus)"/>
{"".join(orbit_svg)}
<path d="{LAND}" fill="url(#land)" stroke="#ffc83d" stroke-width="5" stroke-linejoin="round"/>
<circle cx="{mx:.1f}" cy="{my:.1f}" r="7" fill="#ffffff" stroke="#ffc83d" stroke-width="3"/>
{"".join(glow_svg)}
{"".join(dot_svg)}
</svg>'''

OUT.write_text(svg)
print(f"wrote {OUT} ({len(svg) / 1024:.0f} KB)")
