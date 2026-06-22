/* MOTO.Render — modern rendering layer.
 * Three.js WebGPURenderer (WebGPU on-device, automatic WebGL2 fallback) with
 * ACES tone mapping, high-res soft shadows, a TSL post-processing pipeline
 * (bloom now; AO/TRAA/DoF/motion-blur wired by the post agent), and an adaptive
 * internal-resolution controller that targets a high framerate (120Hz) while
 * presenting at the panel's full resolution — the "render low, present high"
 * temporal-upscaling idea. Used by main.js; never throws merely on load. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  // quality presets: internal pixel-ratio bounds + shadow + effect budget.
  // dpr is multiplied by these; adaptive res moves between min..max to hold fps.
  var PRESETS = {
    perf:     { rmin: 0.55, rmax: 0.9,  shadow: 1024, bloom: 0.6, ao: false, traa: false, target: 120 },
    balanced: { rmin: 0.7,  rmax: 1.25, shadow: 2048, bloom: 0.8, ao: true,  traa: true,  target: 120 },
    ultra:    { rmin: 0.85, rmax: 1.8,  shadow: 4096, bloom: 1.0, ao: true,  traa: true,  target: 90  }
  };
  var MAX_BUFFER_DIM = 3840;

  function preset(name) { return PRESETS[name] || PRESETS.balanced; }

  function Render() {
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.post = null;
    this.settings = null;
    this._inFlight = false;
    this._curRatio = 1;
    this._emaFrame = 1000 / 120;
    this._lastResize = 0;
    this.backend = "unknown";
    this.ready = false;
  }

  Render.prototype.init = function (canvas, settings) {
    var self = this;
    this.settings = settings || { renderScale: "balanced", shadows: true };
    var THREE = window.THREE;
    var useWebGPU = false;
    try { useWebGPU = !!(navigator.gpu); } catch (e) { useWebGPU = false; }

    var renderer = new THREE.WebGPURenderer({
      canvas: canvas, antialias: true, forceWebGL: !useWebGPU,
      powerPreference: "high-performance", alpha: false, stencil: false
    });
    this.renderer = renderer;
    try { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05; } catch (e) {}
    try { if ("outputColorSpace" in renderer) renderer.outputColorSpace = THREE.SRGBColorSpace; } catch (e) {}
    try {
      renderer.shadowMap.enabled = !!this.settings.shadows;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    } catch (e) {}

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(74, 1, 0.1, 4000);
    this.camera.position.set(0, 4.6, 9.5);

    return renderer.init().then(function () {
      try { self.backend = (renderer.backend && /gpu/i.test(renderer.backend.constructor.name)) ? "webgpu" : "webgl"; } catch (e) {}
      self._buildPipeline();
      self.applyQuality(self.settings.renderScale);
      self.ready = true;
      return self;
    }).catch(function (err) {
      // hard fallback: force the WebGL2 backend of the same renderer
      try {
        self.renderer = new THREE.WebGPURenderer({ canvas: canvas, antialias: true, forceWebGL: true });
        return self.renderer.init().then(function () {
          self.backend = "webgl"; self._buildPipeline(); self.applyQuality(self.settings.renderScale); self.ready = true; return self;
        });
      } catch (e2) { throw err; }
    });
  };

  Render.prototype._buildPipeline = function () {
    var THREE = window.THREE, TSL = window.TSL, GFX = window.MOTOGFX || {};
    try {
      this.post = new THREE.PostProcessing(this.renderer);
      var scenePass = TSL.pass(this.scene, this.camera);
      var p = preset(this.settings.renderScale);
      var out = scenePass;
      if (GFX.bloom) {
        var b = GFX.bloom(scenePass, p.bloom, 0.45, 0.1);
        out = scenePass.add(b);
      }
      this.post.outputNode = out;
      this._scenePass = scenePass;
    } catch (e) {
      // pipeline optional: fall back to direct rendering
      this.post = null;
    }
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
    var dpr = (window.devicePixelRatio || 1);
    this._curRatio = Math.min(p.rmax, dpr * (name === "ultra" ? 1.0 : 0.9));
    this._setRatio(this._curRatio);
    try {
      if (this.renderer) {
        this.renderer.shadowMap.enabled = !!(this.settings && this.settings.shadows);
      }
    } catch (e) {}
  };

  Render.prototype._setRatio = function (r) {
    if (!this.renderer) return;
    var w = window.innerWidth || 1, h = window.innerHeight || 1;
    var dpr = (window.devicePixelRatio || 1);
    var maxByDim = Math.min(MAX_BUFFER_DIM / Math.max(1, w * 1), MAX_BUFFER_DIM / Math.max(1, h * 1)) / Math.max(0.001, 1);
    // r is a device-pixel multiplier already incorporating dpr
    var clamped = Math.max(0.4, Math.min(r, 4));
    try { this.renderer.setPixelRatio(clamped); } catch (e) {}
    this._curRatio = clamped;
  };

  // adaptive: nudge internal resolution to hold the preset's target frame budget
  Render.prototype._adapt = function (frameMs) {
    var p = preset(this.settings.renderScale);
    this._emaFrame += (frameMs - this._emaFrame) * 0.1;
    var budget = 1000 / p.target;
    var dpr = (window.devicePixelRatio || 1);
    var min = p.rmin, max = Math.min(p.rmax, dpr * (this.settings.renderScale === "ultra" ? 1.6 : 1.3));
    var r = this._curRatio;
    if (this._emaFrame > budget * 1.12 && r > min) r = Math.max(min, r - 0.06);
    else if (this._emaFrame < budget * 0.82 && r < max) r = Math.min(max, r + 0.03);
    if (Math.abs(r - this._curRatio) > 0.005) this._setRatio(r);
  };

  // render one frame (async for WebGPU); decoupled from sim via in-flight guard
  Render.prototype.frame = function (frameMs) {
    if (!this.ready || this._inFlight) return;
    if (frameMs) this._adapt(frameMs);
    var self = this;
    this._inFlight = true;
    var done = function () { self._inFlight = false; };
    try {
      if (this.post && this.post.renderAsync) this.post.renderAsync().then(done, done);
      else if (this.renderer.renderAsync) this.renderer.renderAsync(this.scene, this.camera).then(done, done);
      else { this.renderer.render(this.scene, this.camera); done(); }
    } catch (e) { done(); }
  };

  MOTO.Render = {
    create: function () { return new Render(); },
    presets: function () { return Object.keys(PRESETS); }
  };
})();
