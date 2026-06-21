# SpeedMoto — Module Contract (FROZEN)

An original, from-scratch endless moto-dodging game inspired by the *Racing Moto*
genre (tilt to steer, hold to accelerate, weave through highway traffic, themed
scenery, bike garage). **No third-party game assets or source are used** — every
mesh, texture, sound and line of code is generated procedurally / written here.
Target: Pixel 9 Pro XL, Android, rendered crisply up to ~4K via supersampling.

Runtime = a single WebGL game (Three.js, global `THREE`) running inside a thin
Android WebView shell. Everything is bundled and runs **fully offline**.

## Global namespace
`window.MOTO` is the shared namespace. Each module attaches exactly one property.
Load order (see index.html): `three.min.js` → `models.js` → `environment.js` →
`controls.js` → `audio.js` → `ui.js` → `game.js` → `main.js`.

## World conventions (METERS; obey exactly)
- Axes: **+X = right**, **+Y = up**, **−Z = forward / direction of travel**.
- Ground plane at **y = 0**. All vehicles rest on y = 0 (origin at ground-center).
- Lane width **3.6 m**, default **3 lanes** (road centered on x = 0).
  `laneCenters` for 3 lanes = `[-3.6, 0, 3.6]`. roadWidth = lanes * 3.6.
- Player stays near z = 0. Traffic/coins move in z relative to the player:
  they spawn ahead (negative z, e.g. −220) and z increases toward + as the
  player overtakes; cull when z > 35.
- A vehicle/bike model faces forward (its front points toward −Z). Build it so
  `group.position` places the ground-center; do not pre-translate off origin.

## Rough scale targets
bike ≈ 0.8 w × 2.1 l, rider top ≈ 1.7 h. car ≈ 1.8 w × 4.4 l × 1.5 h.
van 2.0×5.2×2.2. taxi like car. truck 2.5×9×3.6. bus 2.6×11×3.2.

## Modules & exact APIs

### MOTO.Models  (file: js/models.js)
- `bike(id) -> THREE.Group` — player motorcycle **with rider**, faces −Z.
- `bikeCatalog() -> [{id,name,colorHex,price,topSpeed,accel,handling,desc}]`
  topSpeed in km/h (used by physics), accel & handling in 0..1.
  First entry must be a free starter (price 0). Provide >= 5 bikes.
- `traffic(kind) -> THREE.Group` for kind in trafficKinds() ids.
- `trafficKinds() -> [{kind,w,l,h,weight}]` weight = spawn likelihood.
  Must include at least: car, taxi, van, truck, bus.
- `coin() -> THREE.Group` — collectible (~0.8 m), spins (caller rotates it).
All meshes must use `THREE.MeshStandardMaterial`/`MeshLambertMaterial` (lit).
Keep total triangles modest (mobile). No external textures; use vertex/material color.

### MOTO.Environment  (file: js/environment.js)
- `themes() -> [{id,name,...palette}]` ids include desert, city, bridge, sea, forest.
- `create(scene, themeId) -> instance` where instance has:
  - `update(dt, speed, distance)` — scroll road, stripes, roadside props.
  - `setTheme(themeId)` — swap palette/sky/fog/props (smooth-ish ok).
  - `numLanes` (int), `roadWidth` (m), `laneCenters` (number[]).
  - `dispose()` — remove everything it added to scene.
  - On create it installs lights, sky/background color, and `scene.fog`.
- Keep road effectively infinite by recycling segments/stripes/props.

### MOTO.Controls  (file: js/controls.js)
- `init(domElement, {onTap, onPause}) ` — wire tilt + touch + keyboard.
- `read() -> {steer:-1..1, throttle:0..1, brake:0..1}` — called every frame.
  steer<0 = left. Tilt uses DeviceOrientation gamma (portrait); touch-drag &
  hold-to-accelerate fallback; keyboard arrows/space for desktop verify.
- `setMode('tilt'|'touch')`, `calibrate()` (set current tilt as neutral),
  `requestPermission()` (resolve harmlessly where not needed).

### MOTO.Audio  (file: js/audio.js)  — WebAudio, fully synthesized
- `init()` (call after first user gesture), `setMuted(bool)`.
- `startEngine()`, `stopEngine()`, `engine(rpm01)` (0..1 continuous).
- `crash()`, `coin()`, `click()`, `whoosh()` (near-miss).
Must never throw if WebAudio is unavailable (guard everything).

### MOTO.UI  (files: js/ui.js + css/ui.css)  — DOM overlay
- `init(cb)` where cb = {onStart(bikeId), onRestart, onResume, onPause,
  onSelectBike(bikeId), onBuyBike(bikeId), onSettingsChange(settings),
  onCalibrate, onOpenGarage, onBackToMenu}.
- `show(screen)` screen in: loading, menu, garage, hud, paused, gameover.
- `setHUD({speedKmh,distance,coins,best})`.
- `showGameOver({distance,coins,best,isNewBest,earned})`.
- `setBikes(catalog, owned[], selectedId, coinBalance)`.
- `setCoins(n)`, `setSettings(settings)`, `toast(msg)`.
- settings object: `{renderScale:'perf'|'balanced'|'ultra', controlMode:'tilt'|'touch', muted:bool, shadows:bool}`.

### Core (files: js/game.js = MOTO.World, js/main.js = MOTO.App) — owned by integrator
game.js exposes `MOTO.World.create({scene, env, bikeGroup, stats}) -> world` with
`update(dt,input)`, getters `speed` (m/s), `speedKmh`, `distance` (m), `coins`,
`rpm01`, `crashed`, `events` (array drained by main: 'coin','nearmiss','crash'),
and `dispose(scene)`. main.js owns renderer, camera, RAF loop, 4K render-scale,
persistence (localStorage `moto.save`), state machine, module wiring.

## Hard rules for module agents
1. Edit **only your own file(s)**. Never touch another module, index.html, or core.
2. `THREE` is a global. Do not import. Do not add `<script>` tags.
3. Conform to the API names/signatures above **exactly** — the core calls them.
4. Must run in the Android WebView (Chromium, WebGL2) AND under headless verify
   (jsdom won't run WebGL, so guard so that merely *loading* the file throws nothing;
   heavy GL work happens inside functions the verifier may stub).
5. No network, no external assets, no copyrighted material. Self-contained.
