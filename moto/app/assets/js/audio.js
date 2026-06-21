/* MOTO.Audio — STUB (WebAudio synth). Upgraded by Audio agent. Never throws. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});
  var ctx = null, muted = false;
  var eng = null; // {osc,gain}

  function ac() {
    if (ctx) return ctx;
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; }
    return ctx;
  }
  function init() { var c = ac(); if (c && c.state === "suspended") { try { c.resume(); } catch (e) {} } }

  function startEngine() {
    var c = ac(); if (!c || muted || eng) return;
    try {
      var osc = c.createOscillator(); osc.type = "sawtooth"; osc.frequency.value = 70;
      var g = c.createGain(); g.gain.value = 0.05;
      var lp = c.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 600;
      osc.connect(lp); lp.connect(g); g.connect(c.destination); osc.start();
      eng = { osc: osc, gain: g, lp: lp };
    } catch (e) {}
  }
  function stopEngine() { if (eng) { try { eng.osc.stop(); } catch (e) {} eng = null; } }
  function engine(rpm01) {
    if (!eng) return;
    try { eng.osc.frequency.value = 70 + rpm01 * 220; eng.lp.frequency.value = 500 + rpm01 * 2500; } catch (e) {}
  }
  function blip(freq, dur, type, vol) {
    var c = ac(); if (!c || muted) return;
    try {
      var o = c.createOscillator(); o.type = type || "square"; o.frequency.value = freq;
      var g = c.createGain(); g.gain.value = vol || 0.12;
      o.connect(g); g.connect(c.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + (dur || 0.1));
      o.stop(c.currentTime + (dur || 0.1) + 0.02);
    } catch (e) {}
  }

  MOTO.Audio = {
    init: init, setMuted: function (m) { muted = m; if (m) stopEngine(); },
    startEngine: startEngine, stopEngine: stopEngine, engine: engine,
    coin: function () { blip(1100, 0.09, "square", 0.1); },
    crash: function () { var c = ac(); if (!c || muted) return; blip(120, 0.4, "sawtooth", 0.25); },
    click: function () { blip(600, 0.05, "square", 0.08); },
    whoosh: function () { blip(300, 0.12, "sine", 0.06); }
  };
})();
