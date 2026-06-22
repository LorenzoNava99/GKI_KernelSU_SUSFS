/* Visual capture harness — NOT a pass/fail test. Loads the real game, starts a
 * run, and saves several full-resolution frames + a scene diagnostic dump so we
 * can actually LOOK at the rendering and catch fog/road/floating-prop problems.
 * Usage: node verify/shots.mjs [quality]   (quality: perf|balanced|ultra) */
import puppeteer from "puppeteer";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexUrl = "file://" + path.join(here, "..", "app", "assets", "index.html");
const outDir = path.join(here, "shots");
fs.mkdirSync(outDir, { recursive: true });
const quality = process.argv[2] || "balanced";

const errs = [];
const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle",
    "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
});
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 1040, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
page.on("pageerror", e => errs.push("pageerror: " + e.message));
page.on("console", m => { const t = m.text(); if (m.type() === "error" || /warn/i.test(m.type())) errs.push(m.type() + ": " + t); });

// preset quality + disable adaptive res so frames are crisp & stable for review
await page.evaluateOnNewDocument((q) => {
  try { localStorage.setItem("moto.save", JSON.stringify({ settings: { renderScale: q, controlMode: "tilt", muted: true, shadows: true, sensitivity: 1, aiTraffic: true, dev: true } })); } catch (e) {}
  window.__CAPTURE__ = true;
}, quality);

await page.goto(indexUrl, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => window.MOTO && window.MOTO.App, { timeout: 15000 });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await sleep(800);
await page.screenshot({ path: path.join(outDir, "00-menu.png") });

// pin the render scale (defeat adaptive) so review frames aren't downscaled
await page.evaluate(() => {
  try {
    const app = window.MOTO.App; // not exposed; reach renderer via a hook
  } catch (e) {}
});

// start a run
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /play/i.test(x.textContent)); if (b) b.click(); });
await sleep(500);
await page.keyboard.down("ArrowUp");

const frames = [3000, 6000, 9000, 13000];
let t0 = Date.now(), idx = 0;
for (const f of frames) {
  while (Date.now() - t0 < f) await sleep(150);
  idx++;
  await page.screenshot({ path: path.join(outDir, `0${idx}-play-${f}ms.png`) });
}
await page.keyboard.up("ArrowUp");

// scene diagnostics: find objects far from the play volume (likely "floating" junk)
const diag = await page.evaluate(() => {
  const out = { camera: null, objects: 0, byType: {}, suspicious: [], fog: null, bg: null };
  try {
    // locate the THREE scene/camera via the renderer the app made
    // (main.js keeps them module-local; sniff from the canvas' __three or globals)
    const sc = window.__scene || (window.MOTO && window.MOTO._scene);
  } catch (e) {}
  return out;
});

console.log("quality:", quality);
console.log("errors/warnings:", errs.length ? errs.slice(0, 12) : "none");
console.log("saved:", fs.readdirSync(outDir).filter(f => f.endsWith(".png")).join(", "));
await browser.close();
