// Structural verifier for the multi-page "Hashish — A History" app.
// Loads the real index.html + all modules + app.js in jsdom, drives every
// page, and asserts the expected structure and content binding.
import { JSDOM, VirtualConsole } from "jsdom";

const indexUrl = new URL("../app/assets/index.html", import.meta.url);
const errors = [];
const vc = new VirtualConsole();
vc.on("jsdomError", e => {
  const m = e.detail?.message || e.message || String(e);
  // jsdom doesn't implement scrollTo; ignore that noise (works in WebView).
  if (!/scrollTo|Not implemented/i.test(m)) errors.push("jsdomError: " + m);
});
vc.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

const dom = await JSDOM.fromFile(indexUrl.pathname, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole: vc,
});
const { window } = dom;
window.IntersectionObserver = class {
  constructor(cb){ this.cb = cb; }
  observe(el){ this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this); }
  unobserve(){} disconnect(){}
};
window.scrollTo = () => {};
await new Promise(r => (window.document.readyState === "complete"
  ? r() : (window.addEventListener("load", r), setTimeout(r, 1500))));

const d = window.document;
const go = id => window.__go(id);
const checks = [];
const want = (name, ok, extra = "") => checks.push({ name, ok: !!ok, extra });

// modules + shell
want("module: Illo", "Illo" in window && !!window.Illo);
want("module: Gallery.render", window.Gallery && typeof window.Gallery.render === "function");
want("module: Charts.render", window.Charts && typeof window.Charts.render === "function");
want("module: HashMap.render", window.HashMap && typeof window.HashMap.render === "function");
want("module: Motion.production", window.Motion && typeof window.Motion.production === "function");
want("nav tabs = 8", d.querySelectorAll("#tabbar .tab").length === 8, d.querySelectorAll("#tabbar .tab").length);

// drive each page, assert it populates
for (const id of ["home","timeline","map","data","language","myths","gallery","sources"]) {
  go(id);
  const pg = d.getElementById("page-" + id);
  want(`page '${id}' renders`, pg && pg.querySelectorAll("*").length > 5,
    pg ? pg.querySelectorAll("*").length + " nodes" : "missing");
}

// content binding
go("home");
want("hero coin SVG", d.querySelectorAll("#page-home .coinwrap svg").length === 1);
want("big-stat tiles >= 6", d.querySelectorAll("#page-home .bigstat").length >= 6, d.querySelectorAll("#page-home .bigstat").length);
go("timeline");
want("timeline entries >= 30", d.querySelectorAll("#page-timeline .entry").length >= 30, d.querySelectorAll("#page-timeline .entry").length);
want("timeline has region pills", d.querySelectorAll("#page-timeline .entry .region").length > 10);
go("data");
want("chart SVGs = 5", d.querySelectorAll("#page-data svg").length === 5, d.querySelectorAll("#page-data svg").length);
want("chart sources shown", d.querySelectorAll("#page-data .chart-source").length === 5);
go("language");
want("language terms = 14", d.querySelectorAll("#page-language .term").length === 14, d.querySelectorAll("#page-language .term").length);
go("myths");
want("myth cards = 7", d.querySelectorAll("#page-myths .myth").length === 7, d.querySelectorAll("#page-myths .myth").length);
want("primary extracts = 10", d.querySelectorAll("#page-myths .extract").length === 10, d.querySelectorAll("#page-myths .extract").length);
go("gallery");
want("gallery items = 24", d.querySelectorAll("#page-gallery .gitem").length === 24, d.querySelectorAll("#page-gallery .gitem").length);
go("map");
want("map+motion SVGs >= 2", d.querySelectorAll("#page-map svg").length >= 2, d.querySelectorAll("#page-map svg").length);
go("sources");
want("sources list >= 10", d.querySelectorAll("#sourcelist li").length >= 10, d.querySelectorAll("#sourcelist li").length);

// myth accordion toggles
go("myths");
const m0 = d.querySelector("#page-myths .myth");
m0 && m0.click();
want("myth expands (.open)", m0 && m0.classList.contains("open"));

want("no runtime errors", errors.length === 0, errors.slice(0,4).join(" | "));

let pass = 0;
for (const c of checks) {
  console.log(`${c.ok ? "✓" : "✗"} ${c.name}${c.extra !== "" ? "  (" + c.extra + ")" : ""}`);
  if (c.ok) pass++;
}
console.log(`\n${pass}/${checks.length} checks passed`);
process.exit(pass === checks.length ? 0 : 1);
