/* Scene diagnostics — dumps real object positions so we can pinpoint rendering
 * bugs (props overlapping the road, bike/road misalignment, fog/bg) numerically
 * instead of guessing from blurry software-rendered screenshots. */
import puppeteer from "puppeteer";
import path from "node:path";
import { fileURLToPath } from "node:url";
const here = path.dirname(fileURLToPath(import.meta.url));
const url = "file://" + path.join(here, "..", "app", "assets", "index.html");

const browser = await puppeteer.launch({ headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const page = await browser.newPage();
await page.setViewport({ width: 480, height: 1040, deviceScaleFactor: 1 });
await page.evaluateOnNewDocument(() => { try { localStorage.setItem("moto.save", JSON.stringify({ settings: { renderScale: "balanced", controlMode: "tilt", muted: true, shadows: true, sensitivity: 1, aiTraffic: true, dev: true } })); } catch (e) {} });
await page.goto(url, { waitUntil: "load", timeout: 30000 });
await page.waitForFunction(() => window.MOTO && window.MOTO.App && window.MOTO.App._debug, { timeout: 15000 });
await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find(x => /play/i.test(x.textContent)); if (b) b.click(); });
const sleep = ms => new Promise(r => setTimeout(r, ms));
await page.keyboard.down("ArrowUp");
await sleep(4000);

const d = await page.evaluate(() => {
  const dbg = window.MOTO.App._debug();
  const scene = dbg.scene, world = dbg.world, cam = dbg.camera;
  const out = { bike: null, camera: null, fog: null, bg: null, roadHalfWidth: 5.4,
    overlappingProps: [], roadSegsNearZ0: [], counts: { total: 0, byGeom: {} }, traffic: [] };
  try { out.camera = { x: +cam.position.x.toFixed(2), y: +cam.position.y.toFixed(2), z: +cam.position.z.toFixed(2), fov: +cam.fov.toFixed(1) }; } catch (e) {}
  try { out.bike = { x: +world.bike.position.x.toFixed(2), y: +world.bike.position.y.toFixed(2), z: +world.bike.position.z.toFixed(2) }; } catch (e) {}
  try { out.fog = scene.fog ? { near: scene.fog.near, far: scene.fog.far } : null; } catch (e) {}
  try { out.bg = scene.background ? scene.background.constructor.name : null; } catch (e) {}
  try {
    scene.traverse(o => {
      out.counts.total++;
      // props are Groups we added; check children for big meshes near the road
      const wp = o.getWorldPosition ? o.getWorldPosition(new THREE.Vector3()) : null;
      if (o.isMesh && wp) {
        // estimate world half-width via bounding box scaled
        let hw = 0;
        try { if (!o.geometry.boundingBox) o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox; hw = (bb.max.x - bb.min.x) * 0.5 * Math.abs(o.getWorldScale ? o.getWorldScale(new THREE.Vector3()).x : 1); } catch (e) {}
        // does this mesh intrude into the road corridor (|x|<6.5) within the visible band?
        if (wp.z > -160 && wp.z < 30 && (Math.abs(wp.x) - hw) < 6.5 && wp.position?.y !== undefined) {}
        if (wp.z > -120 && wp.z < 25 && (Math.abs(wp.x) - hw) < 6.5 && hw > 1.2) {
          out.overlappingProps.push({ x: +wp.x.toFixed(1), z: +wp.z.toFixed(1), hw: +hw.toFixed(1), y: +wp.y.toFixed(1) });
        }
      }
    });
  } catch (e) { out.err = String(e); }
  out.overlappingProps = out.overlappingProps.slice(0, 14);
  try { out.traffic = (world.traffic || []).slice(0, 5).map(t => ({ x: +t.x.toFixed(1), z: +t.z.toFixed(0), lane: t.lane })); } catch (e) {}
  return out;
});
console.log(JSON.stringify(d, null, 1));
await browser.close();
