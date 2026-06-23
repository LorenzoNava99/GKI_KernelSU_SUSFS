/* MOTO.Render — classic Three.js WebGLRenderer (the battle-tested path used by
 * shipped HTML5 games). Direct render with hardware MSAA anti-aliasing (crisp,
 * no fragile post-processing render targets), ACES tone mapping and soft shadows.
 * We deliberately dropped the WebGPU/TSL post-processing experiment: it rendered
 * differently across GPU backends (the device-only road bug) and couldn't be
 * verified here. Quality now comes from clean art + lighting, not bleeding-edge FX.
 * API is unchanged so main.js is untouched. Never throws merely on load. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  // maxDpr caps the drawing-buffer scale; we render at the panel's native pixels
  // (capped) for crisp output. No adaptive downscaling — MSAA + native res = sharp.
  var PRESETS = {
    perf:     { maxDpr: 1.5, shadow: 1024 },
    balanced: { maxDpr: 2.5, shadow: 2048 },
    ultra:    { maxDpr: 4.0, shadow: 3072 }
  };
  function preset(n) { return PRESETS[n] || PRESETS.balanced; }

  function Render() {
    this.renderer = null; this.scene = null; this.camera = null;
    this.settings = null; this.backend = "webgl"; this.ready = false;
  }

  Render.prototype.init = function (canvas, settings) {
    var THREE = window.THREE;
    this.settings = settings || { renderScale: "ultra", shadows: true };
    var r = new THREE.WebGLRenderer({
      canvas: canvas, antialias: true, powerPreference: "high-performance",
      alpha: false, stencil: false
    });
    this.renderer = r;
    try { if ("outputColorSpace" in r) r.outputColorSpace = THREE.SRGBColorSpace; } catch (e) {}
    try { r.toneMapping = THREE.ACESFilmicToneMapping; r.toneMappingExposure = 1.1; } catch (e) {}
    try { r.shadowMap.enabled = !!this.settings.shadows; r.shadowMap.type = THREE.PCFSoftShadowMap; } catch (e) {}

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1600);
    this.camera.position.set(0, 3.3, 7.2);

    this.applyQuality(this.settings.renderScale);
    this.ready = true;
    return Promise.resolve(this);
  };

  Render.prototype.resize = function (w, h) {
    if (!this.renderer) return;
    try {
      this.renderer.setSize(w, h, false);
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
    } catch (e) {}
  };

  Render.prototype.applyQuality = function (name) {
    if (this.settings) this.settings.renderScale = name;
    var p = preset(name);
    var dpr = Math.min(window.devicePixelRatio || 1, p.maxDpr);
    try {
      this.renderer.setPixelRatio(dpr);
      this.renderer.shadowMap.enabled = !!(this.settings && this.settings.shadows);
    } catch (e) {}
  };

  Render.prototype.frame = function () {
    if (!this.ready || !this.renderer) return;
    try { this.renderer.render(this.scene, this.camera); } catch (e) {}
  };

  Render.prototype.info = function () {
    var dpr = 1; try { dpr = this.renderer.getPixelRatio(); } catch (e) {}
    return { backend: this.backend, pipeline: "msaa", ratio: dpr };
  };

  MOTO.Render = {
    create: function () { return new Render(); },
    presets: function () { return Object.keys(PRESETS); }
  };
})();
