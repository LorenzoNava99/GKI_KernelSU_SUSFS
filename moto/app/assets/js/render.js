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
    perf:     { rmin: 0.55, rmax: 0.9,  shadow: 1024, bloom: 0.22, ao: false, traa: false, target: 120 },
    balanced: { rmin: 0.7,  rmax: 1.25, shadow: 2048, bloom: 0.32, ao: true,  traa: true,  target: 120 },
    ultra:    { rmin: 0.85, rmax: 1.8,  shadow: 4096, bloom: 0.45, ao: true,  traa: true,  target: 90  }
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
    try { renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.15; } catch (e) {}
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
    var p = preset(this.settings.renderScale);

    // Tier 1: MRT scene pass -> GTAO ambient occlusion x color -> bloom (highlights only)
    try {
      var post = new THREE.PostProcessing(this.renderer);
      var scenePass = TSL.pass(this.scene, this.camera);
      var normalNode = TSL.normalView || TSL.normal;
      var wantAO = p.ao && GFX.ao && TSL.mrt && TSL.output && normalNode && scenePass.getTextureNode && scenePass.setMRT;
      if (wantAO) scenePass.setMRT(TSL.mrt({ output: TSL.output, normal: normalNode }));
      var color = scenePass.getTextureNode ? scenePass.getTextureNode("output") : scenePass;
      var lit = color;
      if (wantAO) {
        var depth = scenePass.getTextureNode("depth");
        var nrm = scenePass.getTextureNode("normal");
        var aoPass = GFX.ao(depth, nrm, this.camera);
        try { if ("resolutionScale" in aoPass) aoPass.resolutionScale = (this.settings.renderScale === "ultra" ? 1.0 : 0.5); } catch (e) {}
        lit = aoPass.getTextureNode().mul(color);
      }
      var outNode = lit;
      if (GFX.bloom) outNode = lit.add(GFX.bloom(lit, p.bloom, 0.6, 0.9)); // high threshold: only bright pixels bloom
      post.outputNode = outNode;
      this.post = post; this._scenePass = scenePass;
      this._pipeline = wantAO ? "ao+bloom" : "bloom";
      return;
    } catch (e1) { try { console.warn("post tier1 failed:", e1 && e1.message); } catch (e) {} }

    // Tier 2: bloom only (proven minimal pipeline)
    try {
      var post2 = new THREE.PostProcessing(this.renderer);
      var sp2 = TSL.pass(this.scene, this.camera);
      var o2 = sp2;
      if (GFX.bloom) o2 = sp2.add(GFX.bloom(sp2, p.bloom, 0.6, 0.9));
      post2.outputNode = o2;
      this.post = post2; this._scenePass = sp2; this._pipeline = "bloom";
      return;
    } catch (e2) { try { console.warn("post tier2 failed:", e2 && e2.message); } catch (e) {} }

    // Tier 3: direct render, no post
    this.post = null; this._pipeline = "direct";
  };

  Render.prototype.info = function () {
    return { backend: this.backend, pipeline: this._pipeline || "?", ratio: this._curRatio };
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
