/* MOTO.Models — STUB (plain primitives). Upgraded by the Models agent.
 * Conforms to docs/CONTRACT.md. THREE is global. Faces -Z, ground-center origin. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});
  function mat(c) { return new THREE.MeshStandardMaterial({ color: c, metalness: 0.3, roughness: 0.6 }); }
  function box(w, h, l, c) { var m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), mat(c)); m.castShadow = true; return m; }

  var CATALOG = [
    { id: "street", name: "Street 600", colorHex: 0xff3b30, price: 0, topSpeed: 190, accel: 0.55, handling: 0.6, desc: "Balanced starter." },
    { id: "cruiser", name: "Cruiser", colorHex: 0xffcc00, price: 1200, topSpeed: 175, accel: 0.45, handling: 0.5, desc: "Heavy & steady." },
    { id: "sport", name: "Sport RR", colorHex: 0x0a84ff, price: 3500, topSpeed: 230, accel: 0.8, handling: 0.75, desc: "Fast, twitchy." },
    { id: "naked", name: "Naked", colorHex: 0x34c759, price: 6000, topSpeed: 215, accel: 0.7, handling: 0.85, desc: "Agile." },
    { id: "hyper", name: "Hyper", colorHex: 0xaf52de, price: 12000, topSpeed: 260, accel: 0.95, handling: 0.8, desc: "Top tier." }
  ];

  function makeBike(id) {
    var spec = CATALOG[0]; for (var i = 0; i < CATALOG.length; i++) if (CATALOG[i].id === id) spec = CATALOG[i];
    var g = new THREE.Group();
    var body = box(0.5, 0.5, 1.7, spec.colorHex); body.position.y = 0.75; g.add(body);
    var seat = box(0.45, 0.18, 0.7, 0x222222); seat.position.set(0, 1.02, 0.15); g.add(seat);
    var wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.16, 18);
    var wheelMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    var wf = new THREE.Mesh(wheelGeo, wheelMat); wf.rotation.z = Math.PI / 2; wf.position.set(0, 0.34, -0.78); g.add(wf);
    var wr = wf.clone(); wr.position.z = 0.78; g.add(wr);
    // rider
    var rider = new THREE.Group();
    var torso = box(0.4, 0.55, 0.3, 0x303843); torso.position.y = 1.35; rider.add(torso);
    var head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), mat(0xe8e8e8)); head.position.set(0, 1.75, -0.05); rider.add(head);
    g.add(rider);
    g.traverse(function (c) { if (c.isMesh) c.castShadow = true; });
    return g;
  }

  var TKINDS = [
    { kind: "car", w: 1.8, l: 4.4, h: 1.45, weight: 5 },
    { kind: "taxi", w: 1.85, l: 4.5, h: 1.5, weight: 2 },
    { kind: "van", w: 2.0, l: 5.2, h: 2.2, weight: 2 },
    { kind: "truck", w: 2.5, l: 9.0, h: 3.5, weight: 2 },
    { kind: "bus", w: 2.6, l: 11.0, h: 3.2, weight: 1 }
  ];
  var TCOLORS = { car: 0x2d6cdf, taxi: 0xffc107, van: 0xcfcfcf, truck: 0x8d6e63, bus: 0xe53935 };

  function makeTraffic(kind) {
    var spec = TKINDS[0]; for (var i = 0; i < TKINDS.length; i++) if (TKINDS[i].kind === kind) spec = TKINDS[i];
    var g = new THREE.Group();
    var body = box(spec.w, spec.h, spec.l, TCOLORS[kind] || 0x888888);
    body.position.y = spec.h / 2; g.add(body);
    if (kind === "car" || kind === "taxi") {
      var cabin = box(spec.w * 0.9, spec.h * 0.55, spec.l * 0.5, 0x1b2733);
      cabin.position.set(0, spec.h * 0.95, -0.1); g.add(cabin);
    }
    g.traverse(function (c) { if (c.isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    return g;
  }

  function makeCoin() {
    var g = new THREE.Group();
    var c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 20),
      new THREE.MeshStandardMaterial({ color: 0xffd24a, metalness: 0.8, roughness: 0.25, emissive: 0x5a3d00 }));
    c.rotation.x = Math.PI / 2; g.add(c);
    return g;
  }

  MOTO.Models = {
    bike: makeBike,
    bikeCatalog: function () { return CATALOG.map(function (b) { return Object.assign({}, b); }); },
    traffic: makeTraffic,
    trafficKinds: function () { return TKINDS.map(function (t) { return Object.assign({}, t); }); },
    coin: makeCoin
  };
})();
