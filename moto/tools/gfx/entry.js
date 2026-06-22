// Bundle entry: produces a single classic IIFE that exposes the WebGPU stack as
// globals, so the game's classic <script> modules (which read window.THREE) work
// over file:// in the Android WebView — no ES modules / import maps / CORS.
import * as THREE from "three/webgpu";
import * as TSL from "three/tsl";
import { bloom } from "three/addons/tsl/display/BloomNode.js";
import { ao } from "three/addons/tsl/display/GTAONode.js";
import { traa } from "three/addons/tsl/display/TRAANode.js";
import { dof } from "three/addons/tsl/display/DepthOfFieldNode.js";
import { motionBlur } from "three/addons/tsl/display/MotionBlur.js";
import { smaa } from "three/addons/tsl/display/SMAANode.js";
import { fxaa } from "three/addons/tsl/display/FXAANode.js";
import { chromaticAberration } from "three/addons/tsl/display/ChromaticAberrationNode.js";
import { film } from "three/addons/tsl/display/FilmNode.js";
import { ssr } from "three/addons/tsl/display/SSRNode.js";
import { denoise } from "three/addons/tsl/display/DenoiseNode.js";

window.THREE = THREE;
window.TSL = TSL;
window.MOTOGFX = {
  version: THREE.REVISION,
  bloom, ao, traa, dof, motionBlur, smaa, fxaa, chromaticAberration, film, ssr, denoise
};
