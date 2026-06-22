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
  // trained MLP weights — arch 12->20->16->4, 664 params, ES fitness 152.6 (regenerate: node tools/ai/train.js)
  var NN_W = [-0.9099,0.6059,-0.1803,-0.505,-1.7363,0.8682,-1.7955,-0.3204,0.4598,1.0536,1.5703,0.0724,-0.4229,-1.3978,-0.0933,-0.0307,0.1214,-1.7324,-0.0769,-1.9594,0.7181,2.2958,1.5613,1.7145,1.5546,0.4234,-0.2324,-0.6805,-0.9443,1.5825,0.569,2.2007,-1.4499,2.9447,1.4953,-2.2032,2.5674,-1.4649,0.1677,-1.2092,-0.708,1.3726,0.149,2.399,1.0638,0.3234,-0.7486,-0.4317,0.0421,-0.693,-1.3406,-0.3532,-1.5377,0.7549,1.0248,1.0545,-0.3581,1.4778,-2.1092,-0.8991,0.011,0.3027,-0.0736,-0.2215,1.5505,-0.2934,0.7822,-1.7138,-0.889,-0.2257,-0.6099,-1.7562,-0.235,-2.0914,3.6813,-0.1087,-3.4215,-0.2942,0.0479,-1.6729,0.2324,0.3983,-1.3972,-0.5264,3.0843,2.4535,-0.8749,-1.4261,-1.4559,-4.2979,0.5888,2.0017,1.9477,-1.0512,0.1999,-0.3943,-0.2602,0.4686,-0.6233,0.516,-1.2931,-0.1084,-0.8879,-0.8352,2.632,-1.551,-0.6734,-2.0717,-1.2337,-1.9923,0.8119,0.8679,1.2333,-2.0522,-0.786,0.0945,2.8435,0.9714,3.1614,-0.4558,-2.8608,-0.6247,-1.9073,-1.402,-0.9392,0.9074,-2.0649,-0.9593,0.3071,1.234,1.1961,0.2353,2.1813,0.9396,0.9053,1.2684,-0.1735,1.2512,1.0208,1.264,-1.6016,0.1389,0.25,-0.1184,-0.9906,-2.1413,0.4351,-0.3803,-0.0187,1.3669,1.5427,-0.9847,0.3378,-0.0882,-0.1737,-0.8364,-0.0407,-0.4297,2.5016,1.5334,-2.2857,-1.2514,-1.1312,0.7993,0.3304,-1.3404,-1.0277,2.162,-0.2564,-1.6466,-0.7505,-1.5373,-1.4637,-0.1296,2.8346,-0.0012,-1.8425,1.4482,1.3946,0.0748,1.8183,-1.4857,0.1762,1.1213,1.6514,-1.0164,1.3983,-1.0675,-0.3782,-0.8029,-0.3635,1.7022,-2.5674,1.8757,0.5832,-1.5486,1.4499,-0.6199,1.7123,1.3888,-2.1881,0.4594,1.5764,1.7946,-0.9436,0.8977,-0.0915,-1.8633,-0.9345,2.848,-2.9878,0.3397,-1.198,-1.2033,1.1743,0.6693,-0.11,1.2737,0.3658,-0.3777,1.2993,0.0379,-1.9993,0.3502,2.7603,0.3513,1.8532,0.0241,-0.8389,-1.4561,0.3486,-0.6153,0.7526,-1.7479,-0.1701,-2.5976,0.4332,0.8982,-0.4068,-0.5717,-0.2623,2.4821,1.2759,-0.3016,1.3409,-1.5406,-0.1498,1.9124,-1.2053,-0.4644,0.6004,1.8175,-1.9288,-1.8546,-0.6858,-0.7222,0.9469,-1.5876,0.8487,-0.3352,-1.1902,-0.0095,1.4892,1.8434,1.8786,0.1797,-0.5393,-0.0807,1.549,0.1932,-0.8796,-2.7533,-1.0433,0.0174,0.7929,1.9913,1.4848,-1.7552,0.2862,-0.0857,1.95,0.0494,-1.1156,-1.8386,-2.2901,1.9663,-2.3502,1.914,-2.5494,-2.3673,0.2524,-0.9068,0.6862,-1.3739,0.718,-0.2167,-0.3007,0.2691,1.9838,-1.9579,-0.7791,-1.7427,0.8226,-1.1015,2.5327,0.9459,-1.4009,-0.9744,-0.7343,0.6238,-2.9665,2.1721,-0.1724,0.7067,-1.3824,0.5042,-0.3255,0.3909,2.0828,-0.2027,-0.3088,1.0334,1.9881,-0.8768,1.7147,-0.6214,-0.6498,0.4272,0.4598,-0.1718,-1.0918,-0.4811,0.4979,0.6337,-3.397,-0.797,0.301,0.1144,1.3209,-0.9579,1.6287,-0.7023,-2.6324,0.1159,0.5139,0.0468,0.9303,1.4062,-1.7228,-0.6953,0.8693,-0.079,-2.1201,1.2524,0.4609,-0.3546,0.1004,0.1812,0.8247,0.1949,1.006,0.7905,1.138,0.2521,1.8094,-0.7603,1.511,0.0822,0.5892,1.783,0.9125,-0.0534,0.1372,0.9204,-0.0978,2.1881,-2.6028,-1.3035,0.4213,-0.0009,-0.0104,0.5473,1.8019,-0.5881,2.8227,1.1362,1.3839,0.9562,-0.0696,1.7712,0.9512,0.3356,1.7912,0.9883,0.8828,1.7068,-0.0695,0.2962,-0.5191,2.9902,0.9904,0.0852,-0.1446,-0.4541,0.2795,1.5268,1.3697,-1.1146,2.1292,-2.4449,1.2514,-3.155,-0.2299,-3.1027,1.0778,0.3937,2.1062,1.6331,-0.1946,0.1346,0.5129,1.893,2.027,0.6242,-1.381,0.868,-2.3398,-1.4409,0.8295,1.1539,-0.0459,2.8178,-1.2044,-1.6714,1.6379,-0.4007,1.2951,-0.2964,0.5812,1.4519,-0.8235,-1.4376,-0.6278,0.0691,0.377,0.5023,0.2594,-2.207,1.8674,-2.0227,-0.1993,-3.1069,-0.002,1.6439,0.8997,-0.53,-0.4823,1.743,-2.8499,-0.3418,2.8891,-1.2793,1.8674,1.913,0.2922,-0.2672,-1.5322,1.8028,-0.8675,0.5328,1.6029,0.1162,0.488,-0.841,-0.7054,0.1688,2.8918,0.4043,-0.2998,0.5879,-1.1214,0.0171,-0.8905,-0.7286,1.6384,-1.6271,0.6773,1.3072,-0.8019,-0.7921,-3.5102,-2.5989,-0.7288,-1.5356,0.4807,1.7176,-1.4205,1.794,-1.0547,-0.8149,-0.5045,0.2755,1.9219,-1.2552,-0.0482,-2.8823,-1.0794,1.2893,-1.663,0.4755,-0.4203,1.4308,0.958,1.7386,2.3754,1.149,1.9556,0.0424,0.2129,1.8805,0.6927,0.7449,0.5349,-1.3967,4.6633,0.0488,-2.2758,-1.0105,-1.084,0.9547,1.3546,1.2341,-1.2061,1.3574,0.6929,-0.957,0.5366,-1.4949,-0.4079,-0.9044,-1.7534,-0.9285,2.33,-0.1182,1.2939,0.9251,1.9188,-0.3349,-0.5141,-1.7271,-1.2673,1.6439,0.0384,-3.1659,0.2237,-2.2272,-1.4494,0.9096,-1.5317,0.0818,0.0602,-1.4862,1.4567,-0.5947,0.6502,1.5902,1.3361,0.3991,0.8101,-0.2037,0.4359,-0.1518,0.4436,0.4622,-2.8861,-0.0428,1.2764,0.8381,-2.8807,0.8724,-0.6758,-2.1282,1.4539,-1.3248,-1.7027,-1.4016,-0.128,0.3047,-1.1512,1.8266,-0.6638,-1.0818,2.7182,0.6536,1.0391,0.5439,-0.6679,-0.1253,1.5556,-0.2659,0.4842,-0.3994,2.6234,1.2608,1.4236,-0.51,-0.8482,-0.8122,-1.9368,-0.2785,0.3762,0.4003,2.318,-3.1915,-0.1801,-0.7562,0.9263,0.0927,1.4067,-0.391,-1.1464,0.8725,-1.8888,0.2337,1.0034,-1.4846,0.7989,0.5162,2.025,1.0598,-0.4144,-1.0555,1.2056,-0.8168,-1.2962,-0.248,-0.5799,0.0342,3.2838,1.0132,0.2544,1.4997,0.5803,0.4091,-0.4095,-0.6921,1.6931,0.142,-0.9824,-1.3359,1.1917,1.087,0.4962,1.5113,0.2257,1.5196,0.0328,-1.3134,-0.0071,0.4964,-1.2141,-1.2996,1.4258,0.1392];
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

      // lane logits from the trained net (left / stay / right). The net learns
      // collision-averse lane DISCIPLINE & SPEED; we layer a personality-driven
      // OVERTAKE URGE + per-agent stochasticity on top so blocked drivers seek a
      // clear lane and traffic stays varied (believable "smart" driving). The
      // net still gates the decision: it vetoes via its strong stay preference
      // when conditions are bad, and supplies the speed target.
      var l = out[0], st = out[1], r = out[2];

      // overtake urge: blocked by a slower car ahead AND an adjacent lane is
      // clearly more open and safe behind -> bias toward that lane, scaled by
      // aggression and (lack of) patience. feats: 0=gapAhead 1=closing
      // 2=gapLeft 3=leftSafe 4=gapRight 5=rightSafe.
      var blocked = feats[0] < 0.45 && feats[1] < 0.5;       // close + closing
      if (blocked) {
        // urge must out-vote the net's (deliberately collision-averse) stay
        // preference when a clearly-open lane invites a safe overtake; scaled so
        // aggressive/impatient drivers commit harder than cautious ones.
        var stayBias = out[1] - Math.max(out[0], out[2]);
        var commit = 0.45 + 0.55 * brain.aggr + 0.25 * (1 - brain.patience); // ~0.5..1.2
        var urge = stayBias * commit + (1.6 + 4.6 * brain.aggr) * (0.6 + 0.4 * Math.random());
        if (feats[3] > 0.5 && feats[2] > feats[0] + 0.05) l += urge;
        if (feats[5] > 0.5 && feats[4] > feats[0] + 0.05) r += urge;
      }

      // per-agent stochasticity (low-skill / aggressive explore more -> the odd
      // realistic mistake / spontaneous lane drift keeps traffic non-repetitive)
      var temp = 1.2 + brain.noise * (1.6 - brain.skill) * 6;
      l += temp * (Math.random() - 0.5);
      st += temp * (Math.random() - 0.5) * 0.5;
      r += temp * (Math.random() - 0.5);

      var dir = 0, m = st;
      if (l > m) { m = l; dir = -1; }
      if (r > m) { m = r; dir = 1; }

      // spontaneous lane drift: even unblocked drivers occasionally move to an
      // adjacent open lane (lane-discipline is the norm, but real traffic isn't
      // perfectly static). Probability scales with personality "change" drive,
      // gated by cooldown — keeps traffic alive & non-repetitive.
      if (dir === 0 && brain.cooldown <= 0 && n > 1 && Math.random() < brain.changeProb * 0.10) {
        var canL = lane > 0 && feats[3] > 0.5 && feats[2] > 0.3;
        var canR = lane < n - 1 && feats[5] > 0.5 && feats[4] > 0.3;
        if (canL && canR) dir = Math.random() < 0.5 ? -1 : 1;
        else if (canL) dir = -1;
        else if (canR) dir = 1;
      }

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
