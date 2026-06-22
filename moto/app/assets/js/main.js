/* SpeedMoto — bootstrap, render loop, persistence, wiring.
 * Owns the RAF loop, state machine and settings; delegates all rendering to
 * MOTO.Render (WebGPU/WebGL2). Calls MOTO.{Models,Environment,Controls,Audio,UI,World,AI}. */
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
      owned: null,
      selected: null,
      settings: {
        renderScale: "ultra",      // top-tier device: default to the best preset
        controlMode: "tilt",
        muted: false,
        shadows: true,
        sensitivity: 1.0,          // tilt sensitivity multiplier
        aiTraffic: true,           // neural traffic NPCs
        dev: true                  // DEV MODE ON by default -> all bikes unlocked
      }
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
  var gfx = null, scene = null, camera = null, canvas = null;
  var env = null, world = null;
  var state = "LOADING";
  var camShake = 0;
  var started = false;
  var lastT = 0;

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

  function allBikeIds() { return catalog().map(function (b) { return b.id; }); }

  function ensureOwnership() {
    var c = catalog();
    if (!c.length) return;
    if (save.settings.dev) {
      save.owned = allBikeIds();              // dev mode: everything unlocked
    } else if (!save.owned || !save.owned.length) {
      save.owned = [c[0].id];
    }
    if (!save.selected || save.owned.indexOf(save.selected) < 0) save.selected = save.owned[0];
    persist();
  }

  // ---- run lifecycle --------------------------------------------------------
  function startRun(bikeId) {
    bikeId = bikeId || save.selected;
    teardownRun();
    // auto-calibrate tilt to however the phone is currently held -> play from any pose
    try { MOTO.Controls.calibrate(); } catch (e) {}
    var theme = themeForDistance(0);
    env = MOTO.Environment.create(scene, theme);
    var bikeGroup = MOTO.Models.bike(bikeId);
    world = MOTO.World.create({
      scene: scene, env: env, bikeGroup: bikeGroup, stats: statsFor(bikeId),
      ai: !!save.settings.aiTraffic
    });
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
  var _camTarget = null;
  function updateCamera(dt) {
    if (!_camTarget) _camTarget = new THREE.Vector3();
    var px = world.playerX || 0;
    var speed01 = Math.min(1, world.speed / 90);
    camShake = world.crashed ? 0 : (0.05 * speed01);
    var sx = (Math.random() - 0.5) * camShake;
    var sy = (Math.random() - 0.5) * camShake;
    var desired = new THREE.Vector3(px * 0.55 + sx, 4.4 + sy, 9.2 + speed01 * 1.2);
    camera.position.lerp(desired, Math.min(1, dt * 6));
    _camTarget.set(px * 0.75, 1.4, -14);
    camera.lookAt(_camTarget);
    camera.fov = 74 + speed01 * 10;
    camera.updateProjectionMatrix();
  }

  // ---- main loop ------------------------------------------------------------
  function loop(now) {
    requestAnimationFrame(loop);
    if (!lastT) lastT = now || 0;
    var frameMs = (now || 0) - lastT; lastT = now || 0;
    var dt = Math.min(Math.max(frameMs / 1000, 0.0001), 0.05);

    if (state === "PLAYING" && world) {
      var input = MOTO.Controls.read();
      world.update(dt, input);

      var th = themeForDistance(world.distance);
      if (th !== world._lastTheme) { world._lastTheme = th; try { env.setTheme(th); } catch (e) {} }

      try { env.update(dt, world.speed, world.distance); } catch (e) {}
      updateCamera(dt);

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

    if (gfx) gfx.frame(frameMs);
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
        if (save.owned.indexOf(id) >= 0) { save.selected = id; persist(); MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins); return; }
        if (save.coins >= st.price) {
          save.coins -= st.price; save.owned.push(id); save.selected = id; persist();
          MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins);
          MOTO.UI.setCoins(save.coins); MOTO.UI.toast("Unlocked " + st.name);
          try { if (!save.settings.muted) MOTO.Audio.coin(); } catch (e) {}
        } else { MOTO.UI.toast("Not enough coins"); }
      },
      onOpenGarage: function () { MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins); setState("GARAGE"); },
      onBackToMenu: function () { teardownRun(); setState("MENU"); },
      onCalibrate: function () { try { MOTO.Controls.calibrate(); MOTO.UI.toast("Tilt calibrated — hold this pose"); } catch (e) {} },
      onSettingsChange: function (s) {
        save.settings = Object.assign(save.settings, s); persist();
        try { MOTO.Controls.setMode(save.settings.controlMode); } catch (e) {}
        try { if (MOTO.Controls.setSensitivity) MOTO.Controls.setSensitivity(save.settings.sensitivity); } catch (e) {}
        try { MOTO.Audio.setMuted(save.settings.muted); } catch (e) {}
        if (gfx) { try { gfx.settings.shadows = save.settings.shadows; gfx.applyQuality(save.settings.renderScale); } catch (e) {} }
        if (save.settings.dev) { ensureOwnership(); MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins); }
      }
    };
  }

  // ---- boot -----------------------------------------------------------------
  function boot() {
    if (started) return; started = true;
    canvas = document.getElementById("gl");
    ensureOwnership();
    MOTO.UI.init(buildCallbacks());
    MOTO.UI.setSettings(save.settings);
    MOTO.UI.setBikes(catalog(), save.owned, save.selected, save.coins);
    MOTO.UI.setCoins(save.coins);
    try { MOTO.Controls.init(canvas, { onTap: function () {}, onPause: function () { buildCallbacks().onPause(); } }); } catch (e) {}
    try { MOTO.Controls.setMode(save.settings.controlMode); } catch (e) {}
    try { if (MOTO.Controls.setSensitivity) MOTO.Controls.setSensitivity(save.settings.sensitivity); } catch (e) {}

    gfx = MOTO.Render.create();
    gfx.init(canvas, save.settings).then(function () {
      scene = gfx.scene; camera = gfx.camera;
      gfx.resize(window.innerWidth, window.innerHeight);
      window.addEventListener("resize", function () { gfx.resize(window.innerWidth, window.innerHeight); });
      document.addEventListener("visibilitychange", function () {
        if (document.hidden && state === "PLAYING") buildCallbacks().onPause();
      });
      setState("MENU");
      requestAnimationFrame(loop);
    }).catch(function (err) {
      try { MOTO.UI.toast("Renderer init failed"); } catch (e) {}
      try { console.error("Render init failed", err); } catch (e) {}
    });
  }

  MOTO.App = { boot: boot, _save: function () { return save; } };

  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(boot, 0);
  } else {
    window.addEventListener("DOMContentLoaded", boot);
  }
})();
