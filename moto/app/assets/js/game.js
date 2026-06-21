/* SpeedMoto — gameplay core (MOTO.World).
 * Player physics, traffic spawn/recycle, collision, coins, scoring, difficulty.
 * Pure simulation over a Three.js scene; rendering/camera live in main.js. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  var SPAWN_Z = -220;     // where traffic/coins appear ahead
  var CULL_Z = 38;        // behind player -> recycle
  var LANE_W = 3.6;

  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  function World(opts) {
    this.scene = opts.scene;
    this.env = opts.env;
    this.stats = opts.stats || { topSpeed: 200, accel: 0.6, handling: 0.6 };
    this.bike = opts.bikeGroup;

    this.numLanes = (this.env && this.env.numLanes) || 3;
    this.laneCenters = (this.env && this.env.laneCenters) ||
      this._defaultLanes(this.numLanes);
    this.roadHalf = ((this.env && this.env.roadWidth) || this.numLanes * LANE_W) / 2 - 0.6;

    this.playerX = 0;
    this.playerVX = 0;
    this.speed = 22;                          // m/s, current
    this.baseSpeed = 20;                       // idle cruise
    this.maxSpeed = (this.stats.topSpeed || 200) / 3.6; // km/h -> m/s
    this.accelRate = 14 + (this.stats.accel || 0.6) * 22;
    this.handling = 14 + (this.stats.handling || 0.6) * 16; // lateral m/s
    this.distance = 0;
    this.coins = 0;
    this.crashed = false;
    this.events = [];

    this.traffic = [];
    this.coinObjs = [];
    this._spawnTimer = 0;
    this._coinTimer = 0.6;
    this._t = 0;

    if (this.bike) { this.bike.position.set(0, 0, 0); this.scene.add(this.bike); }

    // player collision footprint (m)
    this.pW = 0.95; this.pL = 2.1;
  }

  World.prototype._defaultLanes = function (n) {
    var arr = [], start = -(n - 1) / 2;
    for (var i = 0; i < n; i++) arr.push((start + i) * LANE_W);
    return arr;
  };

  // difficulty 0..1 ramps over ~3km
  World.prototype._difficulty = function () { return clamp(this.distance / 3000, 0, 1); };

  World.prototype.update = function (dt, input) {
    if (this.crashed) return;
    this._t += dt;
    var diff = this._difficulty();

    // ---- longitudinal ----
    var throttle = input ? input.throttle : 1;
    var brake = input ? input.brake : 0;
    var want = this.baseSpeed + throttle * (this.maxSpeed - this.baseSpeed);
    if (brake > 0) want = Math.max(8, want - brake * 40);
    var a = this.accelRate * (throttle > 0.05 ? 1 : 0.4);
    if (want > this.speed) this.speed += Math.min(a * dt, want - this.speed);
    else this.speed -= Math.min(a * dt, this.speed - want);
    this.speed = clamp(this.speed, 6, this.maxSpeed);
    this.distance += this.speed * dt;

    // ---- lateral (tilt/touch steer) ----
    var steer = input ? input.steer : 0;
    var targetVX = steer * this.handling;
    this.playerVX += (targetVX - this.playerVX) * Math.min(1, dt * 10);
    this.playerX += this.playerVX * dt;
    if (this.playerX < -this.roadHalf) { this.playerX = -this.roadHalf; this.playerVX = 0; }
    if (this.playerX > this.roadHalf) { this.playerX = this.roadHalf; this.playerVX = 0; }

    if (this.bike) {
      this.bike.position.x = this.playerX;
      this.bike.rotation.z = -clamp(this.playerVX / this.handling, -1, 1) * 0.32; // lean
      this.bike.rotation.y = -clamp(this.playerVX / this.handling, -1, 1) * 0.12;
      this.bike.position.y = Math.sin(this._t * 22) * 0.012; // vibration
    }

    // ---- spawn traffic ----
    var spawnGap = clamp(1.15 - diff * 0.8, 0.32, 1.2); // seconds between spawns
    this._spawnTimer -= dt;
    if (this._spawnTimer <= 0) { this._spawnTimer = spawnGap * (0.7 + Math.random() * 0.6); this._spawnTraffic(diff); }

    this._coinTimer -= dt;
    if (this._coinTimer <= 0) { this._coinTimer = 0.5 + Math.random() * 0.9; this._spawnCoins(); }

    // ---- move + collide traffic ----
    var i, o;
    for (i = this.traffic.length - 1; i >= 0; i--) {
      o = this.traffic[i];
      var closing = this.speed - o.v; // m/s, player overtakes slower traffic
      o.z += closing * dt;
      o.group.position.z = o.z;
      // collision (AABB in x,z) when near player band
      if (o.z > -this.pL && o.z < this.pL && !o.passed) {
        if (Math.abs(o.x - this.playerX) < (o.w + this.pW) * 0.5 &&
            Math.abs(o.z) < (o.l + this.pL) * 0.5) {
          this.crashed = true; this.events.push("crash"); return;
        }
      }
      // near-miss feedback
      if (!o.passed && o.z > 0) {
        o.passed = true;
        if (Math.abs(o.x - this.playerX) < (o.w + this.pW) * 0.5 + 0.7) this.events.push("nearmiss");
      }
      if (o.z > CULL_Z) { this._recycle(o, i); }
    }

    // ---- move + collect coins ----
    for (i = this.coinObjs.length - 1; i >= 0; i--) {
      o = this.coinObjs[i];
      o.z += this.speed * dt;
      o.group.position.z = o.z;
      o.group.rotation.y += dt * 6;
      if (!o.got && o.z > -this.pL && o.z < this.pL &&
          Math.abs(o.x - this.playerX) < 1.1) {
        o.got = true; this.coins += 1; this.events.push("coin");
        this.scene.remove(o.group); this.coinObjs.splice(i, 1); continue;
      }
      if (o.z > CULL_Z) { this.scene.remove(o.group); this.coinObjs.splice(i, 1); }
    }
  };

  World.prototype._laneX = function (lane) { return this.laneCenters[lane]; };

  World.prototype._spawnTraffic = function (diff) {
    var kinds;
    try { kinds = MOTO.Models.trafficKinds(); } catch (e) { kinds = [{ kind: "car", w: 1.8, l: 4.4, h: 1.5, weight: 1 }]; }
    // weighted pick
    var total = 0, k; for (k = 0; k < kinds.length; k++) total += (kinds[k].weight || 1);
    var r = Math.random() * total, chosen = kinds[0];
    for (k = 0; k < kinds.length; k++) { r -= (kinds[k].weight || 1); if (r <= 0) { chosen = kinds[k]; break; } }

    // choose a lane; sometimes leave at least one lane open near high difficulty
    var lane = (Math.random() * this.numLanes) | 0;
    var g;
    try { g = MOTO.Models.traffic(chosen.kind); } catch (e) { g = null; }
    if (!g) return;
    var x = this._laneX(lane);
    g.position.set(x, 0, SPAWN_Z - Math.random() * 40);
    this.scene.add(g);
    var trafficSpeed = (8 + Math.random() * 10) + diff * 6; // m/s
    this.traffic.push({ group: g, kind: chosen.kind, lane: lane, x: x,
      z: g.position.z, v: trafficSpeed, w: chosen.w, l: chosen.l, passed: false });
  };

  World.prototype._spawnCoins = function () {
    var n = 3 + ((Math.random() * 4) | 0);
    var lane = (Math.random() * this.numLanes) | 0;
    var x = this._laneX(lane);
    var z0 = SPAWN_Z - Math.random() * 30;
    for (var i = 0; i < n; i++) {
      var g; try { g = MOTO.Models.coin(); } catch (e) { g = null; }
      if (!g) return;
      var z = z0 - i * 3.2;
      g.position.set(x, 1.1, z);
      this.scene.add(g);
      this.coinObjs.push({ group: g, x: x, z: z, got: false });
    }
  };

  World.prototype._recycle = function (o, idx) {
    this.scene.remove(o.group);
    if (o.group.traverse) o.group.traverse(function (c) {
      if (c.geometry && c.geometry.dispose) {} // geometry shared via factory; don't dispose
    });
    this.traffic.splice(idx, 1);
  };

  Object.defineProperty(World.prototype, "speedKmh", { get: function () { return this.speed * 3.6; } });
  Object.defineProperty(World.prototype, "rpm01", {
    get: function () {
      var range = this.maxSpeed - this.baseSpeed;
      return clamp(range > 0 ? (this.speed - this.baseSpeed) / range : 0.5, 0.05, 1);
    }
  });

  World.prototype.dispose = function (scene) {
    var i;
    if (this.bike) scene.remove(this.bike);
    for (i = 0; i < this.traffic.length; i++) scene.remove(this.traffic[i].group);
    for (i = 0; i < this.coinObjs.length; i++) scene.remove(this.coinObjs[i].group);
    this.traffic.length = 0; this.coinObjs.length = 0;
  };

  MOTO.World = { create: function (opts) { return new World(opts); } };
})();
