/* map.js — HashMap + Motion modules for Hashish History
   Self-contained, offline, no external deps, no backdrop-filter.
   Injects own <style> on first call. GPU-safe animations only.
*/
(function (global) {
  'use strict';

  /* ── CSS injection (idempotent) ─────────────────────────────────── */
  function injectCSS() {
    if (document.getElementById('hh-map-style')) return;
    const style = document.createElement('style');
    style.id = 'hh-map-style';
    style.textContent = `
/* ── HashMap ──────────────────────────────────────────────────────── */
.hm-wrap {
  position: relative;
  width: 100%;
  background: #0A0704;
  border: 1px solid rgba(196,146,74,.20);
  border-top-color: rgba(234,197,122,.28);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(234,197,122,.10), 0 6px 28px rgba(0,0,0,.55);
}
.hm-title {
  font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  font-size: 13px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #C4924A;
  opacity: .85;
  text-align: center;
  padding: 14px 0 0;
  margin: 0;
}
.hm-svg-wrap {
  width: 100%;
  overflow: hidden;
}
.hm-svg-wrap svg {
  width: 100%;
  height: auto;
  display: block;
}
/* map land fill */
.hm-land {
  fill: #d9c39a;
  stroke: rgba(80,50,10,.55);
  stroke-width: 1;
  stroke-linejoin: round;
}
/* sea is the SVG background rect */
.hm-sea {
  fill: #0d1117;
}
/* subtle paper texture overlay */
.hm-noise {
  fill: url(#hm-paper);
  opacity: .28;
  pointer-events: none;
}
/* trade route paths */
.hm-route {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.2;
}
/* node circles */
.hm-node {
  cursor: default;
}
.hm-node circle.hm-ring {
  fill: none;
  stroke-width: 1.4;
  animation: hm-pulse 2.6s ease-in-out infinite;
}
.hm-node circle.hm-dot {
  stroke: none;
}
@keyframes hm-pulse {
  0%,100% { r: 7; opacity: .85; }
  50%      { r: 9; opacity: .45; }
}
.hm-label {
  font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  font-size: 9.5px;
  fill: #F0E4CC;
  paint-order: stroke;
  stroke: #0A0704;
  stroke-width: 2.8px;
  pointer-events: none;
  letter-spacing: .04em;
}
/* route draw-on animation */
@keyframes hm-draw {
  to { stroke-dashoffset: 0; }
}
/* legend */
.hm-legend {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 16px 14px;
  flex-wrap: wrap;
}
.hm-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #9E8E75;
  letter-spacing: .06em;
}
.hm-legend-line {
  width: 22px;
  height: 2px;
  border-radius: 1px;
}
.hm-caption {
  flex: 1 1 100%;
  font-size: 10px;
  color: #9E8E75;
  font-style: italic;
  line-height: 1.5;
  margin-top: 2px;
}
/* replay button */
.hm-replay {
  display: block;
  margin: 0 16px 16px auto;
  font-size: 11px;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: #0A0704;
  background: linear-gradient(180deg,#EAC57A,#C4924A);
  border: none;
  border-radius: 999px;
  padding: 8px 20px;
  cursor: pointer;
  min-height: 36px;
  box-shadow: 0 2px 12px rgba(196,146,74,.35);
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
  transition: opacity .18s, transform .12s;
  -webkit-tap-highlight-color: transparent;
}
.hm-replay:active { transform: scale(.96); opacity: .85; }

/* ── Motion ───────────────────────────────────────────────────────── */
.mo-wrap {
  width: 100%;
  background: #0A0704;
  border: 1px solid rgba(196,146,74,.20);
  border-top-color: rgba(234,197,122,.28);
  border-radius: 18px;
  overflow: hidden;
  box-shadow: inset 0 1px 0 rgba(234,197,122,.10), 0 6px 28px rgba(0,0,0,.55);
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
}
.mo-title {
  font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  font-size: 13px;
  letter-spacing: .18em;
  text-transform: uppercase;
  color: #C4924A;
  opacity: .85;
  text-align: center;
  padding: 14px 0 0;
  margin: 0;
}
.mo-stage-track {
  position: relative;
  overflow: hidden;
  width: 100%;
}
.mo-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 22px 16px;
  position: absolute;
  top: 0; left: 0; width: 100%;
  opacity: 0;
  transform: translateX(48px);
  transition: opacity .38s cubic-bezier(.4,0,.2,1), transform .38s cubic-bezier(.4,0,.2,1);
  pointer-events: none;
}
.mo-stage.mo-active {
  opacity: 1;
  transform: none;
  position: relative;
  pointer-events: auto;
}
.mo-stage.mo-exit {
  opacity: 0;
  transform: translateX(-48px);
  position: absolute;
  pointer-events: none;
}
.mo-stage svg {
  width: 160px;
  height: 160px;
}
.mo-stage-num {
  font-size: 9.5px;
  letter-spacing: .26em;
  text-transform: uppercase;
  color: #C45F28;
  opacity: .85;
  margin-bottom: 8px;
}
.mo-stage-title {
  font-family: "Iowan Old Style","Palatino Linotype",Palatino,Georgia,"Times New Roman",serif;
  font-size: 17px;
  color: #EAC57A;
  margin: 10px 0 6px;
  text-align: center;
  font-weight: 600;
}
.mo-stage-desc {
  font-size: 13px;
  color: #DDD0B4;
  line-height: 1.62;
  text-align: center;
  max-width: 30ch;
  margin: 0;
}
.mo-controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px 18px;
  gap: 10px;
}
.mo-dots {
  display: flex;
  gap: 7px;
}
.mo-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: rgba(196,146,74,.25);
  transition: background .25s, transform .25s;
}
.mo-dot.mo-on {
  background: #C4924A;
  transform: scale(1.25);
}
.mo-btn {
  font-size: 11px;
  letter-spacing: .10em;
  text-transform: uppercase;
  color: #0A0704;
  background: linear-gradient(180deg,#EAC57A,#C4924A);
  border: none;
  border-radius: 999px;
  padding: 8px 22px;
  cursor: pointer;
  min-height: 36px;
  box-shadow: 0 2px 12px rgba(196,146,74,.30);
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif;
  transition: opacity .18s, transform .12s;
  -webkit-tap-highlight-color: transparent;
}
.mo-btn:active { transform: scale(.96); opacity: .85; }
.mo-btn:disabled { opacity: .35; cursor: default; transform: none; }

/* ── Reduced motion overrides ─────────────────────────────────────── */
@media (prefers-reduced-motion: reduce) {
  .hm-node circle.hm-ring { animation: none !important; }
  .hm-route { stroke-dashoffset: 0 !important; animation: none !important; }
  .mo-stage { transition: none !important; }
}
    `;
    (document.head || document.documentElement).appendChild(style);
  }

  /* ═══════════════════════════════════════════════════════════════
     HashMap
  ═══════════════════════════════════════════════════════════════ */

  // Nodes: [id, label, cx, cy]
  var NODES = [
    ['china',    'East Asia',      680, 110],
    ['pamir',    'Pamir / C. Asia',490,  95],
    ['india',    'India',          580, 210],
    ['persia',   'Persia',         430, 165],
    ['arabia',   'Arabia / Egypt', 370, 230],
    ['greece',   'Greece',         270, 165],
    ['morocco',  'Morocco',        165, 200],
    ['paris',    'Western Europe', 200, 100]
  ];

  // Routes: [fromId, toId, era-label, color-stop (0=ember,1=gold)]
  // Drawn in historical diffusion order
  var ROUTES = [
    ['china',  'pamir',   'c.500 BCE',   0   ],
    ['pamir',  'india',   'c.400 BCE',   0   ],
    ['pamir',  'persia',  'c.300 BCE',   0.2 ],
    ['persia', 'arabia',  'c.900 CE',    0.4 ],
    ['persia', 'greece',  'c.440 BCE',   0.3 ],
    ['arabia', 'morocco', 'c.1000 CE',   0.6 ],
    ['greece', 'paris',   'c.1800 CE',   0.8 ],
    ['morocco','paris',   'c.1800 CE',   1   ]
  ];

  /* Build a lookup for node positions */
  function nodeMap() {
    var m = {};
    NODES.forEach(function (n) { m[n[0]] = { x: n[2], y: n[3] }; });
    return m;
  }

  /* Quadratic bezier control point — arcs routes above the map */
  function curveD(x1, y1, x2, y2) {
    var mx = (x1 + x2) / 2;
    var my = (y1 + y2) / 2 - 60 - Math.abs(x2 - x1) * 0.15;
    return 'M' + x1 + ',' + y1 + ' Q' + mx + ',' + my + ' ' + x2 + ',' + y2;
  }

  /* Interpolate between ember #C45F28 and gold #EAC57A */
  function routeColor(t) {
    var r1 = 0xC4, g1 = 0x5F, b1 = 0x28;
    var r2 = 0xEA, g2 = 0xC5, b2 = 0x7A;
    var r = Math.round(r1 + (r2 - r1) * t);
    var g = Math.round(g1 + (g2 - g1) * t);
    var b = Math.round(b1 + (b2 - b1) * t);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  /* Approximate path length for dasharray */
  function approxLen(x1, y1, x2, y2) {
    var dx = x2 - x1, dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy) * 1.35; // bezier is longer than straight line
  }

  function buildMapSVG() {
    var ns = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 800 480');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('aria-label', 'Animated map of hashish diffusion routes across Eurasia and North Africa');
    svg.setAttribute('role', 'img');

    /* ── defs ── */
    var defs = document.createElementNS(ns, 'defs');

    // Paper noise filter (cheap, no backdrop-filter)
    var filt = document.createElementNS(ns, 'filter');
    filt.setAttribute('id', 'hm-paper');
    filt.setAttribute('x', '0'); filt.setAttribute('y', '0');
    filt.setAttribute('width', '100%'); filt.setAttribute('height', '100%');
    var feTurb = document.createElementNS(ns, 'feTurbulence');
    feTurb.setAttribute('type', 'fractalNoise');
    feTurb.setAttribute('baseFrequency', '0.65');
    feTurb.setAttribute('numOctaves', '3');
    feTurb.setAttribute('stitchTiles', 'stitch');
    var feBlend = document.createElementNS(ns, 'feBlend');
    feBlend.setAttribute('in', 'SourceGraphic');
    feBlend.setAttribute('mode', 'multiply');
    filt.appendChild(feTurb);
    filt.appendChild(feBlend);
    defs.appendChild(filt);

    // Glow filter for route highlight (cheap drop-shadow)
    var glow = document.createElementNS(ns, 'filter');
    glow.setAttribute('id', 'hm-glow');
    glow.setAttribute('x', '-20%'); glow.setAttribute('y', '-20%');
    glow.setAttribute('width', '140%'); glow.setAttribute('height', '140%');
    var feGBlur = document.createElementNS(ns, 'feGaussianBlur');
    feGBlur.setAttribute('stdDeviation', '2.5');
    feGBlur.setAttribute('result', 'blur');
    var feMerge = document.createElementNS(ns, 'feMerge');
    var feMN1 = document.createElementNS(ns, 'feMergeNode');
    feMN1.setAttribute('in', 'blur');
    var feMN2 = document.createElementNS(ns, 'feMergeNode');
    feMN2.setAttribute('in', 'SourceGraphic');
    feMerge.appendChild(feMN1);
    feMerge.appendChild(feMN2);
    glow.appendChild(feGBlur);
    glow.appendChild(feMerge);
    defs.appendChild(glow);

    svg.appendChild(defs);

    /* ── sea background ── */
    var sea = document.createElementNS(ns, 'rect');
    sea.setAttribute('class', 'hm-sea');
    sea.setAttribute('width', '800');
    sea.setAttribute('height', '480');
    svg.appendChild(sea);

    /* ── landmass paths (evocative, hand-authored, not precise) ── */
    // Main Eurasian + North Africa body
    var landPaths = [
      // Main body: Europe + Asia + Middle East landmass
      'M 155,60 C 170,45 200,42 230,50 C 260,58 275,42 300,38 C 325,34 345,42 360,38 ' +
      'C 380,34 400,28 425,32 C 455,37 480,28 510,22 C 540,16 570,20 600,18 ' +
      'C 635,16 665,24 690,30 C 718,37 740,42 758,55 C 770,65 775,80 772,98 ' +
      'C 768,120 760,138 755,158 C 750,178 748,200 750,218 ' +
      'C 752,238 748,258 742,272 C 735,288 720,298 705,308 ' +
      'C 688,318 668,325 648,330 C 628,335 610,342 590,348 ' +
      'C 568,355 545,362 522,368 C 500,373 478,376 458,380 ' +
      'C 436,384 412,386 390,382 C 368,378 348,370 330,362 ' +
      'C 310,354 288,348 268,345 C 248,342 228,345 210,350 ' +
      'C 192,355 175,362 162,370 C 150,378 142,388 138,398 ' +
      'C 133,408 130,418 128,428 C 125,440 120,450 112,456 ' +
      'C 100,462 88,458 78,450 C 68,442 62,430 58,418 ' +
      'C 54,405 52,390 55,375 C 58,358 68,342 78,328 ' +
      'C 88,313 96,298 98,282 C 100,265 92,250 85,236 ' +
      'C 78,222 72,208 70,193 C 68,178 70,163 75,150 ' +
      'C 80,136 90,124 100,112 C 110,100 122,90 135,80 C 145,72 150,66 155,60 Z',

      // Iberian Peninsula
      'M 148,128 C 155,118 165,112 178,110 C 192,108 205,115 215,125 ' +
      'C 225,135 228,150 222,163 C 216,175 202,183 188,185 ' +
      'C 174,187 160,180 152,168 C 144,156 142,140 148,128 Z',

      // India subcontinent
      'M 555,190 C 568,185 582,188 592,198 C 602,208 605,225 600,240 ' +
      'C 595,258 582,272 568,280 C 554,288 538,288 526,278 ' +
      'C 514,268 508,250 510,234 C 512,218 520,205 532,198 C 542,192 550,192 555,190 Z',

      // Arabian Peninsula
      'M 355,230 C 368,222 385,225 398,235 C 410,245 415,262 410,278 ' +
      'C 405,295 392,307 376,310 C 360,313 344,304 337,288 ' +
      'C 330,272 330,253 340,242 C 346,237 352,233 355,230 Z',

      // Horn of Africa / East Africa nub
      'M 390,310 C 402,308 415,315 422,327 C 430,340 428,358 418,367 ' +
      'C 408,375 394,374 384,365 C 374,356 372,340 378,328 C 382,320 387,313 390,310 Z',

      // North Africa
      'M 88,210 C 108,200 135,195 162,198 C 190,202 215,212 240,218 ' +
      'C 268,225 296,228 324,228 C 352,228 378,225 400,222 ' +
      'C 420,220 438,218 455,222 C 472,226 485,235 490,248 ' +
      'C 492,255 488,262 480,266 C 468,272 450,270 432,265 ' +
      'C 410,258 385,252 358,250 C 330,248 300,250 272,256 ' +
      'C 244,262 218,272 194,278 C 170,283 146,284 125,278 ' +
      'C 105,272 90,260 82,245 C 75,230 78,218 88,210 Z',

      // British Isles (small blob)
      'M 190,62 C 198,55 210,54 218,60 C 226,67 226,78 218,85 ' +
      'C 210,92 198,92 190,85 C 182,78 182,68 190,62 Z',

      // Scandinavia hint
      'M 248,30 C 258,20 272,18 282,25 C 292,32 294,46 285,55 ' +
      'C 276,64 262,64 253,56 C 244,48 240,38 248,30 Z',

      // Japan islands (small)
      'M 725,80 C 732,74 742,74 748,80 C 754,86 753,97 746,102 ' +
      'C 738,107 728,106 722,100 C 716,94 718,86 725,80 Z',

      // Korean peninsula
      'M 700,100 C 706,94 715,94 720,100 C 725,106 724,116 718,120 ' +
      'C 712,124 703,123 698,117 C 694,111 695,105 700,100 Z',
    ];

    var landGroup = document.createElementNS(ns, 'g');
    landPaths.forEach(function (d) {
      var path = document.createElementNS(ns, 'path');
      path.setAttribute('class', 'hm-land');
      path.setAttribute('d', d);
      landGroup.appendChild(path);
    });
    svg.appendChild(landGroup);

    /* ── noise overlay ── */
    var noiseRect = document.createElementNS(ns, 'rect');
    noiseRect.setAttribute('width', '800');
    noiseRect.setAttribute('height', '480');
    noiseRect.setAttribute('fill', '#d9c39a');
    noiseRect.setAttribute('filter', 'url(#hm-paper)');
    noiseRect.setAttribute('opacity', '.08');
    noiseRect.setAttribute('pointer-events', 'none');
    svg.appendChild(noiseRect);

    /* ── route paths (animated) ── */
    var pos = nodeMap();
    var routeEls = [];
    ROUTES.forEach(function (r, i) {
      var from = pos[r[0]], to = pos[r[1]];
      if (!from || !to) return;
      var d = curveD(from.x, from.y, to.x, to.y);
      var len = approxLen(from.x, from.y, to.x, to.y);
      var col = routeColor(r[3]);

      // Shadow/glow pass
      var shadow = document.createElementNS(ns, 'path');
      shadow.setAttribute('class', 'hm-route');
      shadow.setAttribute('d', d);
      shadow.setAttribute('stroke', col);
      shadow.setAttribute('stroke-width', '5');
      shadow.setAttribute('stroke-dasharray', len);
      shadow.setAttribute('stroke-dashoffset', len);
      shadow.setAttribute('opacity', '.22');
      shadow.setAttribute('filter', 'url(#hm-glow)');
      shadow.dataset = shadow.dataset || {};
      shadow.setAttribute('data-len', len);
      shadow.setAttribute('data-idx', i);
      svg.appendChild(shadow);

      // Main line
      var path = document.createElementNS(ns, 'path');
      path.setAttribute('class', 'hm-route');
      path.setAttribute('d', d);
      path.setAttribute('stroke', col);
      path.setAttribute('stroke-dasharray', len);
      path.setAttribute('stroke-dashoffset', len);
      path.setAttribute('data-len', len);
      path.setAttribute('data-idx', i);
      svg.appendChild(path);

      routeEls.push({ main: path, shadow: shadow, len: len, label: r[2] });
    });

    /* ── node markers ── */
    NODES.forEach(function (n) {
      var g = document.createElementNS(ns, 'g');
      g.setAttribute('class', 'hm-node');
      g.setAttribute('transform', 'translate(' + n[2] + ',' + n[3] + ')');

      var ring = document.createElementNS(ns, 'circle');
      ring.setAttribute('class', 'hm-ring');
      ring.setAttribute('r', '7');
      ring.setAttribute('stroke', '#EAC57A');
      ring.setAttribute('fill', 'rgba(234,197,122,.08)');
      // Stagger pulse animation
      var delay = (NODES.indexOf(n) * 0.35) + 's';
      ring.style.animationDelay = delay;

      var dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('class', 'hm-dot');
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', '#C4924A');

      // Label offset logic
      var lx = 10, ly = -9;
      // shift left for western nodes
      if (n[2] < 250) { lx = -11; ly = -9; }
      // shift down for some
      if (n[0] === 'india') { lx = 12; ly = 4; }
      if (n[0] === 'arabia') { lx = 12; ly = 5; }

      var label = document.createElementNS(ns, 'text');
      label.setAttribute('class', 'hm-label');
      label.setAttribute('x', lx);
      label.setAttribute('y', ly);
      label.setAttribute('text-anchor', n[2] < 250 ? 'end' : 'start');
      label.textContent = n[1];

      g.appendChild(ring);
      g.appendChild(dot);
      g.appendChild(label);
      svg.appendChild(g);
    });

    return { svg: svg, routeEls: routeEls };
  }

  /* Animate routes one after another */
  function animateRoutes(routeEls, doneCallback) {
    if (!routeEls.length) { if (doneCallback) doneCallback(); return; }
    var BASE_DURATION = 820; // ms per route
    var GAP = 220;           // pause between routes

    function animOne(i) {
      if (i >= routeEls.length) { if (doneCallback) doneCallback(); return; }
      var r = routeEls[i];
      var len = r.len;
      var duration = BASE_DURATION + len * 0.4;

      // Reset
      r.main.style.transition = 'none';
      r.shadow.style.transition = 'none';
      r.main.setAttribute('stroke-dashoffset', len);
      r.shadow.setAttribute('stroke-dashoffset', len);

      // Force reflow
      void r.main.getBoundingClientRect();

      r.main.style.transition   = 'stroke-dashoffset ' + duration + 'ms cubic-bezier(.4,0,.2,1)';
      r.shadow.style.transition = 'stroke-dashoffset ' + duration + 'ms cubic-bezier(.4,0,.2,1)';
      r.main.setAttribute('stroke-dashoffset', '0');
      r.shadow.setAttribute('stroke-dashoffset', '0');

      setTimeout(function () { animOne(i + 1); }, duration + GAP);
    }

    animOne(0);
  }

  /* Reset all routes to hidden */
  function resetRoutes(routeEls) {
    routeEls.forEach(function (r) {
      r.main.style.transition = 'none';
      r.shadow.style.transition = 'none';
      r.main.setAttribute('stroke-dashoffset', r.len);
      r.shadow.setAttribute('stroke-dashoffset', r.len);
    });
  }

  /* Show final state (no animation) */
  function showFinalState(routeEls) {
    routeEls.forEach(function (r) {
      r.main.style.transition = 'none';
      r.shadow.style.transition = 'none';
      r.main.setAttribute('stroke-dashoffset', '0');
      r.shadow.setAttribute('stroke-dashoffset', '0');
    });
  }

  /* ── HashMap public API ── */
  global.HashMap = {
    render: function (container) {
      try {
        if (!container) return;
        injectCSS();

        var wrap = document.createElement('div');
        wrap.className = 'hm-wrap';

        var title = document.createElement('p');
        title.className = 'hm-title';
        title.textContent = 'Spread of Hashish · Eurasia & North Africa';
        wrap.appendChild(title);

        var svgWrap = document.createElement('div');
        svgWrap.className = 'hm-svg-wrap';

        var built = buildMapSVG();
        var routeEls = built.routeEls;
        svgWrap.appendChild(built.svg);
        wrap.appendChild(svgWrap);

        /* Legend */
        var legend = document.createElement('div');
        legend.className = 'hm-legend';

        var li1 = document.createElement('div');
        li1.className = 'hm-legend-item';
        var line1 = document.createElement('div');
        line1.className = 'hm-legend-line';
        line1.style.background = 'linear-gradient(90deg,#C45F28,#EAC57A)';
        li1.appendChild(line1);
        li1.appendChild(document.createTextNode('Diffusion route'));

        var li2 = document.createElement('div');
        li2.className = 'hm-legend-item';
        var dot2 = document.createElement('div');
        dot2.style.cssText = 'width:8px;height:8px;border-radius:50%;background:#C4924A;flex-shrink:0';
        li2.appendChild(dot2);
        li2.appendChild(document.createTextNode('Key location'));

        var cap = document.createElement('div');
        cap.className = 'hm-caption';
        cap.textContent = 'Routes are evocative, not geographically precise. Dates are approximate.';

        legend.appendChild(li1);
        legend.appendChild(li2);
        legend.appendChild(cap);
        wrap.appendChild(legend);

        /* Replay button */
        var btn = document.createElement('button');
        btn.className = 'hm-replay';
        btn.textContent = '↺ Replay';
        btn.setAttribute('aria-label', 'Replay route animation');
        var animating = false;
        btn.addEventListener('click', function () {
          if (animating) return;
          animating = true;
          btn.disabled = true;
          btn.textContent = '…';
          resetRoutes(routeEls);
          setTimeout(function () {
            animateRoutes(routeEls, function () {
              animating = false;
              btn.disabled = false;
              btn.textContent = '↺ Replay';
            });
          }, 80);
        });
        wrap.appendChild(btn);

        container.appendChild(wrap);

        /* IntersectionObserver — trigger on scroll-in */
        var triggered = false;
        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting && !triggered) {
                triggered = true;
                io.disconnect();
                animating = true;
                btn.disabled = true;
                animateRoutes(routeEls, function () {
                  animating = false;
                  btn.disabled = false;
                });
              }
            });
          }, { threshold: 0.18 });
          io.observe(wrap);
        } else {
          // Fallback: show final state immediately
          showFinalState(routeEls);
        }
      } catch (e) {
        // Never throw
        if (typeof console !== 'undefined') console.warn('[HashMap] render error:', e);
      }
    }
  };

  /* ═══════════════════════════════════════════════════════════════
     Motion — traditional hashish production stages
  ═══════════════════════════════════════════════════════════════ */

  var STAGES = [
    {
      num: '01',
      title: 'Plant & Resin Glands',
      desc: 'Cannabis plants produce trichomes — tiny resin-filled glands — that cluster on the flowers. These glands hold the cannabinoids and terpenes.',
      icon: function (ns) {
        // Cannabis leaf + gland dots
        var g = document.createElementNS(ns, 'g');
        // Stem
        var stem = document.createElementNS(ns, 'line');
        stem.setAttribute('x1','80'); stem.setAttribute('y1','140');
        stem.setAttribute('x2','80'); stem.setAttribute('y2','60');
        stem.setAttribute('stroke','#7B5A24'); stem.setAttribute('stroke-width','3');
        stem.setAttribute('stroke-linecap','round');
        g.appendChild(stem);

        // Stylised leaf blades
        var leafData = [
          'M80,100 C60,80 30,72 20,55 C40,58 62,70 80,100Z',
          'M80,100 C100,80 130,72 140,55 C120,58 98,70 80,100Z',
          'M80,85  C65,68 42,60 34,44 C52,48 70,60 80,85Z',
          'M80,85  C95,68 118,60 126,44 C108,48 90,60 80,85Z',
          'M80,72  C72,58 58,50 52,36 C66,42 76,54 80,72Z',
          'M80,72  C88,58 102,50 108,36 C94,42 84,54 80,72Z',
        ];
        leafData.forEach(function (d) {
          var p = document.createElementNS(ns, 'path');
          p.setAttribute('d', d);
          p.setAttribute('fill', '#7B8F3A');
          p.setAttribute('stroke', '#5A6A28');
          p.setAttribute('stroke-width', '.8');
          g.appendChild(p);
        });

        // Trichome dots (pulsing)
        var glPos = [[68,88],[80,76],[92,88],[72,96],[88,96],[78,105],[82,105]];
        glPos.forEach(function (pos, i) {
          var c = document.createElementNS(ns, 'circle');
          c.setAttribute('cx', pos[0]); c.setAttribute('cy', pos[1]);
          c.setAttribute('r', '2.5');
          c.setAttribute('fill', '#EAC57A');
          c.setAttribute('opacity', '.9');
          c.style.animation = 'hm-pulse ' + (2 + i * 0.2) + 's ease-in-out infinite';
          c.style.transformOrigin = pos[0] + 'px ' + pos[1] + 'px';
          g.appendChild(c);
        });
        return g;
      }
    },
    {
      num: '02',
      title: 'Harvesting & Drying',
      desc: 'Plants are cut and hung upside-down in cool, dry shade. Over weeks, moisture leaves the plant, concentrating the resins.',
      icon: function (ns) {
        var g = document.createElementNS(ns, 'g');
        // Drying rack bar
        var bar = document.createElementNS(ns, 'line');
        bar.setAttribute('x1','30'); bar.setAttribute('y1','45');
        bar.setAttribute('x2','130'); bar.setAttribute('y2','45');
        bar.setAttribute('stroke','#7B5A24'); bar.setAttribute('stroke-width','4');
        bar.setAttribute('stroke-linecap','round');
        g.appendChild(bar);

        // Hanging strings + plants
        var positions = [45, 65, 80, 95, 115];
        positions.forEach(function (x, i) {
          // String
          var s = document.createElementNS(ns, 'line');
          s.setAttribute('x1', x); s.setAttribute('y1', '45');
          s.setAttribute('x2', x); s.setAttribute('y2', '70');
          s.setAttribute('stroke', 'rgba(196,146,74,.5)'); s.setAttribute('stroke-width', '1.2');
          g.appendChild(s);
          // Inverted mini plant
          var plant = document.createElementNS(ns, 'path');
          plant.setAttribute('d',
            'M' + x + ',70 C' + (x-10) + ',80 ' + (x-8) + ',95 ' + x + ',105' +
            ' C' + (x+8) + ',95 ' + (x+10) + ',80 ' + x + ',70Z'
          );
          plant.setAttribute('fill', '#6A7A30');
          plant.setAttribute('opacity', String(0.6 + i * 0.08));
          g.appendChild(plant);
        });

        // Sun/heat rays top-right
        var sun = document.createElementNS(ns, 'circle');
        sun.setAttribute('cx', '140'); sun.setAttribute('cy', '28');
        sun.setAttribute('r', '8');
        sun.setAttribute('fill', '#EAC57A');
        sun.setAttribute('opacity', '.75');
        g.appendChild(sun);
        [[140,8],[155,28],[140,48],[125,28]].forEach(function (p) {
          var ray = document.createElementNS(ns, 'line');
          ray.setAttribute('x1', 140); ray.setAttribute('y1', 28);
          ray.setAttribute('x2', p[0]); ray.setAttribute('y2', p[1]);
          ray.setAttribute('stroke', '#EAC57A');
          ray.setAttribute('stroke-width', '1.5');
          ray.setAttribute('opacity', '.5');
          g.appendChild(ray);
        });

        return g;
      }
    },
    {
      num: '03',
      title: 'Sieving & Hand-rubbing',
      desc: 'Dried flowers are sieved through fine mesh screens to collect kief (loose resin), or rubbed by hand to collect charas — both isolate the potent resin glands.',
      icon: function (ns) {
        var g = document.createElementNS(ns, 'g');

        // Sieve frame
        var frame = document.createElementNS(ns, 'rect');
        frame.setAttribute('x', '25'); frame.setAttribute('y', '40');
        frame.setAttribute('width', '110'); frame.setAttribute('height', '60');
        frame.setAttribute('rx', '5');
        frame.setAttribute('fill', 'none');
        frame.setAttribute('stroke', '#7B5A24');
        frame.setAttribute('stroke-width', '3');
        g.appendChild(frame);

        // Mesh grid lines
        for (var xi = 35; xi < 130; xi += 10) {
          var vl = document.createElementNS(ns, 'line');
          vl.setAttribute('x1', xi); vl.setAttribute('y1', '40');
          vl.setAttribute('x2', xi); vl.setAttribute('y2', '100');
          vl.setAttribute('stroke', 'rgba(196,146,74,.35)');
          vl.setAttribute('stroke-width', '0.8');
          g.appendChild(vl);
        }
        for (var yi = 50; yi < 100; yi += 10) {
          var hl = document.createElementNS(ns, 'line');
          hl.setAttribute('x1', '25'); hl.setAttribute('y1', yi);
          hl.setAttribute('x2', '135'); hl.setAttribute('y2', yi);
          hl.setAttribute('stroke', 'rgba(196,146,74,.35)');
          hl.setAttribute('stroke-width', '0.8');
          g.appendChild(hl);
        }

        // Falling kief dots
        var kDots = [[55,112],[70,118],[85,115],[100,120],[65,125],[90,128]];
        kDots.forEach(function (p, i) {
          var kd = document.createElementNS(ns, 'circle');
          kd.setAttribute('cx', p[0]); kd.setAttribute('cy', p[1]);
          kd.setAttribute('r', '2');
          kd.setAttribute('fill', '#EAC57A');
          kd.setAttribute('opacity', String(0.5 + i * 0.08));
          g.appendChild(kd);
        });

        // Hand outline (right)
        var hand = document.createElementNS(ns, 'path');
        hand.setAttribute('d',
          'M128,55 C132,50 138,48 142,52 C146,56 144,64 140,68 ' +
          'C137,72 133,74 130,78 C127,82 126,88 128,95 ' +
          'C125,95 120,90 118,84 C116,78 118,70 122,64 C124,60 126,57 128,55Z'
        );
        hand.setAttribute('fill', '#C4924A');
        hand.setAttribute('opacity', '.6');
        g.appendChild(hand);

        return g;
      }
    },
    {
      num: '04',
      title: 'Pressing into a Block',
      desc: 'Collected resin powder is warmed and pressed — by hand, in a cloth, or under a weight — into the dense, fragrant blocks of hashish traded along the ancient routes.',
      icon: function (ns) {
        var g = document.createElementNS(ns, 'g');

        // Block shadow
        var shadow = document.createElementNS(ns, 'ellipse');
        shadow.setAttribute('cx', '80'); shadow.setAttribute('cy', '125');
        shadow.setAttribute('rx', '35'); shadow.setAttribute('ry', '7');
        shadow.setAttribute('fill', 'rgba(0,0,0,.4)');
        g.appendChild(shadow);

        // Hash block (3-D isometric rect)
        // Top face
        var top = document.createElementNS(ns, 'polygon');
        top.setAttribute('points', '80,60 120,75 120,95 80,80');
        top.setAttribute('fill', '#9A6D2A');
        g.appendChild(top);
        var top2 = document.createElementNS(ns, 'polygon');
        top2.setAttribute('points', '80,60 40,75 40,95 80,80');
        top2.setAttribute('fill', '#C4924A');
        g.appendChild(top2);
        var topFace = document.createElementNS(ns, 'polygon');
        topFace.setAttribute('points', '80,60 120,75 80,90 40,75');
        topFace.setAttribute('fill', '#EAC57A');
        topFace.setAttribute('opacity', '.85');
        g.appendChild(topFace);

        // Front right face
        var right = document.createElementNS(ns, 'polygon');
        right.setAttribute('points', '120,75 120,115 80,130 80,90');
        right.setAttribute('fill', '#7B5A24');
        g.appendChild(right);

        // Front left face
        var left = document.createElementNS(ns, 'polygon');
        left.setAttribute('points', '40,75 40,115 80,130 80,90');
        left.setAttribute('fill', '#9A6D2A');
        g.appendChild(left);

        // Surface grain lines on top face
        var grains = [
          'M82,68 L78,70', 'M90,72 L86,74', 'M98,76 L94,78',
          'M72,74 L68,76', 'M64,78 L60,80'
        ];
        grains.forEach(function (d) {
          var gr = document.createElementNS(ns, 'path');
          gr.setAttribute('d', d);
          gr.setAttribute('stroke', 'rgba(60,35,5,.5)');
          gr.setAttribute('stroke-width', '1');
          gr.setAttribute('fill', 'none');
          g.appendChild(gr);
        });

        // "Pressed" arrows above block
        var arr1 = document.createElementNS(ns, 'text');
        arr1.setAttribute('x', '74'); arr1.setAttribute('y', '48');
        arr1.setAttribute('fill', '#EAC57A');
        arr1.setAttribute('font-size', '16');
        arr1.setAttribute('text-anchor', 'middle');
        arr1.setAttribute('opacity', '.7');
        arr1.textContent = '↓';
        g.appendChild(arr1);
        var arr2 = document.createElementNS(ns, 'text');
        arr2.setAttribute('x', '86'); arr2.setAttribute('y', '48');
        arr2.setAttribute('fill', '#EAC57A');
        arr2.setAttribute('font-size', '16');
        arr2.setAttribute('text-anchor', 'middle');
        arr2.setAttribute('opacity', '.7');
        arr2.textContent = '↓';
        g.appendChild(arr2);

        return g;
      }
    }
  ];

  function buildStageEl(stage, ns) {
    var div = document.createElement('div');
    div.className = 'mo-stage';

    var numEl = document.createElement('div');
    numEl.className = 'mo-stage-num';
    numEl.textContent = 'Stage ' + stage.num;
    div.appendChild(numEl);

    // SVG icon
    var svg = document.createElementNS(ns, 'svg');
    svg.setAttribute('viewBox', '0 0 160 160');
    svg.setAttribute('xmlns', ns);
    svg.setAttribute('aria-hidden', 'true');
    var iconG = stage.icon(ns);
    svg.appendChild(iconG);
    div.appendChild(svg);

    var titleEl = document.createElement('div');
    titleEl.className = 'mo-stage-title';
    titleEl.textContent = stage.title;
    div.appendChild(titleEl);

    var desc = document.createElement('p');
    desc.className = 'mo-stage-desc';
    desc.textContent = stage.desc;
    div.appendChild(desc);

    return div;
  }

  global.Motion = {
    production: function (container) {
      try {
        if (!container) return;
        injectCSS();

        var ns = 'http://www.w3.org/2000/svg';
        var wrap = document.createElement('div');
        wrap.className = 'mo-wrap';

        var title = document.createElement('p');
        title.className = 'mo-title';
        title.textContent = 'Traditional Hashish Production';
        wrap.appendChild(title);

        /* Stage track */
        var track = document.createElement('div');
        track.className = 'mo-stage-track';

        var stageEls = STAGES.map(function (s) {
          return buildStageEl(s, ns);
        });

        stageEls.forEach(function (el) { track.appendChild(el); });
        wrap.appendChild(track);

        /* Controls */
        var controls = document.createElement('div');
        controls.className = 'mo-controls';

        var dotsWrap = document.createElement('div');
        dotsWrap.className = 'mo-dots';
        var dotEls = STAGES.map(function (_, i) {
          var d = document.createElement('div');
          d.className = 'mo-dot' + (i === 0 ? ' mo-on' : '');
          return d;
        });
        dotEls.forEach(function (d) { dotsWrap.appendChild(d); });
        controls.appendChild(dotsWrap);

        var nextBtn = document.createElement('button');
        nextBtn.className = 'mo-btn';
        nextBtn.textContent = 'Next →';
        nextBtn.setAttribute('aria-label', 'Next production stage');
        controls.appendChild(nextBtn);

        wrap.appendChild(controls);
        container.appendChild(wrap);

        /* State */
        var current = 0;
        var autoTimer = null;
        var AUTO_DELAY = 4500;

        function goTo(idx) {
          try {
            var prev = current;
            current = ((idx % STAGES.length) + STAGES.length) % STAGES.length;

            // Animate out old
            var oldEl = stageEls[prev];
            oldEl.classList.remove('mo-active');
            oldEl.classList.add('mo-exit');
            setTimeout(function () {
              oldEl.classList.remove('mo-exit');
            }, 420);

            // Animate in new
            var newEl = stageEls[current];
            newEl.classList.add('mo-active');

            // Update dots
            dotEls.forEach(function (d, i) {
              d.classList.toggle('mo-on', i === current);
            });

            // Update button
            if (current === STAGES.length - 1) {
              nextBtn.textContent = '↺ Restart';
            } else {
              nextBtn.textContent = 'Next →';
            }

            // Track height: set to active child height so wrapping works
            track.style.height = newEl.offsetHeight + 'px';
          } catch (e) {
            if (typeof console !== 'undefined') console.warn('[Motion] goTo error:', e);
          }
        }

        function scheduleAuto() {
          clearTimeout(autoTimer);
          autoTimer = setTimeout(function () {
            goTo(current + 1);
            scheduleAuto();
          }, AUTO_DELAY);
        }

        // Init first stage
        stageEls[0].classList.add('mo-active');
        setTimeout(function () {
          track.style.height = stageEls[0].offsetHeight + 'px';
        }, 50);

        nextBtn.addEventListener('click', function () {
          clearTimeout(autoTimer);
          var next = (current === STAGES.length - 1) ? 0 : current + 1;
          goTo(next);
          scheduleAuto();
        });

        // Dot click navigation
        dotEls.forEach(function (d, i) {
          d.style.cursor = 'pointer';
          d.addEventListener('click', function () {
            clearTimeout(autoTimer);
            goTo(i);
            scheduleAuto();
          });
        });

        // Auto-advance on scroll-in
        if ('IntersectionObserver' in window) {
          var io = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry) {
              if (entry.isIntersecting) {
                io.disconnect();
                scheduleAuto();
              }
            });
          }, { threshold: 0.3 });
          io.observe(wrap);
        } else {
          // Fallback: start auto immediately
          scheduleAuto();
        }

        // Handle resize → update track height
        var resizeTimer;
        window.addEventListener('resize', function () {
          clearTimeout(resizeTimer);
          resizeTimer = setTimeout(function () {
            var active = stageEls[current];
            if (active) track.style.height = active.offsetHeight + 'px';
          }, 150);
        });

      } catch (e) {
        if (typeof console !== 'undefined') console.warn('[Motion] production error:', e);
      }
    }
  };

}(typeof window !== 'undefined' ? window : this));
