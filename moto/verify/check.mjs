/* Headless verifier for SpeedMoto. Cannot run WebGL, so it mocks `THREE` with a
 * permissive auto-vivifying Proxy and runs the REAL game logic (models, env,
 * controls, world simulation) to assert the module contract holds and a run
 * actually progresses, collects coins, and can crash. */
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const ASSETS = path.join(here, "..", "app", "assets");
const errors = [];
const ok = (name, cond, extra = "") => { results.push({ name, pass: !!cond, extra }); if (!cond) errors.push(name + (extra ? " — " + extra : "")); };
const results = [];

// ---- THREE auto-mock -------------------------------------------------------
function makeProxy() {
  const fn = function () { return makeProxy(); };
  fn.x = 0; fn.y = 0; fn.z = 0;
  return new Proxy(fn, {
    get(t, p) {
      if (p === "set") return (a, b, c) => { t.x = a; t.y = b; t.z = c; return t; };
      if (p === "setHex" || p === "setRGB" || p === "copy" || p === "lerp" || p === "add" ||
          p === "remove" || p === "traverse" || p === "updateProjectionMatrix" || p === "lookAt" ||
          p === "clone" || p === "dispose" || p === "start" || p === "stop") {
        return (...args) => (p === "clone" ? makeProxy() : t);
      }
      if (p in t) return t[p];
      if (p === Symbol.toPrimitive) return () => 0;
      const v = makeProxy(); t[p] = v; return v;
    },
    set(t, p, v) { t[p] = v; return true; },
    apply() { return makeProxy(); },
    construct() { return makeProxy(); }
  });
}
const THREE = new Proxy({}, {
  get(t, p) {
    if (p === "Color") return function (c) { this.value = c; this.setHex = () => this; };
    if (p === "Fog") return function () {};
    if (p === "Group") return function () { const g = makeProxy(); return g; };
    if (p in t) return t[p];
    const C = makeProxy(); t[p] = C; return C;
  }
});

// ---- DOM / window mock -----------------------------------------------------
function el() {
  return { style: {}, classList: { add() {}, remove() {}, contains() { return false; } },
    appendChild(c) { (this.children = this.children || []).push(c); return c; }, append() {},
    addEventListener() {}, setAttribute() {}, removeChild() {}, firstChild: { nodeValue: "" },
    set innerHTML(v) {}, get innerHTML() { return ""; }, set textContent(v) {}, get textContent() { return ""; },
    value: "", appendData() {}, querySelector() { return el(); }, querySelectorAll() { return []; } };
}
const documentMock = {
  readyState: "loading",
  getElementById() { return el(); },
  createElement() { return el(); },
  addEventListener() {}, body: el()
};
const sandbox = {
  THREE, window: {}, document: documentMock, localStorage: (() => { let m = {}; return { getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: k => { delete m[k]; } }; })(),
  addEventListener() {}, removeEventListener() {}, dispatchEvent() {}, devicePixelRatio: 3,
  innerWidth: 1344, innerHeight: 2992,
  requestAnimationFrame() { return 0; }, cancelAnimationFrame() {}, setTimeout: () => 0, clearTimeout() {},
  navigator: { userAgent: "node" }, console, Math, Date, JSON, Object, Array, performance: { now: () => Date.now() }
};
sandbox.window = sandbox; sandbox.self = sandbox; sandbox.globalThis = sandbox;
sandbox.AudioContext = function () { return { state: "running", sampleRate: 44100, createOscillator: () => makeProxy(), createGain: () => makeProxy(), createBiquadFilter: () => makeProxy(), createBuffer: () => ({ getChannelData: () => new Float32Array(8) }), createBufferSource: () => makeProxy(), destination: {}, currentTime: 0, resume() {} }; };
// WebGPU post-processing nodes (only used at runtime by render.js, which the
// verifier never boots) — provide a permissive mock so load never throws.
sandbox.MOTOGFX = new Proxy({ version: "mock" }, { get: (t, p) => (p in t ? t[p] : (() => makeProxy())) });
vm.createContext(sandbox);

function load(rel) {
  const code = fs.readFileSync(path.join(ASSETS, rel), "utf8");
  try { vm.runInContext(code, sandbox, { filename: rel }); ok("loads " + rel, true); }
  catch (e) { ok("loads " + rel, false, e.message); }
}

// load modules in the same order as index.html (the THREE bundle is mocked)
["js/models.js", "js/environment.js", "js/controls.js", "js/audio.js", "js/ui.js", "js/render.js", "js/ai.js", "js/game.js", "js/main.js"].forEach(load);

const M = sandbox.MOTO || {};
// ---- contract surface ------------------------------------------------------
ok("MOTO.Models", M.Models && typeof M.Models.bike === "function" && typeof M.Models.bikeCatalog === "function" && typeof M.Models.traffic === "function" && typeof M.Models.trafficKinds === "function" && typeof M.Models.coin === "function");
ok("MOTO.Environment", M.Environment && typeof M.Environment.create === "function" && typeof M.Environment.themes === "function");
ok("MOTO.Controls", M.Controls && typeof M.Controls.read === "function" && typeof M.Controls.init === "function");
ok("MOTO.Audio", M.Audio && typeof M.Audio.engine === "function" && typeof M.Audio.crash === "function");
ok("MOTO.UI", M.UI && typeof M.UI.init === "function" && typeof M.UI.setHUD === "function");
ok("MOTO.World", M.World && typeof M.World.create === "function");
ok("MOTO.App", M.App && typeof M.App.boot === "function");
ok("MOTO.Render", M.Render && typeof M.Render.create === "function");
ok("MOTO.AI", M.AI && typeof M.AI.think === "function" && typeof M.AI.newAgent === "function" && typeof M.AI.available === "function");
ok("MOTO.Controls.setSensitivity", M.Controls && typeof M.Controls.setSensitivity === "function");

// ---- catalog / kinds -------------------------------------------------------
let catalog = [], kinds = [], themes = [];
try { catalog = M.Models.bikeCatalog(); } catch (e) {}
try { kinds = M.Models.trafficKinds(); } catch (e) {}
try { themes = M.Environment.themes(); } catch (e) {}
ok("catalog >= 5 bikes", catalog.length >= 5, "got " + catalog.length);
ok("starter is free", catalog[0] && catalog[0].price === 0);
ok("bikes have stats", catalog.every(b => b.topSpeed > 0 && b.accel >= 0 && b.handling >= 0));
ok("traffic kinds incl car/truck/bus", ["car", "truck", "bus"].every(k => kinds.some(t => t.kind === k)), JSON.stringify(kinds.map(k => k.kind)));
ok("themes >= 5", themes.length >= 5, "got " + themes.length);

// ---- build meshes without throwing ----------------------------------------
try { M.Models.bike(catalog[0].id); M.Models.traffic("car"); M.Models.traffic("truck"); M.Models.coin(); ok("model factories run", true); }
catch (e) { ok("model factories run", false, e.message); }

// ---- environment + world simulation ---------------------------------------
const scene = makeProxy();
let env, world;
try {
  env = M.Environment.create(scene, themes[0].id);
  ok("env.create", env && typeof env.update === "function" && typeof env.dispose === "function" && env.numLanes > 0 && Array.isArray(env.laneCenters), "lanes=" + (env && env.numLanes));
} catch (e) { ok("env.create", false, e.message); }

try {
  const bike = M.Models.bike(catalog[0].id);
  world = M.World.create({ scene, env, bikeGroup: bike, stats: catalog[0] });
  ok("world.create", world && typeof world.update === "function");
} catch (e) { ok("world.create", false, e.message); }

// drive frames; force full throttle, no steer -> distance must grow; collisions possible
let crashed = false, maxCoins = 0, distGrew = false;
try {
  const startDist = world.distance;
  for (let i = 0; i < 1800; i++) {
    const steer = Math.sin(i / 30) * 0.6;
    world.update(1 / 60, { steer, throttle: 1, brake: 0 });
    try { env.update(1 / 60, world.speed, world.distance); } catch (e) { ok("env.update", false, e.message); break; }
    if (world.distance > startDist + 50) distGrew = true;
    if (world.coins > maxCoins) maxCoins = world.coins;
    if (world.crashed) { crashed = true; break; }
  }
  ok("distance advances", distGrew, "dist=" + Math.floor(world.distance));
  ok("speedKmh sane", world.speedKmh > 0 && world.speedKmh < 1000, "kmh=" + Math.round(world.speedKmh));
  ok("rpm01 in [0,1]", world.rpm01 >= 0 && world.rpm01 <= 1, "rpm=" + world.rpm01.toFixed(2));
  ok("simulation ran without throw", true);
} catch (e) { ok("simulation ran without throw", false, e.message); }

// crash detection: ride straight into dense traffic should eventually collide
try {
  const bike2 = M.Models.bike(catalog[0].id);
  const w2 = M.World.create({ scene, env, bikeGroup: bike2, stats: catalog[0] });
  let died = false;
  for (let i = 0; i < 6000 && !died; i++) { w2.update(1 / 60, { steer: 0, throttle: 1, brake: 0 }); if (w2.crashed) died = true; }
  ok("collision can occur (crash)", died, "rode " + Math.floor(w2.distance) + "m without crashing");
} catch (e) { ok("collision can occur (crash)", false, e.message); }

// controls.read shape
try { const r = M.Controls.read(); ok("controls.read shape", typeof r.steer === "number" && typeof r.throttle === "number" && typeof r.brake === "number"); }
catch (e) { ok("controls.read shape", false, e.message); }

// AI traffic: a run with neural drivers must advance without throwing, and
// brains must produce varied lane decisions (not all identical).
try {
  const bike3 = M.Models.bike(catalog[0].id);
  const w3 = M.World.create({ scene, env, bikeGroup: bike3, stats: catalog[0], ai: true });
  ok("AI enabled in world", w3.ai === true);
  let laneChanges = 0, prevLanes = new Map();
  for (let i = 0; i < 3500; i++) {
    w3.update(1 / 60, { steer: Math.sin(i / 25) * 0.5, throttle: 1, brake: 0 });
    for (const o of w3.traffic) { if (prevLanes.has(o) && prevLanes.get(o) !== o.targetLane) laneChanges++; prevLanes.set(o, o.targetLane); }
    if (w3.crashed) break;
  }
  ok("AI run advances", w3.distance > 30, "dist=" + Math.floor(w3.distance));
  ok("AI traffic changes lanes (non-static)", laneChanges > 0, "changes=" + laneChanges);
} catch (e) { ok("AI run advances", false, e.message); }

// AI brains vary by personality (stochastic, not all the same)
try {
  const persons = new Set();
  for (let i = 0; i < 40; i++) { const a = M.AI.newAgent({ lane: 1 }); persons.add(a.person); }
  ok("AI personalities vary", persons.size >= 2, [...persons].join(","));
} catch (e) { ok("AI personalities vary", false, e.message); }

// ---- report ----------------------------------------------------------------
let pass = 0;
for (const r of results) { console.log((r.pass ? "  PASS " : "  FAIL ") + r.name + (r.extra ? "  [" + r.extra + "]" : "")); if (r.pass) pass++; }
console.log(`\n${pass}/${results.length} checks passed`);
process.exit(errors.length ? 1 : 0);
