# Graphics & AI architecture (Pixel 9 Pro XL)

## Device facts that shaped the design
- **SoC/GPU:** Google Tensor G4 + **Arm Mali-G715 MP7** (7-core). It is the
  *non-Immortalis* configuration: **no hardware ray-tracing unit** and **no
  neural accelerator**. Full Vulkan 1.3 / OpenGL ES 3.2.
- **WebGPU** is enabled by default in Chrome / Android **WebView** (Chrome 121+,
  Android 12+, Arm GPUs) — so the latest browser graphics stack is available.
- **120Hz:** Android WebView's `requestAnimationFrame` is *not* 60-capped (that's
  an iOS limitation). The Activity requests the highest-refresh display mode via
  `WindowManager.LayoutParams.preferredDisplayModeId` + `preferredRefreshRate`.
- **TPU/NPU is unreachable for graphics here:** Google's Tensor NPU access
  (LiteRT Tensor delegate / Tensor ML SDK) is experimental, sign-up-gated and
  native-only; NNAPI is deprecated; **WebNN on Android is CPU-only** today. The
  NPU also isn't a rendering device. So "use the TPU" from a WebView game is not
  possible — and true *neural* upscaling (Arm NSS) needs next-gen Mali neural
  units the G715 lacks. We therefore get the DLSS *outcome* on the **GPU**.

## Rendering stack
- **Three.js `WebGPURenderer`** (WebGPU on-device, **automatic WebGL2 fallback**;
  a forced-WebGL retry guards the worst case). Node-material system + TSL.
- Shipped offline as a **single classic IIFE bundle** (`lib/moto-three.bundle.js`,
  built by `tools/gfx/build-bundle.sh` with esbuild). This avoids ES-module /
  import-map loading, which **fails over `file://`** in the WebView (null-origin
  CORS) — a real blocker we hit and designed around.
- Pipeline (`js/render.js`): ACES filmic tone mapping, sRGB output, PCF-soft
  shadows, and a TSL post chain (bloom now; GTAO / TRAA / motion-blur / DoF
  wired by the post pass). **Adaptive internal resolution** targets 120fps and
  presents at panel resolution — the "render low, present high" idea; combined
  with temporal AA this is the practical, GPU-based DLSS/FSR-style path
  (a dedicated TAAU node can replace it when we bump Three.js).

## On-device AI (the "smart NPC" feature)
- `js/ai.js` (`MOTO.AI`) gives every traffic vehicle a **driver brain**:
  a personality (cautious / normal / aggressive / erratic) plus a policy that,
  from a local observation of neighbours, decides a target lane and speed —
  producing lane discipline, overtaking, tailgating and the occasional reckless
  weaver. Result: varied, non-repetitive traffic instead of lane-locked cars.
- Foundation is a hand-authored stochastic policy; the AI agent upgrades
  `think()` to a trained MLP evaluated on the **GPU** (WebGPU compute / TSL) with
  a JS fallback — same API. (GPU, not NPU, since the NPU is unreachable.)

## Quality presets
`perf` / `balanced` / `ultra` (default) map to internal-resolution bounds,
shadow-map size and the effect budget; an adaptive controller moves the internal
resolution within those bounds to hold the target framerate.
