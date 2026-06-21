const { JSDOM } = require("jsdom");
const path = require("path");

const errors = [];
const virtualConsole = new (require("jsdom").VirtualConsole)();
virtualConsole.on("jsdomError", e => errors.push("jsdomError: " + (e.detail || e.message || e)));
virtualConsole.on("error", (...a) => errors.push("console.error: " + a.join(" ")));

// minimal polyfills jsdom lacks
const indexFile = path.resolve("app/assets/index.html");

JSDOM.fromFile(indexFile, {
  runScripts: "dangerously",
  resources: "usable",
  pretendToBeVisual: true,
  virtualConsole,
}).then(dom => {
  const { window } = dom;
  // polyfill IntersectionObserver so modules animate-or-render
  window.IntersectionObserver = class {
    constructor(cb){ this.cb = cb; }
    observe(el){ this.cb([{ isIntersecting: true, target: el, intersectionRatio: 1 }], this); }
    unobserve(){} disconnect(){}
  };
  window.scrollTo = window.scrollTo || function(){};

  // wait for load + scripts
  return new Promise(res => {
    if (window.document.readyState === "complete") return res(window);
    window.addEventListener("load", () => res(window));
    setTimeout(() => res(window), 1500);
  });
}).then(window => {
  const doc = window.document;
  const report = {};
  const pages = ["home","timeline","map","data","language","myths","gallery","sources"];

  // globals present?
  report.globals = {
    CONTENT: !!window.CONTENT,
    Illo: !!window.Illo, Gallery: !!(window.Gallery && window.Gallery.render),
    Charts: !!(window.Charts && window.Charts.render),
    HashMap: !!(window.HashMap && window.HashMap.render),
    Motion: !!(window.Motion && window.Motion.production),
  };
  report.tabs = doc.querySelectorAll("#tabbar .tab").length;

  // drive every page
  report.pages = {};
  for (const id of pages) {
    try {
      window.__go(id);
      const pg = doc.getElementById("page-" + id);
      report.pages[id] = {
        nodes: pg ? pg.querySelectorAll("*").length : -1,
        text: pg ? (pg.textContent || "").replace(/\s+/g," ").trim().length : 0,
      };
    } catch (e) { report.pages[id] = { error: String(e) }; }
  }

  // content coverage checks
  const C = window.CONTENT || {};
  report.content = {
    entries: (C.entries||[]).length, terms:(C.terms||[]).length, myths:(C.myths||[]).length,
    extracts:(C.extracts||[]).length, charts:(C.charts||[]).length, bignums:(C.bignums||[]).length,
    gallery:(C.gallery||[]).length, facts:(C.facts||[]).length,
  };
  // rendered element counts on key pages
  window.__go("timeline");
  report.rendered = { entries: doc.querySelectorAll("#page-timeline .entry").length };
  window.__go("data");
  report.rendered.chartSVGs = doc.querySelectorAll("#page-data svg").length;
  window.__go("gallery");
  report.rendered.gitems = doc.querySelectorAll("#page-gallery .gitem").length;
  window.__go("language");
  report.rendered.terms = doc.querySelectorAll("#page-language .term").length;
  window.__go("myths");
  report.rendered.myths = doc.querySelectorAll("#page-myths .myth").length;
  report.rendered.extracts = doc.querySelectorAll("#page-myths .extract").length;
  window.__go("map");
  report.rendered.mapSVG = doc.querySelectorAll("#page-map svg").length;
  window.__go("home");
  report.rendered.bigstats = doc.querySelectorAll("#page-home .bigstat").length;
  report.rendered.heroCoinSVG = doc.querySelectorAll("#page-home .coinwrap svg").length;

  report.errors = errors;
  console.log(JSON.stringify(report, null, 1));
}).catch(e => { console.error("FATAL", e); process.exit(1); });
