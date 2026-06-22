/* MOTO.AI — on-device "smart traffic" driver intelligence.
 *
 * Each traffic vehicle gets a lightweight "brain": a personality (cautious /
 * normal / aggressive / erratic) plus a policy that decides, from a local
 * observation of neighbours, a desired lane and speed. The result is varied,
 * non-repetitive driving (lane discipline, overtaking, tailgating, the odd
 * reckless weaver) rather than cars locked in their lane.
 *
 * This is the FOUNDATION (a hand-authored stochastic policy). The AI agent
 * upgrades think() to a trained neural-network policy evaluated on the GPU
 * (WebGPU compute / TSL) with a JS fallback — same public API. Runs fine under
 * the headless verifier (pure JS, no GPU, never throws on load).
 *
 * Observation given to think():
 *   { lane, numLanes, speed, maxSpeed, player:{lane,dz}, ahead:[{lane,dz,dv}], dt }
 * Action returned:
 *   { targetLane:int, speedMul:0.5..1.3, blinker:-1|0|1 }
 */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  var mode = "heuristic"; // upgraded to 'neural-webgpu' / 'neural-js' by the AI agent
  var ready = true;

  var PERSON = [
    { id: "cautious",   gap: 26, speed: 0.82, change: 0.15, weight: 3 },
    { id: "normal",     gap: 18, speed: 0.96, change: 0.35, weight: 5 },
    { id: "aggressive", gap: 11, speed: 1.18, change: 0.7,  weight: 3 },
    { id: "erratic",    gap: 14, speed: 1.05, change: 0.9,  weight: 1 }
  ];

  function pickPersonality() {
    var total = 0, i; for (i = 0; i < PERSON.length; i++) total += PERSON[i].weight;
    var r = Math.random() * total;
    for (i = 0; i < PERSON.length; i++) { r -= PERSON[i].weight; if (r <= 0) return PERSON[i]; }
    return PERSON[1];
  }

  function init() {
    // The neural upgrade resolves with its chosen backend; foundation is sync.
    return Promise.resolve({ mode: mode });
  }

  function newAgent(spec) {
    var p = pickPersonality();
    return {
      person: p.id,
      gap: p.gap * (0.85 + Math.random() * 0.3),
      speedBias: p.speed * (0.92 + Math.random() * 0.16),
      changeProb: p.change,
      cooldown: 0,
      phase: Math.random() * 6.28,    // for erratic micro-weaving
      lane: spec && spec.lane != null ? spec.lane : 0
    };
  }

  // Hand-authored policy. Returns desired lane + speed multiplier.
  function think(brain, obs) {
    if (!brain || !obs) return { targetLane: obs ? obs.lane : 0, speedMul: 1, blinker: 0 };
    var lane = obs.lane;
    var n = obs.numLanes || 3;
    brain.cooldown -= obs.dt || 0;

    // find nearest vehicle ahead in my lane
    var aheadGap = 999, aheadDv = 0;
    var ah = obs.ahead || [];
    for (var i = 0; i < ah.length; i++) {
      if (ah[i].lane === lane && ah[i].dz > 0 && ah[i].dz < aheadGap) { aheadGap = ah[i].dz; aheadDv = ah[i].dv; }
    }

    var speedMul = brain.speedBias;
    // slow for a close car ahead
    if (aheadGap < brain.gap) {
      var t = aheadGap / brain.gap;
      speedMul *= 0.4 + 0.6 * t;
    }

    // consider a lane change when blocked, by personality, with a cooldown
    var targetLane = lane;
    var blinker = 0;
    if (brain.cooldown <= 0 && aheadGap < brain.gap * 1.2) {
      var cands = [];
      if (lane > 0) cands.push(lane - 1);
      if (lane < n - 1) cands.push(lane + 1);
      var best = lane, bestClear = aheadGap;
      for (var c = 0; c < cands.length; c++) {
        var ln = cands[c], clear = 999, safeBehind = true;
        for (var j = 0; j < ah.length; j++) {
          if (ah[j].lane === ln) {
            if (ah[j].dz > 0 && ah[j].dz < clear) clear = ah[j].dz;
            if (ah[j].dz < 0 && ah[j].dz > -8) safeBehind = false; // someone alongside/behind
          }
        }
        if (safeBehind && clear > bestClear + 4 && Math.random() < brain.changeProb) {
          best = ln; bestClear = clear;
        }
      }
      if (best !== lane) { targetLane = best; blinker = best > lane ? 1 : -1; brain.cooldown = 1.4; }
    }

    // proactive wander/overtake: even when not strictly blocked, drivers
    // occasionally drift to an adjacent open lane (keeps traffic alive & varied)
    if (targetLane === lane && brain.cooldown <= 0 && n > 1 && Math.random() < brain.changeProb * 0.05) {
      var opts = [];
      if (lane > 0) opts.push(lane - 1);
      if (lane < n - 1) opts.push(lane + 1);
      var to = opts[(Math.random() * opts.length) | 0];
      var blocked = false;
      for (var q = 0; q < ah.length; q++) {
        if (ah[q].lane === to && ah[q].dz < 18 && ah[q].dz > -10) { blocked = true; break; }
      }
      if (!blocked) { targetLane = to; blinker = to > lane ? 1 : -1; brain.cooldown = 1.6; }
    }

    // erratic drivers occasionally drift / surge
    if (brain.person === "erratic") {
      brain.phase += (obs.dt || 0) * 2.0;
      speedMul *= 1 + Math.sin(brain.phase) * 0.12;
      if (brain.cooldown <= 0 && Math.random() < 0.004 && n > 1) {
        targetLane = Math.max(0, Math.min(n - 1, lane + (Math.random() < 0.5 ? -1 : 1)));
        brain.cooldown = 1.0;
      }
    }

    if (targetLane !== lane) brain.lane = targetLane;
    return { targetLane: targetLane, speedMul: Math.max(0.45, Math.min(1.35, speedMul)), blinker: blinker };
  }

  MOTO.AI = {
    init: init,
    available: function () { return ready; },
    mode: function () { return mode; },
    newAgent: newAgent,
    think: think,
    describe: function () {
      return "Neural traffic: " + (mode === "heuristic" ? "behavior policy" : mode) +
             " — cautious/normal/aggressive/erratic drivers with lane discipline & overtaking.";
    }
  };
})();
