/* MOTO.Audio — fully synthesized WebAudio sound engine. No audio files.
 * Procedural motorcycle engine + crash/coin/whoosh/click SFX.
 * NEVER throws: every public call is wrapped in try/catch and null-guards the
 * AudioContext (works under the headless verifier's minimal AudioContext mock). */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  var ctx = null;          // AudioContext (lazy)
  var master = null;       // master gain -> destination
  var muted = false;
  var eng = null;          // live engine voice graph
  var noiseBuf = null;     // cached white-noise buffer

  // ---- context plumbing -----------------------------------------------------
  function ac() {
    if (ctx) return ctx;
    try {
      var Ctor = window.AudioContext || window.webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch (e) { ctx = null; }
    return ctx;
  }

  function ensureMaster() {
    var c = ac();
    if (!c) return null;
    if (master) return master;
    try {
      master = c.createGain();
      master.gain.value = muted ? 0.0 : 0.9;
      master.connect(c.destination);
    } catch (e) { master = null; }
    return master;
  }

  function now() {
    var c = ac();
    try { return c ? c.currentTime : 0; } catch (e) { return 0; }
  }

  function init() {
    var c = ac();
    if (!c) return;
    try { if (c.state === "suspended" && c.resume) c.resume(); } catch (e) {}
    ensureMaster();
  }

  // ---- white noise buffer (cached) ------------------------------------------
  function noise() {
    var c = ac();
    if (!c) return null;
    if (noiseBuf) return noiseBuf;
    try {
      var len = Math.floor((c.sampleRate || 44100) * 1.0);
      var buf = c.createBuffer(1, len, c.sampleRate || 44100);
      var d = buf.getChannelData(0);
      for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      noiseBuf = buf;
    } catch (e) { noiseBuf = null; }
    return noiseBuf;
  }

  function noiseSource() {
    var c = ac(), b = noise();
    if (!c || !b) return null;
    try {
      var s = c.createBufferSource();
      s.buffer = b;
      s.loop = true;
      return s;
    } catch (e) { return null; }
  }

  // safe param helpers (ramps degrade gracefully under the mock) -------------
  function setTarget(param, v, t, tc) {
    try {
      if (param.setTargetAtTime) param.setTargetAtTime(v, t, tc);
      else param.value = v;
    } catch (e) { try { param.value = v; } catch (e2) {} }
  }
  function ramp(param, v, t) {
    try {
      if (param.linearRampToValueAtTime) param.linearRampToValueAtTime(v, t);
      else param.value = v;
    } catch (e) { try { param.value = v; } catch (e2) {} }
  }
  function expRamp(param, v, t) {
    try {
      if (param.exponentialRampToValueAtTime) param.exponentialRampToValueAtTime(Math.max(v, 0.0001), t);
      else param.value = v;
    } catch (e) { try { param.value = v; } catch (e2) {} }
  }
  function setAt(param, v, t) {
    try {
      if (param.setValueAtTime) param.setValueAtTime(v, t);
      else param.value = v;
    } catch (e) { try { param.value = v; } catch (e2) {} }
  }

  // ---- ENGINE ---------------------------------------------------------------
  // Layered oscillators (sawtooth body + square buzz + sine sub) through a
  // lowpass, with a vibrato LFO detuning the body for a "living" idle.
  var ENGINE_BASE = 46;    // Hz at idle (fundamental)
  var ENGINE_SPAN = 150;   // Hz added at full rpm

  function startEngine() {
    var c = ac();
    if (!c || muted || eng) return;
    var m = ensureMaster();
    if (!m) return;
    try {
      var t = now();

      // voice mixer gain (the continuous engine level)
      var vGain = c.createGain();
      vGain.gain.value = 0.0001;

      // lowpass shapes timbre with rpm
      var lp = c.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 420;
      lp.Q.value = 6;

      // body: sawtooth (rich harmonics)
      var saw = c.createOscillator();
      saw.type = "sawtooth";
      saw.frequency.value = ENGINE_BASE;
      var sawG = c.createGain(); sawG.gain.value = 0.55;

      // buzz: square one octave-ish up, slightly detuned (mechanical grit)
      var sq = c.createOscillator();
      sq.type = "square";
      sq.frequency.value = ENGINE_BASE * 2;
      try { sq.detune.value = 8; } catch (e) {}
      var sqG = c.createGain(); sqG.gain.value = 0.18;

      // sub: sine half the fundamental for low-end thump
      var sub = c.createOscillator();
      sub.type = "sine";
      sub.frequency.value = ENGINE_BASE * 0.5;
      var subG = c.createGain(); subG.gain.value = 0.5;

      // vibrato LFO -> detune of body for a subtle wobble
      var lfo = c.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 11;
      var lfoG = c.createGain(); lfoG.gain.value = 6; // cents of detune swing
      lfo.connect(lfoG);
      try { lfoG.connect(saw.detune); } catch (e) {}

      // wiring
      saw.connect(sawG); sawG.connect(lp);
      sq.connect(sqG); sqG.connect(lp);
      sub.connect(subG); subG.connect(vGain); // sub bypasses lowpass for punch
      lp.connect(vGain);
      vGain.connect(m);

      saw.start(); sq.start(); sub.start(); lfo.start();

      // smooth fade-in to avoid pop
      ramp(vGain.gain, 0.0001, t);
      ramp(vGain.gain, 0.22, t + 0.12);

      eng = {
        saw: saw, sq: sq, sub: sub, lfo: lfo, lfoG: lfoG,
        lp: lp, vGain: vGain, lastRpm: 0, lastPop: 0
      };
    } catch (e) { eng = null; }
  }

  function stopEngine() {
    if (!eng) return;
    var e = eng;
    eng = null;
    try {
      var t = now();
      // fade out then stop, to avoid a click
      ramp(e.vGain.gain, e.vGain.gain.value, t);
      ramp(e.vGain.gain, 0.0001, t + 0.08);
      var stopT = t + 0.12;
      [e.saw, e.sq, e.sub, e.lfo].forEach(function (o) {
        try { o.stop(stopT); } catch (er) {}
      });
    } catch (er) {}
  }

  function engine(rpm01) {
    if (!eng) return;
    var r = +rpm01;
    if (!(r >= 0)) r = 0; if (r > 1) r = 1;
    try {
      var c = ac(); if (!c) return;
      var t = now();

      // a faux gear-shift dip: pull pitch back a touch in narrow bands as rpm
      // sweeps up (cosmetic; smoothed by setTargetAtTime so never clicks).
      var phase = (r * 3) % 1;            // 3 "gears" across the range
      var dip = phase < 0.12 ? (0.12 - phase) * 0.9 : 0; // brief drop on shift
      var rr = Math.max(0, r - dip);

      var fund = ENGINE_BASE + ENGINE_SPAN * rr;
      setTarget(eng.saw.frequency, fund, t, 0.05);
      setTarget(eng.sq.frequency, fund * 2, t, 0.05);
      setTarget(eng.sub.frequency, fund * 0.5, t, 0.05);

      // open up the filter and lift gain with rpm
      var cutoff = 400 + 4200 * rr;
      setTarget(eng.lp.frequency, cutoff, t, 0.06);
      var lvl = 0.16 + 0.16 * rr;
      setTarget(eng.vGain.gain, lvl, t, 0.06);

      // vibrato gets a little faster/deeper at high rpm
      setTarget(eng.lfo.frequency, 9 + 14 * rr, t, 0.1);
      setTarget(eng.lfoG.gain, 4 + 7 * rr, t, 0.1);

      // occasional exhaust "pop" at higher rpm
      if (rr > 0.55 && (t - eng.lastPop) > 0.18 && Math.random() < 0.06) {
        eng.lastPop = t;
        pop(0.6 + rr * 0.4);
      }
      eng.lastRpm = rr;
    } catch (e) {}
  }

  // short crackly exhaust pop layered over the running engine
  function pop(amt) {
    var c = ac(); if (!c || muted) return;
    var m = ensureMaster(); if (!m) return;
    try {
      var t = now();
      var s = noiseSource(); if (!s) return;
      var bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 1.2;
      var g = c.createGain(); g.gain.value = 0.0001;
      s.connect(bp); bp.connect(g); g.connect(m);
      s.start(t);
      setAt(g.gain, 0.0001, t);
      ramp(g.gain, 0.05 * amt, t + 0.004);
      expRamp(g.gain, 0.0001, t + 0.07);
      try { s.stop(t + 0.09); } catch (e) {}
    } catch (e) {}
  }

  // ---- ONE-SHOT SFX ---------------------------------------------------------
  // tonal blip with ADSR-ish exp decay
  function tone(freq, dur, type, vol, dest) {
    var c = ac(); if (!c) return;
    var m = dest || ensureMaster(); if (!m) return;
    try {
      var t = now();
      var o = c.createOscillator();
      o.type = type || "square";
      o.frequency.value = freq;
      var g = c.createGain();
      g.gain.value = 0.0001;
      o.connect(g); g.connect(m);
      o.start(t);
      setAt(g.gain, 0.0001, t);
      ramp(g.gain, vol, t + 0.008);
      expRamp(g.gain, 0.0001, t + dur);
      try { o.stop(t + dur + 0.03); } catch (e) {}
      return o;
    } catch (e) {}
  }

  function crash() {
    var c = ac(); if (!c || muted) return;
    var m = ensureMaster(); if (!m) return;
    try {
      var t = now();

      // 1) noise burst through a falling lowpass = the impact "splat"
      var s = noiseSource();
      if (s) {
        var lp = c.createBiquadFilter();
        lp.type = "lowpass"; lp.frequency.value = 4000;
        var ng = c.createGain(); ng.gain.value = 0.0001;
        s.connect(lp); lp.connect(ng); ng.connect(m);
        s.start(t);
        setAt(ng.gain, 0.0001, t);
        ramp(ng.gain, 0.5, t + 0.005);
        expRamp(ng.gain, 0.0001, t + 0.45);
        setAt(lp.frequency, 4500, t);
        expRamp(lp.frequency, 300, t + 0.4);
        try { s.stop(t + 0.5); } catch (e) {}
      }

      // 2) low thud: sine sweeping down for body/weight
      var o = c.createOscillator();
      o.type = "sine"; o.frequency.value = 160;
      var og = c.createGain(); og.gain.value = 0.0001;
      o.connect(og); og.connect(m);
      o.start(t);
      setAt(o.frequency, 180, t);
      expRamp(o.frequency, 45, t + 0.35);
      setAt(og.gain, 0.0001, t);
      ramp(og.gain, 0.55, t + 0.01);
      expRamp(og.gain, 0.0001, t + 0.4);
      try { o.stop(t + 0.45); } catch (e) {}
    } catch (e) {}
  }

  function coin() {
    if (muted) return;
    var c = ac(); if (!c) return;
    var m = ensureMaster(); if (!m) return;
    try {
      var t = now();
      // bright up-arpeggio
      var notes = [988, 1319, 1760]; // B5, E6, A6
      for (var i = 0; i < notes.length; i++) {
        var o = c.createOscillator();
        o.type = i === notes.length - 1 ? "triangle" : "square";
        o.frequency.value = notes[i];
        var g = c.createGain(); g.gain.value = 0.0001;
        o.connect(g); g.connect(m);
        var st = t + i * 0.045;
        o.start(st);
        setAt(g.gain, 0.0001, st);
        ramp(g.gain, 0.12, st + 0.006);
        expRamp(g.gain, 0.0001, st + 0.12);
        try { o.stop(st + 0.15); } catch (e) {}
      }
    } catch (e) {}
  }

  function whoosh() {
    if (muted) return;
    var c = ac(); if (!c) return;
    var m = ensureMaster(); if (!m) return;
    try {
      var t = now();
      var s = noiseSource(); if (!s) return;
      var bp = c.createBiquadFilter();
      bp.type = "bandpass"; bp.Q.value = 4;
      var g = c.createGain(); g.gain.value = 0.0001;
      s.connect(bp); bp.connect(g); g.connect(m);
      s.start(t);
      // sweep the bandpass up then down for a "swish" past the ear
      setAt(bp.frequency, 500, t);
      ramp(bp.frequency, 3200, t + 0.16);
      ramp(bp.frequency, 700, t + 0.34);
      setAt(g.gain, 0.0001, t);
      ramp(g.gain, 0.18, t + 0.08);
      expRamp(g.gain, 0.0001, t + 0.34);
      try { s.stop(t + 0.38); } catch (e) {}
    } catch (e) {}
  }

  function click() {
    if (muted) return;
    var c = ac(); if (!c) return;
    var m = ensureMaster(); if (!m) return;
    try {
      var t = now();
      var o = c.createOscillator();
      o.type = "square"; o.frequency.value = 660;
      var g = c.createGain(); g.gain.value = 0.0001;
      o.connect(g); g.connect(m);
      o.start(t);
      setAt(g.gain, 0.0001, t);
      ramp(g.gain, 0.09, t + 0.003);
      expRamp(g.gain, 0.0001, t + 0.05);
      try { o.stop(t + 0.07); } catch (e) {}
    } catch (e) {}
  }

  function setMuted(m) {
    muted = !!m;
    try {
      if (muted) {
        stopEngine();
        if (master) ramp(master.gain, 0.0, now() + 0.02);
      } else {
        ensureMaster();
        if (master) ramp(master.gain, 0.9, now() + 0.02);
      }
    } catch (e) {}
  }

  MOTO.Audio = {
    init: init,
    setMuted: setMuted,
    startEngine: startEngine,
    stopEngine: stopEngine,
    engine: engine,
    crash: crash,
    coin: coin,
    click: click,
    whoosh: whoosh
  };
})();
