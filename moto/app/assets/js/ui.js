/* MOTO.UI — premium arcade DOM overlay. Pure DOM + CSS, no imports/assets.
 * Defensive: must merely LOAD without throwing under a minimal document mock,
 * so every DOM lookup is null-guarded and we never assume real DOM behaviour. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  var root = null;
  var cb = {};
  var screens = {};
  var els = {};
  var current = "loading";
  var settings = { renderScale: "balanced", controlMode: "tilt", muted: false, shadows: true,
    sensitivity: 1.0, aiTraffic: true, dev: false };
  var toastTimer = null;

  // ---- tiny DOM helpers (all guarded) --------------------------------------
  function el(tag, cls, txt) {
    var e;
    try { e = document.createElement(tag); } catch (err) { return null; }
    if (!e) return null;
    if (cls) e.className = cls;
    if (txt != null) { try { e.textContent = txt; } catch (err) {} }
    return e;
  }
  function add(parent, child) {
    if (parent && child && parent.appendChild) { try { parent.appendChild(child); } catch (err) {} }
    return child;
  }
  function click(node, fn) {
    if (node && node.addEventListener) {
      node.addEventListener("click", function (ev) {
        if (ev && ev.preventDefault) { try { ev.preventDefault(); } catch (e) {} }
        try { if (MOTO.Audio && MOTO.Audio.click) MOTO.Audio.click(); } catch (e) {}
        try { fn(); } catch (e) {}
      });
    }
    return node;
  }
  function setText(node, txt) { if (node) { try { node.textContent = txt; } catch (e) {} } }
  function addCls(node, c) { if (node && node.classList) { try { node.classList.add(c); } catch (e) {} } }
  function rmCls(node, c) { if (node && node.classList) { try { node.classList.remove(c); } catch (e) {} } }

  function button(label, cls, fn) {
    var b = el("button", "btn " + (cls || ""));
    if (b) {
      var span = el("span", "btn-label", label);
      add(b, span);
    }
    return click(b, fn);
  }

  // ---- build ----------------------------------------------------------------
  function init(callbacks) {
    cb = callbacks || {};
    root = null;
    try { root = document.getElementById("overlay"); } catch (e) {}
    if (!root) return; // mock / missing overlay: stay loadable, do nothing more
    try { root.innerHTML = ""; } catch (e) {}
    screens = {};
    els = {};

    buildLoading();
    buildMenu();
    buildGarage();
    buildHud();
    buildPaused();
    buildGameOver();

    els.toast = add(root, el("div", "toast"));

    show("menu");
  }

  function buildLoading() {
    var s = el("div", "screen scr-loading");
    var wrap = add(s, el("div", "load-wrap"));
    var logo = add(wrap, el("div", "logo logo-load"));
    add(logo, el("div", "logo-speed", "SPEED"));
    add(logo, el("div", "logo-moto", "MOTO"));
    var bar = add(wrap, el("div", "load-bar"));
    add(bar, el("div", "load-fill"));
    add(wrap, el("div", "load-tip", "Revving up the engine…"));
    screens.loading = add(root, s);
  }

  function buildMenu() {
    var s = el("div", "screen scr-menu");

    var logo = add(s, el("div", "logo logo-big"));
    add(logo, el("div", "logo-speed", "SPEED"));
    add(logo, el("div", "logo-moto", "MOTO"));
    add(s, el("div", "tagline", "ENDLESS HIGHWAY • DODGE • SURVIVE"));

    // best + coin stat strip
    var strip = add(s, el("div", "stat-strip"));
    var bestBox = add(strip, el("div", "stat-box"));
    add(bestBox, el("div", "stat-icon", "★"));
    var bestVal = add(bestBox, el("div", "stat-num", "0 m"));
    add(bestBox, el("div", "stat-cap", "BEST"));
    els.menuBest = bestVal;

    var coinBox = add(strip, el("div", "stat-box"));
    add(coinBox, el("div", "stat-icon coin-ic", "◉"));
    var coinVal = add(coinBox, el("div", "stat-num", "0"));
    add(coinBox, el("div", "stat-cap", "COINS"));
    els.menuCoins = coinVal;

    // actions
    var acts = add(s, el("div", "menu-actions"));
    add(acts, button("PLAY", "primary big", function () { if (cb.onStart) cb.onStart(); }));
    var row = add(acts, el("div", "btn-row"));
    add(row, button("🏍 GARAGE", "ghost", function () { if (cb.onOpenGarage) cb.onOpenGarage(); }));
    add(row, button("⌖ CALIBRATE", "ghost", function () { if (cb.onCalibrate) cb.onCalibrate(); }));

    add(s, buildSettings());

    screens.menu = add(root, s);
  }

  function buildSettings() {
    var box = el("div", "settings");
    add(box, el("div", "settings-title", "SETTINGS"));

    // Quality segmented
    els.segQuality = segment(box, "QUALITY", [
      ["perf", "Performance"], ["balanced", "Native"], ["ultra", "4K Ultra"]
    ], "renderScale");

    // Control segmented
    els.segControl = segment(box, "CONTROL", [
      ["tilt", "Tilt"], ["touch", "Touch"]
    ], "controlMode");

    // tilt sensitivity slider
    els.sldSens = slider(box, "TILT SENSITIVITY", "sensitivity", 0.3, 3.0, 0.1);

    // toggles
    els.tgMute = toggle(box, "MUTE", "muted");
    els.tgShadows = toggle(box, "SHADOWS", "shadows");
    els.tgAi = toggle(box, "SMART TRAFFIC (AI)", "aiTraffic");
    els.tgDev = toggle(box, "DEV MODE", "dev");

    return box;
  }

  function fmtSens(v) {
    var n = Number(v);
    if (!(n === n)) n = 1; // NaN guard
    return (Math.round(n * 10) / 10).toFixed(1) + "×";
  }

  function slider(box, label, key, min, max, step) {
    var row = add(box, el("div", "set-row"));
    add(row, el("div", "set-label", label));
    var wrap = add(row, el("div", "slider-wrap"));
    var input = el("input", "slider");
    if (input) {
      try { input.type = "range"; } catch (e) {}
      try { input.min = String(min); input.max = String(max); input.step = String(step); } catch (e) {}
      try { input.value = String(settings[key]); } catch (e) {}
    }
    var valLabel = el("div", "slider-val", fmtSens(settings[key]));
    function onInput() {
      var v = min;
      try { v = parseFloat(input.value); } catch (e) {}
      if (!(v === v)) v = settings[key]; // NaN guard
      settings[key] = v;
      setText(valLabel, fmtSens(v));
      fireSettings();
    }
    if (input && input.addEventListener) {
      try { input.addEventListener("input", onInput); } catch (e) {}
      try { input.addEventListener("change", onInput); } catch (e) {}
    }
    add(wrap, input);
    add(wrap, valLabel);
    return { input: input, label: valLabel, min: min, max: max };
  }
  function syncSlider(sl, val) {
    if (!sl) return;
    if (sl.input) { try { sl.input.value = String(val); } catch (e) {} }
    setText(sl.label, fmtSens(val));
  }

  function segment(box, label, opts, key) {
    var row = add(box, el("div", "set-row"));
    add(row, el("div", "set-label", label));
    var seg = add(row, el("div", "seg"));
    var buttons = [];
    opts.forEach(function (o) {
      var b = el("button", "seg-opt", o[1]);
      b._val = o[0];
      click(b, function () {
        settings[key] = o[0];
        syncSegment(buttons, o[0]);
        fireSettings();
      });
      add(seg, b);
      buttons.push(b);
    });
    syncSegment(buttons, settings[key]);
    return buttons;
  }
  function syncSegment(buttons, val) {
    if (!buttons) return;
    for (var i = 0; i < buttons.length; i++) {
      if (buttons[i]._val === val) addCls(buttons[i], "on"); else rmCls(buttons[i], "on");
    }
  }

  function toggle(box, label, key) {
    var row = add(box, el("div", "set-row"));
    add(row, el("div", "set-label", label));
    var t = el("button", "switch");
    add(t, el("span", "switch-knob"));
    click(t, function () {
      settings[key] = !settings[key];
      syncToggle(t, settings[key]);
      fireSettings();
    });
    add(row, t);
    syncToggle(t, settings[key]);
    return t;
  }
  function syncToggle(node, on) { if (on) addCls(node, "on"); else rmCls(node, "on"); }
  function syncDevBadge(on) { if (on) addCls(els.devBadge, "show"); else rmCls(els.devBadge, "show"); }

  function fireSettings() {
    try { if (cb.onSettingsChange) cb.onSettingsChange(settings); } catch (e) {}
  }

  function buildGarage() {
    var s = el("div", "screen scr-garage");

    var head = add(s, el("div", "garage-head"));
    add(head, el("div", "screen-title", "GARAGE"));
    var bal = add(head, el("div", "coin-pill"));
    add(bal, el("span", "coin-ic", "◉"));
    els.garageCoins = add(bal, el("span", "coin-amt", "0"));

    els.devBadge = add(s, el("div", "dev-badge", "DEV — all unlocked"));
    syncDevBadge(settings.dev);

    els.bikeList = add(s, el("div", "bike-list"));

    add(s, button("← BACK", "ghost wide", function () { if (cb.onBackToMenu) cb.onBackToMenu(); }));

    screens.garage = add(root, s);
  }

  function buildHud() {
    var s = el("div", "screen scr-hud");

    // top bar: distance + coins + pause
    var top = add(s, el("div", "hud-top"));
    var dist = add(top, el("div", "hud-chip"));
    add(dist, el("span", "chip-ic", "▸"));
    els.hudDist = add(dist, el("span", "chip-val", "0 m"));

    var coins = add(top, el("div", "hud-chip coin"));
    add(coins, el("span", "chip-ic coin-ic", "◉"));
    els.hudCoins = add(coins, el("span", "chip-val", "0"));

    var pause = button("❚❚", "pause-btn", function () { if (cb.onPause) cb.onPause(); });
    add(top, pause);

    // live perf readout (FPS + GPU backend); hidden until setPerf() feeds it
    var perf = add(s, el("div", "perf hidden"));
    els.perfFps = add(perf, el("span", "perf-fps", "-- fps"));
    els.perfBackend = add(perf, el("span", "perf-backend", ""));
    els.perf = perf;

    // speedometer gauge bottom-right
    var gauge = add(s, el("div", "speedo"));
    var ring = add(gauge, el("div", "speedo-ring"));
    els.speedoFill = add(ring, el("div", "speedo-fill"));
    var inner = add(ring, el("div", "speedo-inner"));
    els.hudSpeed = add(inner, el("div", "speedo-num", "0"));
    add(inner, el("div", "speedo-unit", "KM/H"));

    screens.hud = add(root, s);
  }

  function buildPaused() {
    var s = el("div", "screen scr-paused dim");
    var card = add(s, el("div", "panel"));
    add(card, el("div", "screen-title", "PAUSED"));
    add(card, button("RESUME", "primary big", function () { if (cb.onResume) cb.onResume(); }));
    add(card, button("RESTART", "ghost wide", function () { if (cb.onRestart) cb.onRestart(); }));
    add(card, button("MENU", "ghost wide", function () { if (cb.onBackToMenu) cb.onBackToMenu(); }));
    screens.paused = add(root, s);
  }

  function buildGameOver() {
    var s = el("div", "screen scr-gameover dim");
    var card = add(s, el("div", "panel"));
    els.goBest = add(card, el("div", "go-best", "NEW BEST!"));
    add(card, el("div", "go-head", "WIPEOUT"));

    var dwrap = add(card, el("div", "go-dist-wrap"));
    els.goDist = add(dwrap, el("div", "go-dist", "0"));
    add(dwrap, el("div", "go-dist-unit", "METERS"));

    var rows = add(card, el("div", "go-rows"));
    var r1 = add(rows, el("div", "go-row"));
    add(r1, el("span", "go-row-cap", "EARNED"));
    els.goEarned = add(r1, el("span", "go-row-val coin-amt", "+0"));
    var r2 = add(rows, el("div", "go-row"));
    add(r2, el("span", "go-row-cap", "BEST"));
    els.goBestVal = add(r2, el("span", "go-row-val", "0 m"));

    var acts = add(card, el("div", "go-actions"));
    add(acts, button("RETRY", "primary big", function () { if (cb.onRestart) cb.onRestart(); }));
    var row = add(acts, el("div", "btn-row"));
    add(row, button("GARAGE", "ghost", function () { if (cb.onOpenGarage) cb.onOpenGarage(); }));
    add(row, button("MENU", "ghost", function () { if (cb.onBackToMenu) cb.onBackToMenu(); }));

    screens.gameover = add(root, s);
  }

  // ---- screen switching -----------------------------------------------------
  function show(name) {
    current = name;
    for (var k in screens) {
      if (!screens.hasOwnProperty(k)) continue;
      var node = screens[k];
      if (!node || !node.classList) continue;
      if (k === name) addCls(node, "active"); else rmCls(node, "active");
    }
  }

  // ---- HUD (cheap per-frame text updates) -----------------------------------
  var _lastSpeed = -1, _lastDist = "", _lastCoins = -1;
  function setHUD(d) {
    if (!d) return;
    if (d.speedKmh !== _lastSpeed) {
      _lastSpeed = d.speedKmh;
      setText(els.hudSpeed, String(d.speedKmh));
      if (els.speedoFill && els.speedoFill.style) {
        var frac = Math.max(0, Math.min(1, d.speedKmh / 220));
        // sweep a 270deg arc via conic-gradient angle
        els.speedoFill.style.background =
          "conic-gradient(from 135deg, #ff2a2a 0deg, #ff8a00 " +
          (frac * 270 * 0.6) + "deg, #ffd400 " + (frac * 270) +
          "deg, rgba(255,255,255,0.06) " + (frac * 270) + "deg 270deg, transparent 270deg)";
      }
    }
    var dStr = d.distance + " m";
    if (dStr !== _lastDist) { _lastDist = dStr; setText(els.hudDist, dStr); }
    if (d.coins !== _lastCoins) { _lastCoins = d.coins; setText(els.hudCoins, String(d.coins)); }
  }

  // ---- game over ------------------------------------------------------------
  function showGameOver(d) {
    d = d || {};
    setText(els.goDist, String(d.distance != null ? d.distance : 0));
    setText(els.goEarned, "+" + (d.earned || 0));
    setText(els.goBestVal, (d.best != null ? d.best : 0) + " m");
    if (els.goBest && els.goBest.classList) {
      if (d.isNewBest) addCls(els.goBest, "show"); else rmCls(els.goBest, "show");
    }
    setText(els.menuBest, (d.best != null ? d.best : 0) + " m");
  }

  // ---- garage ---------------------------------------------------------------
  function statBar(parent, label, frac) {
    var row = add(parent, el("div", "stat-bar-row"));
    add(row, el("span", "sb-label", label));
    var track = add(row, el("div", "sb-track"));
    var fill = el("div", "sb-fill");
    if (fill && fill.style) {
      try { fill.style.width = Math.max(4, Math.min(100, Math.round(frac * 100))) + "%"; } catch (e) {}
    }
    add(track, fill);
  }

  function setBikes(catalog, owned, selectedId, coinBalance) {
    syncDevBadge(settings.dev);
    if (coinBalance != null) {
      setText(els.garageCoins, String(coinBalance));
      setText(els.menuCoins, String(coinBalance));
    }
    if (!els.bikeList) return;
    try { els.bikeList.innerHTML = ""; } catch (e) {}
    owned = owned || [];
    (catalog || []).forEach(function (b) {
      var isOwned = owned.indexOf(b.id) >= 0;
      var isSel = b.id === selectedId;
      var card = el("div", "bike-card" + (isSel ? " selected" : "") + (isOwned ? "" : " locked"));

      var top = add(card, el("div", "bike-top"));
      var swatch = add(top, el("div", "bike-swatch"));
      if (swatch && swatch.style && b.colorHex != null) {
        var hex = (typeof b.colorHex === "number") ? ("#" + ("000000" + b.colorHex.toString(16)).slice(-6)) : b.colorHex;
        try { swatch.style.background = hex; } catch (e) {}
      }
      var nameWrap = add(top, el("div", "bike-name-wrap"));
      add(nameWrap, el("div", "bike-name", b.name || b.id));
      add(nameWrap, el("div", "bike-desc", b.desc || ""));

      var stats = add(card, el("div", "bike-stats"));
      statBar(stats, "SPEED", Math.min(1, (b.topSpeed || 0) / 320));
      statBar(stats, "ACCEL", b.accel || 0);
      statBar(stats, "GRIP", b.handling || 0);

      var foot = add(card, el("div", "bike-foot"));
      if (isOwned) {
        var sb = button(isSel ? "✓ SELECTED" : "SELECT", "select" + (isSel ? " is-selected" : ""),
          function () { if (cb.onSelectBike) cb.onSelectBike(b.id); });
        add(foot, sb);
      } else {
        var afford = coinBalance == null || coinBalance >= (b.price || 0);
        var bb = button("BUY ◉ " + (b.price || 0), "buy" + (afford ? "" : " disabled"),
          function () { if (afford && cb.onBuyBike) cb.onBuyBike(b.id); });
        add(foot, bb);
      }

      add(els.bikeList, card);
    });
  }

  // ---- coins / settings -----------------------------------------------------
  function setCoins(n) {
    setText(els.garageCoins, String(n));
    setText(els.menuCoins, String(n));
  }

  function setSettings(s) {
    if (!s) return;
    if (s.renderScale != null) settings.renderScale = s.renderScale;
    if (s.controlMode != null) settings.controlMode = s.controlMode;
    if (s.muted != null) settings.muted = !!s.muted;
    if (s.shadows != null) settings.shadows = !!s.shadows;
    if (s.sensitivity != null) {
      var sv = Number(s.sensitivity);
      if (sv === sv) settings.sensitivity = Math.max(0.3, Math.min(3.0, sv));
    }
    if (s.aiTraffic != null) settings.aiTraffic = !!s.aiTraffic;
    if (s.dev != null) settings.dev = !!s.dev;
    syncSegment(els.segQuality, settings.renderScale);
    syncSegment(els.segControl, settings.controlMode);
    syncSlider(els.sldSens, settings.sensitivity);
    syncToggle(els.tgMute, settings.muted);
    syncToggle(els.tgShadows, settings.shadows);
    syncToggle(els.tgAi, settings.aiTraffic);
    syncToggle(els.tgDev, settings.dev);
    syncDevBadge(settings.dev);
  }

  // ---- perf readout (cheap text-node updates; safe no-op if absent) ----------
  var _lastFps = null, _lastBackend = null;
  function setPerf(p) {
    if (!p) return;
    if (!els.perf) return; // mock / no HUD: harmless no-op
    if (p.fps != null && p.fps !== _lastFps) {
      _lastFps = p.fps;
      var n = Math.round(Number(p.fps));
      if (!(n === n)) n = 0;
      setText(els.perfFps, n + " fps");
    }
    if (p.backend != null && p.backend !== _lastBackend) {
      _lastBackend = p.backend;
      setText(els.perfBackend, String(p.backend));
    }
    rmCls(els.perf, "hidden");
  }

  // ---- toast ----------------------------------------------------------------
  function toast(msg) {
    if (!els.toast) return;
    setText(els.toast, msg);
    addCls(els.toast, "on");
    try { clearTimeout(toastTimer); } catch (e) {}
    try { toastTimer = setTimeout(function () { rmCls(els.toast, "on"); }, 1800); } catch (e) {}
  }

  MOTO.UI = {
    init: init,
    show: show,
    setHUD: setHUD,
    showGameOver: showGameOver,
    setBikes: setBikes,
    setCoins: setCoins,
    setSettings: setSettings,
    toast: toast,
    setPerf: setPerf
  };
})();
