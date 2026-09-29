# Qumanity app logo: Quantum + Humanity

The 10 countries of the Indian Sub-continent (India, Nepal, Bhutan, Bangladesh, Myanmar, Sri Lanka, Pakistan, Balochistan, Afghanistan, Maldives) form one white shape with a gold edge. It sits at the **nucleus of an atom**, circled by three orbits, each carrying a glowing particle:
- saffron, gold and sky blue on deep space;
- the land and its people (humanity) at the centre of quantum motion;
- the Maldives, too small to draw, shown as a dot at their real position.

The outline comes from the website's `Qumanity_DPG/static/data/subcontinent.geojson` (role `outline`), the same shape the website map highlights.

## Regenerate
Needs only Python 3 (no extra packages for the SVG):
```bash
python3 make_logo.py logo.svg          # app icon, on a deep-space background
python3 make_logo.py mark.svg --mark   # transparent mark used inside the app
qlmanage -t -s 1024 -o . logo.svg      # macOS: renders logo.svg.png
```

The PNGs in `mobile/assets/` were made from `logo.svg.png` with Pillow.
- `android-icon-foreground.png` is the art shrunk into the centre circle Android launchers show.
- The splash image is 512 px and the favicon 48 px.
- The SVG masters are `mobile/assets/brand/logo-qumanity-app*.svg`.
- The in-app copy is `mobile/src/brand/logoSvg.ts`.

The website keeps its Ram Mandala logo (`logo-qumanity.svg`).
