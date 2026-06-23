# SpeedMoto — Unity (native) build

This is the native version you asked for. I can't build or run Unity inside the
cloud container I work in (no GPU, no Unity Editor, and I won't sign into your
Google account), so the deal is: **I write all the code, you build it once.**

To keep my side reliable, the **entire game is built from one C# script at
runtime** — there are no scenes/prefabs/materials to hand-author (the fragile
part I can't do blind). You just drop the script onto an empty object.

## What you need
- **Unity 6 (6000.x LTS)** or **2022.3 LTS**, installed via Unity Hub, with
  **Android Build Support** ticked (it pulls the OpenJDK + Android SDK + NDK).

## Steps (5 minutes)
1. **New project** → template **"Universal 3D"** (URP). Name it `SpeedMoto`.
2. Copy **`unity/SpeedMoto/Assets/Scripts/SpeedMotoGame.cs`** from this repo into
   the new project's `Assets/` folder (Unity will generate the `.meta` itself).
3. Open the default **SampleScene**. **Delete the default "Directional Light"**
   (the script creates its own sun, so you'd otherwise double the lighting).
   Leave the **Main Camera**.
4. Create an empty GameObject (`GameObject ▸ Create Empty`), name it `Game`,
   and **Add Component ▸ Speed Moto Game**.
5. Press **Play** in the editor to sanity-check (arrow keys steer, ↓ brakes,
   Space retries).
6. **File ▸ Build Settings ▸ Android ▸ Switch Platform**, then
   **Player Settings ▸ Resolution and Presentation ▸ Default Orientation ▸
   Portrait**. Connect the phone and **Build And Run** (or Build to an APK).

## Controls (kept deliberately simple)
- Always accelerating.
- **Tilt** left/right to steer — auto-calibrated to however you're holding the
  phone when a run starts (so you can play from any position).
- **Touch the bottom of the screen** (thumb zone) to **brake**.

## What this slice has
Procedural straight 3-lane highway (recycled segments), tilt + thumb-brake
controls, traffic (cars/vans/trucks) you dodge, collision + retry, a chase
camera, URP lighting with a procedural sky + sun + soft shadows, distance/speed
HUD, 120 fps target.

## If it doesn't compile or run
Paste me the **exact Console error text** (and the Unity version). I can't see
your editor, so that error text is how I fix it — usually a one-line API tweak.
Once the slice runs on your phone, we expand it (better bike/car models, more
scenery, post-processing/bloom, garage, audio) the same way: I write code, you
build, you tell me what to change.
