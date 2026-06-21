/* Real-browser smoke test: loads the actual game with software WebGL (SwiftShader),
 * boots it, starts a run, drives input, and asserts no runtime errors + the canvas
 * actually renders non-blank frames. Catches integration bugs the THREE-mock can't. */
import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const indexUrl = "file://" + path.join(here, "..", "app", "assets", "index.html");
const shotDir = path.join(here, "shots");
import fs from "node:fs"; fs.mkdirSync(shotDir, { recursive: true });

import zlib from "node:zlib";
const errors = [];
const results = [];
function ok(name, cond, extra = "") { results.push({ name, pass: !!cond, extra }); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
// crude "is this image non-blank" check: decompress IDAT, count distinct sampled bytes
function pngSampleDistinct(file) {
  try {
    const d = fs.readFileSync(file); let i = 8, idat = [];
    while (i < d.length) { const ln = d.readUInt32BE(i); const typ = d.toString("ascii", i + 4, i + 8); if (typ === "IDAT") idat.push(d.subarray(i + 8, i + 8 + ln)); i += 12 + ln; }
    const raw = zlib.inflateSync(Buffer.concat(idat)); const set = new Set();
    for (let k = 0; k < raw.length; k += 997) set.add(raw[k]);
    return set.size;
  } catch (e) { return 0; }
}

const browser = await puppeteer.launch({
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--enable-webgl",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist", "--enable-features=Vulkan"]
});
try {
  const page = await browser.newPage();
  // Simulate Pixel 9 Pro XL portrait, high DPI
  await page.setViewport({ width: 412, height: 916, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  page.on("console", m => { if (m.type() === "error") errors.push("console.error: " + m.text()); });
  page.on("pageerror", e => errors.push("pageerror: " + (e && e.message || e)));
  page.on("requestfailed", r => { const u = r.url(); if (!u.startsWith("data:")) errors.push("requestfailed: " + u + " " + (r.failure() && r.failure().errorText)); });

  await page.goto(indexUrl, { waitUntil: "load", timeout: 30000 });

  // wait for boot: WebGL context + menu visible
  await page.waitForFunction(() => window.MOTO && window.MOTO.App, { timeout: 15000 });
  const glInfo = await page.evaluate(() => {
    const c = document.getElementById("gl");
    const gl = c.getContext("webgl2") || c.getContext("webgl");
    return { hasGL: !!gl, w: c.width, h: c.height,
      menu: !!document.querySelector(".scr-menu.active, .screen.active") };
  });
  ok("WebGL context created", glInfo.hasGL);
  ok("canvas sized > 0", glInfo.w > 0 && glInfo.h > 0, glInfo.w + "x" + glInfo.h);
  await sleep(600);
  await page.screenshot({ path: path.join(shotDir, "menu.png") });

  // start a run: click the primary PLAY button
  const clicked = await page.evaluate(() => {
    const btns = Array.from(document.querySelectorAll("button"));
    const play = btns.find(b => /play/i.test(b.textContent));
    if (play) { play.click(); return true; }
    return false;
  });
  ok("PLAY button found & clicked", clicked);
  await sleep(400);

  // drive: hold throttle + steer with keyboard for ~2.5s
  await page.keyboard.down("ArrowUp");
  for (let i = 0; i < 5; i++) { await page.keyboard.down("ArrowLeft"); await sleep(250); await page.keyboard.up("ArrowLeft"); await page.keyboard.down("ArrowRight"); await sleep(250); await page.keyboard.up("ArrowRight"); }
  await page.keyboard.up("ArrowUp");

  // is the HUD active and is something being drawn (non-blank center pixels)?
  const hud = await page.evaluate(() => !!document.querySelector(".scr-hud.active"));
  ok("HUD active during play", hud);

  // WebGL canvases clear their drawing buffer after compositing, so sampling the
  // canvas directly reads blank. Instead analyse the compositor screenshot file.
  const playShot = path.join(shotDir, "play.png");
  await page.screenshot({ path: playShot });
  const distinct = pngSampleDistinct(playShot);
  ok("gameplay frame renders content", distinct > 24, "distinct sampled bytes=" + distinct);

  ok("no runtime errors", errors.length === 0, errors.slice(0, 8).join(" | "));
} catch (e) {
  ok("test harness ran", false, e.message);
} finally {
  await browser.close();
}

let pass = 0;
for (const r of results) { console.log((r.pass ? "  PASS " : "  FAIL ") + r.name + (r.extra ? "  [" + r.extra + "]" : "")); if (r.pass) pass++; }
console.log(`\n${pass}/${results.length} browser checks passed`);
process.exit(pass === results.length ? 0 : 1);
