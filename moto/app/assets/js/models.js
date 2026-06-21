/* MOTO.Models — procedural model factory (high-fidelity low-poly).
 * Conforms to docs/CONTRACT.md. THREE is global (r160). Faces -Z.
 * Origin at ground-center: all wheels/bodies rest on y = 0.
 * No imports, no external assets — everything built in code. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  // ---- material / geometry helpers ----------------------------------------
  function std(c, metal, rough, emissive) {
    return new THREE.MeshStandardMaterial({
      color: c,
      metalness: metal == null ? 0.3 : metal,
      roughness: rough == null ? 0.6 : rough,
      emissive: emissive == null ? 0x000000 : emissive
    });
  }
  function lambert(c) { return new THREE.MeshLambertMaterial({ color: c }); }

  function mesh(geo, m) {
    var o = new THREE.Mesh(geo, m);
    o.castShadow = true; o.receiveShadow = true;
    return o;
  }
  function box(w, h, l, m) { return mesh(new THREE.BoxGeometry(w, h, l), m); }

  // Shared, reusable geometries / materials (mobile triangle budget) --------
  var GLASS = std(0x0d1418, 0.5, 0.15);          // dark tinted window glass
  var TIRE = std(0x141414, 0.0, 0.9);            // rubber
  var CHROME = std(0xcfd6dc, 0.95, 0.18);        // bright metal
  var DARK_METAL = std(0x2a2e33, 0.7, 0.4);
  var RIM = std(0xb9c0c7, 0.85, 0.25);
  var HEADLIGHT = std(0xfff7d6, 0.2, 0.2, 0xffe9a8);
  var TAILLIGHT = std(0x7a0000, 0.2, 0.4, 0xb20000);
  var SEAT_MAT = std(0x1a1a1d, 0.1, 0.85);
  var SUIT = std(0x2b3340, 0.1, 0.7);
  var HELMET = std(0xe9edf2, 0.3, 0.4);
  var VISOR = std(0x10171c, 0.6, 0.2);
  var GLOVE = std(0x101216, 0.1, 0.7);
  var SKIN = std(0xcf9b6e, 0.0, 0.8);

  // shared wheel pieces — built once, cloned per use
  function makeWheelGeo(r, width) {
    return new THREE.CylinderGeometry(r, r, width, 18);
  }
  var BIKE_WHEEL_GEO = makeWheelGeo(0.34, 0.14);
  var BIKE_RIM_GEO = new THREE.CylinderGeometry(0.20, 0.20, 0.145, 14);
  var CAR_WHEEL_GEO = makeWheelGeo(0.36, 0.22);
  var CAR_RIM_GEO = new THREE.CylinderGeometry(0.20, 0.20, 0.225, 12);

  // A motorcycle wheel: tire + bright rim hub, oriented to spin about X.
  function bikeWheel() {
    var g = new THREE.Group();
    var t = mesh(BIKE_WHEEL_GEO, TIRE); t.rotation.z = Math.PI / 2; g.add(t);
    var rim = mesh(BIKE_RIM_GEO, RIM); rim.rotation.z = Math.PI / 2; g.add(rim);
    return g;
  }
  function carWheel() {
    var g = new THREE.Group();
    var t = mesh(CAR_WHEEL_GEO, TIRE); t.rotation.z = Math.PI / 2; g.add(t);
    var rim = mesh(CAR_RIM_GEO, RIM); rim.rotation.z = Math.PI / 2; g.add(rim);
    return g;
  }

  // ===========================================================================
  //  BIKE CATALOG
  // ===========================================================================
  // shape: body-style proportions so each bike reads as visibly different.
  // style: 'sport' | 'street' | 'cruiser' | 'naked' | 'hyper'
  var CATALOG = [
    { id: "street",  name: "Street 600", colorHex: 0xff3b30, price: 0,     topSpeed: 190, accel: 0.55, handling: 0.62, desc: "Balanced free starter.", style: "street" },
    { id: "cruiser", name: "Road Cruiser", colorHex: 0xffb300, price: 1200, topSpeed: 172, accel: 0.45, handling: 0.50, desc: "Long, heavy & steady.", style: "cruiser" },
    { id: "sport",   name: "Sport RR",   colorHex: 0x0a84ff, price: 3500, topSpeed: 232, accel: 0.82, handling: 0.74, desc: "Faired & fast, twitchy.", style: "sport" },
    { id: "naked",   name: "Naked GT",   colorHex: 0x34c759, price: 6000, topSpeed: 214, accel: 0.70, handling: 0.88, desc: "Stripped & super agile.", style: "naked" },
    { id: "hyper",   name: "Hyperbike",  colorHex: 0xaf52de, price: 12000, topSpeed: 262, accel: 0.95, handling: 0.80, desc: "Top-tier hypersport.", style: "hyper" }
  ];

  function findSpec(list, key, val) {
    for (var i = 0; i < list.length; i++) if (list[i][key] === val) return list[i];
    return list[0];
  }

  // Build a posed rider leaning forward (group origin at ground y=0).
  function buildRider(crouch) {
    // crouch 0 = upright (cruiser), 1 = tucked race crouch (sport)
    var r = new THREE.Group();
    var lean = 0.25 + crouch * 0.45; // forward tilt (radians)

    // hips/pelvis
    var hip = box(0.34, 0.22, 0.30, SUIT); hip.position.set(0, 0.96, 0.18); r.add(hip);

    // torso, leaning forward toward the bars
    var torso = box(0.40, 0.58, 0.28, SUIT);
    torso.position.set(0, 1.30, 0.02);
    torso.rotation.x = lean;
    r.add(torso);

    // head + helmet
    var head = new THREE.Group();
    var hg = mesh(new THREE.SphereGeometry(0.155, 16, 12), HELMET);
    head.add(hg);
    var visor = mesh(new THREE.BoxGeometry(0.26, 0.10, 0.10), VISOR);
    visor.position.set(0, 0.0, -0.12);
    head.add(visor);
    var dropF = -0.18 - crouch * 0.20;
    head.position.set(0, 1.66 - crouch * 0.16, dropF);
    r.add(head);

    // arms reaching forward to bars
    var armMat = SUIT;
    function arm(side) {
      var a = box(0.12, 0.12, 0.46, armMat);
      a.position.set(side * 0.20, 1.32, -0.28);
      a.rotation.x = -0.5 - crouch * 0.3;
      r.add(a);
      var hand = box(0.10, 0.10, 0.10, GLOVE);
      hand.position.set(side * 0.21, 1.16 - crouch * 0.12, -0.52);
      r.add(hand);
    }
    arm(-1); arm(1);

    // legs tucked back to pegs
    function leg(side) {
      var thigh = box(0.15, 0.15, 0.42, armMat);
      thigh.position.set(side * 0.14, 0.84, 0.30);
      thigh.rotation.x = -0.6;
      r.add(thigh);
      var shin = box(0.13, 0.13, 0.40, armMat);
      shin.position.set(side * 0.16, 0.52, 0.18);
      shin.rotation.x = 0.7;
      r.add(shin);
      var boot = box(0.13, 0.12, 0.20, GLOVE);
      boot.position.set(side * 0.16, 0.34, 0.06);
      r.add(boot);
    }
    leg(-1); leg(1);

    return r;
  }

  function makeBike(id) {
    var spec = findSpec(CATALOG, "id", id);
    var col = spec.colorHex;
    var style = spec.style;
    var g = new THREE.Group();
    var body = std(col, 0.45, 0.45);

    // style-driven proportions
    var wheelbase, tankH, tankL, seatY, crouch, faired, hasWind;
    switch (style) {
      case "cruiser": wheelbase = 0.95; tankH = 0.34; tankL = 0.75; seatY = 0.78; crouch = 0.0; faired = false; hasWind = false; break;
      case "sport":   wheelbase = 0.78; tankH = 0.40; tankL = 0.95; seatY = 0.92; crouch = 1.0; faired = true;  hasWind = true;  break;
      case "naked":   wheelbase = 0.80; tankH = 0.42; tankL = 0.80; seatY = 0.90; crouch = 0.5; faired = false; hasWind = false; break;
      case "hyper":   wheelbase = 0.82; tankH = 0.44; tankL = 1.00; seatY = 0.94; crouch = 0.9; faired = true;  hasWind = true;  break;
      default:        wheelbase = 0.82; tankH = 0.38; tankL = 0.82; seatY = 0.86; crouch = 0.4; faired = false; hasWind = false; break; // street
    }

    var frontZ = -wheelbase, rearZ = wheelbase;

    // wheels
    var wf = bikeWheel(); wf.position.set(0, 0.34, frontZ); g.add(wf);
    var wr = bikeWheel(); wr.position.set(0, 0.34, rearZ); g.add(wr);

    // front fork (two tubes) from steering head down to front wheel
    function fork(side) {
      var f = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 8), CHROME);
      f.position.set(side * 0.06, 0.66, frontZ - 0.02);
      f.rotation.x = -0.45;
      g.add(f);
    }
    fork(-1); fork(1);

    // swingarm to rear wheel
    var swing = box(0.08, 0.08, wheelbase, DARK_METAL);
    swing.position.set(0.1, 0.36, 0.2); g.add(swing);

    // engine block (low, dark)
    var engine = box(0.30, 0.34, 0.55, DARK_METAL);
    engine.position.set(0, 0.50, 0.05); g.add(engine);

    // frame/tank
    var tank = box(0.36, tankH, tankL, body);
    tank.position.set(0, seatY + 0.02, -0.10); g.add(tank);

    // fairing (sport/hyper get a swept nose)
    if (faired) {
      var nose = mesh(new THREE.CylinderGeometry(0.04, 0.22, 0.55, 10), body);
      nose.rotation.x = Math.PI / 2;
      nose.position.set(0, seatY - 0.05, frontZ + 0.18);
      g.add(nose);
      // lower side fairing
      var sideF = box(0.40, 0.34, 0.6, body);
      sideF.position.set(0, 0.55, -0.30); g.add(sideF);
    }

    // seat + tail
    var seat = box(0.34, 0.12, 0.55, SEAT_MAT);
    seat.position.set(0, seatY + 0.10, 0.30); g.add(seat);
    var tail = box(0.26, 0.16, 0.30, body);
    tail.position.set(0, seatY + 0.14, rearZ - 0.18); g.add(tail);

    // handlebars
    var bar = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.46, 8), DARK_METAL);
    bar.rotation.z = Math.PI / 2;
    var barY = faired ? 0.80 : 1.02;
    bar.position.set(0, barY, frontZ + 0.12); g.add(bar);

    // headlight
    var hlGeo = faired ? new THREE.BoxGeometry(0.20, 0.14, 0.06) : new THREE.SphereGeometry(0.10, 12, 10);
    var hl = mesh(hlGeo, HEADLIGHT);
    hl.position.set(0, seatY - 0.02, frontZ - 0.18); g.add(hl);

    // taillight
    var tl = mesh(new THREE.BoxGeometry(0.16, 0.07, 0.04), TAILLIGHT);
    tl.position.set(0, seatY + 0.12, rearZ + 0.02); g.add(tl);

    // exhaust pipe (chrome) running back-right
    var exhaust = mesh(new THREE.CylinderGeometry(0.055, 0.07, 0.85, 10), CHROME);
    exhaust.rotation.x = Math.PI / 2;
    exhaust.position.set(0.18, 0.40, 0.45); g.add(exhaust);

    // tinted windscreen for sportier bikes
    if (hasWind) {
      var wind = mesh(new THREE.BoxGeometry(0.30, 0.22, 0.04), GLASS);
      wind.position.set(0, seatY + 0.18, frontZ + 0.10);
      wind.rotation.x = -0.5;
      g.add(wind);
    }

    // rider
    g.add(buildRider(crouch));

    return g;
  }

  // ===========================================================================
  //  TRAFFIC
  // ===========================================================================
  var TKINDS = [
    { kind: "car",   w: 1.8, l: 4.4,  h: 1.45, weight: 5 },
    { kind: "taxi",  w: 1.85, l: 4.5, h: 1.50, weight: 2 },
    { kind: "van",   w: 2.0, l: 5.2,  h: 2.20, weight: 2 },
    { kind: "truck", w: 2.5, l: 9.0,  h: 3.50, weight: 2 },
    { kind: "bus",   w: 2.6, l: 11.0, h: 3.20, weight: 1 }
  ];

  // tasteful per-spawn palettes (varied but not garish)
  var CAR_PALETTE = [0xc62828, 0x1565c0, 0x2e7d32, 0xfafafa, 0x37474f, 0x6a1b9a, 0xef6c00, 0x00838f];
  var VAN_PALETTE = [0xeceff1, 0xb0bec5, 0x90a4ae, 0xcfd8dc, 0xe0e0e0];
  var TRUCK_PALETTE = [0x37474f, 0x5d4037, 0x455a64, 0x263238, 0x4e342e];
  var BUS_PALETTE = [0xe53935, 0xfb8c00, 0x1e88e5, 0x43a047, 0xfdd835];
  function pick(arr) { return arr[(Math.random() * arr.length) | 0]; }

  function addWheels(g, w, l, wheelFn) {
    var r = (wheelFn === carWheel) ? 0.36 : 0.36;
    var dx = w / 2 - 0.05;
    var dz = l / 2 - 0.85;
    var positions = [[-dx, r, -dz], [dx, r, -dz], [-dx, r, dz], [dx, r, dz]];
    for (var i = 0; i < positions.length; i++) {
      var wh = wheelFn();
      wh.position.set(positions[i][0], positions[i][1], positions[i][2]);
      g.add(wh);
    }
  }

  function addLights(g, w, l, h, frontY, rearY) {
    // headlights (front = -z), taillights (rear = +z)
    var hx = w / 2 - 0.30;
    function light(geo, mat, x, y, z) { var m = mesh(geo, mat); m.position.set(x, y, z); g.add(m); }
    var hg = new THREE.BoxGeometry(0.26, 0.16, 0.06);
    light(hg, HEADLIGHT, -hx, frontY, -l / 2 - 0.01);
    light(hg, HEADLIGHT, hx, frontY, -l / 2 - 0.01);
    var tg = new THREE.BoxGeometry(0.22, 0.14, 0.05);
    light(tg, TAILLIGHT, -hx, rearY, l / 2 + 0.01);
    light(tg, TAILLIGHT, hx, rearY, l / 2 + 0.01);
  }

  function makeCarLike(spec, isTaxi) {
    var w = spec.w, l = spec.l, h = spec.h;
    var col = isTaxi ? 0xffc107 : pick(CAR_PALETTE);
    var bodyMat = std(col, 0.4, 0.5);
    var g = new THREE.Group();

    // lower body
    var lowerH = h * 0.55;
    var lower = box(w, lowerH, l, bodyMat);
    lower.position.y = lowerH / 2 + 0.18; g.add(lower);

    // greenhouse / cabin with glass
    var cabL = l * 0.5;
    var cabH = h * 0.5;
    var cabin = box(w * 0.92, cabH, cabL, bodyMat);
    cabin.position.set(0, lowerH + 0.18 + cabH / 2 - 0.04, -0.1); g.add(cabin);
    // window band slightly inset, darker glass
    var glass = box(w * 0.93, cabH * 0.62, cabL * 0.96, GLASS);
    glass.position.set(0, lowerH + 0.18 + cabH / 2 + 0.02, -0.1); g.add(glass);

    addWheels(g, w, l, carWheel);
    addLights(g, w, l, h, 0.55, 0.6);

    if (isTaxi) {
      // roof taxi sign
      var sign = mesh(new THREE.BoxGeometry(0.5, 0.18, 0.24), std(0x111111, 0.2, 0.5, 0x222200));
      var roofY = lowerH + 0.18 + cabH + 0.10;
      sign.position.set(0, roofY, -0.1); g.add(sign);
      var signLight = mesh(new THREE.BoxGeometry(0.46, 0.12, 0.20), std(0xfff2b0, 0.1, 0.3, 0xffd24a));
      signLight.position.set(0, roofY, -0.1); g.add(signLight);
      // checker stripe along the side
      var stripe = box(w + 0.02, 0.16, l * 0.7, std(0x111111, 0.2, 0.6));
      stripe.position.set(0, lowerH * 0.6 + 0.18, 0); g.add(stripe);
    }
    return g;
  }

  function makeVan(spec) {
    var w = spec.w, l = spec.l, h = spec.h;
    var bodyMat = std(pick(VAN_PALETTE), 0.35, 0.55);
    var g = new THREE.Group();
    // boxy single volume + short hood
    var bodyH = h * 0.82;
    var body = box(w, bodyH, l * 0.82, bodyMat);
    body.position.set(0, bodyH / 2 + 0.18, l * 0.07); g.add(body);
    var hood = box(w * 0.96, h * 0.42, l * 0.22, bodyMat);
    hood.position.set(0, h * 0.42 / 2 + 0.18, -l / 2 + l * 0.11); g.add(hood);
    // windshield + cab side windows
    var ws = box(w * 0.9, h * 0.30, 0.06, GLASS);
    ws.position.set(0, bodyH * 0.7 + 0.18, -l / 2 + l * 0.22); g.add(ws);
    var sideW = box(w + 0.02, h * 0.22, l * 0.18, GLASS);
    sideW.position.set(0, bodyH * 0.62 + 0.18, -l / 2 + l * 0.30); g.add(sideW);
    addWheels(g, w, l, carWheel);
    addLights(g, w, l, h, 0.55, h * 0.7);
    return g;
  }

  function makeTruck(spec) {
    var w = spec.w, l = spec.l, h = spec.h;
    var cabMat = std(pick(TRUCK_PALETTE), 0.45, 0.45);
    var trailerMat = std(0xd5d8db, 0.3, 0.7);
    var g = new THREE.Group();

    // cab at front (-z)
    var cabL = l * 0.26;
    var cabH = h * 0.78;
    var cab = box(w, cabH, cabL, cabMat);
    cab.position.set(0, cabH / 2 + 0.40, -l / 2 + cabL / 2); g.add(cab);
    var cabGlass = box(w * 0.9, cabH * 0.4, 0.06, GLASS);
    cabGlass.position.set(0, cabH * 0.72 + 0.40, -l / 2 + 0.02); g.add(cabGlass);

    // tall box trailer behind
    var trL = l * 0.70;
    var trH = h * 0.92;
    var trailer = box(w, trH, trL, trailerMat);
    trailer.position.set(0, trH / 2 + 0.40, l / 2 - trL / 2); g.add(trailer);

    // 6 wheels (cab front pair + trailer two pairs)
    var r = 0.42;
    var dx = w / 2 - 0.04;
    var zs = [-l / 2 + cabL * 0.6, l * 0.10, l / 2 - 0.7];
    for (var i = 0; i < zs.length; i++) {
      for (var s = -1; s <= 1; s += 2) {
        var wh = carWheel();
        wh.scale.set(1.15, 1.15, 1.0);
        wh.position.set(s * dx, r, zs[i]);
        g.add(wh);
      }
    }
    addLights(g, w, l, h, 0.7, trH * 0.8);
    return g;
  }

  function makeBus(spec) {
    var w = spec.w, l = spec.l, h = spec.h;
    var bodyMat = std(pick(BUS_PALETTE), 0.4, 0.5);
    var g = new THREE.Group();
    var bodyH = h * 0.86;
    var body = box(w, bodyH, l, bodyMat);
    body.position.y = bodyH / 2 + 0.40; g.add(body);
    // long window strip along both sides
    var stripY = bodyH * 0.62 + 0.40;
    var strip = box(w + 0.02, h * 0.28, l * 0.86, GLASS);
    strip.position.set(0, stripY, -l * 0.02); g.add(strip);
    // windshield
    var ws = box(w * 0.92, h * 0.30, 0.06, GLASS);
    ws.position.set(0, stripY, -l / 2 + 0.04); g.add(ws);
    // roof accent
    var roof = box(w * 0.96, 0.14, l * 0.96, std(0xffffff, 0.3, 0.6));
    roof.position.set(0, bodyH + 0.40, 0); g.add(roof);
    // 6 wheels
    var r = 0.40, dx = w / 2 - 0.05;
    var zs = [-l / 2 + 1.1, 0.2, l / 2 - 1.4];
    for (var i = 0; i < zs.length; i++)
      for (var s = -1; s <= 1; s += 2) {
        var wh = carWheel(); wh.scale.set(1.1, 1.1, 1.0);
        wh.position.set(s * dx, r, zs[i]); g.add(wh);
      }
    addLights(g, w, l, h, 0.7, bodyH * 0.8);
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
  var COIN_GEO = new THREE.CylinderGeometry(0.4, 0.4, 0.08, 24);
  var COIN_FACE_GEO = new THREE.CylinderGeometry(0.28, 0.28, 0.085, 24);
  var GOLD = std(0xffd24a, 0.9, 0.2, 0x5a3d00);
  var GOLD_BRIGHT = std(0xffe680, 0.95, 0.15, 0x6b4a00);

  function makeCoin() {
    var g = new THREE.Group();
    // disc lying so its flat faces point along +/-X — readable when spun on Y
    var disc = mesh(COIN_GEO, GOLD);
    disc.rotation.z = Math.PI / 2;
    g.add(disc);
    // raised inner medallion for sparkle
    var face = mesh(COIN_FACE_GEO, GOLD_BRIGHT);
    face.rotation.z = Math.PI / 2;
    g.add(face);
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
