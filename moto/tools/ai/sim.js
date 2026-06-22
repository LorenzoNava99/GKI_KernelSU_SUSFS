/* Lightweight traffic micro-sim used for OFFLINE training of the MOTO.AI policy.
 *
 * Pure JS, no deps. A single straight multi-lane highway populated with cars
 * driven by the policy under test. The sim feeds each car an observation that
 * mirrors the runtime obs given to MOTO.AI.think() (gaps to neighbours, relative
 * speeds, lane position, personality), applies the returned action, integrates
 * motion, and accumulates a reward that rewards believable driving:
 *
 *   + forward progress
 *   + keeping safe following gaps (heavy penalty for collisions / near-misses)
 *   + smooth driving (penalise jerky speed + ping-pong lane flapping)
 *   + lane variety across the fleet (anti lane-lock)
 *   + behaviour that DIFFERS across personalities (penalise all-identical action)
 *
 * The feature layout here is the single source of truth — it MUST match the
 * `buildFeatures()` used at inference time inside app/assets/js/ai.js.
 */
"use strict";

const NUM_LANES = 4;
const LANE_LEN = 600;     // wrap-around ring road length (m)
const N_CARS = 24;
const DT = 0.12;          // matches the ~0.12s think cadence in game.js
const STEPS = 220;       // shorter episodes for tractable offline training

// ---- feature builder (shared contract with ai.js) --------------------------
// obs fields: own gap/dv ahead in lane; left & right lane gap+clear+behind;
// lane fraction; speed fraction; 3 personality dims; congestion estimate.
// Returns Float array length = N_FEATURES.
const N_FEATURES = 12;
const N_HIDDEN1 = 20;
const N_HIDDEN2 = 16;
const N_OUT = 4; // [logitLeft, logitStay, logitRight, speedTarget]

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

// Build features from a raw neighbour summary. `s` carries pre-computed gaps so
// the exact same math runs in the sim and (mirrored) in ai.js.
function buildFeatures(s) {
  return [
    clamp(s.gapAhead / 40, 0, 1),          // 0: room ahead in my lane
    clamp((s.dvAhead + 15) / 30, 0, 1),     // 1: closing speed ahead (0.5=matched)
    clamp(s.gapLeft / 40, 0, 1),            // 2: room ahead, left lane
    clamp(s.clearLeftBehind, 0, 1),         // 3: is left lane safe behind (1=safe)
    clamp(s.gapRight / 40, 0, 1),           // 4: room ahead, right lane
    clamp(s.clearRightBehind, 0, 1),        // 5: is right lane safe behind
    clamp(s.laneFrac, 0, 1),                // 6: lane position 0..1
    clamp(s.speedFrac, 0, 1),               // 7: my speed / max
    s.pAggr,                                // 8: personality aggression 0..1
    s.pPatience,                            // 9: personality patience 0..1
    s.pSkill,                               // 10: personality skill 0..1
    clamp(s.density, 0, 1)                  // 11: local congestion
  ];
}

// ---- MLP forward -----------------------------------------------------------
// weights packed as flat Float64Array; layout described in pack/unpack below.
function shapes() {
  return [
    [N_FEATURES, N_HIDDEN1],
    [N_HIDDEN1],
    [N_HIDDEN1, N_HIDDEN2],
    [N_HIDDEN2],
    [N_HIDDEN2, N_OUT],
    [N_OUT]
  ];
}
function paramCount() {
  return shapes().reduce((a, s) => a + (s.length === 2 ? s[0] * s[1] : s[0]), 0);
}
function unpack(flat) {
  const sh = shapes(); let o = 0; const out = [];
  for (const s of sh) {
    const n = s.length === 2 ? s[0] * s[1] : s[0];
    out.push(flat.subarray(o, o + n)); o += n;
  }
  return out; // [W1,b1,W2,b2,W3,b3]
}
function tanh(x) { return Math.tanh(x); }
function matvec(W, b, x, inN, outN, act) {
  const y = new Float64Array(outN);
  for (let j = 0; j < outN; j++) {
    let s = b[j];
    for (let i = 0; i < inN; i++) s += W[i * outN + j] * x[i];
    y[j] = act ? act(s) : s;
  }
  return y;
}
function forward(P, feats) {
  const h1 = matvec(P[0], P[1], feats, N_FEATURES, N_HIDDEN1, tanh);
  const h2 = matvec(P[2], P[3], h1, N_HIDDEN1, N_HIDDEN2, tanh);
  const out = matvec(P[4], P[5], h2, N_HIDDEN2, N_OUT, null);
  return out; // raw: 3 logits + speed pre-activation
}

// argmax over the 3 lane logits -> -1/0/+1; speed via sigmoid mapped to 0.5..1.3
function decide(out, explore, rng) {
  let l = out[0], s = out[1], r = out[2];
  if (explore) { l += explore * (rng() - 0.5); s += explore * (rng() - 0.5); r += explore * (rng() - 0.5); }
  let lane = 0, m = s;            // prefer stay on ties
  if (l > m) { m = l; lane = -1; }
  if (r > m) { m = r; lane = 1; }
  const speedMul = 0.5 + 0.8 * (1 / (1 + Math.exp(-out[3])));
  return { lane, speedMul };
}

// ---- personality space -----------------------------------------------------
// 4 archetypes spread across (aggression, patience, skill)
const ARCHETYPES = [
  { id: "cautious",   aggr: 0.15, patience: 0.85, skill: 0.7 },
  { id: "normal",     aggr: 0.45, patience: 0.55, skill: 0.65 },
  { id: "aggressive", aggr: 0.85, patience: 0.25, skill: 0.6 },
  { id: "erratic",    aggr: 0.6,  patience: 0.2,  skill: 0.3 }
];

// deterministic-ish RNG so episodes are repeatable per seed (fair comparisons)
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// run one episode, return reward. flat = candidate weights.
function episode(flat, seed) {
  const P = unpack(flat);
  const rng = mulberry32(seed);
  const cars = [];
  for (let i = 0; i < N_CARS; i++) {
    const arch = ARCHETYPES[i % ARCHETYPES.length];
    cars.push({
      lane: i % NUM_LANES,
      z: (i / N_CARS) * LANE_LEN + rng() * 4,
      v: 14 + rng() * 6,
      arch,
      target: i % NUM_LANES,
      prevLane: i % NUM_LANES,
      flapCount: 0,
      lastSpeedMul: 1,
      cross: 0  // mid lane-change progress
    });
  }
  const VMAX = 32;
  let reward = 0;
  let collisions = 0;
  const laneVisitsByArch = ARCHETYPES.map(() => new Set());
  const actionSig = ARCHETYPES.map(() => []);

  for (let step = 0; step < STEPS; step++) {
    // think for each car
    for (let i = 0; i < N_CARS; i++) {
      const c = cars[i];
      // summarise neighbours
      let gapAhead = 999, dvAhead = 0;
      let gapLeft = 999, clearLeftBehind = 1;
      let gapRight = 999, clearRightBehind = 1;
      let near = 0;
      for (let k = 0; k < N_CARS; k++) {
        if (k === i) continue;
        const o = cars[k];
        let dz = o.z - c.z;
        // ring wrap to nearest image
        if (dz > LANE_LEN / 2) dz -= LANE_LEN;
        if (dz < -LANE_LEN / 2) dz += LANE_LEN;
        if (Math.abs(dz) < 50) near++;
        const dLane = o.lane - c.lane;
        if (dLane === 0) {
          if (dz > 0 && dz < gapAhead) { gapAhead = dz; dvAhead = o.v - c.v; }
        } else if (dLane === -1) {
          if (dz > 0 && dz < gapLeft) gapLeft = dz;
          if (dz < 0 && dz > -8) clearLeftBehind = 0;
        } else if (dLane === 1) {
          if (dz > 0 && dz < gapRight) gapRight = dz;
          if (dz < 0 && dz > -8) clearRightBehind = 0;
        }
      }
      if (c.lane === 0) { gapLeft = 0; clearLeftBehind = 0; }
      if (c.lane === NUM_LANES - 1) { gapRight = 0; clearRightBehind = 0; }

      const feats = buildFeatures({
        gapAhead, dvAhead, gapLeft, clearLeftBehind, gapRight, clearRightBehind,
        laneFrac: c.lane / (NUM_LANES - 1),
        speedFrac: c.v / VMAX,
        pAggr: c.arch.aggr, pPatience: c.arch.patience, pSkill: c.arch.skill,
        density: near / 6
      });
      const out = forward(P, feats);
      const act = decide(out, 0.0, rng);

      // "blocked" = a slower car is close ahead in my lane (overtake justified)
      c._wasBlocked = (gapAhead < 18 && dvAhead < -1);
      c._changedThisStep = false;

      // reward taking a CLEAR adjacent lane to get around a slow car ahead:
      // turns blocking into an overtake instead of just braking. Scaled by
      // aggression so aggressive drivers overtake more eagerly.
      if (c._wasBlocked && c.cross <= 0) {
        const leftClear = c.lane > 0 && gapLeft > gapAhead + 6 && clearLeftBehind > 0.5;
        const rightClear = c.lane < NUM_LANES - 1 && gapRight > gapAhead + 6 && clearRightBehind > 0.5;
        if ((act.lane === -1 && leftClear) || (act.lane === 1 && rightClear)) {
          reward += 3.0 + 2.5 * c.arch.aggr;       // good overtake (strong)
        } else if (act.lane === 0 && (leftClear || rightClear)) {
          reward -= 1.0 + 1.0 * c.arch.aggr;       // missed an open overtake
        }
      }

      // apply lane decision with cooldown via cross progress
      let want = c.lane + act.lane;
      want = clamp(want, 0, NUM_LANES - 1);
      if (want !== c.target && c.cross <= 0) {
        c.prevLane = c.target;
        c.target = want;
        c.cross = 1;
        c._changedThisStep = true;
        if (c.target !== c.prevLane) c.flapCount++;
      }
      // smoothly move lane
      if (c.cross > 0) { c.cross -= DT * 2.2; if (c.cross <= 0) { c.lane = c.target; c.cross = 0; } }

      // speed
      const desired = act.speedMul * VMAX * (0.7 + 0.5 * c.arch.aggr);
      c.v += clamp(desired - c.v, -8 * DT * 8, 6 * DT * 8) * 0.5;
      c.v = clamp(c.v, 4, VMAX);
      c._jerk = Math.abs(act.speedMul - c.lastSpeedMul);
      c.lastSpeedMul = act.speedMul;

      laneVisitsByArch[i % ARCHETYPES.length].add(c.lane);
      if (step % 50 === 0) actionSig[i % ARCHETYPES.length].push(act.lane + "," + Math.round(act.speedMul * 4));
    }

    // integrate + per-car rewards
    for (let i = 0; i < N_CARS; i++) {
      const c = cars[i];
      c.z += c.v * DT;
      if (c.z >= LANE_LEN) c.z -= LANE_LEN;
      reward += c.v * DT * 0.012;                // progress (modest)
      reward -= c._jerk * 0.6;                   // smoothness (penalise jerky speed)

      // PERSONALITY-MATCHED cruising: each archetype has a preferred cruising
      // speed; reward driving near it (so aggressive!=cautious, not all maxed).
      // Wide spread (cautious ~15, aggressive ~31) to force distinct styles.
      const want = (0.45 + 0.55 * c.arch.aggr) * VMAX;
      reward -= Math.abs(c.v - want) * DT * 0.09;

      // LANE DISCIPLINE: penalise lane changes that weren't needed (no slow car
      // close ahead) — discourages random weaving, encourages purposeful
      // overtakes. Skilful drivers are penalised more for needless changes.
      if (c._changedThisStep && !c._wasBlocked) reward -= 0.3 * (0.5 + c.arch.skill);
    }
    // pairwise collision / safe-gap reward
    for (let i = 0; i < N_CARS; i++) {
      for (let k = i + 1; k < N_CARS; k++) {
        const a = cars[i], b = cars[k];
        if (a.lane !== b.lane) continue;
        let dz = Math.abs(a.z - b.z);
        if (dz > LANE_LEN / 2) dz = LANE_LEN - dz;
        if (dz < 5) { reward -= 8; collisions++; }     // collision (dominant)
        else if (dz < 14) reward -= (14 - dz) * 0.35;  // unsafe following gap
      }
    }
  }

  // lane-variety bonus across whole fleet
  let variety = 0;
  for (const set of laneVisitsByArch) variety += set.size;
  reward += variety * 1.5;

  // flapping penalty (ping-pong lane changes)
  let flaps = 0; for (const c of cars) flaps += c.flapCount;
  reward -= Math.max(0, flaps - N_CARS * 3) * 0.3;

  // DISTINCT-behaviour bonus: action signatures should differ across archetypes
  let distinct = 0;
  for (let a = 0; a < ARCHETYPES.length; a++) {
    for (let b = a + 1; b < ARCHETYPES.length; b++) {
      const sa = actionSig[a].join("|"), sb = actionSig[b].join("|");
      if (sa !== sb) distinct++;
      // also count differing entries
      const len = Math.min(actionSig[a].length, actionSig[b].length);
      let diff = 0; for (let t = 0; t < len; t++) if (actionSig[a][t] !== actionSig[b][t]) diff++;
      distinct += diff / Math.max(1, len);
    }
  }
  reward += distinct * 2.0;

  // hard collision-rate penalty so collisions dominate
  reward -= collisions * 0.5;

  return reward;
}

function fitness(flat) {
  // average over a few seeds for robustness
  let s = 0; const seeds = [1, 13];
  for (const sd of seeds) s += episode(flat, sd);
  return s / seeds.length;
}

module.exports = {
  NUM_LANES, N_FEATURES, N_HIDDEN1, N_HIDDEN2, N_OUT,
  ARCHETYPES, shapes, paramCount, unpack, forward, decide, buildFeatures,
  episode, fitness, mulberry32
};
