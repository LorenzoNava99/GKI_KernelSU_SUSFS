/* MOTO.Environment — high-fidelity procedural infinite highway.
 * Global THREE (r160). No imports, no external assets, all procedural.
 * Recycles road segments, lane markings and pooled roadside props as the
 * world scrolls toward +Z (player at z=0; objects move +Z at `speed`;
 * recycle when past ~+40 back to far -Z).
 *
 * Robustness: under the headless verifier THREE objects are permissive
 * proxies. All control-flow numbers (lane centers, counts, positions, z
 * recycling thresholds) are kept as plain JS numbers we compute ourselves,
 * never read back FROM three objects.
 */
(function () {
  "use strict";
  var MOTO = (window.MOTO = window.MOTO || {});

  var LANE_W = 3.6;
  var NUM_LANES = 3;
  var LANE_CENTERS = [-LANE_W, 0, LANE_W];      // 3 lanes, width 3.6 — matches game scale
  var ROAD_WIDTH = NUM_LANES * LANE_W;          // 10.8
  var SHOULDER = 1.4;
  var EDGE_X = ROAD_WIDTH / 2;                  // 5.4

  // World/recycling tuning (plain numbers — never derived from three objects)
  var Z_FAR = -240;        // spawn line (far ahead, forward = -Z)
  var Z_RECYCLE = 40;      // when an object passes this z (behind player) recycle it
  var Z_SPAN = Z_RECYCLE - Z_FAR; // total scroll length 280

  // ---- Themes ---------------------------------------------------------------
  var THEMES = [
    {
      id: "desert", name: "Desert",
      sky: 0xf2c98a, fog: 0xeec188, ground: 0xcaa062, road: 0x3a3a40, accent: 0x9c5a32,
      fogNear: 55, fogFar: 300, sun: 0xfff0d0, hemiSky: 0xffe6b0, hemiGround: 0xa07a44
    },
    {
      id: "city", name: "City",
      sky: 0x9fb4c7, fog: 0x9aa9ba, ground: 0x6b7280, road: 0x33343a, accent: 0xc7d2dc,
      fogNear: 45, fogFar: 260, sun: 0xf5f7ff, hemiSky: 0xc0d0e0, hemiGround: 0x4a4f57
    },
    {
      id: "bridge", name: "Bridge",
      sky: 0x88c0d8, fog: 0x8fc2d6, ground: 0x4a6b82, road: 0x3a3a42, accent: 0xd24b3a,
      fogNear: 50, fogFar: 290, sun: 0xffffff, hemiSky: 0xb6e0f0, hemiGround: 0x355064
    },
    {
      id: "sea", name: "Sea",
      sky: 0x7fc6e8, fog: 0x9fd6ee, ground: 0x2f7fb0, road: 0x394048, accent: 0x2aa6c8,
      fogNear: 50, fogFar: 300, sun: 0xfff6e0, hemiSky: 0xbfe8f7, hemiGround: 0x1f5e84
    },
    {
      id: "forest", name: "Forest",
      sky: 0xa7c98a, fog: 0xbfe0a0, ground: 0x3f6b3a, road: 0x35383a, accent: 0x255b22,
      fogNear: 45, fogFar: 250, sun: 0xfff4d8, hemiSky: 0xcce6a8, hemiGround: 0x2d4a28
    }
  ];

  function themeById(id) {
    for (var i = 0; i < THEMES.length; i++) if (THEMES[i].id === id) return THEMES[i];
    return THEMES[0];
  }

  // small deterministic PRNG so prop layouts are stable & cheap
  function makeRng(seed) {
    var s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
      return s / 4294967296;
    };
  }

  // ---- create ---------------------------------------------------------------
  function create(scene, themeId) {
    var inst = {};
    inst.numLanes = NUM_LANES;
    inst.roadWidth = ROAD_WIDTH;
    inst.laneCenters = LANE_CENTERS.slice();

    var theme = themeById(themeId);

    // Track everything we add to scene + every geometry/material for clean dispose.
    var added = [];
    var geos = [];
    var mats = [];
    function track(o) { added.push(o); scene.add(o); return o; }
    function geo(g) { geos.push(g); return g; }
    function mat(m) { mats.push(m); return m; }

    // ---- Lights -------------------------------------------------------------
    var hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 0.85);
    track(hemi);

    var sun = new THREE.DirectionalLight(theme.sun, 1.15);
    sun.position.set(14, 26, -8);
    sun.castShadow = true;
    if (sun.shadow) {
      if (sun.shadow.mapSize && sun.shadow.mapSize.set) sun.shadow.mapSize.set(1024, 1024);
      if (sun.shadow.camera) {
        var c = sun.shadow.camera;
        c.near = 1; c.far = 90; c.left = -30; c.right = 30; c.top = 40; c.bottom = -40;
        if (c.updateProjectionMatrix) c.updateProjectionMatrix();
      }
    }
    track(sun);
    track(sun.target ? sun.target : new THREE.Object3D());

    // ---- Shared material set (palette is mutated on setTheme) ---------------
    var groundMat = mat(new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1, metalness: 0 }));
    var roadMat = mat(new THREE.MeshStandardMaterial({ color: theme.road, roughness: 0.92, metalness: 0 }));
    var shoulderMat = mat(new THREE.MeshStandardMaterial({ color: 0x4a4a50, roughness: 1 }));
    var curbMat = mat(new THREE.MeshStandardMaterial({ color: 0xb8b8be, roughness: 0.9 }));
    var railMat = mat(new THREE.MeshStandardMaterial({ color: 0xcfd2d6, roughness: 0.5, metalness: 0.6 }));
    var railPostMat = mat(new THREE.MeshStandardMaterial({ color: 0x808890, roughness: 0.8 }));
    var lineWhiteMat = mat(new THREE.MeshBasicMaterial({ color: 0xf4f4f0 }));
    var lineEdgeMat = mat(new THREE.MeshBasicMaterial({ color: 0xf0e060 }));
    var accentMat = mat(new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.85 }));
    var waterMat = mat(new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 0.25, metalness: 0.15, transparent: true, opacity: 0.92 }));

    // ---- Ground -------------------------------------------------------------
    var groundGeo = geo(new THREE.PlaneGeometry(420, Math.abs(Z_SPAN) + 200));
    var ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.02, (Z_FAR + Z_RECYCLE) / 2);
    ground.receiveShadow = true;
    track(ground);

    // ---- Road surface (recycled segments for an infinite ribbon) -----------
    var ROAD_SEG_LEN = 40;
    var roadSegN = Math.ceil((Math.abs(Z_SPAN) + 80) / ROAD_SEG_LEN) + 1;
    var roadSegGeo = geo(new THREE.PlaneGeometry(ROAD_WIDTH + 0.2, ROAD_SEG_LEN));
    var roadSegments = [];
    var i, z, m;
    for (i = 0; i < roadSegN; i++) {
      m = new THREE.Mesh(roadSegGeo, roadMat);
      m.rotation.x = -Math.PI / 2;
      m.position.set(0, 0, Z_RECYCLE - i * ROAD_SEG_LEN);
      m.receiveShadow = true;
      m.userData.z = Z_RECYCLE - i * ROAD_SEG_LEN;
      track(m);
      roadSegments.push(m);
    }

    // Shoulders (static long planes — they don't need scrolling, uniform color)
    var shoulderGeo = geo(new THREE.PlaneGeometry(SHOULDER, Math.abs(Z_SPAN) + 120));
    var shL = new THREE.Mesh(shoulderGeo, shoulderMat);
    shL.rotation.x = -Math.PI / 2;
    shL.position.set(-(EDGE_X + SHOULDER / 2), -0.005, (Z_FAR + Z_RECYCLE) / 2);
    shL.receiveShadow = true; track(shL);
    var shR = new THREE.Mesh(shoulderGeo, shoulderMat);
    shR.rotation.x = -Math.PI / 2;
    shR.position.set(EDGE_X + SHOULDER / 2, -0.005, (Z_FAR + Z_RECYCLE) / 2);
    shR.receiveShadow = true; track(shR);

    // Continuous curbs along both edges (static long boxes)
    var curbGeo = geo(new THREE.BoxGeometry(0.18, 0.18, Math.abs(Z_SPAN) + 120));
    var curbL = new THREE.Mesh(curbGeo, curbMat);
    curbL.position.set(-(EDGE_X + 0.05), 0.09, (Z_FAR + Z_RECYCLE) / 2); track(curbL);
    var curbR = new THREE.Mesh(curbGeo, curbMat);
    curbR.position.set(EDGE_X + 0.05, 0.09, (Z_FAR + Z_RECYCLE) / 2); track(curbR);

    // Continuous guardrail beams (static), with recycled posts
    var railGeo = geo(new THREE.BoxGeometry(0.08, 0.16, Math.abs(Z_SPAN) + 120));
    var railL = new THREE.Mesh(railGeo, railMat);
    railL.position.set(-(EDGE_X + SHOULDER), 0.62, (Z_FAR + Z_RECYCLE) / 2); track(railL);
    var railR = new THREE.Mesh(railGeo, railMat);
    railR.position.set(EDGE_X + SHOULDER, 0.62, (Z_FAR + Z_RECYCLE) / 2); track(railR);

    // Guardrail posts — pooled & recycled
    var POST_GAP = 8;
    var postN = Math.ceil((Math.abs(Z_SPAN) + 80) / POST_GAP) + 1;
    var postGeo = geo(new THREE.BoxGeometry(0.1, 0.7, 0.1));
    var posts = [];
    for (i = 0; i < postN; i++) {
      var sideX = (EDGE_X + SHOULDER);
      var pL = new THREE.Mesh(postGeo, railPostMat);
      pL.position.set(-sideX, 0.35, Z_RECYCLE - i * POST_GAP);
      pL.userData.z = Z_RECYCLE - i * POST_GAP; track(pL); posts.push(pL);
      var pR = new THREE.Mesh(postGeo, railPostMat);
      pR.position.set(sideX, 0.35, Z_RECYCLE - i * POST_GAP);
      pR.userData.z = Z_RECYCLE - i * POST_GAP; track(pR); posts.push(pR);
    }

    // ---- Lane markings (recycled) ------------------------------------------
    // Dashed center lines between lanes + solid edge lines.
    var centerEdges = [-LANE_W / 2, LANE_W / 2]; // boundaries between the 3 lanes
    var DASH_LEN = 2.6, DASH_GAP = 5.0;
    var dashPitch = DASH_LEN + DASH_GAP;
    var dashN = Math.ceil((Math.abs(Z_SPAN) + 40) / dashPitch) + 1;
    var dashGeo = geo(new THREE.PlaneGeometry(0.16, DASH_LEN));
    var dashes = [];
    for (var e = 0; e < centerEdges.length; e++) {
      for (i = 0; i < dashN; i++) {
        var d = new THREE.Mesh(dashGeo, lineWhiteMat);
        d.rotation.x = -Math.PI / 2;
        z = Z_RECYCLE - i * dashPitch;
        d.position.set(centerEdges[e], 0.012, z);
        d.userData.z = z;
        track(d); dashes.push(d);
      }
    }

    // Solid edge lines: long static thin planes hugging the road edges.
    var edgeLineGeo = geo(new THREE.PlaneGeometry(0.18, Math.abs(Z_SPAN) + 80));
    var edgeL = new THREE.Mesh(edgeLineGeo, lineEdgeMat);
    edgeL.rotation.x = -Math.PI / 2;
    edgeL.position.set(-(EDGE_X - 0.2), 0.012, (Z_FAR + Z_RECYCLE) / 2); track(edgeL);
    var edgeR = new THREE.Mesh(edgeLineGeo, lineEdgeMat);
    edgeR.rotation.x = -Math.PI / 2;
    edgeR.position.set(EDGE_X - 0.2, 0.012, (Z_FAR + Z_RECYCLE) / 2); track(edgeR);

    // ---- Optional water plane (sea/bridge) ---------------------------------
    var waterGeo = geo(new THREE.PlaneGeometry(600, Math.abs(Z_SPAN) + 200));
    var water = new THREE.Mesh(waterGeo, waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, -3.2, (Z_FAR + Z_RECYCLE) / 2);
    water.visible = false;
    track(water);

    // =========================================================================
    // PROP POOLS — one builder per theme. Each prop is a Group placed by us;
    // we only ever mutate position/rotation in update, never allocate.
    // =========================================================================

    // Reusable shared geometries for props (kept across themes, disposed once).
    var G = {
      box1: geo(new THREE.BoxGeometry(1, 1, 1)),
      cyl: geo(new THREE.CylinderGeometry(1, 1, 1, 8)),
      cone: geo(new THREE.ConeGeometry(1, 1, 8)),
      sphere: geo(new THREE.SphereGeometry(1, 8, 6)),
      coneLow: geo(new THREE.ConeGeometry(1, 1, 6))
    };

    // Reusable prop materials (palette-independent, themed where noted).
    var PM = {
      cactus: mat(new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 1 })),
      rock: mat(new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 1 })),
      dune: mat(new THREE.MeshStandardMaterial({ color: 0xd8b27a, roughness: 1 })),
      mesa: mat(new THREE.MeshStandardMaterial({ color: 0xb06a40, roughness: 1 })),
      bldg1: mat(new THREE.MeshStandardMaterial({ color: 0x8f9aa6, roughness: 0.7 })),
      bldg2: mat(new THREE.MeshStandardMaterial({ color: 0x6f7a86, roughness: 0.7 })),
      bldg3: mat(new THREE.MeshStandardMaterial({ color: 0xa9b4c0, roughness: 0.6 })),
      glass: mat(new THREE.MeshStandardMaterial({ color: 0x9fc6e0, roughness: 0.25, metalness: 0.4 })),
      lampPost: mat(new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.7 })),
      lampHead: mat(new THREE.MeshStandardMaterial({ color: 0xfff4c0, emissive: 0x3a3416, roughness: 0.5 })),
      tower: mat(new THREE.MeshStandardMaterial({ color: 0xc94a38, roughness: 0.6 })),
      cable: mat(new THREE.MeshStandardMaterial({ color: 0x555a60, roughness: 0.6 })),
      pylon: mat(new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.85 })),
      palmTrunk: mat(new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 1 })),
      palmLeaf: mat(new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 1 })),
      pineTrunk: mat(new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 1 })),
      pine: mat(new THREE.MeshStandardMaterial({ color: 0x26622f, roughness: 1 })),
      leaf: mat(new THREE.MeshStandardMaterial({ color: 0x357a35, roughness: 1 })),
      bush: mat(new THREE.MeshStandardMaterial({ color: 0x3d7a3a, roughness: 1 }))
    };

    function meshOf(g, material, sx, sy, sz, px, py, pz) {
      var msh = new THREE.Mesh(g, material);
      if (msh.scale && msh.scale.set) msh.scale.set(sx, sy, sz);
      if (msh.position && msh.position.set) msh.position.set(px, py, pz);
      return msh;
    }

    // --- Prop builders: each returns a THREE.Group (not yet added) ----------
    function buildDesert(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.34) {
        // cactus: trunk + two arms
        g.add(meshOf(G.cyl, PM.cactus, 0.22, 1.6, 0.22, 0, 1.6, 0));
        g.add(meshOf(G.cyl, PM.cactus, 0.13, 0.6, 0.13, 0.3, 1.9, 0));
        g.add(meshOf(G.cyl, PM.cactus, 0.13, 0.5, 0.13, -0.28, 1.6, 0));
      } else if (pick < 0.6) {
        // rocks cluster
        g.add(meshOf(G.sphere, PM.rock, 0.9, 0.7, 0.9, 0, 0.4, 0));
        g.add(meshOf(G.sphere, PM.rock, 0.5, 0.4, 0.5, 0.8, 0.25, 0.3));
      } else if (pick < 0.85) {
        // dune mound
        g.add(meshOf(G.sphere, PM.dune, 3.2, 1.0, 4.0, 0, -0.2, 0));
      } else {
        // distant mesa
        g.add(meshOf(G.box1, PM.mesa, 6, 5, 6, 0, 2.5, 0));
      }
      return g;
    }

    function buildCity(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.85) {
        var h = 8 + Math.floor(rng() * 34);
        var w = 4 + rng() * 6;
        var dpt = 4 + rng() * 6;
        var bm = pick < 0.3 ? PM.bldg1 : (pick < 0.55 ? PM.bldg2 : (pick < 0.7 ? PM.bldg3 : PM.glass));
        g.add(meshOf(G.box1, bm, w, h, dpt, 0, h / 2, 0));
        // rooftop block
        g.add(meshOf(G.box1, PM.bldg2, w * 0.4, 1.5, dpt * 0.4, 0, h + 0.7, 0));
      } else {
        // streetlight: post + arm + head
        g.add(meshOf(G.cyl, PM.lampPost, 0.1, 4.5, 0.1, 0, 2.25, 0));
        g.add(meshOf(G.box1, PM.lampPost, 1.4, 0.1, 0.1, -0.6, 4.4, 0));
        g.add(meshOf(G.box1, PM.lampHead, 0.5, 0.2, 0.3, -1.2, 4.3, 0));
      }
      return g;
    }

    function buildBridge(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.5) {
        // suspension tower (tall A-ish frame)
        g.add(meshOf(G.box1, PM.tower, 0.8, 22, 0.8, -0.9, 11, 0));
        g.add(meshOf(G.box1, PM.tower, 0.8, 22, 0.8, 0.9, 11, 0));
        g.add(meshOf(G.box1, PM.tower, 2.6, 0.6, 0.6, 0, 18, 0));
        g.add(meshOf(G.box1, PM.tower, 2.6, 0.6, 0.6, 0, 11, 0));
        // a sloping cable
        var cable = meshOf(G.cyl, PM.cable, 0.06, 24, 0.06, 0, 11, 0);
        if (cable.rotation && cable.rotation.set) cable.rotation.set(0, 0, 0.4);
        g.add(cable);
      } else {
        // pylon + railing segment
        g.add(meshOf(G.box1, PM.pylon, 1.2, 6, 1.2, 0, 3, 0));
        g.add(meshOf(G.box1, PM.pylon, 0.15, 0.15, 6, 0, 6.4, 0));
      }
      return g;
    }

    function buildSea(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.55) {
        // palm tree: leaning trunk + radial fronds
        var trunk = meshOf(G.cyl, PM.palmTrunk, 0.18, 4.5, 0.18, 0, 2.25, 0);
        if (trunk.rotation && trunk.rotation.set) trunk.rotation.set(0, 0, 0.12);
        g.add(trunk);
        for (var k = 0; k < 5; k++) {
          var leaf = meshOf(G.cone, PM.palmLeaf, 0.5, 2.2, 0.2, 0.3, 4.4, 0);
          if (leaf.rotation && leaf.rotation.set) leaf.rotation.set(1.2, k * 1.25, 0);
          g.add(leaf);
        }
      } else {
        // causeway support pylon rising from the water
        g.add(meshOf(G.cyl, PM.pylon, 0.6, 4.5, 0.6, 0, -1.0, 0));
        g.add(meshOf(G.box1, PM.pylon, 1.6, 0.5, 1.6, 0, 1.1, 0));
      }
      return g;
    }

    function buildForest(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.55) {
        // pine: trunk + stacked cones
        g.add(meshOf(G.cyl, PM.pineTrunk, 0.18, 1.4, 0.18, 0, 0.7, 0));
        g.add(meshOf(G.cone, PM.pine, 1.6, 2.2, 1.6, 0, 2.0, 0));
        g.add(meshOf(G.cone, PM.pine, 1.2, 1.8, 1.2, 0, 3.2, 0));
        g.add(meshOf(G.cone, PM.pine, 0.8, 1.4, 0.8, 0, 4.2, 0));
      } else if (pick < 0.85) {
        // broadleaf: trunk + blob canopy
        g.add(meshOf(G.cyl, PM.pineTrunk, 0.2, 2.0, 0.2, 0, 1.0, 0));
        g.add(meshOf(G.sphere, PM.leaf, 1.8, 1.6, 1.8, 0, 2.8, 0));
      } else {
        // bush
        g.add(meshOf(G.sphere, PM.bush, 1.1, 0.8, 1.1, 0, 0.5, 0));
      }
      return g;
    }

    var BUILDERS = {
      desert: buildDesert, city: buildCity, bridge: buildBridge, sea: buildSea, forest: buildForest
    };

    // Prop pool: a fixed set of recycled groups (dozens, not thousands).
    var PROPS_PER_SIDE = 16;
    var propPool = [];        // { group, side, z } — currently active props
    var propRng = makeRng(1337);

    function clearProps() {
      for (var p = 0; p < propPool.length; p++) {
        var grp = propPool[p].group;
        scene.remove(grp);
      }
      propPool.length = 0;
    }

    function buildPropsFor(id) {
      clearProps();
      var builder = BUILDERS[id] || buildForest;
      var sides = [-1, 1];
      for (var s = 0; s < sides.length; s++) {
        var side = sides[s];
        for (var n = 0; n < PROPS_PER_SIDE; n++) {
          var grp = builder(propRng);
          // distance off the road edge varies by theme prop
          var baseOff = EDGE_X + SHOULDER + 2.5;
          var spread = 3 + propRng() * 22;
          var px = side * (baseOff + spread);
          var pz = Z_RECYCLE - (n + 0.5) * (Math.abs(Z_SPAN) / PROPS_PER_SIDE) - propRng() * 6;
          if (grp.position && grp.position.set) grp.position.set(px, 0, pz);
          if (grp.rotation && grp.rotation.set) grp.rotation.set(0, propRng() * 6.28, 0);
          grp.userData.z = pz;
          grp.userData.x = px;
          grp.userData.side = side;
          scene.add(grp);
          propPool.push({ group: grp, side: side, z: pz, x: px });
        }
      }
    }

    // ---- Apply palette ------------------------------------------------------
    function applyPalette(t) {
      if (scene.background && scene.background.setHex) scene.background.setHex(t.sky);
      else scene.background = new THREE.Color(t.sky);
      scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
      if (groundMat.color && groundMat.color.setHex) groundMat.color.setHex(t.ground);
      if (roadMat.color && roadMat.color.setHex) roadMat.color.setHex(t.road);
      if (accentMat.color && accentMat.color.setHex) accentMat.color.setHex(t.accent);
      if (hemi.color && hemi.color.setHex) hemi.color.setHex(t.hemiSky);
      if (hemi.groundColor && hemi.groundColor.setHex) hemi.groundColor.setHex(t.hemiGround);
      if (sun.color && sun.color.setHex) sun.color.setHex(t.sun);
      // water shown only for water themes
      var showWater = (t.id === "sea" || t.id === "bridge");
      water.visible = showWater;
      if (showWater && waterMat.color && waterMat.color.setHex) {
        waterMat.color.setHex(t.id === "sea" ? 0x2f7fb0 : 0x3d6f8a);
      }
    }

    function applyTheme(id) {
      theme = themeById(id);
      applyPalette(theme);
      buildPropsFor(theme.id);
    }

    applyTheme(theme.id);

    // ---- update -------------------------------------------------------------
    var waterPhase = 0;
    inst.update = function (dt, speed, distance) {
      var sp = typeof speed === "number" ? speed : 0;
      var d = typeof dt === "number" ? dt : 0;
      var dz = sp * d;
      var j, o, nz;

      // road segments
      for (j = 0; j < roadSegments.length; j++) {
        o = roadSegments[j];
        nz = o.userData.z + dz;
        if (nz > Z_RECYCLE + ROAD_SEG_LEN) nz -= roadSegN * ROAD_SEG_LEN;
        o.userData.z = nz;
        if (o.position) o.position.z = nz;
      }

      // lane dashes
      for (j = 0; j < dashes.length; j++) {
        o = dashes[j];
        nz = o.userData.z + dz;
        if (nz > Z_RECYCLE) nz -= dashN * dashPitch;
        o.userData.z = nz;
        if (o.position) o.position.z = nz;
      }

      // guardrail posts
      for (j = 0; j < posts.length; j++) {
        o = posts[j];
        nz = o.userData.z + dz;
        if (nz > Z_RECYCLE) nz -= postN * POST_GAP;
        o.userData.z = nz;
        if (o.position) o.position.z = nz;
      }

      // roadside props
      for (j = 0; j < propPool.length; j++) {
        o = propPool[j].group;
        nz = o.userData.z + dz;
        if (nz > Z_RECYCLE + 6) nz -= Math.abs(Z_SPAN);
        o.userData.z = nz;
        if (o.position) o.position.z = nz;
      }

      // subtle water bob
      if (water.visible) {
        waterPhase += d;
        if (water.position) water.position.y = -3.2 + Math.sin(waterPhase * 1.3) * 0.06;
      }
    };

    // ---- setTheme -----------------------------------------------------------
    inst.setTheme = function (id) {
      applyTheme(id);
    };

    // ---- dispose ------------------------------------------------------------
    inst.dispose = function () {
      clearProps();
      for (var a = 0; a < added.length; a++) scene.remove(added[a]);
      added.length = 0;
      for (var gi = 0; gi < geos.length; gi++) if (geos[gi] && geos[gi].dispose) geos[gi].dispose();
      for (var mi = 0; mi < mats.length; mi++) if (mats[mi] && mats[mi].dispose) mats[mi].dispose();
      geos.length = 0; mats.length = 0;
      scene.fog = null;
    };

    return inst;
  }

  // ---- public API -----------------------------------------------------------
  MOTO.Environment = {
    themes: function () {
      return THEMES.map(function (t) { return Object.assign({}, t); });
    },
    create: create
  };
})();
