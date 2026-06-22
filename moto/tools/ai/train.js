/* Offline trainer for the MOTO.AI neural driver policy.
 *
 * Pure JS, no ML libs. Optimises the MLP weights with a simple but effective
 * Evolution Strategy (Gaussian perturbations + rank-weighted recombination,
 * a.k.a. (mu/mu, lambda)-ES / NES-lite) against the traffic micro-sim in sim.js.
 *
 * Run:  node tools/ai/train.js [generations]
 * Output: prints progress and writes the trained weights as a JS literal to
 *         tools/ai/weights.json (and a ready-to-paste snippet).
 *
 * The result is embedded by hand into app/assets/js/ai.js (no runtime fetch).
 */
"use strict";
const fs = require("fs");
const path = require("path");
const sim = require("./sim.js");

const DIM = sim.paramCount();
const GENERATIONS = parseInt(process.argv[2] || "60", 10);
const POP = 32;          // lambda
const ELITE = 8;         // mu
const SIGMA0 = 0.6;
const SEED = 12345;

let rngState = SEED;
function rnd() {
  rngState |= 0; rngState = (rngState + 0x6D2B79F5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
function gauss() { // Box-Muller
  let u = 0, v = 0; while (u === 0) u = rnd(); while (v === 0) v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

// init mean weights small (Xavier-ish)
let mean = new Float64Array(DIM);
for (let i = 0; i < DIM; i++) mean[i] = gauss() * 0.3;
let sigma = SIGMA0;

console.log(`Training MLP policy: ${DIM} params, pop=${POP}, elite=${ELITE}, gens=${GENERATIONS}`);

let bestFlat = mean.slice();
let bestFit = -Infinity;

// rank weights for recombination (log-decreasing)
const wRank = new Float64Array(ELITE);
{
  let sum = 0;
  for (let i = 0; i < ELITE; i++) { wRank[i] = Math.log(ELITE + 0.5) - Math.log(i + 1); sum += wRank[i]; }
  for (let i = 0; i < ELITE; i++) wRank[i] /= sum;
}

for (let gen = 0; gen < GENERATIONS; gen++) {
  const pop = [];
  for (let p = 0; p < POP; p++) {
    const cand = new Float64Array(DIM);
    const noise = new Float64Array(DIM);
    for (let i = 0; i < DIM; i++) { noise[i] = gauss(); cand[i] = mean[i] + sigma * noise[i]; }
    const fit = sim.fitness(cand);
    pop.push({ cand, noise, fit });
  }
  pop.sort((a, b) => b.fit - a.fit);

  // recombine elite into new mean
  const newMean = new Float64Array(DIM);
  for (let e = 0; e < ELITE; e++) {
    const c = pop[e].cand, w = wRank[e];
    for (let i = 0; i < DIM; i++) newMean[i] += w * c[i];
  }
  mean = newMean;

  if (pop[0].fit > bestFit) { bestFit = pop[0].fit; bestFlat = pop[0].cand.slice(); }

  // adaptive sigma: shrink slowly to refine
  sigma *= 0.985;
  if (sigma < 0.06) sigma = 0.06;

  if (gen % 5 === 0 || gen === GENERATIONS - 1) {
    const meanFit = sim.fitness(mean);
    console.log(`gen ${String(gen).padStart(3)}  best=${pop[0].fit.toFixed(1)}  mean=${meanFit.toFixed(1)}  overall=${bestFit.toFixed(1)}  sigma=${sigma.toFixed(3)}`);
  }
}

// final: pick better of mean vs best-sampled
const meanFit = sim.fitness(mean);
let finalFlat = bestFlat, finalFit = bestFit;
if (meanFit > bestFit) { finalFlat = mean; finalFit = meanFit; }
console.log(`\nFinal fitness: ${finalFit.toFixed(1)}`);

// round to keep the embedded literal compact
const rounded = Array.from(finalFlat, x => Math.round(x * 10000) / 10000);

const meta = {
  arch: { in: sim.N_FEATURES, h1: sim.N_HIDDEN1, h2: sim.N_HIDDEN2, out: sim.N_OUT },
  shapes: sim.shapes(),
  fitness: Math.round(finalFit * 10) / 10,
  trainedAt: new Date().toISOString(),
  weights: rounded
};
fs.writeFileSync(path.join(__dirname, "weights.json"), JSON.stringify(meta, null, 0));
console.log(`Wrote weights.json (${rounded.length} params)`);

// also emit a paste-ready JS literal
const snippet =
  "// trained MLP weights (tools/ai/train.js); arch " +
  `${meta.arch.in}->${meta.arch.h1}->${meta.arch.h2}->${meta.arch.out}\n` +
  "var NN_W = [" + rounded.join(",") + "];\n";
fs.writeFileSync(path.join(__dirname, "weights.snippet.js"), snippet);

// quick behaviour audit
auditBehaviour(finalFlat);

function auditBehaviour(flat) {
  const P = sim.unpack(Float64Array.from(flat));
  console.log("\nBehaviour audit (action under typical scenarios per archetype):");
  const scenarios = [
    { name: "open road      ", gapAhead: 999, dvAhead: 0, gapLeft: 999, clearLeftBehind: 1, gapRight: 999, clearRightBehind: 1, laneFrac: 0.5, speedFrac: 0.6, density: 0.1 },
    { name: "blocked, L open ", gapAhead: 6, dvAhead: -10, gapLeft: 999, clearLeftBehind: 1, gapRight: 8, clearRightBehind: 1, laneFrac: 0.5, speedFrac: 0.5, density: 0.5 },
    { name: "blocked, boxed  ", gapAhead: 5, dvAhead: -12, gapLeft: 4, clearLeftBehind: 0, gapRight: 4, clearRightBehind: 0, laneFrac: 0.5, speedFrac: 0.4, density: 0.9 }
  ];
  for (const s of sim.ARCHETYPES) {
    let line = "  " + s.id.padEnd(11);
    for (const sc of scenarios) {
      const feats = sim.buildFeatures(Object.assign({}, sc, { pAggr: s.aggr, pPatience: s.patience, pSkill: s.skill }));
      const out = sim.forward(P, feats);
      const act = sim.decide(out, 0, Math.random);
      const dir = act.lane < 0 ? "L" : act.lane > 0 ? "R" : "-";
      line += "  [" + sc.name.trim() + ": " + dir + " v" + act.speedMul.toFixed(2) + "]";
    }
    console.log(line);
  }
}
