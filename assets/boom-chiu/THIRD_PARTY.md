# Bùm Chíu third-party assets

Bùm Chíu only vendors or renders assets that are free for personal and commercial use.

## Kenney Crosshair Pack 1.1

- Source: https://kenney.nl/assets/crosshair-pack
- Creator: Kenney
- License: Creative Commons Zero (CC0 1.0)
- Vendored derivative/source asset: `kenney/crosshair.svg` (`Vector/Light/crosshair-007.svg`)

## Kenney UI Pack 2.0

- Source: https://kenney.nl/assets/ui-pack
- Creator: Kenney
- License: Creative Commons Zero (CC0 1.0)
- Vendored UI assets are stored under `kenney/`.

## Styloo Guns Asset Pack

- Canonical source: https://styloo.itch.io/guns-asset-pack
- Creator: styloo / Styl0o_
- License: Creative Commons Zero (CC0 1.0) on the itch.io asset page
- Source model used for the current rifle render: `ak47.glb`
- Mirror used by the deterministic renderer: https://github.com/hackinghackers/water-gun-simulator/tree/main/addons/styloo-guns
- Generated runtime sprite: `styloo/ak47-fps.png`

The game does not ship or initialize a 3D renderer at runtime. `scripts/render-boom-chiu-assets.mjs` renders the CC0 GLB into a transparent PNG ahead of time so the raycast game keeps its lightweight Canvas renderer.

## Quaternius Toon Shooter Game Kit

- Canonical source: https://quaternius.com/packs/toonshootergamekit.html
- Creator: Quaternius
- License: Creative Commons Zero (CC0 1.0)
- Source model used: `Character_Soldier.gltf`
- Mirror used by the deterministic renderer: https://github.com/aar0npal/shooter-blitz/blob/main/public/models/Character_Soldier.gltf
- Generated directional sprites: `quaternius/soldier-0.png` through `quaternius/soldier-7.png`

The source pack provides textured animated shooter characters and is explicitly listed by Quaternius as CC0 and free for personal/commercial use. The eight runtime images are renders of that source model at 45-degree increments for the existing raycast/billboard engine.

## Reproducibility

Run:

```bash
node scripts/render-boom-chiu-assets.mjs
```

The script uses Chromium + Three.js only during asset generation. Gameplay itself continues to load only the generated PNG sprites.
