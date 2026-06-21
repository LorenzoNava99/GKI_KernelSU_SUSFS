/**
 * charts.js — dependency-free SVG charting module
 * window.Charts.render(container, spec)
 * Supports type: "line" | "bar" | "donut"
 */
(function (global) {
  'use strict';

  /* ── Theme tokens (fall back to hex if CSS vars are absent) ─────────── */
  function tok(name, fallback) {
    if (typeof getComputedStyle !== 'undefined') {
      var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
      if (v) return v;
    }
    return fallback;
  }

  function theme() {
    return {
      gold:    tok('--gold',     '#C4924A'),
      goldHi:  tok('--gold-hi',  '#EAC57A'),
      goldLo:  tok('--gold-lo',  '#7B5A24'),
      ember:   tok('--ember',    '#C45F28'),
      ink:     tok('--ink2',     '#DDD0B4'),
      muted:   tok('--muted',    '#9E8E75'),
      grid:    'rgba(196,146,74,.15)',
      bg:      tok('--panel',    '#18110A'),
    };
  }

  /* ── CSS injected once ──────────────────────────────────────────────── */
  var CSS_INJECTED = false;
  var CSS_ID = 'charts-module-css';

  function injectCSS() {
    if (CSS_INJECTED || document.getElementById(CSS_ID)) { CSS_INJECTED = true; return; }
    var s = document.createElement('style');
    s.id = CSS_ID;
    s.textContent = [
      /* chart-wrap: host element */
      '.ch-wrap{position:relative;width:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,system-ui,sans-serif}',
      /* SVG base */
      '.ch-wrap svg{display:block;width:100%;height:auto;overflow:visible}',
      /* line animation: draw stroke */
      '.ch-line-path{stroke-dasharray:var(--ch-len,2000);stroke-dashoffset:var(--ch-len,2000);transition:stroke-dashoffset 1.1s cubic-bezier(.4,0,.2,1)}',
      '.ch-line-path.ch-anim{stroke-dashoffset:0}',
      /* area fade */
      '.ch-area{opacity:0;transition:opacity .9s .3s ease}',
      '.ch-area.ch-anim{opacity:1}',
      /* dots pop */
      '.ch-dot{r:3.5;transform-origin:center;transform:scale(0);transition:transform .25s ease}',
      '.ch-dot.ch-anim{transform:scale(1)}',
      /* bar grow */
      '.ch-bar{transform-origin:bottom;transform:scaleY(0);transition:transform .7s cubic-bezier(.4,0,.2,1)}',
      '.ch-bar.ch-anim{transform:scaleY(1)}',
      /* bar value labels */
      '.ch-bar-lbl{opacity:0;transition:opacity .4s .5s ease}',
      '.ch-bar-lbl.ch-anim{opacity:1}',
      /* donut segments */
      '.ch-seg{stroke-dashoffset:var(--ch-seg-start,0);transition:stroke-dashoffset .9s cubic-bezier(.4,0,.2,1)}',
      /* legend */
      '.ch-legend{display:flex;flex-wrap:wrap;gap:6px 12px;padding:6px 0 0 0;list-style:none;margin:4px 0 0 0}',
      '.ch-legend li{display:flex;align-items:center;gap:5px;font-size:11px}',
      '.ch-legend .ch-swatch{width:10px;height:10px;border-radius:2px;flex-shrink:0}',
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
    CSS_INJECTED = true;
  }

  /* ── Maths helpers ───────────────────────────────────────────────────── */
  function niceRange(min, max) {
    var span = max - min || 1;
    var rough = span / 4;
    var mag = Math.pow(10, Math.floor(Math.log10(rough)));
    var nice = [1,2,2.5,5,10].reduce(function(p,c){ return Math.abs(c*mag-rough)<Math.abs(p-rough)?c*mag:p; }, rough);
    var lo = Math.floor(min / nice) * nice;
    var hi = Math.ceil(max / nice) * nice;
    return { lo: lo < 0 ? lo : Math.max(0, lo), hi: hi, step: nice };
  }

  function fmtVal(v) {
    if (Math.abs(v) >= 1000) return (v/1000).toFixed(v%1000===0?0:1) + 'k';
    if (v % 1 === 0) return String(v);
    return v.toFixed(1);
  }

  /* ── SVG builder helpers ─────────────────────────────────────────────── */
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, extra) {
    var e = document.createElementNS(NS, tag);
    if (attrs) Object.keys(attrs).forEach(function(k){ e.setAttribute(k, attrs[k]); });
    if (extra && extra.text) e.textContent = extra.text;
    return e;
  }

  function defsGradients(svg, id, t) {
    var defs = el('defs');
    // vertical area gradient
    var ag = el('linearGradient', { id: id+'-ag', x1:'0', y1:'0', x2:'0', y2:'1' });
    var s1 = el('stop', { offset:'0%',   'stop-color': t.goldHi, 'stop-opacity':'0.30' });
    var s2 = el('stop', { offset:'100%', 'stop-color': t.goldLo, 'stop-opacity':'0.03' });
    ag.appendChild(s1); ag.appendChild(s2);
    // stroke gradient
    var sg = el('linearGradient', { id: id+'-sg', x1:'0', y1:'0', x2:'1', y2:'0' });
    var ss1 = el('stop', { offset:'0%',   'stop-color': t.gold });
    var ss2 = el('stop', { offset:'100%', 'stop-color': t.goldHi });
    sg.appendChild(ss1); sg.appendChild(ss2);
    defs.appendChild(ag); defs.appendChild(sg);
    svg.appendChild(defs);
  }

  function uniqueId() {
    return 'ch' + Math.random().toString(36).slice(2,8);
  }

  /* ── Label abbreviation for long bar x-labels ──────────────────────── */
  function abbrev(s, max) {
    max = max || 14;
    if (s.length <= max) return s;
    // try to trim parenthetical
    var p = s.replace(/\s*\(.*?\)/g, '').trim();
    if (p.length <= max) return p;
    return p.slice(0, max-1) + '…';
  }

  /* ── IntersectionObserver wrapper ───────────────────────────────────── */
  function onVisible(el, cb) {
    if (typeof IntersectionObserver === 'undefined') { cb(); return; }
    var io = new IntersectionObserver(function(entries) {
      entries.forEach(function(e){ if (e.isIntersecting){ cb(); io.disconnect(); } });
    }, { threshold: 0.15 });
    io.observe(el);
  }

  /* ── COLOR PALETTE for donut/bar ────────────────────────────────────── */
  function palette(t) {
    return [t.goldHi, t.gold, t.ember, t.goldLo, '#B788C4', '#6EB3A3', '#C9A24B', '#E07A40'];
  }

  /* ════════════════════════════════════════════════════════════════════
     LINE CHART
  ════════════════════════════════════════════════════════════════════ */
  function renderLine(container, spec, t) {
    var data = (spec.data || []).filter(function(d){ return d.y != null; });
    if (data.length < 2) { container.textContent = 'Insufficient data.'; return; }

    var id = uniqueId();
    var W = 410, H = 210;
    var padL = 46, padR = 14, padT = 18, padB = 46;
    var cW = W - padL - padR;
    var cH = H - padT - padB;

    var ys = data.map(function(d){ return d.y; });
    var rng = niceRange(Math.min.apply(null,ys), Math.max.apply(null,ys));

    var xStep = cW / (data.length - 1);
    function px(i){ return padL + i * xStep; }
    function py(v){ return padT + cH - ((v - rng.lo) / (rng.hi - rng.lo)) * cH; }

    var svg = el('svg', {
      viewBox: '0 0 '+W+' '+H,
      'aria-label': spec.title,
      role: 'img',
      style: 'shape-rendering:geometricPrecision'
    });
    var titleEl = el('title', {}, { text: spec.title + (spec.unit ? ' ('+spec.unit+')' : '') });
    svg.appendChild(titleEl);

    defsGradients(svg, id, t);

    // grid lines + y labels
    var steps = 4;
    for (var s = 0; s <= steps; s++) {
      var gv = rng.lo + (rng.hi - rng.lo) * s / steps;
      var gy = py(gv);
      svg.appendChild(el('line', {
        x1: padL, y1: gy, x2: padL + cW, y2: gy,
        stroke: t.grid, 'stroke-width': '1'
      }));
      var lbl = fmtVal(Math.round(gv * 10) / 10);
      var ytxt = el('text', {
        x: padL - 5, y: gy + 4,
        'text-anchor': 'end',
        fill: t.muted,
        'font-size': '9',
        'font-family': 'inherit'
      }, { text: lbl });
      svg.appendChild(ytxt);
    }

    // unit label on y axis
    if (spec.unit) {
      var uLbl = el('text', {
        x: 8, y: padT + cH / 2,
        'text-anchor': 'middle',
        fill: t.muted,
        'font-size': '8.5',
        transform: 'rotate(-90,8,'+(padT+cH/2)+')'
      }, { text: spec.unit });
      svg.appendChild(uLbl);
    }

    // x labels — skip to avoid overlap (min 28px between labels)
    var minGap = 28;
    var skip = Math.ceil(minGap / xStep);
    if (skip < 1) skip = 1;
    data.forEach(function(d, i){
      if (i % skip !== 0 && i !== data.length - 1) return;
      var xt = el('text', {
        x: px(i), y: H - padB + 14,
        'text-anchor': 'middle',
        fill: t.muted,
        'font-size': '9',
        transform: 'rotate(-40,'+px(i)+','+(H-padB+14)+')'
      }, { text: String(d.x) });
      svg.appendChild(xt);
    });

    // area path
    var areaD = 'M'+px(0)+','+py(data[0].y);
    data.forEach(function(d,i){ if(i>0) areaD += ' L'+px(i)+','+py(d.y); });
    areaD += ' L'+px(data.length-1)+','+(padT+cH)+' L'+px(0)+','+(padT+cH)+' Z';
    var area = el('path', {
      d: areaD,
      fill: 'url(#'+id+'-ag)',
      stroke: 'none',
      class: 'ch-area'
    });
    svg.appendChild(area);

    // line path
    var lineD = 'M'+px(0)+','+py(data[0].y);
    data.forEach(function(d,i){ if(i>0) lineD += ' L'+px(i)+','+py(d.y); });
    var linePath = el('path', {
      d: lineD,
      fill: 'none',
      stroke: 'url(#'+id+'-sg)',
      'stroke-width': '2.2',
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
      class: 'ch-line-path'
    });
    svg.appendChild(linePath);

    // dots
    var dots = data.map(function(d, i){
      var dot = el('circle', {
        cx: px(i), cy: py(d.y),
        r: '3.5',
        fill: t.goldHi,
        stroke: t.bg,
        'stroke-width': '1.5',
        class: 'ch-dot'
      });
      // stagger transition via style
      dot.style.transitionDelay = (0.6 + i * 0.06) + 's';
      svg.appendChild(dot);
      return dot;
    });

    container.appendChild(svg);

    // measure path length after DOM insertion
    onVisible(container, function(){
      var len = linePath.getTotalLength ? linePath.getTotalLength() : 2000;
      linePath.style.setProperty('--ch-len', len);
      // force reflow
      void linePath.getBoundingClientRect();
      linePath.classList.add('ch-anim');
      area.classList.add('ch-anim');
      dots.forEach(function(d){ d.classList.add('ch-anim'); });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     BAR CHART
  ════════════════════════════════════════════════════════════════════ */
  function renderBar(container, spec, t) {
    var data = (spec.data || []).filter(function(d){ return d.y != null; });
    if (data.length < 1) { container.textContent = 'Insufficient data.'; return; }

    var id = uniqueId();
    var W = 410, H = 210;
    var padL = 50, padR = 14, padT = 22, padB = 50;
    var cW = W - padL - padR;
    var cH = H - padT - padB;
    var n = data.length;

    var ys = data.map(function(d){ return d.y; });
    var rng = niceRange(0, Math.max.apply(null, ys));
    function py(v){ return padT + cH - (v / rng.hi) * cH; }
    function bH(v){ return (v / rng.hi) * cH; }

    var barW = Math.min(44, (cW / n) * 0.62);
    var slotW = cW / n;
    function bx(i){ return padL + i * slotW + (slotW - barW) / 2; }

    var pal = palette(t);

    var svg = el('svg', {
      viewBox: '0 0 '+W+' '+H,
      'aria-label': spec.title,
      role: 'img',
      style: 'shape-rendering:geometricPrecision'
    });
    svg.appendChild(el('title', {}, { text: spec.title + (spec.unit ? ' ('+spec.unit+')' : '') }));

    // grid + y labels
    var steps = 4;
    for (var s = 0; s <= steps; s++) {
      var gv = rng.hi * s / steps;
      var gy = py(gv);
      svg.appendChild(el('line', {
        x1: padL, y1: gy, x2: padL + cW, y2: gy,
        stroke: t.grid, 'stroke-width': '1'
      }));
      var ytxt = el('text', {
        x: padL - 5, y: gy + 4,
        'text-anchor': 'end',
        fill: t.muted,
        'font-size': '9'
      }, { text: fmtVal(gv) });
      svg.appendChild(ytxt);
    }

    // unit on y
    if (spec.unit) {
      svg.appendChild(el('text', {
        x: 9, y: padT + cH / 2,
        'text-anchor': 'middle',
        fill: t.muted,
        'font-size': '8',
        transform: 'rotate(-90,9,'+(padT+cH/2)+')'
      }, { text: spec.unit }));
    }

    var bars = [], lblEls = [];

    data.forEach(function(d, i){
      var color = pal[i % pal.length];
      var bx_ = bx(i);
      var bH_ = Math.max(bH(d.y), 2);
      var by_ = py(d.y);
      var r = Math.min(4, barW / 2);

      // rounded-top bar via path
      var bPath = [
        'M', bx_, by_ + r,
        'Q', bx_, by_, bx_ + r, by_,
        'L', bx_ + barW - r, by_,
        'Q', bx_ + barW, by_, bx_ + barW, by_ + r,
        'L', bx_ + barW, by_ + bH_,
        'L', bx_, by_ + bH_,
        'Z'
      ].join(' ');

      var barEl = el('path', {
        d: bPath,
        fill: color,
        opacity: '0.90',
        class: 'ch-bar',
        style: 'transform-box:fill-box;transform-origin:50% 100%'
      });
      barEl.style.transitionDelay = (i * 0.08) + 's';
      svg.appendChild(barEl);
      bars.push(barEl);

      // value label above bar
      var valLbl = el('text', {
        x: bx_ + barW / 2,
        y: by_ - 4,
        'text-anchor': 'middle',
        fill: t.ink,
        'font-size': '9',
        'font-weight': '600',
        class: 'ch-bar-lbl'
      }, { text: fmtVal(d.y) });
      valLbl.style.transitionDelay = (i * 0.08 + 0.35) + 's';
      svg.appendChild(valLbl);
      lblEls.push(valLbl);

      // x label — abbreviated, centered under bar
      var xLabel = abbrev(String(d.x), 12);
      // break into two lines if still longish
      var words = xLabel.split(' ');
      var line1 = words.slice(0, Math.ceil(words.length/2)).join(' ');
      var line2 = words.slice(Math.ceil(words.length/2)).join(' ');
      var baseY = padT + cH + 12;
      var xtxt = el('text', {
        x: bx_ + barW / 2,
        y: baseY,
        'text-anchor': 'middle',
        fill: t.muted,
        'font-size': '8.5'
      });
      var tspan1 = el('tspan', { x: bx_ + barW / 2, dy: '0' }, { text: line1 });
      xtxt.appendChild(tspan1);
      if (line2) {
        var tspan2 = el('tspan', { x: bx_ + barW / 2, dy: '10' }, { text: line2 });
        xtxt.appendChild(tspan2);
      }
      svg.appendChild(xtxt);
    });

    container.appendChild(svg);

    onVisible(container, function(){
      bars.forEach(function(b){ b.classList.add('ch-anim'); });
      lblEls.forEach(function(l){ l.classList.add('ch-anim'); });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     DONUT CHART
  ════════════════════════════════════════════════════════════════════ */
  function renderDonut(container, spec, t) {
    var data = (spec.data || []).filter(function(d){ return d.y != null && d.y > 0; });
    if (data.length < 1) { container.textContent = 'Insufficient data.'; return; }

    var total = data.reduce(function(s,d){ return s + d.y; }, 0);
    var pal = palette(t);

    // Layout: SVG left, legend right, stacked in a flex div
    var R = 72, cx = 90, cy = 90, thick = 22;
    var W = 180, H = 180;

    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex;align-items:center;gap:12px;width:100%';

    var svg = el('svg', {
      viewBox: '0 0 '+W+' '+H,
      width: '180',
      height: '180',
      'aria-label': spec.title,
      role: 'img',
      style: 'flex-shrink:0;shape-rendering:geometricPrecision'
    });
    svg.appendChild(el('title', {}, { text: spec.title }));

    // background ring
    svg.appendChild(el('circle', {
      cx: cx, cy: cy, r: R,
      fill: 'none',
      stroke: 'rgba(196,146,74,.10)',
      'stroke-width': thick
    }));

    var circumference = 2 * Math.PI * R;
    var segments = [];
    var offset = 0; // starts at top (rotated later via transform)

    data.forEach(function(d, i){
      var fraction = d.y / total;
      var dashLen = fraction * circumference;
      var dashGap = circumference - dashLen;
      var seg = el('circle', {
        cx: cx, cy: cy, r: R,
        fill: 'none',
        stroke: pal[i % pal.length],
        'stroke-width': thick,
        'stroke-dasharray': dashLen + ' ' + dashGap,
        'stroke-dashoffset': 0,
        transform: 'rotate('+(offset * 360 - 90)+' '+cx+' '+cy+')',
        class: 'ch-seg',
        'stroke-linecap': 'butt'
      });
      // animation: start fully hidden (dashoffset = circumference), animate to 0
      // We animate stroke-dashoffset from circumference to 0 but that would reveal whole
      // Instead animate opacity for simplicity and reliability
      seg.style.opacity = '0';
      seg.style.transition = 'opacity .6s ease '+(0.1 + i * 0.15)+'s';
      svg.appendChild(seg);
      segments.push(seg);
      offset += fraction;
    });

    // center label: total
    svg.appendChild(el('text', {
      x: cx, y: cy - 5,
      'text-anchor': 'middle',
      'dominant-baseline': 'middle',
      fill: t.goldHi,
      'font-size': '15',
      'font-weight': '700'
    }, { text: fmtVal(total) }));
    svg.appendChild(el('text', {
      x: cx, y: cy + 12,
      'text-anchor': 'middle',
      fill: t.muted,
      'font-size': '9'
    }, { text: spec.unit || 'total' }));

    wrapper.appendChild(svg);

    // Legend
    var legend = document.createElement('ul');
    legend.className = 'ch-legend';
    legend.style.cssText = 'flex:1;min-width:0';
    data.forEach(function(d, i){
      var li = document.createElement('li');
      li.style.cssText = 'color:'+tok('--ink2','#DDD0B4')+';font-size:11px;display:flex;align-items:center;gap:5px';
      var sw = document.createElement('span');
      sw.className = 'ch-swatch';
      sw.style.cssText = 'width:10px;height:10px;border-radius:2px;flex-shrink:0;background:'+pal[i % pal.length];
      var pct = Math.round(d.y / total * 100);
      var txt = document.createTextNode(d.x + ' — ' + pct + '%');
      li.appendChild(sw);
      li.appendChild(txt);
      legend.appendChild(li);
    });
    wrapper.appendChild(legend);
    container.appendChild(wrapper);

    onVisible(container, function(){
      segments.forEach(function(s){ s.style.opacity = '1'; });
    });
  }

  /* ════════════════════════════════════════════════════════════════════
     PUBLIC API
  ════════════════════════════════════════════════════════════════════ */
  var Charts = {
    /**
     * render(container, spec)
     *   container : HTMLElement — cleared and filled with the chart
     *   spec      : { id, title, unit, type, source, caveat, data:[{x,y}] }
     */
    render: function (container, spec) {
      if (!container || !spec) return;
      injectCSS();

      // Clear and set up wrapper
      container.innerHTML = '';
      var wrap = document.createElement('div');
      wrap.className = 'ch-wrap';
      wrap.setAttribute('aria-label', spec.title || '');
      container.appendChild(wrap);

      var t = theme();

      if (!spec.data || spec.data.length === 0) {
        wrap.textContent = 'No data available.';
        return;
      }

      switch (spec.type) {
        case 'line':  renderLine(wrap, spec, t);  break;
        case 'bar':   renderBar(wrap, spec, t);   break;
        case 'donut': renderDonut(wrap, spec, t); break;
        default:
          wrap.textContent = 'Unknown chart type: ' + spec.type;
      }
    }
  };

  global.Charts = Charts;

}(typeof window !== 'undefined' ? window : this));
