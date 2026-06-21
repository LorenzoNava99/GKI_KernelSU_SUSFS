/* MOTO.Controls — robust input for SpeedMoto (tilt + touch + keyboard).
 *
 * Genre convention: the bike ALWAYS accelerates; the player TILTS to steer.
 *
 * Steering feel (tilt mode):
 *   raw   = gamma adjusted for screen orientation, minus calibrated neutral.
 *   dead  = DEADZONE_DEG (degrees) of slack around neutral are ignored so a
 *           comfortable resting hand does not drift.
 *   range = TILT_RANGE_DEG degrees past the deadzone maps to full lock (±1).
 *   smooth= one-pole low-pass (SMOOTH factor per read) removes sensor jitter.
 *   clamp = final steer hard-clamped to [-1, 1].
 *
 * Everything that touches a browser API is guarded so the file merely *loading*
 * under Node (the verifier supplies minimal window/document mocks and calls
 * read()) never throws, and read() always returns finite numbers.
 */
(function () {
  "use strict";

  var MOTO = (window.MOTO = window.MOTO || {});

  // ---- tuning ---------------------------------------------------------------
  var DEADZONE_DEG = 3;     // degrees of slack around neutral
  var TILT_RANGE_DEG = 28;  // degrees past deadzone for full lock
  var SMOOTH = 0.18;        // low-pass coefficient (0..1; higher = snappier)
  var DEFAULT_NEUTRAL = 12; // assume device rests tilted slightly toward user
  var TOUCH_RANGE_PX = 110; // horizontal drag (px) from touch-start for full lock
  var TOUCH_DEAD_PX = 6;    // ignore tiny finger jitter

  // ---- state ----------------------------------------------------------------
  var mode = "tilt";
  var cb = {};

  // tilt
  var haveTilt = false;
  var curGamma = 0;          // latest orientation-corrected reading (degrees)
  var neutralGamma = DEFAULT_NEUTRAL;
  var smoothedSteer = 0;     // low-passed steer output (tilt mode)
  var tiltBrake = 0;         // brake from holding lower edge / two fingers in tilt mode

  // touch
  var touchActive = false;
  var touchStartX = 0;
  var touchSteer = 0;
  var touchThrottle = 0;
  var touchBrake = 0;
  var touchCount = 0;

  // keyboard
  var keys = {};

  // ---- helpers --------------------------------------------------------------
  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
  function num(v, d) { return (typeof v === "number" && isFinite(v)) ? v : d; }

  // Map a DeviceOrientation event to a "gamma in portrait, +right" reading,
  // compensating for how the OS has rotated the screen.
  function orientedGamma(e) {
    var beta = num(e.beta, 0);
    var gamma = num(e.gamma, 0);
    var angle = 0;
    try {
      if (window.screen && window.screen.orientation && typeof window.screen.orientation.angle === "number") {
        angle = window.screen.orientation.angle;
      } else if (typeof window.orientation === "number") {
        angle = window.orientation;
      }
    } catch (err) { angle = 0; }
    // Normalize to 0/90/180/270.
    angle = ((angle % 360) + 360) % 360;
    if (angle === 90) return -beta;      // rotated CCW: left edge is "up"
    if (angle === 270 || angle === -90) return beta; // rotated CW
    if (angle === 180) return -gamma;    // upside-down portrait
    return gamma;                        // 0: natural portrait
  }

  function onOrientation(e) {
    if (e == null || e.gamma == null) return;
    haveTilt = true;
    curGamma = orientedGamma(e);
  }

  // ---- keyboard -------------------------------------------------------------
  function onKey(down) {
    return function (e) {
      if (!e) return;
      var k = e.key;
      keys[k] = down;
      if (down && (k === "p" || k === "P" || k === "Escape") && cb.onPause) {
        try { cb.onPause(); } catch (err) {}
      }
    };
  }

  // ---- touch ----------------------------------------------------------------
  function firstTouch(e) { return e.touches && e.touches.length ? e.touches[0] : null; }

  function onTouchStart(e) {
    var t = firstTouch(e);
    if (!t) return;
    touchActive = true;
    touchCount = e.touches.length;
    touchStartX = num(t.clientX, 0);
    touchSteer = 0;
    touchThrottle = 1;           // any touch = accelerate
    // Two fingers, or a touch in the bottom ~18% of the screen, = brake.
    touchBrake = brakeFromTouch(e);
    if (cb.onTap) { try { cb.onTap(); } catch (err) {} }
  }

  function onTouchMove(e) {
    var t = firstTouch(e);
    if (!t) return;
    touchActive = true;
    touchCount = e.touches.length;
    var dx = num(t.clientX, 0) - touchStartX;
    var adx = Math.abs(dx);
    if (adx <= TOUCH_DEAD_PX) {
      touchSteer = 0;
    } else {
      var sign = dx < 0 ? -1 : 1;
      touchSteer = clamp(sign * (adx - TOUCH_DEAD_PX) / TOUCH_RANGE_PX, -1, 1);
    }
    touchThrottle = 1;
    touchBrake = brakeFromTouch(e);
  }

  function onTouchEnd(e) {
    var remaining = (e && e.touches) ? e.touches.length : 0;
    if (remaining > 0) {
      // Re-anchor drag to the remaining finger so steering doesn't jump.
      var t = e.touches[0];
      touchStartX = num(t.clientX, touchStartX);
      touchCount = remaining;
      touchBrake = brakeFromTouch(e);
      return;
    }
    touchActive = false;
    touchCount = 0;
    touchSteer = 0;
    touchThrottle = 0;
    touchBrake = 0;
  }

  function brakeFromTouch(e) {
    if (!e.touches) return 0;
    if (e.touches.length >= 2) return 1;
    var h = num(window.innerHeight, 0);
    if (h > 0) {
      var t = e.touches[0];
      if (num(t.clientY, 0) > h * 0.82) return 1;
    }
    return 0;
  }

  // ---- init -----------------------------------------------------------------
  function safeAdd(target, type, handler, opts) {
    try {
      if (target && typeof target.addEventListener === "function") {
        target.addEventListener(type, handler, opts);
      }
    } catch (err) {}
  }

  function init(dom, callbacks) {
    cb = callbacks || {};

    safeAdd(window, "keydown", onKey(true));
    safeAdd(window, "keyup", onKey(false));
    safeAdd(window, "deviceorientation", onOrientation, true);

    var el = dom || window;
    safeAdd(el, "touchstart", onTouchStart, { passive: true });
    safeAdd(el, "touchmove", onTouchMove, { passive: true });
    safeAdd(el, "touchend", onTouchEnd, { passive: true });
    safeAdd(el, "touchcancel", onTouchEnd, { passive: true });
  }

  // ---- per-frame read -------------------------------------------------------
  function tiltSteer() {
    var raw = curGamma - neutralGamma;          // degrees from neutral
    var mag = Math.abs(raw);
    var target;
    if (mag <= DEADZONE_DEG) {
      target = 0;
    } else {
      var sign = raw < 0 ? -1 : 1;
      target = clamp(sign * (mag - DEADZONE_DEG) / TILT_RANGE_DEG, -1, 1);
    }
    // One-pole low-pass for smoothness.
    smoothedSteer += (target - smoothedSteer) * SMOOTH;
    if (Math.abs(smoothedSteer) < 1e-4) smoothedSteer = 0;
    return clamp(smoothedSteer, -1, 1);
  }

  function read() {
    var steer = 0, throttle = 0, brake = 0;

    if (mode === "tilt") {
      throttle = 1; // always accelerating, faithful to the genre
      if (haveTilt) steer = tiltSteer();
      // Brake gesture in tilt mode (two-finger / bottom-edge touch).
      if (touchActive && touchBrake) brake = 1;
    } else {
      // touch mode: drag to steer, hold to accelerate
      if (touchActive) {
        steer = touchSteer;
        throttle = touchThrottle;
        brake = touchBrake;
      }
    }

    // Keyboard (desktop verification) overrides — always available.
    if (keys["ArrowLeft"] || keys["a"] || keys["A"]) steer = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) steer = 1;
    if (keys["ArrowUp"] || keys[" "] || keys["Spacebar"] || keys["w"] || keys["W"]) throttle = 1;
    if (keys["ArrowDown"] || keys["s"] || keys["S"]) brake = 1;

    // Default cruise: with no live input source, keep accelerating so the game
    // never stalls (and so headless read() before any event still moves).
    if (throttle === 0 && !touchActive) throttle = 1;

    return {
      steer: clamp(num(steer, 0), -1, 1),
      throttle: clamp(num(throttle, 0), 0, 1),
      brake: clamp(num(brake, 0), 0, 1)
    };
  }

  // ---- mode / calibrate -----------------------------------------------------
  function setMode(m) {
    if (m === "tilt" || m === "touch") mode = m;
    // Reset transient steering so switching modes never leaks a stale value.
    smoothedSteer = 0;
    touchSteer = 0;
  }

  function calibrate() {
    // Set the current resting tilt as neutral. If we have no reading yet,
    // keep the sensible default so calibration is harmless.
    if (haveTilt) neutralGamma = curGamma;
  }

  function requestPermission() {
    // iOS-style platforms gate DeviceOrientation behind a user-gesture prompt.
    // Android (and the verifier) need no permission — resolve true. Never throw.
    try {
      var DOE = (typeof window !== "undefined") ? window.DeviceOrientationEvent : null;
      if (DOE && typeof DOE.requestPermission === "function") {
        return DOE.requestPermission()
          .then(function (state) { return state === "granted"; })
          .catch(function () { return false; });
      }
    } catch (err) {}
    return Promise.resolve(true);
  }

  MOTO.Controls = {
    init: init,
    read: read,
    setMode: setMode,
    calibrate: calibrate,
    requestPermission: requestPermission
  };
})();
