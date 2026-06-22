/* Embed the trained weights (tools/ai/weights.json) into the ai.js literal.
 *
 * Splices the flat weight array between the /*__WEIGHTS__*\/ and
 * /*__END_WEIGHTS__*\/ markers in app/assets/js/ai.js, replacing whatever NN_W
 * is currently there. Run after training:  node tools/ai/embed.js
 */
"use strict";
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const aiPath = path.join(root, "app", "assets", "js", "ai.js");
const meta = JSON.parse(fs.readFileSync(path.join(__dirname, "weights.json"), "utf8"));

const w = meta.weights;
const literal =
  "  // trained MLP weights — arch " +
  `${meta.arch.in}->${meta.arch.h1}->${meta.arch.h2}->${meta.arch.out}, ` +
  `${w.length} params, ES fitness ${meta.fitness} (regenerate: node tools/ai/train.js)\n` +
  "  var NN_W = [" + w.join(",") + "];";

let src = fs.readFileSync(aiPath, "utf8");
const re = /\/\*__WEIGHTS__\*\/[\s\S]*?\/\*__END_WEIGHTS__\*\//;
if (!re.test(src)) { console.error("markers not found in ai.js"); process.exit(1); }
src = src.replace(re, "/*__WEIGHTS__*/\n" + literal + "\n  /*__END_WEIGHTS__*/");
fs.writeFileSync(aiPath, src);
console.log(`Embedded ${w.length} weights into ${aiPath}`);
