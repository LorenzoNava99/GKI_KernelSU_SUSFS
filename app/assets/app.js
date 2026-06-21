/* Hashish — A History · multi-page app shell.
   Builds every page from window.CONTENT and wires in the optional modules
   (Illo, Gallery, Charts, HashMap, Motion). Everything is guarded so a
   missing module degrades gracefully instead of breaking the app. */
(function () {
  "use strict";
  var C = window.CONTENT || {};
  var doc = document;
  var $ = function (s, r) { return (r || doc).querySelector(s); };
  function el(t, c, h) { var e = doc.createElement(t); if (c) e.className = c; if (h != null) e.innerHTML = h; return e; }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"]/g, function (m) { return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[m]; }); }
  function has(x) { return x != null && x !== ""; }

  /* ---------- chronology ---------- */
  function parseYear(y) {
    if (!y) return 99999;
    var s = ("" + y).toLowerCase();
    var bce = /bce|\bbc\b/.test(s);
    var cent = s.match(/(\d+)\s*(st|nd|rd|th)\s*c/);
    var n;
    if (cent) { n = (parseInt(cent[1], 10) - 1) * 100 + 50; }
    else {
      var m = s.replace(/,/g, "").match(/\d{1,5}/g);
      if (m && m.length) n = parseInt(m[0], 10); else return 99998;
    }
    return bce ? -n : n;
  }

  /* ---------- shared bits ---------- */
  var THEMES = { faith: "Faith & Ritual", science: "Science & Medicine", law: "Law & Power", culture: "Culture & Art" };
  function tagEls(themes) {
    var w = el("div", "tags");
    (themes || []).forEach(function (t) { w.appendChild(el("span", "tag " + t, THEMES[t] || t)); });
    return w;
  }
  function flagEl(text) {
    if (!has(text)) return null;
    var i = text.indexOf(":");
    var head = i >= 0 ? text.slice(0, i + 1) : text, rest = i >= 0 ? text.slice(i + 1) : "";
    var d = el("div", "flag"); d.appendChild(el("b", null, "⚠ " + esc(head))); d.appendChild(doc.createTextNode(rest));
    return d;
  }
  // image with graceful fallback to an Illo placeholder
  function illoFor(tag) {
    var I = window.Illo || {};
    var map = { painting: "amphora", manuscript: "manuscript", artifact: "mortar", map: "scroll", photo: "leaf" };
    var name = map[tag] || "leaf";
    return I[name] || I.leaf || "";
  }
  function imgWithFallback(url, alt, tag) {
    var wrap = el("div", "media");
    var img = el("img");
    img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
    img.alt = alt || ""; img.src = url;
    img.onerror = function () {
      var ph = el("div", "ph", illoFor(tag));
      ph.appendChild(el("span", "ph-hint", "image offline"));
      if (img.parentNode) img.parentNode.replaceChild(ph, img);
    };
    wrap.appendChild(img);
    return wrap;
  }

  /* ---------- page builders ---------- */
  function sectionHead(kicker, title) {
    var h = el("div", "sechead");
    h.appendChild(el("div", "section-k", esc(kicker)));
    h.appendChild(el("h2", "section-h", esc(title)));
    return h;
  }

  function buildHome(page) {
    var hero = el("section", "hero");
    var coin = el("div", "coinwrap");
    coin.innerHTML = (window.Illo && window.Illo.coin) ? window.Illo.coin : "";
    hero.appendChild(coin);
    hero.appendChild(el("p", "kicker", "<span>Resin &amp; Smoke</span>"));
    var h1 = el("h1", null, "HASHISH"); hero.appendChild(h1);
    hero.appendChild(el("p", "sub", "A History in Twelve Millennia"));
    hero.appendChild(el("p", "lede", "From a wild weed on the Asian steppe to a global story of faith, medicine, law and art — told with maps, data, manuscripts and myth."));
    var cta = el("button", "cta", "Begin the journey →");
    cta.onclick = function () { go("timeline"); };
    hero.appendChild(cta);
    page.appendChild(hero);

    // big stats
    if ((C.bignums || []).length) {
      page.appendChild(sectionHead("By the Numbers", "A drug, measured"));
      var g = el("div", "bigstats");
      C.bignums.slice(0, 8).forEach(function (b) {
        var d = el("div", "bigstat");
        var n = el("div", "n", "0"); n.dataset.v = b.value; n.dataset.pre = b.prefix || ""; n.dataset.suf = b.suffix || "";
        d.appendChild(n); d.appendChild(el("div", "l", esc(b.label || ""))); d.appendChild(el("div", "s", esc(b.source || "")));
        g.appendChild(d);
      });
      page.appendChild(g);
    }

    // fun fact ticker
    if ((C.facts || []).length) {
      page.appendChild(sectionHead("Did you know", "Fun facts"));
      var fg = el("div", "factgrid");
      C.facts.slice(0, 6).forEach(function (f) {
        var d = el("div", "fact"); d.appendChild(el("div", "txt", esc(f.text || f)));
        fg.appendChild(d);
      });
      page.appendChild(fg);
    }
  }

  function buildTimeline(page) {
    page.appendChild(sectionHead("12,000 years", "The Timeline"));
    var entries = (C.entries || []).slice().sort(function (a, b) { return parseYear(a.y) - parseYear(b.y); });
    var track = el("div", "track");
    var facts = (C.facts || []).slice();
    entries.forEach(function (e, i) {
      var card = el("article", "entry");
      if (has(e.region)) card.appendChild(el("span", "region", esc(e.region)));
      card.appendChild(el("div", "yr", esc(e.y || "")));
      card.appendChild(el("h3", null, esc(e.t || "")));
      if (e.image && e.image.url) card.appendChild(imgWithFallback(e.image.url, e.image.caption || e.t, "photo"));
      card.appendChild(el("p", null, esc(e.b || "")));
      if (has(e.extract)) { var q = el("div", "extract"); q.appendChild(el("div", "q", "“" + esc(e.extract) + "”")); card.appendChild(q); }
      card.appendChild(tagEls(e.themes));
      var fl = flagEl(e.flag); if (fl) card.appendChild(fl);
      if (has(e.src)) card.appendChild(el("div", "src", "Source: " + esc(e.src)));
      track.appendChild(card);
      // interleave a fun fact every 7 entries
      if (i % 7 === 6 && facts.length) {
        var f = facts.shift();
        var fc = el("div", "fact inline"); fc.appendChild(el("div", "txt", esc(f.text || f)));
        track.appendChild(fc);
      }
    });
    page.appendChild(track);
  }

  function buildMap(page) {
    page.appendChild(sectionHead("Diffusion", "How it spread"));
    page.appendChild(el("p", "intro", "Cannabis travelled with traders, pilgrims, soldiers and poets. Follow its diffusion across Eurasia and into Africa and Europe — then watch how traditional hashish is made."));
    var mapBox = el("div", "mapbox");
    page.appendChild(mapBox);
    try { if (window.HashMap && HashMap.render) HashMap.render(mapBox); else mapBox.appendChild(el("div", "ph", (window.Illo && Illo.scroll) || "")); }
    catch (e) { mapBox.appendChild(el("div", "ph", "map unavailable")); }

    page.appendChild(sectionHead("Craft", "Making hashish"));
    var motionBox = el("div", "motionbox");
    page.appendChild(motionBox);
    try { if (window.Motion && Motion.production) Motion.production(motionBox); else motionBox.appendChild(el("div", "ph", (window.Illo && Illo.mortar) || "")); }
    catch (e2) { motionBox.appendChild(el("div", "ph", "")); }
  }

  function buildData(page) {
    page.appendChild(sectionHead("By the Numbers", "The data"));
    (C.charts || []).forEach(function (spec) {
      var card = el("div", "chartcard");
      card.appendChild(el("div", "chart-title", esc(spec.title || "")));
      var body = el("div", "chart-body"); card.appendChild(body);
      if (has(spec.source)) card.appendChild(el("div", "chart-source", "Source: " + esc(spec.source)));
      if (has(spec.caveat)) card.appendChild(el("div", "chart-caveat", esc(spec.caveat)));
      page.appendChild(card);
      try { if (window.Charts && Charts.render) Charts.render(body, spec); else body.appendChild(el("div", "ph", "chart")); }
      catch (e) { body.appendChild(el("div", "ph", "chart unavailable")); }
    });
  }

  function buildLanguage(page) {
    page.appendChild(sectionHead("Etymology", "The words for it"));
    page.appendChild(el("p", "intro", "The drug carries its history in its names — across Arabic, Persian, Sanskrit, Chinese, Greek and beyond."));
    var grid = el("div", "termgrid");
    (C.terms || []).forEach(function (t) {
      var d = el("div", "term");
      d.appendChild(el("div", "script", esc(t.script || "")));
      d.appendChild(el("div", "translit", esc(t.translit || "") + (has(t.lang) ? " · " + esc(t.lang) : "")));
      d.appendChild(el("div", "meaning", esc(t.meaning || "")));
      if (has(t.first)) d.appendChild(el("div", "first", esc(t.first)));
      if (has(t.note)) d.appendChild(el("div", "note", esc(t.note)));
      grid.appendChild(d);
    });
    page.appendChild(grid);
  }

  function buildMyths(page) {
    page.appendChild(sectionHead("Setting the record straight", "Myth & Fact"));
    (C.myths || []).forEach(function (m) {
      var card = el("div", "myth");
      var row = el("div", "myth-header m");
      row.appendChild(el("span", "badge", "Myth"));
      row.appendChild(el("h3", "q", esc(m.m || "")));
      row.appendChild(el("span", "chev", "▼"));
      var a = el("div", "a");
      var ai = el("div", "a-inner");
      ai.appendChild(el("span", "fl", "The record says"));
      ai.appendChild(el("p", null, esc(m.f || "")));
      if (has(m.cite)) ai.appendChild(el("div", "cite", esc(m.cite)));
      a.appendChild(ai);
      card.appendChild(row); card.appendChild(a);
      card.onclick = function () { card.classList.toggle("open"); };
      page.appendChild(card);
    });
    // primary extracts
    if ((C.extracts || []).length) {
      page.appendChild(sectionHead("In their words", "Primary extracts"));
      C.extracts.forEach(function (x) {
        var bq = el("blockquote", "extract");
        bq.appendChild(el("div", "q", "“" + esc(x.quote || "") + "”"));
        var cite = [x.who, x.work, x.year].filter(has).join(", ");
        bq.appendChild(el("div", "cite", esc(cite || x.src || "")));
        page.appendChild(bq);
      });
    }
  }

  function buildGallery(page) {
    page.appendChild(sectionHead("Paintings, manuscripts, artifacts", "The Gallery"));
    page.appendChild(el("p", "intro", "Public-domain images load when you’re online; otherwise each is replaced by an illustrated placeholder and its caption."));
    var box = el("div", "gallery");
    page.appendChild(box);
    try {
      if (window.Gallery && Gallery.render) Gallery.render(box, C.gallery || []);
      else (C.gallery || []).forEach(function (g) { box.appendChild(imgFigure(g)); });
    } catch (e) { (C.gallery || []).forEach(function (g) { box.appendChild(imgFigure(g)); }); }
  }
  function imgFigure(g) { // local fallback if Gallery module missing
    var fig = el("figure", "gitem");
    var media = el("div", "gitem-media");
    var img = el("img");
    img.loading = "lazy"; img.decoding = "async"; img.referrerPolicy = "no-referrer";
    img.alt = g.caption || ""; img.src = g.url;
    img.onerror = function () { var ph = el("div", "ph", illoFor(g.tag)); ph.appendChild(el("span", "ph-hint", "image offline")); if (img.parentNode) img.parentNode.replaceChild(ph, img); };
    media.appendChild(img); fig.appendChild(media);
    var cap = el("figcaption", null, esc(g.caption || ""));
    if (has(g.credit) || has(g.license)) cap.appendChild(el("span", "credit", " " + esc([g.credit, g.license].filter(has).join(" · "))));
    fig.appendChild(cap);
    return fig;
  }

  function buildSources(page) {
    page.appendChild(sectionHead("Where this comes from", "Sources"));
    var set = {}; var list = [];
    (C.entries || []).forEach(function (e) { if (has(e.src)) set[e.src] = 1; });
    (C.charts || []).forEach(function (c) { if (has(c.source)) set[c.source] = 1; });
    var core = [
      "Ren, M. et al. (2019). Science Advances 5(6) — Pamir braziers.",
      "Ren, G. et al. (2021). Science Advances 7(29) — cannabis genome & domestication.",
      "Russo, E. B. et al. (2008). J. Experimental Botany 59 — Yanghai cannabis.",
      "Arie, Rosen & Namdar (2020). Tel Aviv 47(1) — cannabis on the Tel Arad altar.",
      "Herodotus, The Histories, Book IV.",
      "Rosenthal, F. (1971). The Herb: Hashish versus Medieval Muslim Society.",
      "Daftary, F. (1994). The Assassin Legends.",
      "Indian Hemp Drugs Commission Report (1893–94).",
      "Gaoni & Mechoulam (1964); Devane et al. (1992).",
      "UNODC World Drug Report; EMCDDA European Drug Report."
    ];
    core.forEach(function (s) { set[s] = 1; });
    Object.keys(set).forEach(function (k) { list.push(k); });
    list.sort();
    var ul = el("ul"); ul.id = "sourcelist";
    list.forEach(function (s) { ul.appendChild(el("li", null, esc(s))); });
    page.appendChild(ul);
    var ft = el("footer");
    ft.appendChild(el("div", null, "Hashish — A History · an interactive, offline field guide"));
    ft.appendChild(el("div", "disc", "Educational and historical content describing the cultural, scientific and legal history of a controlled substance. Not advice to obtain or use one. Disputed claims are flagged throughout. Images are public-domain works loaded from the web where available."));
    page.appendChild(ft);
  }

  /* ---------- router ---------- */
  var PAGES = [
    { id: "home", label: "Home", build: buildHome },
    { id: "timeline", label: "Timeline", build: buildTimeline },
    { id: "map", label: "Spread", build: buildMap },
    { id: "data", label: "Data", build: buildData },
    { id: "language", label: "Language", build: buildLanguage },
    { id: "myths", label: "Myths", build: buildMyths },
    { id: "gallery", label: "Gallery", build: buildGallery },
    { id: "sources", label: "Sources", build: buildSources }
  ];
  var built = {};
  function go(id) {
    var pageEl = doc.getElementById("page-" + id);
    if (!pageEl) return;
    if (!built[id]) { try { PAGES.filter(function (p) { return p.id === id; })[0].build(pageEl); } catch (e) {} built[id] = 1; }
    [].forEach.call(doc.querySelectorAll(".page"), function (p) { p.classList.remove("active"); p.style.display = "none"; });
    pageEl.classList.add("active"); pageEl.style.display = "block";
    [].forEach.call(doc.querySelectorAll("#tabbar .tab"), function (t) { t.classList.toggle("on", t.dataset.page === id); });
    var on = doc.querySelector('#tabbar .tab[data-page="' + id + '"]');
    if (on && on.scrollIntoView) try { on.scrollIntoView({ inline: "center", block: "nearest" }); } catch (e) {}
    window.scrollTo(0, 0);
    countersIn(pageEl);
  }
  window.__go = go;

  /* ---------- counters ---------- */
  function fmt(v) { return v >= 1000 ? Math.round(v).toLocaleString("en-US") : (v % 1 ? v.toFixed(1) : String(Math.round(v))); }
  function countersIn(root) {
    [].forEach.call(root.querySelectorAll(".bigstat .n"), function (n) {
      if (n.dataset.done) return; n.dataset.done = "1";
      var target = parseFloat(n.dataset.v), pre = n.dataset.pre || "", suf = n.dataset.suf || "";
      if (!isFinite(target)) { n.textContent = pre + (n.dataset.v || "") + suf; return; }
      var t0 = 0;
      function step(t) { if (!t0) t0 = t; var p = Math.min(1, (t - t0) / 1100); var e = 1 - Math.pow(1 - p, 3); n.textContent = pre + fmt(target * e) + suf; if (p < 1) requestAnimationFrame(step); }
      requestAnimationFrame(step);
    });
  }

  /* ---------- boot ---------- */
  function boot() {
    var tabbar = doc.getElementById("tabbar"), pages = doc.getElementById("pages");
    PAGES.forEach(function (p) {
      var b = el("button", "tab", esc(p.label)); b.dataset.page = p.id;
      b.onclick = function () { go(p.id); }; tabbar.appendChild(b);
      var sec = el("section", "page"); sec.id = "page-" + p.id; sec.style.display = "none"; pages.appendChild(sec);
    });
    go("home");

    // progress bar
    var bar = doc.getElementById("progress");
    doc.addEventListener("scroll", function () {
      var h = doc.documentElement, max = h.scrollHeight - h.clientHeight;
      bar.style.width = (max > 0 ? (h.scrollTop / max * 100) : 0) + "%";
      var tt = doc.getElementById("toTop"); if (tt) tt.classList.toggle("show", h.scrollTop > 600);
    }, { passive: true });

    var tt = doc.getElementById("toTop");
    if (tt) tt.onclick = function () { window.scrollTo({ top: 0, behavior: "smooth" }); };
  }
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", boot); else boot();
})();
