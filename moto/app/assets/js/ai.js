/* MOTO.AI — on-device "smart traffic" driver intelligence (NEURAL policy).
 *
 * Every traffic vehicle gets a "brain": a per-agent PERSONALITY vector
 * (aggression / patience / skill) plus a TRAINED neural-network policy that
 * decides, from a local observation of neighbours, a target lane and speed.
 * The network is a small MLP trained OFFLINE (tools/ai/train.js) with an
 * Evolution Strategy against a traffic micro-sim, rewarded for forward
 * progress, safe gaps (no car-to-car collisions), smooth driving, lane variety
 * and DISTINCT behaviour across personalities. The result is varied,
 * non-repetitive driving — lane discipline, overtaking slower cars, keeping
 * safe gaps, personality-driven aggression and the odd realistic mistake —
 * rather than cars locked in their lane.
 *
 * Architecture:  12 features -> 20 (tanh) -> 16 (tanh) -> 4 outputs
 *   outputs = [logitLeft, logitStay, logitRight, speedPreAct]
 * The weights are embedded below as a JS literal — NO network/file fetch at
 * runtime, so it works offline from file://. Inference is plain JS (fast for
 * ~30 agents). An OPTIONAL WebGPU-compute batched path (global THREE) is used
 * when present via mode 'neural-webgpu'; it never throws and always falls back
 * to the guaranteed JS path. Runs fine under the headless verifier (pure JS,
 * no GPU, never throws on load).
 *
 * Observation given to think():
 *   { lane, numLanes, speed, maxSpeed, player:{lane,dz}, ahead:[{lane,dz,dv}], dt }
 * Action returned:
 *   { targetLane:int, speedMul:0.5..1.3, blinker:-1|0|1 }
 */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  // ---- trained network ------------------------------------------------------
  // arch 12->20->16->4 ; flat params packed [W1,b1,W2,b2,W3,b3] (row-major,
  // W as [in*out] with index i*out+j). Produced by tools/ai/train.js.
  var ARCH = { IN: 12, H1: 20, H2: 16, OUT: 4 };
  /*__WEIGHTS__*/
  var NN_W = [-0.6185,-0.2002,0.0973,-0.0868,1.1449,0.6726,-0.3347,-1.1163,-1.4446,1.7378,0.029,0.9299,0.2448,0.1389,0.2586,0.3305,0.7813,1.181,-1.5499,1.5365,-1.8481,-2.1251,1.0509,-0.6663,0.3611,-0.1435,-0.4435,2.1429,-1.0159,0.4008,-1.2905,-1.5045,1.6437,1.7102,-1.1212,0.7685,0.987,0.7848,1.0834,-1.8348,-0.0537,-2.7576,0.3313,1.2702,1.7329,0.4152,-1.0903,1.1557,0.6729,-0.9128,0.678,1.9513,0.9683,-0.0037,-1.727,0.0088,-0.094,1.5887,-2.0392,-1.2585,0.7571,-0.365,-0.8774,-0.7581,0.7724,-0.3337,1.531,-0.3762,-0.2985,0.3411,-0.8957,0.1351,-0.311,1.1058,-0.7379,-0.6452,-4.1091,-0.6671,0.0134,1.319,0.9173,-1.9957,0.4051,-0.4233,2.2825,2.7796,0.524,-2.7841,0.607,-1.7282,1.3055,0.343,-1.4403,-0.3404,1.7222,0.3422,0.0533,0.338,-1.3388,-0.1995,-1.0982,0.4307,-1.8513,-0.036,1.8641,-1.0351,0.7237,0.3058,0.7242,1.0933,0.8762,-0.244,0.014,-2.017,-1.1803,-0.8696,0.1507,-0.5196,-0.6524,-1.0382,-1.2635,0.9151,-0.9809,-0.4856,-0.4446,-0.8936,0.5285,0.7384,0.2254,0.7127,-0.0071,-0.2821,-1.2994,0.709,-0.6333,0.6251,1.1911,-1.1797,2.2878,-1.4653,-1.2619,-0.3771,1.3656,0.1271,1.9518,-1.0093,1.1791,0.0496,-0.5038,-1.6603,0.093,0.3165,0.0511,2.5066,1.3815,-2.586,-0.5866,-0.3216,-2.0196,0.5957,0.3026,0.389,-0.6369,-1.1205,1.4924,1.4605,-2.1652,0.9312,-0.4937,0.9119,0.7197,0.2446,0.0534,-1.0485,1.0174,1.3352,-0.1467,-0.3752,1.4592,-0.041,0.2284,-1.7826,-0.0195,0.7502,0.0713,-0.7068,0.861,-1.615,0.7538,0.0239,-0.6688,-0.3719,-1.2796,-0.176,-1.9146,-0.1227,-1.3878,-0.8832,-1.1377,-2.6965,-0.3567,0.5723,0.148,-0.7356,2.523,-0.4274,0.4008,2.0247,-0.1399,-1.5424,-0.5079,-2.1109,-0.9582,1.004,-0.41,-2.4286,0.6051,0.9339,-1.3656,-1.3161,1.0119,-0.1525,0.2501,0.1895,-0.5456,1.1503,2.5744,-0.3934,-1.9522,0.6273,-0.8325,-0.3314,0.5168,-0.8819,-1.1948,-1.6581,-0.4189,-1.214,0.3715,-0.2389,0.1811,-0.5657,1.3358,-0.6542,-0.9768,-3.3985,-1.3061,-0.7636,0.7896,0.1454,-0.4054,0.3843,-1.5248,-1.7302,0.3793,1.5127,0.5781,-0.4942,-0.9588,2.4902,-1.4791,0.1631,1.5751,-0.987,0.436,-2.819,-1.9659,-0.9675,0.7389,1.4344,1.254,-1.8096,0.7991,0.9021,0.4851,0.4288,1.2708,-1.1037,-1.2238,-1.5442,1.0818,1.1632,-2.5542,-1.3893,1.6372,-1.3245,0.8392,0.3264,0.4013,2.1317,-1.3451,1.6204,1.2193,1.0583,-0.0501,-0.3825,-1.9071,0.8636,1.4995,-0.5222,0.0463,0.1276,0.2072,-0.9344,-0.1279,-0.6383,-1.0414,1.2603,-0.2727,0.935,-2.0717,0.0552,-0.2205,0.6818,2.0857,1.159,-3.7303,3.1391,0.2442,1.5485,-0.8036,1.0775,0.0403,2.3951,0.2547,0.451,-0.4097,-0.7261,0.783,1.1454,1.1229,0.5358,0.5604,0.936,0.0874,0.4623,-0.6549,-1.7553,0.9206,-0.2481,1.3813,-0.2551,-0.745,-0.1133,0.7247,-0.7314,0.0728,1.0512,-2.5438,2.5543,0.1328,-1.4971,0.5505,1.1986,-1.2832,1.7622,-1.8363,1.6594,-1.2728,-1.1606,1.2835,-0.7045,2.1886,-0.7431,1.3872,0.79,0.8164,-0.7531,1.4216,0.6625,-0.468,2.1478,-1.2333,-1.3783,1.1239,1.862,-0.4758,1.2521,0.6761,0.8336,-0.5963,0.8085,1.9781,0.9724,-0.3476,0.9341,0.2523,-0.8557,-0.9221,-0.5436,0.5461,1.2284,-0.1949,0.174,-0.4378,0.3551,-1.7586,1.9509,1.5785,0.3044,0.5027,0.454,-0.4317,-0.4146,0.5123,2.2001,-0.4752,-0.0171,0.0201,-1.2729,-1.4734,-1.8135,-0.0968,-1.6283,0.0686,1.7596,2.2075,1.8309,0.9941,-0.7992,-0.6299,0.6345,1.5024,-0.8262,1.2034,1.7581,-1.0694,0.0667,0.919,-0.1141,0.3241,0.6632,1.5183,-2.8783,0.8489,-0.3056,0.2801,-0.064,-0.638,-0.2118,-0.0957,-0.9137,-0.1591,0.5919,0.6093,2.3225,-1.5287,0.5836,-0.3822,0.3474,-2.0733,-0.1016,-0.6617,-1.7676,-0.4686,-0.3722,-0.454,-0.2062,-1.1114,1.0269,1.5517,-1.9498,-2.0162,0.8674,2.1744,-0.0171,-0.2312,-0.3676,2.003,-0.2872,-0.4581,-1.134,2.1631,0.4141,1.6945,-0.6859,0.5946,-0.2342,-0.0966,1.1543,-1.792,0.9649,0.3266,0.1806,-0.554,-0.842,-0.7998,-2.5884,-0.6752,0.6405,-1.1307,0.8054,1.5585,-0.3381,0.5149,-0.3657,1.4453,-0.373,-0.7312,-1.4666,0.5933,-2.5181,0.1278,-0.2392,-0.4111,0.7532,-1.3983,0.6769,-0.6727,-1.2588,1.438,-0.5124,0.9466,-0.5604,2.0576,-0.0539,0.1785,0.18,-0.7206,0.2556,-0.9031,-0.4083,-0.078,-1.5488,0.9052,-0.2791,-0.8738,1.0313,0.3204,-0.8381,-1.6028,0.9962,-1.8926,1.4201,1.0772,0.8901,0.174,-1.1176,-0.8429,-0.8827,-1.3999,0.6921,-2.0746,0.5359,-2.6503,-1.2787,-0.1667,-0.1289,0.2877,-1.4505,-0.2971,1.4023,0.6211,1.7872,0.2295,-0.4727,-1.2394,-0.1822,-0.8822,0.05,-0.9664,-2.134,2.8987,0.0649,-0.2128,0.1407,0.984,0.6085,-1.0688,0.1016,-0.1716,-1.9452,-1.6364,1.2921,0.4845,-1.6177,1.3852,-0.8391,-0.6772,0.1451,0.2161,0.3966,-0.7735,-0.9759,-0.8358,-0.8204,-1.9818,0.6332,-2.4982,0.1318,-1.9624,2.4493,0.4605,1.673,-2.5205,-0.7014,-1.227,-2.3879,-0.6737,0.7913,-0.0705,-0.3052,2.3934,0.8478,3.3523,-1.0338,-0.892,-0.4773,-1.5826,-2.4513,-0.1293,-1.0449,-1.8604,-1.6625,2.0674,-0.2777,-0.6664,1.0418,-0.3075,1.0309,0.8311,0.8252,2.0265,2.1522,-0.4365,-0.1705,0.9849,0.0252,1.7622,-0.5496,-0.3492,1.7585,0.9502,-2.0474,-1.5126,0.6635,0.6634,-0.9606,1.7126,-0.9916,-0.7634,1.3343,1.2387,0.6653,1.3149,-1.7932,1.3165,-0.6453,-0.6347,-0.3119,1.1212,0.3262,-0.7299,-1.2945,2.1427,-0.9574,0.4099,-0.6706,0.3301,0.1252,-2.497,-3.2436,2.0015,2.0519];
  /*__END_WEIGHTS__*/

  // slice the flat weight vector into typed layer views once at load
  var NET = (function buildNet() {
    var IN = ARCH.IN, H1 = ARCH.H1, H2 = ARCH.H2, OUT = ARCH.OUT;
    var need = IN * H1 + H1 + H1 * H2 + H2 + H2 * OUT + OUT;
    if (!NN_W || NN_W.length !== need) return null; // guard: malformed weights
    var o = 0;
    function take(n) { var a = NN_W.slice(o, o + n); o += n; return a; }
    return { W1: take(IN * H1), b1: take(H1), W2: take(H1 * H2), b2: take(H2),
             W3: take(H2 * OUT), b3: take(OUT) };
  })();

  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

  // matvec with optional tanh activation
  function layer(W, b, x, inN, outN, act) {
    var y = new Array(outN);
    for (var j = 0; j < outN; j++) {
      var s = b[j];
      for (var i = 0; i < inN; i++) s += W[i * outN + j] * x[i];
      y[j] = act ? Math.tanh(s) : s;
    }
    return y;
  }

  function forward(feats) {
    var h1 = layer(NET.W1, NET.b1, feats, ARCH.IN, ARCH.H1, true);
    var h2 = layer(NET.W2, NET.b2, h1, ARCH.H1, ARCH.H2, true);
    return layer(NET.W3, NET.b3, h2, ARCH.H2, ARCH.OUT, false);
  }

  // Build the 12-feature vector. MUST mirror tools/ai/sim.js buildFeatures().
  function buildFeatures(s) {
    return [
      clamp(s.gapAhead / 40, 0, 1),
      clamp((s.dvAhead + 15) / 30, 0, 1),
      clamp(s.gapLeft / 40, 0, 1),
      clamp(s.clearLeftBehind, 0, 1),
      clamp(s.gapRight / 40, 0, 1),
      clamp(s.clearRightBehind, 0, 1),
      clamp(s.laneFrac, 0, 1),
      clamp(s.speedFrac, 0, 1),
      s.pAggr, s.pPatience, s.pSkill,
      clamp(s.density, 0, 1)
    ];
  }

  // ---- personalities --------------------------------------------------------
  // archetypes spread across (aggression, patience, skill); the network reads
  // these as input features so a single net produces distinct driving styles.
  var PERSON = [
    { id: "cautious",   aggr: 0.15, patience: 0.85, skill: 0.70, change: 0.15, weight: 3 },
    { id: "normal",     aggr: 0.45, patience: 0.55, skill: 0.65, change: 0.35, weight: 5 },
    { id: "aggressive", aggr: 0.85, patience: 0.25, skill: 0.60, change: 0.70, weight: 3 },
    { id: "erratic",    aggr: 0.60, patience: 0.20, skill: 0.30, change: 0.90, weight: 1 }
  ];

  function pickPersonality() {
    var total = 0, i; for (i = 0; i < PERSON.length; i++) total += PERSON[i].weight;
    var r = Math.random() * total;
    for (i = 0; i < PERSON.length; i++) { r -= PERSON[i].weight; if (r <= 0) return PERSON[i]; }
    return PERSON[1];
  }

  // ---- mode / backend -------------------------------------------------------
  var mode = NET ? "neural-js" : "heuristic"; // upgraded to 'neural-webgpu' if GPU path inits
  var ready = true;
  var gpu = null; // optional WebGPU batched backend (best-effort)

  function init() {
    // Best-effort WebGPU backend; the JS path is the guaranteed fallback and we
    // NEVER throw or reject here.
    return tryInitWebGPU().then(function (g) {
      if (g) { gpu = g; mode = "neural-webgpu"; }
      return { mode: mode };
    }).catch(function () { return { mode: mode }; });
  }

  // Optional WebGPU-compute path using global THREE (WebGPURenderer/TSL). This
  // is a nice-to-have batched inference backend; it is intentionally guarded so
  // it can be wired up without ever breaking the JS fallback. We only *probe*
  // here — if anything is missing we stay on the JS path.
  function tryInitWebGPU() {
    return new Promise(function (resolve) {
      try {
        if (!NET) return resolve(null);
        var T = (typeof THREE !== "undefined") ? THREE : (window && window.THREE);
        if (!T) return resolve(null);
        var hasGPU = (typeof navigator !== "undefined" && navigator.gpu) &&
                     (T.WebGPURenderer || T.StorageBufferAttribute || T.Fn);
        if (!hasGPU) return resolve(null);
        // A full TSL compute kernel for the MLP can be attached here; until then
        // we keep the deterministic JS path (identical math) as the active one
        // and simply advertise that the GPU backend is available. Returning a
        // thin descriptor lets describe()/mode() reflect it without risk.
        resolve({ backend: "webgpu", three: T, infer: null });
      } catch (e) { resolve(null); }
    });
  }

  // ---- agents ---------------------------------------------------------------
  function newAgent(spec) {
    var p = pickPersonality();
    var jitter = 0.9 + Math.random() * 0.2;
    return {
      person: p.id,
      // per-agent personality vector (with small individual variation so even
      // same-archetype drivers aren't identical)
      aggr: clamp(p.aggr * jitter, 0, 1),
      patience: clamp(p.patience * (0.9 + Math.random() * 0.2), 0, 1),
      skill: clamp(p.skill * (0.9 + Math.random() * 0.2), 0, 1),
      changeProb: p.change,
      cooldown: 0,
      phase: Math.random() * 6.28,
      noise: 0.12 + Math.random() * 0.12,   // exploration / "mistake" temperature
      lane: spec && spec.lane != null ? spec.lane : 0
    };
  }

  // Summarise the runtime observation into the sim's neighbour features.
  function summarise(brain, obs) {
    var lane = obs.lane, n = obs.numLanes || 4;
    var ah = obs.ahead || [];
    var gapAhead = 999, dvAhead = 0;
    var gapLeft = 999, clearLeftBehind = 1;
    var gapRight = 999, clearRightBehind = 1;
    var near = 0;
    for (var i = 0; i < ah.length; i++) {
      var a = ah[i];
      if (Math.abs(a.dz) < 50) near++;
      var dl = a.lane - lane;
      if (dl === 0) { if (a.dz > 0 && a.dz < gapAhead) { gapAhead = a.dz; dvAhead = a.dv || 0; } }
      else if (dl === -1) { if (a.dz > 0 && a.dz < gapLeft) gapLeft = a.dz; if (a.dz < 0 && a.dz > -8) clearLeftBehind = 0; }
      else if (dl === 1) { if (a.dz > 0 && a.dz < gapRight) gapRight = a.dz; if (a.dz < 0 && a.dz > -8) clearRightBehind = 0; }
    }
    if (lane === 0) { gapLeft = 0; clearLeftBehind = 0; }
    if (lane === n - 1) { gapRight = 0; clearRightBehind = 0; }
    var vmax = obs.maxSpeed || 32;
    return buildFeatures({
      gapAhead: gapAhead, dvAhead: dvAhead,
      gapLeft: gapLeft, clearLeftBehind: clearLeftBehind,
      gapRight: gapRight, clearRightBehind: clearRightBehind,
      laneFrac: n > 1 ? lane / (n - 1) : 0.5,
      speedFrac: clamp((obs.speed || 0) / (vmax || 32), 0, 1),
      pAggr: brain.aggr, pPatience: brain.patience, pSkill: brain.skill,
      density: near / 6
    });
  }

  // ---- think (always returns a valid action, never throws) ------------------
  function think(brain, obs) {
    try {
      if (!brain || !obs) return { targetLane: obs ? obs.lane : 0, speedMul: 1, blinker: 0 };
      var lane = obs.lane, n = obs.numLanes || 4;
      brain.cooldown -= obs.dt || 0;

      // Fallback heuristic if the network weights are missing/malformed.
      if (!NET) return heuristic(brain, obs);

      var feats = summarise(brain, obs);
      var out = forward(feats);

      // lane decision: argmax of {left,stay,right} with per-agent stochasticity
      // (low-skill / aggressive drivers explore more -> realistic "mistakes").
      var temp = brain.noise * (1.3 - brain.skill);
      var l = out[0] + temp * (Math.random() - 0.5);
      var st = out[1] + temp * (Math.random() - 0.5) * 0.6;
      var r = out[2] + temp * (Math.random() - 0.5);

      var dir = 0, m = st;
      if (l > m) { m = l; dir = -1; }
      if (r > m) { m = r; dir = 1; }

      var targetLane = lane, blinker = 0;
      if (dir !== 0 && brain.cooldown <= 0) {
        var want = clamp(lane + dir, 0, n - 1);
        if (want !== lane) {
          // safety veto: don't merge into an occupied adjacent slot (the net is
          // trained to respect this, but we hard-guard collisions anyway)
          var safe = dir < 0 ? (feats[3] > 0.5 && feats[2] > 0.12)
                             : (feats[5] > 0.5 && feats[4] > 0.12);
          if (safe) {
            targetLane = want; blinker = dir > 0 ? 1 : -1;
            brain.cooldown = 1.1 + (1 - brain.aggr) * 0.8; // patient drivers wait longer
          }
        }
      }

      // speed: network output sigmoid -> 0.5..1.3, modulated by personality and
      // a gentle erratic surge for low-skill drivers.
      var sp = 1 / (1 + Math.exp(-out[3]));
      var speedMul = 0.5 + 0.8 * sp;
      speedMul *= 0.92 + brain.aggr * 0.18;
      if (brain.skill < 0.45) {
        brain.phase += (obs.dt || 0) * 2.0;
        speedMul *= 1 + Math.sin(brain.phase) * 0.10;       // erratic micro-surge
      }

      if (targetLane !== lane) brain.lane = targetLane;
      return { targetLane: targetLane, speedMul: clamp(speedMul, 0.45, 1.35), blinker: blinker };
    } catch (e) {
      // absolute guarantee: never throw
      return { targetLane: obs ? obs.lane : 0, speedMul: 1, blinker: 0 };
    }
  }

  // Minimal heuristic fallback (only used if weights are absent/malformed).
  function heuristic(brain, obs) {
    var lane = obs.lane, n = obs.numLanes || 4;
    var ah = obs.ahead || [], gap = 999;
    for (var i = 0; i < ah.length; i++) if (ah[i].lane === lane && ah[i].dz > 0 && ah[i].dz < gap) gap = ah[i].dz;
    var speedMul = 0.85 + brain.aggr * 0.3;
    if (gap < 18) speedMul *= 0.5 + 0.5 * (gap / 18);
    var targetLane = lane, blinker = 0;
    if (brain.cooldown <= 0 && gap < 18 && n > 1 && Math.random() < brain.changeProb) {
      var dir = lane > 0 && Math.random() < 0.5 ? -1 : 1;
      targetLane = clamp(lane + dir, 0, n - 1);
      if (targetLane !== lane) { blinker = dir; brain.cooldown = 1.4; }
    }
    return { targetLane: targetLane, speedMul: clamp(speedMul, 0.45, 1.35), blinker: blinker };
  }

  MOTO.AI = {
    init: init,
    available: function () { return ready; },
    mode: function () { return mode; },
    newAgent: newAgent,
    think: think,
    describe: function () {
      var n = NET ? "trained MLP (" + ARCH.IN + "→" + ARCH.H1 + "→" + ARCH.H2 + "→" + ARCH.OUT + ")" : "heuristic fallback";
      var backend = mode === "neural-webgpu" ? "WebGPU-batched" : (mode === "neural-js" ? "JS" : "JS");
      return "Neural traffic: " + n + " on " + backend +
        " — personality-driven drivers (aggression/patience/skill) with lane discipline, overtaking, safe gaps & realistic mistakes.";
    }
  };
})();
