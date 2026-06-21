/* SpeedMoto — bootstrap, render loop, 4K render-scale, persistence, wiring.
 * Owns: renderer, camera, scene root, RAF loop, state machine, settings.
 * Calls into MOTO.{Models,Environment,Controls,Audio,UI,World}. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  var SAVE_KEY = "moto.save";
  var THEME_EVERY = 1400; // metres between scenery themes

  // ---- persistence ----------------------------------------------------------
  function defaultSave() {
    return {
      best: 0,
      coins: 0,
      owned: null, // filled from catalog starter on first run
      selected: null,
      settings: { renderScale: "balanced", controlMode: "tilt", muted: false, shadows: true }
    };
  }
  function loadSave() {
    try {
      var raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return defaultSave();
      var s = JSON.parse(raw);
      var d = defaultSave();
      s.settings = Object.assign(d.settings, s.settings || {});
      return Object.assign(d, s);
    } catch (e) { return defaultSave(); }
  }
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }

  var save = loadSave();

  // ---- module-local state ---------------------------------------------------
  var renderer, scene, camera, clock, canvas;
  var env = null, world = null;
  var state = "LOADING";
  var camShake = 0;
  var started = false;

  // ---- 4K render scale ------------------------------------------------------
  // Pixel 9 Pro XL panel is ~1344x2992. We supersample for "4K" crispness and
  // clamp the drawing buffer so we never exceed GL limits.
  var MAX_BUFFER_DIM = 3840;
  function scaleFactor() {
    switch (save.settings.renderScale) {
      case "perf": return 0.7;
      case "ultra": return 1.5; // supersample beyond native -> 4K-class
      default: return 1.0;      // balanced = native device pixels
    }
  }
  function applyRenderScale() {
    var dpr = window.devicePixelRatio || 1;
    var target = dpr * scaleFactor();
    var w = window.innerWidth, h = window.innerHeight;
    // clamp so w*ratio and h*ratio stay within MAX_BUFFER_DIM
    var maxRatio = Math.min(MAX_BUFFER_DIM / Math.max(1, w), MAX_BUFFER_DIM / Math.max(1, h));
    var ratio = Math.min(target, maxRatio, 4);
    renderer.setPixelRatio(ratio);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  // ---- scene ----------------------------------------------------------------
  function buildRenderer() {
    canvas = document.getElementById("gl");
    renderer = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, powerPreference: "high-performance",
      alpha: false, stencil: false
    });
    renderer.shadowMap.enabled = !!save.settings.shadows;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = new THREE.Scene();
    camera = new THREE.PerspectiveCamera(74, 1, 0.1, 3000);
    camera.position.set(0, 4.6, 9.5);
    clock = new THREE.Clock();
    applyRenderScale();
  }

  // ---- theme helpers --------------------------------------------------------
  function themeIds() {
    try { return MOTO.Environment.themes().map(function (t) { return t.id; }); }
    catch (e) { return ["desert"]; }
  }
  function themeForDistance(d) {
    var ids = themeIds();
    if (!ids.length) return "desert";
    return ids[Math.floor(d / THEME_EVERY) % ids.length];
  }

  function catalog() { try { return MOTO.Models.bikeCatalog(); } catch (e) { return []; } }
  function statsFor(id) {
    var c = catalog();
    for (var i = 0; i < c.length; i++) if (c[i].id === id) return c[i];
    return c[0] || { id: "x", topSpeed: 180, accel: 0.6, handling: 0.6 };
  }

  function ensureOwnership() {
    var c = catalog();
    if (!c.length) return;
    if (!save.owned || !save.owned.length) save.owned = [c[0].id];
    if (!save.selected || save.owned.indexOf(save.selected) < 0) save.selected = save.owned[0];
    persist();
  }

  // ---- run lifecycle --------------------------------------------------------
  function startRun(bikeId) {
    bikeId = bikeId || save.selected;
    teardownRun();
    var theme = themeForDistance(0);
    env = MOTO.Environment.create(scene, theme);
    var bikeGroup = MOTO.Models.bike(bikeId);
    world = MOTO.World.create({ scene: scene, env: env, bikeGroup: bikeGroup, stats: statsFor(bikeId) });
    world._lastTheme = theme;
    camShake = 0;
    try { MOTO.Audio.init(); if (!save.settings.muted) MOTO.Audio.startEngine(); } catch (e) {}
    setState("PLAYING");
  }
  function teardownRun() {
    try { MOTO.Audio.stopEngine(); } catch (e) {}
    if (world) { world.dispose(scene); world = null; }
    if (env) { env.dispose(); env = null; }
  }

  function endRun() {
    var dist = Math.floor(world.distance);
    var earned = world.coins;
    var isNewBest = dist > save.best;
    if (isNewBest) save.best = dist;
    save.coins += earned;
    persist();
    try { MOTO.Audio.crash(); MOTO.Audio.stopEngine(); } catch (e) {}
    setState("GAMEOVER");
    MOTO.UI.showGameOver({ distance: dist, coins: world.coins, best: save.best, isNewBest: isNewBest, earned: earned });
    MOTO.UI.setCoins(save.coins);
  }

  // ---- state machine --------------------------------------------------------
  function setState(s) {
    state = s;
    var screen = { LOADING: "loading", MENU: "menu", GARAGE: "garage",
      PLAYING: "hud", PAUSED: "paused", GAMEOVER: "gameover" }[s] || "menu";
    MOTO.UI.show(screen);
  }

  // ---- camera ---------------------------------------------------------------
  var _camTarget = new THREE.Vector3();
  function updateCamera(dt) {
    var px = world.playerX || 0;
    var speed01 = Math.min(1, world.speed / 90);
    camShake = world.crashed ? 0 : (0.06 * speed01);
    var sx = (Math.random() - 0.5) * camShake;
    var sy = (Math.random() - 0.5) * camShake;
    var desired = new THREE.Vector3(px * 0.55 + sx, 4.4 + sy, 9.2 + speed01 * 1.2);
    camera.position.lerp(desired, Math.min(1, dt * 6));
    _camTarget.set(px * 0.75, 1.4, -14);
    camera.lookAt(_camTarget);
    camera.fov = 74 + speed01 * 10; // speed sensation
    camera.updateProjectionMatrix();
  }

  // ---- main loop ------------------------------------------------------------
  function loop() {
    requestAnimationFrame(loop);
    var dt = clock ? Math.min(clock.getDelta(), 0.05) : 0.016;

    if (state === "PLAYING" && world) {
      var input = MOTO.Controls.read();
      world.update(dt, input);

      // theme cycling
      var th = themeForDistance(world.distance);
      if (th !== world._lastTheme) { world._lastTheme = th; try { env.setTheme(th); } catch (e) {} }

      env.update(dt, world.speed, world.distance);
      updateCamera(dt);

      // drain gameplay events for audio / ui
      var ev = world.events; world.events = [];
      for (var i = 0; i < ev.length; i++) {
        if (ev[i] === "coin") { try { if (!save.settings.muted) MOTO.Audio.coin(); } catch (e) {} }
        else if (ev[i] === "nearmiss") { try { if (!save.settings.muted) MOTO.Audio.whoosh(); } catch (e) {} }
      }
      try { if (!save.settings.muted) MOTO.Audio.engine(world.rpm01); } catch (e) {}

      MOTO.UI.setHUD({ speedKmh: Math.round(world.speedKmh), distance: Math.floor(world.distance),
        coins: world.coins, best: save.best });

      if (world.crashed) endRun();
    }

    if (renderer && scene && camera) renderer.render(scene, camera);
  }

  // ---- UI callbacks ---------------------------------------------------------
  function buildCallbacks() {
    return {
      onStart: function (bikeId) { startRun(bikeId); },
      onRestart: function () { startRun(save.selected); },
      onResume: function () { if (world) { setState("PLAYING"); try { if (!save.settings.muted) MOTO.Audio.startEngine(); } catch (e) {} } },
      onPause: function () { if (state === "PLAYING") { setState("PAUSED"); try { MOTO.Audio.stopEngine(); } catch (e) {} } },
      onSelectBike: function (id) { if (save.owned.indexOf(id) >= 0) { save.selected = id; persist(); MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins); } },
      onBuyBike: function (id) {
        var st = statsFor(id);
        if (save.owned.indexOf(id) >= 0) return;
        if (save.coins >= st.price) {
          save.coins -= st.price; save.owned.push(id); save.selected = id; persist();
          MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins);
          MOTO.UI.setCoins(save.coins); MOTO.UI.toast("Unlocked " + st.name);
          try { if (!save.settings.muted) MOTO.Audio.coin(); } catch (e) {}
        } else { MOTO.UI.toast("Not enough coins"); }
      },
      onOpenGarage: function () { MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins); setState("GARAGE"); },
      onBackToMenu: function () { teardownRun(); setState("MENU"); },
      onCalibrate: function () { try { MOTO.Controls.calibrate(); MOTO.UI.toast("Tilt calibrated"); } catch (e) {} },
      onSettingsChange: function (s) {
        save.settings = Object.assign(save.settings, s); persist();
        try { MOTO.Controls.setMode(save.settings.controlMode); } catch (e) {}
        try { MOTO.Audio.setMuted(save.settings.muted); } catch (e) {}
        if (renderer) { renderer.shadowMap.enabled = !!save.settings.shadows; applyRenderScale(); }
      }
    };
  }

  // ---- boot -----------------------------------------------------------------
  function boot() {
    if (started) return; started = true;
    buildRenderer();
    ensureOwnership();
    MOTO.UI.init(buildCallbacks());
    MOTO.UI.setSettings(save.settings);
    MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins);
    MOTO.UI.setCoins(save.coins);
    try { MOTO.Controls.init(renderer.domElement, { onTap: function () {}, onPause: function () { buildCallbacks().onPause(); } }); } catch (e) {}
    try { MOTO.Controls.setMode(save.settings.controlMode); } catch (e) {}
    window.addEventListener("resize", function () { if (renderer) applyRenderScale(); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden && state === "PLAYING") buildCallbacks().onPause();
    });
    setState("MENU");
    requestAnimationFrame(loop);
  }

  MOTO.App = { boot: boot, _save: function () { return save; } };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(boot, 0);
  } else {
    window.addEventListener("DOMContentLoaded", boot);
  }
})();
