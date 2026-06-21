/* MOTO.Controls — STUB (tilt + touch + keyboard). Upgraded by Controls agent. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});
  var mode = "tilt";
  var neutralGamma = 0, curGamma = 0, haveTilt = false;
  var keys = {};
  var touchSteer = 0, touchThrottle = 0, touchActive = false;
  var cb = {};

  function onKey(d) { return function (e) { keys[e.key] = d; if (d && e.key === "p" && cb.onPause) cb.onPause(); }; }

  function init(dom, callbacks) {
    cb = callbacks || {};
    window.addEventListener("keydown", onKey(true));
    window.addEventListener("keyup", onKey(false));
    window.addEventListener("deviceorientation", function (e) {
      if (e.gamma == null) return; haveTilt = true; curGamma = e.gamma;
    }, true);
    var el = dom || window;
    function touch(e) {
      if (!e.touches || !e.touches.length) { touchActive = false; touchSteer = 0; touchThrottle = 0; return; }
      touchActive = true; var t = e.touches[0];
      var w = window.innerWidth || 1;
      touchSteer = ((t.clientX / w) - 0.5) * 2; // left/right of screen
      touchThrottle = 1; // any touch = accelerate
      if (cb.onTap) cb.onTap();
    }
    el.addEventListener("touchstart", touch, { passive: true });
    el.addEventListener("touchmove", touch, { passive: true });
    el.addEventListener("touchend", function () { touchActive = false; touchSteer = 0; touchThrottle = 0; }, { passive: true });
  }

  function read() {
    var steer = 0, throttle = 0, brake = 0;
    if (mode === "tilt" && haveTilt) {
      steer = Math.max(-1, Math.min(1, (curGamma - neutralGamma) / 30));
      throttle = 1; // auto-throttle, faithful to the genre
    }
    if (touchActive) { steer = touchSteer; throttle = Math.max(throttle, touchThrottle); }
    if (keys["ArrowLeft"] || keys["a"]) steer = -1;
    if (keys["ArrowRight"] || keys["d"]) steer = 1;
    if (keys["ArrowUp"] || keys[" "]) throttle = 1;
    if (keys["ArrowDown"] || keys["s"]) brake = 1;
    if (!haveTilt && !touchActive && !keys["ArrowUp"] && !keys[" "]) throttle = 1; // default cruise
    return { steer: steer, throttle: throttle, brake: brake };
  }

  MOTO.Controls = {
    init: init, read: read,
    setMode: function (m) { mode = m; },
    calibrate: function () { neutralGamma = curGamma; },
    requestPermission: function () { return Promise.resolve(true); }
  };
})();
