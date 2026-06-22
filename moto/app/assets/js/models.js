/* MOTO.Models — procedural model factory (high-fidelity).
 * Conforms to docs/CONTRACT.md. THREE is global (WebGPURenderer build, r179).
 * Faces -Z. Origin at ground-center: all wheels/bodies rest on y = 0.
 * No imports, no external assets — everything built in code.
 *
 * Materials: MeshPhysicalMaterial (clearcoat automotive paint), MeshStandard,
 * with emissive lights/markings so the bloom post-pass makes them glow.
 * Spinnable wheels are exposed on every vehicle via group.userData.wheels
 * (array of meshes whose local +X is the axle, so the game can roll them). */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  // ---- material / geometry helpers ----------------------------------------
  // Standard PBR (guarded — THREE may be a permissive mock under the verifier).
  function std(c, metal, rough, emissive, emissiveI) {
    var p = {
      color: c,
      metalness: metal == null ? 0.3 : metal,
      roughness: rough == null ? 0.6 : rough,
      emissive: emissive == null ? 0x000000 : emissive
    };
    if (emissiveI != null) p.emissiveIntensity = emissiveI;
    try { return new THREE.MeshStandardMaterial(p); }
    catch (e) { return new THREE.MeshStandardMaterial(); }
  }

  // Glossy automotive paint: clearcoat lacquer over metallic basecoat.
  function paint(c, metal) {
    try {
      return new THREE.MeshPhysicalMaterial({
        color: c,
        metalness: metal == null ? 0.55 : metal,
        roughness: 0.32,
        clearcoat: 1.0,
        clearcoatRoughness: 0.06,
        reflectivity: 0.6
      });
    } catch (e) { return std(c, 0.5, 0.35); }
  }

  // Tinted automotive glass (dark, glossy, slightly transmissive look).
  function glassMat(c, rough) {
    try {
      return new THREE.MeshPhysicalMaterial({
        color: c == null ? 0x0a1014 : c,
        metalness: 0.0,
        roughness: rough == null ? 0.08 : rough,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        transmission: 0.18,
        ior: 1.45,
        reflectivity: 0.5,
        envMapIntensity: 1.2
      });
    } catch (e) { return std(0x0a1014, 0.5, 0.12); }
  }

  function mesh(geo, m) {
    var o = new THREE.Mesh(geo, m);
    o.castShadow = true; o.receiveShadow = true;
    return o;
  }
  function box(w, h, l, m) { return mesh(new THREE.BoxGeometry(w, h, l), m); }

  // ---- shared, reusable materials (mobile triangle/material budget) --------
  var GLASS = glassMat(0x0a1014, 0.08);          // dark tinted window glass
  var TIRE = std(0x0c0c0e, 0.0, 0.92);           // rubber sidewall
  var TREAD = std(0x070708, 0.0, 0.98);          // darker tread band
  var CHROME = std(0xe2e8ee, 0.98, 0.08);        // bright chrome
  var BRUSHED = std(0xb6bdc4, 0.85, 0.34);       // brushed/satin metal
  var DARK_METAL = std(0x23272c, 0.7, 0.42);
  var BLACK_PLASTIC = std(0x111316, 0.2, 0.7);
  var RIM = std(0xc3cad1, 0.92, 0.22);           // alloy rim
  var RIM_DARK = std(0x3a4047, 0.85, 0.35);      // dark alloy
  var DISC = std(0x8b9197, 0.9, 0.35);           // brake disc
  var HEADLIGHT = std(0xfff7e0, 0.1, 0.15, 0xfff2c8, 2.4);
  var TAILLIGHT = std(0x5a0000, 0.2, 0.3, 0xff1a1a, 2.6);
  var TAIL_AMBER = std(0x4a2a00, 0.2, 0.3, 0xff8a00, 2.0);
  var SEAT_MAT = std(0x141416, 0.05, 0.85);
  var PLATE = std(0xf2f2ee, 0.1, 0.5, 0x0a0a08, 0.05);
  var SUIT = std(0x21262e, 0.1, 0.62);
  var SUIT_ACCENT = std(0xc62828, 0.1, 0.5);
  var HELMET = std(0xeef2f6, 0.35, 0.22);
  var VISOR = std(0x0b1116, 0.7, 0.12, 0x0a1a22, 0.6);
  var GLOVE = std(0x0d0f12, 0.1, 0.6);
  var BOOT = std(0x111114, 0.1, 0.55);
  var SKIN = std(0xcf9b6e, 0.0, 0.78);

  // ---- shared wheel geometry ----------------------------------------------
  var BIKE_TIRE_GEO = new THREE.CylinderGeometry(0.34, 0.34, 0.13, 22);
  var BIKE_TREAD_GEO = new THREE.CylinderGeometry(0.345, 0.345, 0.10, 22);
  var BIKE_RIM_GEO = new THREE.CylinderGeometry(0.20, 0.20, 0.135, 6);
  var BIKE_HUB_GEO = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 10);
  var BIKE_DISC_GEO = new THREE.CylinderGeometry(0.18, 0.18, 0.02, 18);
  var SPOKE_GEO = new THREE.BoxGeometry(0.018, 0.34, 0.018);

  var CAR_TIRE_GEO = new THREE.CylinderGeometry(0.36, 0.36, 0.22, 20);
  var CAR_TREAD_GEO = new THREE.CylinderGeometry(0.365, 0.365, 0.18, 20);
  var CAR_RIM_GEO = new THREE.CylinderGeometry(0.225, 0.225, 0.225, 5);
  var CAR_HUB_GEO = new THREE.CylinderGeometry(0.06, 0.06, 0.235, 10);
  var ALLOY_SPOKE_GEO = new THREE.BoxGeometry(0.045, 0.40, 0.045);

  // A spoked motorcycle wheel. Returned mesh-group spins about its local +X.
  function bikeWheel() {
    var g = new THREE.Group();
    var t = mesh(BIKE_TIRE_GEO, TIRE); t.rotation.z = Math.PI / 2; g.add(t);
    var tr = mesh(BIKE_TREAD_GEO, TREAD); tr.rotation.z = Math.PI / 2; g.add(tr);
    var rim = mesh(BIKE_RIM_GEO, RIM); rim.rotation.z = Math.PI / 2; g.add(rim);
    var hub = mesh(BIKE_HUB_GEO, CHROME); hub.rotation.z = Math.PI / 2; g.add(hub);
    // brake disc on one side
    var d = mesh(BIKE_DISC_GEO, DISC); d.rotation.z = Math.PI / 2; d.position.x = -0.085; g.add(d);
    // a few spokes for detail
    for (var i = 0; i < 5; i++) {
      var s = mesh(SPOKE_GEO, BRUSHED);
      s.rotation.x = (i / 5) * Math.PI;
      g.add(s);
    }
    return g;
  }
  // A 5-spoke alloy car wheel; spins about local +X.
  function carWheel(dark) {
    var g = new THREE.Group();
    var t = mesh(CAR_TIRE_GEO, TIRE); t.rotation.z = Math.PI / 2; g.add(t);
    var tr = mesh(CAR_TREAD_GEO, TREAD); tr.rotation.z = Math.PI / 2; g.add(tr);
    var rim = mesh(CAR_RIM_GEO, dark ? RIM_DARK : RIM); rim.rotation.z = Math.PI / 2; g.add(rim);
    var hub = mesh(CAR_HUB_GEO, CHROME); hub.rotation.z = Math.PI / 2; g.add(hub);
    for (var i = 0; i < 5; i++) {
      var s = mesh(ALLOY_SPOKE_GEO, dark ? RIM_DARK : RIM);
      s.rotation.x = (i / 5) * Math.PI;
      g.add(s);
    }
    return g;
  }

  // ===========================================================================
  //  BIKE CATALOG
  // ===========================================================================
  // style: 'street' | 'cruiser' | 'sport' | 'naked' | 'hyper'
  var CATALOG = [
    { id: "street",  name: "Street 600",  colorHex: 0xff3b30, price: 0,     topSpeed: 190, accel: 0.55, handling: 0.62, desc: "Balanced free starter.", style: "street" },
    { id: "cruiser", name: "Road Cruiser",colorHex: 0xffb300, price: 1200,  topSpeed: 172, accel: 0.45, handling: 0.50, desc: "Long, heavy & steady.",  style: "cruiser" },
    { id: "sport",   name: "Sport RR",    colorHex: 0x0a84ff, price: 3500,  topSpeed: 232, accel: 0.82, handling: 0.74, desc: "Faired & fast, twitchy.", style: "sport" },
    { id: "naked",   name: "Naked GT",    colorHex: 0x34c759, price: 6000,  topSpeed: 214, accel: 0.70, handling: 0.88, desc: "Stripped & super agile.", style: "naked" },
    { id: "hyper",   name: "Hyperbike",   colorHex: 0xaf52de, price: 12000, topSpeed: 262, accel: 0.95, handling: 0.80, desc: "Top-tier hypersport.",  style: "hyper" }
  ];

  function findSpec(list, key, val) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val) return list[i];
    return list[0];
  }

  // Build a posed rider leaning forward (group origin at ground y=0).
  function buildRider(crouch, accentMat) {
    var r = new THREE.Group();
    var lean = 0.22 + crouch * 0.48;
    var suit = SUIT;

    // pelvis / hips
    var hip = box(0.34, 0.22, 0.30, suit); hip.position.set(0, 0.94, 0.20); r.add(hip);

    // torso, leaning forward toward the bars, with an accent chest panel
    var torso = box(0.40, 0.58, 0.28, suit);
    torso.position.set(0, 1.28, 0.02); torso.rotation.x = lean; r.add(torso);
    var chest = box(0.30, 0.26, 0.06, accentMat || SUIT_ACCENT);
    chest.position.set(0, 1.34, -0.13); chest.rotation.x = lean; r.add(chest);

    // shoulders
    var sh = mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.46, 10), suit);
    sh.rotation.z = Math.PI / 2; sh.position.set(0, 1.50 - crouch * 0.05, -0.04); r.add(sh);

    // neck
    var neck = mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), SKIN);
    neck.position.set(0, 1.56 - crouch * 0.10, -0.08); r.add(neck);

    // head + helmet + glowing visor
    var head = new THREE.Group();
    var hg = mesh(new THREE.SphereGeometry(0.155, 18, 14), HELMET);
    hg.scale.set(1.0, 1.05, 1.12); head.add(hg);
    var visor = mesh(new THREE.SphereGeometry(0.135, 16, 10), VISOR);
    visor.scale.set(1.02, 0.55, 0.7); visor.position.set(0, -0.01, -0.10); head.add(visor);
    var crest = box(0.04, 0.06, 0.18, accentMat || SUIT_ACCENT);
    crest.position.set(0, 0.13, 0.0); head.add(crest);
    head.position.set(0, 1.66 - crouch * 0.16, -0.16 - crouch * 0.22);
    r.add(head);

    // arms reaching forward to the bars
    function arm(side) {
      var upper = mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 8), suit);
      upper.position.set(side * 0.21, 1.40, -0.16); upper.rotation.x = -0.6 - crouch * 0.2; r.add(upper);
      var fore = mesh(new THREE.CylinderGeometry(0.05, 0.055, 0.34, 8), suit);
      fore.position.set(side * 0.22, 1.26 - crouch * 0.06, -0.40); fore.rotation.x = -1.0 - crouch * 0.3; r.add(fore);
      var hand = box(0.09, 0.09, 0.10, GLOVE);
      hand.position.set(side * 0.22, 1.14 - crouch * 0.12, -0.52); r.add(hand);
    }
    arm(-1); arm(1);

    // legs tucked back to the pegs
    function leg(side) {
      var thigh = mesh(new THREE.CylinderGeometry(0.08, 0.075, 0.42, 8), suit);
      thigh.position.set(side * 0.14, 0.82, 0.32); thigh.rotation.x = -0.55; r.add(thigh);
      var shin = mesh(new THREE.CylinderGeometry(0.065, 0.06, 0.42, 8), suit);
      shin.position.set(side * 0.17, 0.50, 0.20); shin.rotation.x = 0.75; r.add(shin);
      var boot = box(0.12, 0.12, 0.22, BOOT);
      boot.position.set(side * 0.17, 0.30, 0.06); r.add(boot);
    }
    leg(-1); leg(1);

    return r;
  }

  function makeBike(id) {
    var spec = findSpec(CATALOG, "id", id);
    var col = spec.colorHex;
    var style = spec.style;
    var g = new THREE.Group();
    var bodyMetal = (style === "cruiser") ? 0.7 : 0.55;
    var body = paint(col, bodyMetal);
    var accent = paint(col, 0.6);

    // style-driven proportions
    var wheelbase, tankH, tankL, seatY, crouch, faired, hasWind, spoked;
    switch (style) {
      case "cruiser": wheelbase = 0.98; tankH = 0.32; tankL = 0.78; seatY = 0.74; crouch = 0.0; faired = false; hasWind = false; spoked = true;  break;
      case "sport":   wheelbase = 0.78; tankH = 0.40; tankL = 0.95; seatY = 0.92; crouch = 1.0; faired = true;  hasWind = true;  spoked = false; break;
      case "naked":   wheelbase = 0.80; tankH = 0.42; tankL = 0.80; seatY = 0.90; crouch = 0.5; faired = false; hasWind = false; spoked = false; break;
      case "hyper":   wheelbase = 0.82; tankH = 0.44; tankL = 1.00; seatY = 0.94; crouch = 0.9; faired = true;  hasWind = true;  spoked = false; break;
      default:        wheelbase = 0.82; tankH = 0.38; tankL = 0.82; seatY = 0.86; crouch = 0.4; faired = false; hasWind = false; spoked = false; break; // street
    }

    var frontZ = -wheelbase, rearZ = wheelbase;

    // wheels (spinnable children)
    var wf = bikeWheel(); wf.position.set(0, 0.34, frontZ); g.add(wf);
    var wr = bikeWheel(); wr.position.set(0, 0.34, rearZ); g.add(wr);

    // front fork (two tubes) + lower sliders
    function fork(side) {
      var f = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.64, 8), CHROME);
      f.position.set(side * 0.07, 0.66, frontZ - 0.02); f.rotation.x = -0.42; g.add(f);
      var slider = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.26, 8), DARK_METAL);
      slider.position.set(side * 0.085, 0.46, frontZ); slider.rotation.x = -0.42; g.add(slider);
    }
    fork(-1); fork(1);

    // triple clamp / steering head
    var clamp = box(0.16, 0.08, 0.10, DARK_METAL);
    clamp.position.set(0, 0.80, frontZ + 0.02); clamp.rotation.x = -0.4; g.add(clamp);

    // swingarm to rear wheel
    var swing = box(0.07, 0.07, wheelbase, BRUSHED);
    swing.position.set(0.12, 0.36, 0.2); g.add(swing);
    var swing2 = box(0.07, 0.07, wheelbase, BRUSHED);
    swing2.position.set(-0.12, 0.36, 0.2); g.add(swing2);

    // rear mono-shock
    var shock = mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.34, 8), accent);
    shock.position.set(0, 0.58, 0.42); shock.rotation.x = 0.3; g.add(shock);

    // engine block (finned, dark) + cylinder head
    var engine = box(0.34, 0.36, 0.56, DARK_METAL);
    engine.position.set(0, 0.48, 0.04); g.add(engine);
    var head = box(0.30, 0.18, 0.30, BRUSHED);
    head.position.set(0, 0.66, -0.02); g.add(head);

    // frame/tank (glossy paint)
    var tank = mesh(new THREE.BoxGeometry(0.36, tankH, tankL, 1, 1, 1), body);
    tank.position.set(0, seatY + 0.04, -0.10); g.add(tank);
    var tankTop = box(0.30, 0.06, tankL * 0.8, accent);
    tankTop.position.set(0, seatY + 0.04 + tankH / 2, -0.10); g.add(tankTop);

    // fairing (sport/hyper get a swept nose + side panels)
    if (faired) {
      var nose = mesh(new THREE.CylinderGeometry(0.05, 0.24, 0.58, 12), body);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, seatY - 0.04, frontZ + 0.20); g.add(nose);
      for (var sgn = -1; sgn <= 1; sgn += 2) {
        var sideF = box(0.10, 0.40, 0.70, body);
        sideF.position.set(sgn * 0.20, 0.52, -0.28); g.add(sideF);
        var belly = box(0.34, 0.14, 0.5, accent);
        belly.position.set(0, 0.34, -0.05); g.add(belly);
      }
    } else {
      // exposed frame trellis hints for naked/street/cruiser
      var frame = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), BRUSHED);
      frame.position.set(0.13, 0.62, -0.18); frame.rotation.x = 0.5; g.add(frame);
      var frame2 = mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.7, 8), BRUSHED);
      frame2.position.set(-0.13, 0.62, -0.18); frame2.rotation.x = 0.5; g.add(frame2);
    }

    // seat + tail cowl
    var seat = box(0.32, 0.10, 0.55, SEAT_MAT);
    seat.position.set(0, seatY + 0.12, 0.30); g.add(seat);
    var tail = mesh(new THREE.CylinderGeometry(0.04, 0.16, 0.34, 10), body);
    tail.rotation.x = Math.PI / 2;
    tail.position.set(0, seatY + 0.16, rearZ - 0.14); g.add(tail);

    // handlebars (clip-ons low for faired, risers high otherwise)
    var bar = mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 8), DARK_METAL);
    bar.rotation.z = Math.PI / 2;
    var barY = faired ? 0.82 : 1.02;
    bar.position.set(0, barY, frontZ + 0.12); g.add(bar);
    for (var hs = -1; hs <= 1; hs += 2) {
      var grip = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.12, 8), BLACK_PLASTIC);
      grip.rotation.z = Math.PI / 2; grip.position.set(hs * 0.21, barY, frontZ + 0.12); g.add(grip);
    }

    // mirrors for street/cruiser/naked
    if (!faired) {
      for (var ms = -1; ms <= 1; ms += 2) {
        var stalk = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.18, 6), DARK_METAL);
        stalk.position.set(ms * 0.22, barY + 0.10, frontZ + 0.10); g.add(stalk);
        var mir = box(0.10, 0.06, 0.02, GLASS);
        mir.position.set(ms * 0.26, barY + 0.18, frontZ + 0.08); g.add(mir);
      }
    }

    // headlight — emissive so it blooms
    var hlGeo = faired ? new THREE.SphereGeometry(0.13, 14, 10) : new THREE.SphereGeometry(0.11, 14, 10);
    var hl = mesh(hlGeo, HEADLIGHT);
    if (faired) hl.scale.set(1.3, 0.7, 0.5);
    hl.position.set(0, seatY - 0.02, frontZ - 0.18); g.add(hl);

    // taillight — emissive red
    var tl = mesh(new THREE.BoxGeometry(0.16, 0.06, 0.04), TAILLIGHT);
    tl.position.set(0, seatY + 0.16, rearZ + 0.0); g.add(tl);

    // exhaust system (chrome header + can)
    var header = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8), CHROME);
    header.position.set(0.10, 0.30, -0.1); header.rotation.x = 0.8; g.add(header);
    var can = mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.65, 12), CHROME);
    can.rotation.x = Math.PI / 2 + 0.04;
    can.position.set(0.20, 0.42, 0.55); g.add(can);
    var tip = mesh(new THREE.CylinderGeometry(0.085, 0.075, 0.06, 12), DARK_METAL);
    tip.rotation.x = Math.PI / 2; tip.position.set(0.20, 0.43, 0.88); g.add(tip);

    // license plate at the rear
    var plate = box(0.20, 0.10, 0.02, PLATE);
    plate.position.set(0, seatY - 0.05, rearZ + 0.16); g.add(plate);

    // tinted windscreen for sportier bikes
    if (hasWind) {
      var wind = mesh(new THREE.BoxGeometry(0.30, 0.24, 0.03), GLASS);
      wind.position.set(0, seatY + 0.22, frontZ + 0.06); wind.rotation.x = -0.55; g.add(wind);
    }

    // rider
    g.add(buildRider(crouch, accent));

    // expose spinnable wheels for the game (local +X is the axle)
    try { g.userData = g.userData || {}; g.userData.wheels = [wf, wr]; } catch (e) {}
    return g;
  }

  // ===========================================================================
  //  TRAFFIC
  // ===========================================================================
  var TKINDS = [
    { kind: "car",   w: 1.8,  l: 4.4,  h: 1.45, weight: 5 },
    { kind: "taxi",  w: 1.85, l: 4.5,  h: 1.50, weight: 2 },
    { kind: "van",   w: 2.0,  l: 5.2,  h: 2.20, weight: 2 },
    { kind: "truck", w: 2.5,  l: 9.0,  h: 3.50, weight: 2 },
    { kind: "bus",   w: 2.6,  l: 11.0, h: 3.20, weight: 1 }
  ];

  // tasteful per-spawn palettes (varied but believable)
  var CAR_PALETTE = [0xc62828, 0x1565c0, 0x2e7d32, 0xf5f5f5, 0x2b2f33, 0x6a1b9a, 0xef6c00, 0x00838f, 0x9e9e9e, 0xb71c1c];
  var VAN_PALETTE = [0xeceff1, 0xb0bec5, 0x90a4ae, 0xcfd8dc, 0xe0e0e0, 0xbdbdbd];
  var TRUCK_PALETTE = [0x37474f, 0x5d4037, 0x455a64, 0x263238, 0x4e342e, 0x1565c0];
  var BUS_PALETTE = [0xe53935, 0xfb8c00, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa];
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  // 4-wheel layout with spinnable wheels collected into out[].
  function addWheels(g, w, l, out, dark) {
    var r = 0.36;
    var dx = w / 2 - 0.04;
    var dz = l / 2 - 0.85;
    var positions = [[-dx, r, -dz], [dx, r, -dz], [-dx, r, dz], [dx, r, dz]];
    for (var i = 0; i < positions.length; i++) {
      var wh = carWheel(dark);
      wh.position.set(positions[i][0], positions[i][1], positions[i][2]);
      g.add(wh);
      if (out) out.push(wh);
    }
  }

  // headlights (front = -z, white emissive) + taillights (rear = +z, red emissive)
  function addLights(g, w, l, frontY, rearY) {
    var hx = w / 2 - 0.30;
    function light(geo, mat, x, y, z) { var m = mesh(geo, mat); m.position.set(x, y, z); g.add(m); }
    var hg = new THREE.BoxGeometry(0.28, 0.16, 0.06);
    light(hg, HEADLIGHT, -hx, frontY, -l / 2 - 0.01);
    light(hg, HEADLIGHT, hx, frontY, -l / 2 - 0.01);
    var tg = new THREE.BoxGeometry(0.24, 0.14, 0.05);
    light(tg, TAILLIGHT, -hx, rearY, l / 2 + 0.01);
    light(tg, TAILLIGHT, hx, rearY, l / 2 + 0.01);
  }

  // small white license plate (front & rear)
  function addPlates(g, w, l, frontY, rearY) {
    var pg = new THREE.BoxGeometry(0.34, 0.12, 0.02);
    var pf = mesh(pg, PLATE); pf.position.set(0, frontY, -l / 2 - 0.02); g.add(pf);
    var pr = mesh(pg, PLATE); pr.position.set(0, rearY, l / 2 + 0.02); g.add(pr);
  }

  function makeCarLike(spec, isTaxi) {
    var w = spec.w, l = spec.l, h = spec.h;
    var col = isTaxi ? 0xffc107 : pick(CAR_PALETTE);
    var bodyMat = paint(col, 0.55);
    var trim = std(0x16181b, 0.4, 0.6);
    var g = new THREE.Group();
    var wheels = [];

    // lower body with slight taper (use trapezoid-ish stacked boxes)
    var lowerH = h * 0.5;
    var lower = box(w, lowerH, l, bodyMat);
    lower.position.y = lowerH / 2 + 0.20; g.add(lower);
    // rounded shoulders (thin upper sill)
    var sill = box(w * 1.0, 0.08, l, trim);
    sill.position.y = 0.20; g.add(sill);

    // hood + trunk slope accents
    var hood = box(w * 0.94, 0.10, l * 0.30, bodyMat);
    hood.position.set(0, lowerH + 0.20, -l * 0.30); g.add(hood);
    var trunk = box(w * 0.94, 0.10, l * 0.26, bodyMat);
    trunk.position.set(0, lowerH + 0.20, l * 0.32); g.add(trunk);

    // greenhouse / cabin (narrower than body) + dark glass band
    var cabL = l * 0.46;
    var cabH = h * 0.46;
    var cabin = box(w * 0.86, cabH, cabL, bodyMat);
    cabin.position.set(0, lowerH + 0.20 + cabH / 2 - 0.02, -0.05); g.add(cabin);
    var glass = box(w * 0.88, cabH * 0.66, cabL * 0.94, GLASS);
    glass.position.set(0, lowerH + 0.20 + cabH / 2 + 0.03, -0.05); g.add(glass);
    // windshield rake
    var wsF = box(w * 0.84, cabH * 0.5, 0.05, GLASS);
    wsF.position.set(0, lowerH + 0.20 + cabH * 0.5, -0.05 - cabL / 2); wsF.rotation.x = 0.5; g.add(wsF);

    // grille + bumpers
    var grille = box(w * 0.7, 0.16, 0.05, trim);
    grille.position.set(0, lowerH * 0.55 + 0.20, -l / 2 - 0.01); g.add(grille);

    addWheels(g, w, l, wheels, false);
    addLights(g, w, l, 0.55, 0.62);
    addPlates(g, w, l, 0.40, lowerH + 0.10);

    if (isTaxi) {
      var roofY = lowerH + 0.20 + cabH + 0.08;
      var sign = mesh(new THREE.BoxGeometry(0.5, 0.16, 0.22), std(0x111111, 0.2, 0.5));
      sign.position.set(0, roofY, -0.05); g.add(sign);
      var signLight = mesh(new THREE.BoxGeometry(0.46, 0.12, 0.20), std(0xfff2b0, 0.1, 0.3, 0xffcf3a, 1.8));
      signLight.position.set(0, roofY, -0.05); g.add(signLight);
      // checker stripe along the sill
      for (var cs = -1; cs <= 1; cs += 2) {
        var stripe = box(0.03, 0.14, l * 0.7, std(0x111111, 0.2, 0.6));
        stripe.position.set(cs * (w / 2), lowerH * 0.5 + 0.20, 0); g.add(stripe);
      }
    }

    try { g.userData = g.userData || {}; g.userData.wheels = wheels; } catch (e) {}
    return g;
  }

  function makeVan(spec) {
    var w = spec.w, l = spec.l, h = spec.h;
    var col = pick(VAN_PALETTE);
    var bodyMat = paint(col, 0.4);
    var g = new THREE.Group();
    var wheels = [];

    var bodyH = h * 0.82;
    var body = box(w, bodyH, l * 0.80, bodyMat);
    body.position.set(0, bodyH / 2 + 0.20, l * 0.08); g.add(body);
    var hood = box(w * 0.96, h * 0.40, l * 0.22, bodyMat);
    hood.position.set(0, h * 0.40 / 2 + 0.20, -l / 2 + l * 0.11); g.add(hood);
    // windshield + cab side windows
    var ws = box(w * 0.9, h * 0.30, 0.06, GLASS);
    ws.position.set(0, bodyH * 0.70 + 0.20, -l / 2 + l * 0.22); ws.rotation.x = 0.3; g.add(ws);
    var sideW = box(w + 0.02, h * 0.20, l * 0.16, GLASS);
    sideW.position.set(0, bodyH * 0.62 + 0.20, -l / 2 + l * 0.32); g.add(sideW);
    // body rub strip
    var strip = box(w + 0.02, 0.08, l * 0.76, std(0x2a2d30, 0.3, 0.6));
    strip.position.set(0, bodyH * 0.30 + 0.20, l * 0.04); g.add(strip);

    addWheels(g, w, l, wheels, true);
    addLights(g, w, l, 0.55, h * 0.66);
    addPlates(g, w, l, 0.42, 0.5);

    try { g.userData = g.userData || {}; g.userData.wheels = wheels; } catch (e) {}
    return g;
  }

  function makeTruck(spec) {
    var w = spec.w, l = spec.l, h = spec.h;
    var col = pick(TRUCK_PALETTE);
    var cabMat = paint(col, 0.5);
    var trailerMat = std(0xe2e5e8, 0.35, 0.55);
    var g = new THREE.Group();
    var wheels = [];

    // cab at front (-z)
    var cabL = l * 0.26;
    var cabH = h * 0.74;
    var cab = box(w, cabH, cabL, cabMat);
    cab.position.set(0, cabH / 2 + 0.42, -l / 2 + cabL / 2); g.add(cab);
    var cabGlass = box(w * 0.9, cabH * 0.36, 0.06, GLASS);
    cabGlass.position.set(0, cabH * 0.70 + 0.42, -l / 2 + 0.02); g.add(cabGlass);
    // grille + bumper + twin stacks
    var grille = box(w * 0.8, cabH * 0.5, 0.06, DARK_METAL);
    grille.position.set(0, cabH * 0.35 + 0.42, -l / 2 - 0.01); g.add(grille);
    for (var st = -1; st <= 1; st += 2) {
      var stack = mesh(new THREE.CylinderGeometry(0.06, 0.06, cabH, 10), CHROME);
      stack.position.set(st * (w / 2 - 0.05), cabH * 0.5 + 0.42, -l / 2 + cabL); g.add(stack);
    }

    // tall box trailer behind
    var trL = l * 0.70;
    var trH = h * 0.90;
    var trailer = box(w, trH, trL, trailerMat);
    trailer.position.set(0, trH / 2 + 0.42, l / 2 - trL / 2); g.add(trailer);
    // ribs on trailer side for detail
    var ribMat = std(0xcdd0d3, 0.4, 0.5);
    for (var ri = 0; ri < 4; ri++) {
      var rib = box(w + 0.02, trH * 0.9, 0.05, ribMat);
      rib.position.set(0, trH / 2 + 0.42, l / 2 - trL + 0.4 + ri * (trL / 4)); g.add(rib);
    }

    // 6 wheels (cab front pair + trailer two pairs)
    var r = 0.42;
    var dx = w / 2 - 0.02;
    var zs = [-l / 2 + cabL * 0.6, l * 0.10, l / 2 - 0.7];
    for (var i = 0; i < zs.length; i++) {
      for (var s = -1; s <= 1; s += 2) {
        var wh = carWheel(true);
        wh.scale.set(1.15, 1.15, 1.0);
        wh.position.set(s * dx, r, zs[i]);
        g.add(wh); wheels.push(wh);
      }
    }
    addLights(g, w, l, 0.7, trH * 0.78);
    addPlates(g, w, l, 0.5, 0.6);

    try { g.userData = g.userData || {}; g.userData.wheels = wheels; } catch (e) {}
    return g;
  }

  function makeBus(spec) {
    var w = spec.w, l = spec.l, h = spec.h;
    var col = pick(BUS_PALETTE);
    var bodyMat = paint(col, 0.45);
    var g = new THREE.Group();
    var wheels = [];

    var bodyH = h * 0.84;
    var body = box(w, bodyH, l, bodyMat);
    body.position.y = bodyH / 2 + 0.42; g.add(body);
    // long window strip along both sides
    var stripY = bodyH * 0.62 + 0.42;
    var strip = box(w + 0.02, h * 0.26, l * 0.86, GLASS);
    strip.position.set(0, stripY, -l * 0.02); g.add(strip);
    // window pillars
    var pillarMat = bodyMat;
    for (var p = 0; p < 7; p++) {
      var pil = box(w + 0.04, h * 0.26, 0.06, pillarMat);
      pil.position.set(0, stripY, -l * 0.40 + p * (l * 0.80 / 6)); g.add(pil);
    }
    // windshield
    var ws = box(w * 0.92, h * 0.30, 0.06, GLASS);
    ws.position.set(0, stripY, -l / 2 + 0.04); g.add(ws);
    // route number sign (emissive)
    var route = mesh(new THREE.BoxGeometry(0.6, 0.2, 0.04), std(0x1a1a00, 0.1, 0.4, 0xffb300, 1.6));
    route.position.set(0, bodyH * 0.86 + 0.42, -l / 2 + 0.03); g.add(route);
    // roof accent
    var roof = box(w * 0.96, 0.14, l * 0.96, std(0xf0f0f0, 0.3, 0.55));
    roof.position.set(0, bodyH + 0.42, 0); g.add(roof);

    // 6 wheels
    var r = 0.40, dx = w / 2 - 0.04;
    var zs = [-l / 2 + 1.1, 0.2, l / 2 - 1.4];
    for (var i = 0; i < zs.length; i++)
      for (var s = -1; s <= 1; s += 2) {
        var wh = carWheel(true); wh.scale.set(1.1, 1.1, 1.0);
        wh.position.set(s * dx, r, zs[i]); g.add(wh); wheels.push(wh);
      }
    addLights(g, w, l, 0.7, bodyH * 0.78);
    addPlates(g, w, l, 0.5, 0.6);

    try { g.userData = g.userData || {}; g.userData.wheels = wheels; } catch (e) {}
    return g;
  }

  function makeTraffic(kind) {
    var spec = findSpec(TKINDS, "kind", kind);
    switch (spec.kind) {
      case "taxi":  return makeCarLike(spec, true);
      case "van":   return makeVan(spec);
      case "truck": return makeTruck(spec);
      case "bus":   return makeBus(spec);
      default:      return makeCarLike(spec, false); // car
    }
  }

  // ===========================================================================
  //  COIN
  // ===========================================================================
  var COIN_GEO = new THREE.CylinderGeometry(0.4, 0.4, 0.07, 28);
  var COIN_RIM_GEO = new THREE.CylinderGeometry(0.4, 0.4, 0.075, 28, 1, true);
  var COIN_FACE_GEO = new THREE.CylinderGeometry(0.27, 0.27, 0.085, 28);
  var COIN_STAR_GEO = new THREE.CylinderGeometry(0.14, 0.14, 0.10, 5);
  function goldMat(c, metal, rough, emissive, ei) {
    try {
      return new THREE.MeshPhysicalMaterial({
        color: c, metalness: metal, roughness: rough,
        clearcoat: 0.8, clearcoatRoughness: 0.1,
        emissive: emissive == null ? 0x000000 : emissive,
        emissiveIntensity: ei == null ? 1 : ei
      });
    } catch (e) { return std(c, metal, rough, emissive, ei); }
  }
  var GOLD = goldMat(0xffce3a, 0.95, 0.18, 0x3a2600, 0.6);
  var GOLD_RIM = goldMat(0xffe27a, 0.98, 0.12, 0xffae00, 2.4);   // emissive glint rim
  var GOLD_BRIGHT = goldMat(0xfff0a0, 0.98, 0.1, 0x6b4a00, 1.0);

  function makeCoin() {
    var g = new THREE.Group();
    // disc lying so its flat faces point along +/-X — readable when spun on Y
    var disc = mesh(COIN_GEO, GOLD);
    disc.rotation.z = Math.PI / 2; g.add(disc);
    // emissive rim ring so it glints/blooms
    var rim = mesh(COIN_RIM_GEO, GOLD_RIM);
    rim.rotation.z = Math.PI / 2; g.add(rim);
    // raised inner medallion + embossed star on both faces
    for (var s = -1; s <= 1; s += 2) {
      var face = mesh(COIN_FACE_GEO, GOLD_BRIGHT);
      face.rotation.z = Math.PI / 2; face.position.x = s * 0.01; g.add(face);
      var star = mesh(COIN_STAR_GEO, GOLD_RIM);
      star.rotation.z = Math.PI / 2; star.position.x = s * 0.05; g.add(star);
    }
    return g;
  }

  // ===========================================================================
  MOTO.Models = {
    bike: makeBike,
    bikeCatalog: function () { return CATALOG.map(function (b) { return Object.assign({}, b); }); },
    traffic: makeTraffic,
    trafficKinds: function () { return TKINDS.map(function (t) { return Object.assign({}, t); }); },
    coin: makeCoin
  };
})();
