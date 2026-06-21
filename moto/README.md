# Speed Moto

An original, from-scratch endless moto-dodging game inspired by the classic
*Racing Moto* genre: tilt your phone to steer, hold to accelerate, and weave
through highway traffic across five themed worlds (desert, city, bridge, sea,
forest). Built for the Pixel 9 Pro XL (portrait), rendered crisply up to ~4K
via a supersampling quality toggle.

> Original work — no third-party game assets or source are used. Every mesh,
> texture, sound, and line of code is generated procedurally / written here.
> Personal use only (built unsigned with a debug key; not for redistribution).

## How it works

A single WebGL game (Three.js, vendored offline) runs inside a thin Android
**WebView** shell. Everything is bundled and runs **fully offline**. This lets
the whole thing build with only Debian/apt-sourced Android tools plus a
Maven-Central `dx` jar — no Android Studio / SDK manager / Google Maven needed.

```
app/assets/index.html        # loads three.min.js + modules + core
app/assets/lib/three.min.js  # vendored Three.js r160 (offline)
app/assets/js/
  models.js        # MOTO.Models      — procedural bikes, traffic, coins
  environment.js   # MOTO.Environment — infinite highway + 5 themed worlds
  controls.js      # MOTO.Controls    — tilt + touch + keyboard
  audio.js         # MOTO.Audio       — synthesized engine + SFX (WebAudio)
  ui.js / css/     # MOTO.UI          — menu, garage, HUD, settings
  game.js          # MOTO.World       — gameplay: physics, traffic, scoring
  main.js          # MOTO.App         — renderer, 4K render-scale, loop, save
app/src/.../MainActivity.java # immersive portrait WebView host
docs/CONTRACT.md   # frozen module API + world conventions
verify/check.mjs   # headless logic verifier (mocks THREE)
verify/browser.mjs # real-browser WebGL smoke test (puppeteer/SwiftShader)
build.sh           # produces a signed, aligned APK
```

## Build

Prerequisites (one-time, from Ubuntu repos):

```bash
sudo apt-get install -y --no-install-recommends \
  aapt zipalign apksigner android-sdk-platform-23
```

Then:

```bash
cd moto
bash build.sh          # -> build/speedmoto.apk  (signed with a debug key)
```

Install on the device:

```bash
adb install -r build/speedmoto.apk
```

## Verify

```bash
cd moto
node verify/check.mjs                 # game-logic checks (no GPU needed)
cd verify && npm i && node browser.mjs # real WebGL render smoke test
```

## Controls

- **Tilt** (default): tilt left/right to steer; throttle is automatic. Use
  *Calibrate* in the menu to set your comfortable neutral hold angle.
- **Touch**: drag horizontally to steer; hold to accelerate.
- **Quality**: Performance / Native / **4K Ultra** (supersampled).
