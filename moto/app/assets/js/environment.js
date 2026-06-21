/* MOTO.Environment — STUB (flat scrolling road + themes). Upgraded by Env agent. */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});
  var LANE_W = 3.6, NUM_LANES = 3;

  var THEMES = [
    { id: "desert", name: "Desert", sky: 0xf2c98a, ground: 0xc99a5b, road: 0x3a3a40, fog: 0xf2c98a },
    { id: "city", name: "City", sky: 0x9fb4c7, ground: 0x6b7280, road: 0x33343a, fog: 0x9fb4c7 },
    { id: "bridge", name: "Bridge", sky: 0x88c0d8, ground: 0x4a6b82, road: 0x3a3a42, fog: 0x88c0d8 },
    { id: "sea", name: "Sea", sky: 0x7fc6e8, ground: 0x2f7fb0, road: 0x394048, fog: 0x9fd6ee },
    { id: "forest", name: "Forest", sky: 0xa7c98a, ground: 0x3f6b3a, road: 0x35383a, fog: 0xbfe0a0 }
  ];

  function create(scene, themeId) {
    var roadWidth = NUM_LANES * LANE_W;
    var inst = {};
    inst.numLanes = NUM_LANES; inst.roadWidth = roadWidth;
    inst.laneCenters = [-LANE_W, 0, LANE_W];

    var added = [];
    function add(o) { scene.add(o); added.push(o); return o; }

    // lights
    var hemi = new THREE.HemisphereLight(0xffffff, 0x404040, 0.9); add(hemi);
    var sun = new THREE.DirectionalLight(0xffffff, 1.1); sun.position.set(8, 20, 6);
    sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 80;
    sun.shadow.camera.left = -25; sun.shadow.camera.right = 25;
    sun.shadow.camera.top = 25; sun.shadow.camera.bottom = -25; add(sun);

    // ground
    var groundMat = new THREE.MeshStandardMaterial({ color: 0xc99a5b, roughness: 1 });
    var ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 1200), groundMat);
    ground.rotation.x = -Math.PI / 2; ground.position.z = -300; ground.receiveShadow = true; add(ground);

    // road
    var roadMat = new THREE.MeshStandardMaterial({ color: 0x3a3a40, roughness: 0.9 });
    var road = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth + 1.5, 1200), roadMat);
    road.rotation.x = -Math.PI / 2; road.position.set(0, 0.01, -300); road.receiveShadow = true; add(road);

    // recycling dashed lane stripes
    var stripes = [];
    var stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    var stripeGeo = new THREE.PlaneGeometry(0.16, 2.4);
    var laneEdges = [-LANE_W / 2, LANE_W / 2];
    var SPAN = 240, GAP = 6;
    for (var e = 0; e < laneEdges.length; e++) {
      for (var z = 0; z > -SPAN; z -= GAP) {
        var s = new THREE.Mesh(stripeGeo, stripeMat);
        s.rotation.x = -Math.PI / 2; s.position.set(laneEdges[e], 0.02, z); add(s); stripes.push(s);
      }
    }

    function applyTheme(id) {
      var t = THEMES[0]; for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) t = THEMES[i];
      scene.background = new THREE.Color(t.sky);
      scene.fog = new THREE.Fog(t.fog, 60, 320);
      groundMat.color.setHex(t.ground); roadMat.color.setHex(t.road);
    }
    applyTheme(themeId);

    inst.update = function (dt, speed) {
      var dz = speed * dt;
      for (var i = 0; i < stripes.length; i++) {
        stripes[i].position.z += dz;
        if (stripes[i].position.z > 30) stripes[i].position.z -= SPAN;
      }
    };
    inst.setTheme = function (id) { applyTheme(id); };
    inst.dispose = function () {
      for (var i = 0; i < added.length; i++) scene.remove(added[i]);
      added.length = 0; scene.fog = null;
    };
    return inst;
  }

  MOTO.Environment = {
    themes: function () { return THEMES.map(function (t) { return Object.assign({}, t); }); },
    create: create
  };
})();
