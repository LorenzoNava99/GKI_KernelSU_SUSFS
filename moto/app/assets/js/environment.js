/* MOTO.Environment — high-fidelity procedural infinite highway (WebGPU build).
 * Global THREE (r179 WebGPURenderer; WebGL2 fallback). No imports, no modules,
 * no network, no external assets — everything is generated procedurally.
 *
 * What this layer provides:
 *   - Image-based lighting: a procedural gradient sky is pushed through
 *     PMREMGenerator to make scene.environment, so chrome/car paint reflect a
 *     real-looking sky. Regenerated per theme. All of it is guarded so the
 *     headless verifier (permissive THREE mock, no GL) never throws.
 *   - A glossy PBR asphalt ribbon with crisp emissive lane markings (bloom
 *     catches them), reflective cat's-eye studs, expansion joints, edge lines,
 *     curbs and metallic guardrails.
 *   - Gentle, sweeping VISUAL road curvature + crests. Gameplay stays 1D: the
 *     player and traffic are positioned by game.js using laneCenters[x] and z
 *     on a straight track. We only bend the *rendered* world — every env-owned
 *     object is offset in x (and lifted in y) by curveX(z)/curveY(z), so lanes
 *     appear to bend left/right and roll over crests while lane indices and
 *     collision math are untouched.
 *   - Rich, pooled & recycled themed worlds (desert / city / bridge / sea /
 *     forest) with PBR materials, emissive windows & lamps, animated specular
 *     water, bridge towers + cables, dunes/mesas/cacti, vegetation with depth.
 *   - A shadow-casting sun + hemisphere/ambient fill and per-theme volumetric
 *     -feeling distance fog.
 *
 * Robustness contract: under the verifier, THREE objects are auto-vivifying
 * proxies. All control-flow numbers (lane centers, counts, recycle thresholds,
 * curvature) are plain JS we compute ourselves — we never read them back FROM
 * three objects. Exotic GL calls (PMREM, render targets, scene textures) are
 * wrapped in try/catch and feature-checks so merely loading / creating /
 * updating / disposing never throws.
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
  var Z_FAR = -260;        // spawn line (far ahead, forward = -Z)
  var Z_RECYCLE = 40;      // when an object passes this z (behind player) recycle it
  var Z_SPAN = Z_RECYCLE - Z_FAR; // total scroll length 300

  // ---- Visual curvature -----------------------------------------------------
  // The world bends as a smooth function of "world z" = scenery position + the
  // total distance travelled. Two low-frequency sines combine into a lazy,
  // non-repeating, non-nauseating sweep; a third drives gentle elevation crests.
  // Only env geometry uses these; gameplay coordinates never see them.
  var CURVE_AMP = 0.016;   // lateral bend strength (m of x per m of z, scaled below)
  var CREST_AMP = 0.9;     // vertical crest amplitude (m)
  function curveX(worldZ) {
    // farther ahead (more negative z) bends more — quadratic-ish in distance
    var s = worldZ * 0.0042;
    var bend = Math.sin(s) * 0.7 + Math.sin(s * 0.37 + 1.3) * 0.3;
    // amplify with depth so the road visibly peels away toward the horizon
    return bend * CURVE_AMP * worldZ * worldZ * 0.05;
  }
  function curveY(worldZ) {
    var s = worldZ * 0.0061 + 2.1;
    return (Math.sin(s) * 0.6 + Math.sin(s * 0.43) * 0.4) * CREST_AMP - CREST_AMP * 0.2;
  }
  // local yaw so long meshes/props align with the tangent of the curve
  function curveYaw(worldZ) {
    var dz = 4;
    var dx = curveX(worldZ - dz) - curveX(worldZ + dz);
    return Math.atan2(dx, 2 * dz);
  }

  // ---- Themes ---------------------------------------------------------------
  // skyTop / skyHorizon drive the procedural sky used for both background and
  // the PMREM environment map.
  var THEMES = [
    {
      id: "desert", name: "Desert",
      sky: 0xf2c98a, fog: 0xeec188, ground: 0xcaa062, road: 0x35353c, accent: 0x9c5a32,
      fogNear: 60, fogFar: 340, sun: 0xfff0d0, hemiSky: 0xffe6b0, hemiGround: 0xa07a44,
      skyTop: 0x6fa8d8, skyHorizon: 0xf6d49a, sunDir: [16, 22, -10], roadRough: 0.62
    },
    {
      id: "city", name: "City",
      sky: 0x9fb4c7, fog: 0x9aa9ba, ground: 0x5f6670, road: 0x2f3037, accent: 0xc7d2dc,
      fogNear: 50, fogFar: 300, sun: 0xf5f7ff, hemiSky: 0xc0d0e0, hemiGround: 0x4a4f57,
      skyTop: 0x3c5a7c, skyHorizon: 0xc6d4e2, sunDir: [12, 24, -6], roadRough: 0.55
    },
    {
      id: "bridge", name: "Bridge",
      sky: 0x88c0d8, fog: 0x8fc2d6, ground: 0x3f5e74, road: 0x33333b, accent: 0xd24b3a,
      fogNear: 55, fogFar: 330, sun: 0xffffff, hemiSky: 0xb6e0f0, hemiGround: 0x355064,
      skyTop: 0x2f7bb0, skyHorizon: 0xcdeaf6, sunDir: [18, 20, -8], roadRough: 0.4
    },
    {
      id: "sea", name: "Sea",
      sky: 0x7fc6e8, fog: 0x9fd6ee, ground: 0x2f7fb0, road: 0x33363e, accent: 0x2aa6c8,
      fogNear: 55, fogFar: 340, sun: 0xfff6e0, hemiSky: 0xbfe8f7, hemiGround: 0x1f5e84,
      skyTop: 0x1f86c4, skyHorizon: 0xd6f1fb, sunDir: [20, 18, -6], roadRough: 0.34
    },
    {
      id: "forest", name: "Forest",
      sky: 0xa7c98a, fog: 0xbfe0a0, ground: 0x3a6336, road: 0x303338, accent: 0x255b22,
      fogNear: 50, fogFar: 290, sun: 0xfff4d8, hemiSky: 0xcce6a8, hemiGround: 0x2d4a28,
      skyTop: 0x4f7e9a, skyHorizon: 0xd6e8b4, sunDir: [10, 26, -12], roadRough: 0.6
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
    var disposables = []; // textures / render targets / pmrem
    function track(o) { added.push(o); scene.add(o); return o; }
    function geo(g) { geos.push(g); return g; }
    function mat(m) { mats.push(m); return m; }

    // A registry of "curved" objects: { o, baseZ-via-userData, baseX, alignYaw }.
    // Their x/y/yaw are recomputed each frame from curveX/curveY of their z.
    // baseX is the object's straight-track x; we add curveX on top.
    function curved(o, baseX, alignYaw) {
      if (o) {
        o.userData.baseX = baseX || 0;
        o.userData.alignYaw = !!alignYaw;
      }
      return o;
    }
    function applyCurve(o) {
      if (!o || !o.position) return;
      var z = o.userData.z;
      if (typeof z !== "number") z = (o.position.z || 0);
      var bx = o.userData.baseX || 0;
      o.position.x = bx + curveX(z);
      o.position.y = (o.userData.baseY || 0) + curveY(z);
      if (o.userData.alignYaw && o.rotation && typeof o.rotation.y === "number") {
        o.rotation.y = (o.userData.yaw0 || 0) + curveYaw(z);
      }
    }

    // =========================================================================
    // IMAGE-BASED LIGHTING — procedural sky -> PMREM environment map.
    // Everything here is best-effort and fully guarded; under the verifier mock
    // (no real GL) it silently no-ops.
    // =========================================================================
    var pmrem = null;
    var envRT = null;          // current PMREMGenerator render target
    var skyCanvas = null;      // reusable canvas for the gradient sky
    var skyTexture = null;

    function makeSkyTexture(t) {
      try {
        if (typeof document === "undefined" || !document.createElement) return null;
        var cnv = skyCanvas || document.createElement("canvas");
        if (!cnv) return null;
        cnv.width = 16; cnv.height = 256;
        var ctx = cnv.getContext && cnv.getContext("2d");
        if (!ctx) return null;
        skyCanvas = cnv;
        var top = "#" + ("000000" + (t.skyTop >>> 0).toString(16)).slice(-6);
        var hor = "#" + ("000000" + (t.skyHorizon >>> 0).toString(16)).slice(-6);
        var grad = ctx.createLinearGradient(0, 0, 0, 256);
        grad.addColorStop(0.0, top);
        grad.addColorStop(0.55, hor);
        grad.addColorStop(1.0, hor);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, 16, 256);
        // faint sun glow band near the horizon
        var sg = ctx.createRadialGradient(8, 70, 2, 8, 70, 120);
        sg.addColorStop(0, "rgba(255,250,235,0.55)");
        sg.addColorStop(1, "rgba(255,250,235,0)");
        ctx.fillStyle = sg;
        ctx.fillRect(0, 0, 16, 256);
        var tex = new THREE.CanvasTexture(cnv);
        if (THREE.SRGBColorSpace) tex.colorSpace = THREE.SRGBColorSpace;
        tex.needsUpdate = true;
        return tex;
      } catch (e) { return null; }
    }

    function regenEnvironment(t) {
      try {
        // dispose previous IBL artifacts
        if (envRT && envRT.dispose) { envRT.dispose(); }
        envRT = null;
        if (skyTexture && skyTexture.dispose) skyTexture.dispose();
        skyTexture = makeSkyTexture(t);

        if (!pmrem && THREE.PMREMGenerator && renderer) {
          pmrem = new THREE.PMREMGenerator(renderer);
          if (pmrem && pmrem.compileEquirectangularShader) pmrem.compileEquirectangularShader();
        }
        if (pmrem && skyTexture && pmrem.fromEquirectangular) {
          envRT = pmrem.fromEquirectangular(skyTexture);
          if (envRT && envRT.texture) scene.environment = envRT.texture;
        } else if (skyTexture) {
          // No PMREM available — still give reflections something plausible.
          scene.environment = skyTexture;
        }
      } catch (e) { /* IBL is a luxury; never block the scene on it */ }
    }

    // The renderer is needed for PMREM. We can't import it; main.js owns it. We
    // grab it opportunistically from a couple of likely globals, fully guarded.
    var renderer = null;
    try {
      if (window.MOTO && window.MOTO._renderer) renderer = window.MOTO._renderer;
      else if (window.__MOTO_RENDERER__) renderer = window.__MOTO_RENDERER__;
    } catch (e) { renderer = null; }

    // ---- Lights -------------------------------------------------------------
    var hemi = new THREE.HemisphereLight(theme.hemiSky, theme.hemiGround, 0.7);
    track(hemi);

    var amb = new THREE.AmbientLight(0xffffff, 0.12);
    track(amb);

    var sun = new THREE.DirectionalLight(theme.sun, 1.5);
    sun.position.set(theme.sunDir[0], theme.sunDir[1], theme.sunDir[2]);
    sun.castShadow = true;
    if (sun.shadow) {
      if (sun.shadow.mapSize && sun.shadow.mapSize.set) sun.shadow.mapSize.set(2048, 2048);
      if (typeof sun.shadow.bias === "number" || sun.shadow.bias === undefined) sun.shadow.bias = -0.0004;
      if (sun.shadow.camera) {
        var c = sun.shadow.camera;
        c.near = 1; c.far = 120; c.left = -36; c.right = 36; c.top = 50; c.bottom = -50;
        if (c.updateProjectionMatrix) c.updateProjectionMatrix();
      }
    }
    track(sun);
    track(sun.target ? sun.target : new THREE.Object3D());

    // ---- Shared material set (palette is mutated on setTheme) ---------------
    var groundMat = mat(new THREE.MeshStandardMaterial({ color: theme.ground, roughness: 1, metalness: 0 }));
    // Asphalt: lower roughness so it catches the sky/highlights ("wet-ish").
    var roadMat = mat(new THREE.MeshStandardMaterial({
      color: theme.road, roughness: theme.roadRough, metalness: 0.06, envMapIntensity: 1.0
    }));
    var shoulderMat = mat(new THREE.MeshStandardMaterial({ color: 0x44444a, roughness: 0.9, metalness: 0.04 }));
    var jointMat = mat(new THREE.MeshStandardMaterial({ color: 0x202024, roughness: 0.85 }));
    var curbMat = mat(new THREE.MeshStandardMaterial({ color: 0xc4c4ca, roughness: 0.85 }));
    var railMat = mat(new THREE.MeshStandardMaterial({ color: 0xd8dbe0, roughness: 0.3, metalness: 0.85, envMapIntensity: 1.2 }));
    var railPostMat = mat(new THREE.MeshStandardMaterial({ color: 0x7c848c, roughness: 0.6, metalness: 0.5 }));
    // Lane markings: emissive so bloom blooms them.
    var lineWhiteMat = mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf6f6ee, emissiveIntensity: 0.85, roughness: 0.5, metalness: 0 }));
    var lineEdgeMat = mat(new THREE.MeshStandardMaterial({ color: 0xffe24a, emissive: 0xffcf2a, emissiveIntensity: 0.8, roughness: 0.5, metalness: 0 }));
    var studMat = mat(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xbfe6ff, emissiveIntensity: 1.4, roughness: 0.2, metalness: 0.6 }));
    var accentMat = mat(new THREE.MeshStandardMaterial({ color: theme.accent, roughness: 0.8 }));
    // Animated specular water.
    var waterMat = mat(new THREE.MeshStandardMaterial({
      color: theme.ground, roughness: 0.08, metalness: 0.4, transparent: true, opacity: 0.9, envMapIntensity: 1.4
    }));

    // ---- Ground (curved long planes, segmented so the bend is visible) ------
    var GROUND_SEG_LEN = 30;
    var groundSegN = Math.ceil((Math.abs(Z_SPAN) + 120) / GROUND_SEG_LEN) + 1;
    var groundGeo = geo(new THREE.PlaneGeometry(520, GROUND_SEG_LEN + 0.5));
    var groundSegments = [];
    var i, z, m;
    for (i = 0; i < groundSegN; i++) {
      m = new THREE.Mesh(groundGeo, groundMat);
      m.rotation.x = -Math.PI / 2;
      z = Z_RECYCLE - i * GROUND_SEG_LEN;
      m.userData.z = z; m.userData.baseY = -0.04;
      curved(m, 0, false);
      m.receiveShadow = true;
      track(m); applyCurve(m);
      groundSegments.push(m);
    }

    // ---- Road surface (recycled curved segments for an infinite ribbon) -----
    var ROAD_SEG_LEN = 16;   // shorter segments => smoother visible bend
    var roadSegN = Math.ceil((Math.abs(Z_SPAN) + 80) / ROAD_SEG_LEN) + 1;
    var roadSegGeo = geo(new THREE.PlaneGeometry(ROAD_WIDTH + 0.3, ROAD_SEG_LEN + 0.05));
    var roadSegments = [];
    for (i = 0; i < roadSegN; i++) {
      m = new THREE.Mesh(roadSegGeo, roadMat);
      m.rotation.x = -Math.PI / 2;
      z = Z_RECYCLE - i * ROAD_SEG_LEN;
      m.userData.z = z; m.userData.baseY = 0; m.userData.yaw0 = -Math.PI / 2 * 0; // plane already laid flat
      curved(m, 0, false);
      m.receiveShadow = true;
      track(m); applyCurve(m);
      roadSegments.push(m);
    }

    // Expansion joints — thin dark bars across the road, recycled.
    var JOINT_GAP = 16;
    var jointN = Math.ceil((Math.abs(Z_SPAN) + 40) / JOINT_GAP) + 1;
    var jointGeo = geo(new THREE.BoxGeometry(ROAD_WIDTH + 0.1, 0.02, 0.12));
    var joints = [];
    for (i = 0; i < jointN; i++) {
      m = new THREE.Mesh(jointGeo, jointMat);
      z = Z_RECYCLE - i * JOINT_GAP;
      m.userData.z = z; m.userData.baseY = 0.013;
      curved(m, 0, false);
      track(m); applyCurve(m);
      joints.push(m);
    }

    // Shoulders (curved segmented planes hugging the road edges).
    var shoulderGeo = geo(new THREE.PlaneGeometry(SHOULDER, ROAD_SEG_LEN + 0.05));
    var shoulders = [];
    for (var ss = 0; ss < 2; ss++) {
      var sgn = ss === 0 ? -1 : 1;
      for (i = 0; i < roadSegN; i++) {
        m = new THREE.Mesh(shoulderGeo, shoulderMat);
        m.rotation.x = -Math.PI / 2;
        z = Z_RECYCLE - i * ROAD_SEG_LEN;
        m.userData.z = z; m.userData.baseY = -0.01;
        curved(m, sgn * (EDGE_X + SHOULDER / 2), false);
        m.receiveShadow = true;
        track(m); applyCurve(m);
        shoulders.push(m);
      }
    }

    // ---- Curbs (recycled curved boxes along both edges) --------------------
    var CURB_LEN = 16;
    var curbN = roadSegN;
    var curbGeo = geo(new THREE.BoxGeometry(0.16, 0.18, CURB_LEN + 0.1));
    var curbs = [];
    for (ss = 0; ss < 2; ss++) {
      sgn = ss === 0 ? -1 : 1;
      for (i = 0; i < curbN; i++) {
        m = new THREE.Mesh(curbGeo, curbMat);
        z = Z_RECYCLE - i * CURB_LEN;
        m.userData.z = z; m.userData.baseY = 0.09; m.userData.yaw0 = 0;
        curved(m, sgn * (EDGE_X + 0.05), true);
        m.castShadow = false;
        track(m); applyCurve(m);
        curbs.push(m);
      }
    }

    // ---- Guardrails (recycled curved metallic beams + posts) ---------------
    var RAIL_LEN = 16;
    var railN = roadSegN;
    var railGeo = geo(new THREE.BoxGeometry(0.08, 0.18, RAIL_LEN + 0.1));
    var rails = [];
    for (ss = 0; ss < 2; ss++) {
      sgn = ss === 0 ? -1 : 1;
      for (i = 0; i < railN; i++) {
        m = new THREE.Mesh(railGeo, railMat);
        z = Z_RECYCLE - i * RAIL_LEN;
        m.userData.z = z; m.userData.baseY = 0.62; m.userData.yaw0 = 0;
        curved(m, sgn * (EDGE_X + SHOULDER), true);
        track(m); applyCurve(m);
        rails.push(m);
      }
    }

    var POST_GAP = 6;
    var postN = Math.ceil((Math.abs(Z_SPAN) + 80) / POST_GAP) + 1;
    var postGeo = geo(new THREE.BoxGeometry(0.1, 0.7, 0.1));
    var posts = [];
    for (ss = 0; ss < 2; ss++) {
      sgn = ss === 0 ? -1 : 1;
      for (i = 0; i < postN; i++) {
        var pst = new THREE.Mesh(postGeo, railPostMat);
        z = Z_RECYCLE - i * POST_GAP;
        pst.userData.z = z; pst.userData.baseY = 0.35;
        curved(pst, sgn * (EDGE_X + SHOULDER), false);
        track(pst); applyCurve(pst);
        posts.push(pst);
      }
    }

    // ---- Lane markings (recycled curved dashes + stud cat's-eyes) ----------
    var centerEdges = [-LANE_W / 2, LANE_W / 2]; // boundaries between the 3 lanes
    var DASH_LEN = 2.6, DASH_GAP = 4.4;
    var dashPitch = DASH_LEN + DASH_GAP;
    var dashN = Math.ceil((Math.abs(Z_SPAN) + 40) / dashPitch) + 1;
    var dashGeo = geo(new THREE.PlaneGeometry(0.16, DASH_LEN));
    var dashes = [];
    var studGeo = geo(new THREE.SphereGeometry(0.07, 6, 5));
    var studs = [];
    for (var e = 0; e < centerEdges.length; e++) {
      for (i = 0; i < dashN; i++) {
        z = Z_RECYCLE - i * dashPitch;
        var d = new THREE.Mesh(dashGeo, lineWhiteMat);
        d.rotation.x = -Math.PI / 2;
        d.userData.z = z; d.userData.baseY = 0.014;
        curved(d, centerEdges[e], false);
        track(d); applyCurve(d); dashes.push(d);
        // reflective cat's-eye between dashes
        var stud = new THREE.Mesh(studGeo, studMat);
        stud.userData.z = z - dashPitch / 2; stud.userData.baseY = 0.05;
        curved(stud, centerEdges[e], false);
        track(stud); applyCurve(stud); studs.push(stud);
      }
    }

    // Solid emissive edge lines (recycled curved segments).
    var EDGE_SEG_LEN = 16;
    var edgeLineGeo = geo(new THREE.PlaneGeometry(0.18, EDGE_SEG_LEN + 0.05));
    var edgeLines = [];
    for (ss = 0; ss < 2; ss++) {
      sgn = ss === 0 ? -1 : 1;
      for (i = 0; i < roadSegN; i++) {
        m = new THREE.Mesh(edgeLineGeo, lineEdgeMat);
        m.rotation.x = -Math.PI / 2;
        z = Z_RECYCLE - i * EDGE_SEG_LEN;
        m.userData.z = z; m.userData.baseY = 0.014;
        curved(m, sgn * (EDGE_X - 0.2), false);
        track(m); applyCurve(m);
        edgeLines.push(m);
      }
    }

    // ---- Animated specular water (sea/bridge) ------------------------------
    var WATER_SEG_LEN = 40;
    var waterSegN = Math.ceil((Math.abs(Z_SPAN) + 160) / WATER_SEG_LEN) + 1;
    var waterGeo = geo(new THREE.PlaneGeometry(700, WATER_SEG_LEN + 0.5, 1, 1));
    var waterSegments = [];
    for (i = 0; i < waterSegN; i++) {
      m = new THREE.Mesh(waterGeo, waterMat);
      m.rotation.x = -Math.PI / 2;
      z = Z_RECYCLE - i * WATER_SEG_LEN;
      m.userData.z = z; m.userData.baseY = -3.2;
      m.visible = false;
      track(m);
      waterSegments.push(m);
    }

    // =========================================================================
    // PROP POOLS — one builder per theme. Each prop is a Group placed by us;
    // we only ever mutate position/rotation in update, never allocate.
    // =========================================================================
    var G = {
      box1: geo(new THREE.BoxGeometry(1, 1, 1)),
      cyl: geo(new THREE.CylinderGeometry(1, 1, 1, 10)),
      cone: geo(new THREE.ConeGeometry(1, 1, 10)),
      sphere: geo(new THREE.SphereGeometry(1, 10, 7)),
      coneLow: geo(new THREE.ConeGeometry(1, 1, 6)),
      icos: geo(new THREE.IcosahedronGeometry(1, 0))
    };

    var PM = {
      cactus: mat(new THREE.MeshStandardMaterial({ color: 0x3f7d3a, roughness: 0.9 })),
      rock: mat(new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 1 })),
      rock2: mat(new THREE.MeshStandardMaterial({ color: 0x6e533a, roughness: 1 })),
      dune: mat(new THREE.MeshStandardMaterial({ color: 0xdcb67e, roughness: 1 })),
      mesa: mat(new THREE.MeshStandardMaterial({ color: 0xb06a40, roughness: 1 })),
      bldg1: mat(new THREE.MeshStandardMaterial({ color: 0x8f9aa6, roughness: 0.7, metalness: 0.15 })),
      bldg2: mat(new THREE.MeshStandardMaterial({ color: 0x6f7a86, roughness: 0.7, metalness: 0.15 })),
      bldg3: mat(new THREE.MeshStandardMaterial({ color: 0xa9b4c0, roughness: 0.55, metalness: 0.2 })),
      glass: mat(new THREE.MeshStandardMaterial({ color: 0x8fbfe0, roughness: 0.12, metalness: 0.6, envMapIntensity: 1.4 })),
      windows: mat(new THREE.MeshStandardMaterial({ color: 0x222a33, emissive: 0xffd58a, emissiveIntensity: 0.9, roughness: 0.4 })),
      lampPost: mat(new THREE.MeshStandardMaterial({ color: 0x33383e, roughness: 0.6, metalness: 0.4 })),
      lampHead: mat(new THREE.MeshStandardMaterial({ color: 0xfff4c0, emissive: 0xffdd88, emissiveIntensity: 1.6, roughness: 0.4 })),
      tower: mat(new THREE.MeshStandardMaterial({ color: 0xc94a38, roughness: 0.5, metalness: 0.35 })),
      cable: mat(new THREE.MeshStandardMaterial({ color: 0x4c5158, roughness: 0.5, metalness: 0.6 })),
      pylon: mat(new THREE.MeshStandardMaterial({ color: 0x9a9a9e, roughness: 0.8, metalness: 0.2 })),
      palmTrunk: mat(new THREE.MeshStandardMaterial({ color: 0x8a6a40, roughness: 1 })),
      palmLeaf: mat(new THREE.MeshStandardMaterial({ color: 0x2f8a4a, roughness: 0.85 })),
      pineTrunk: mat(new THREE.MeshStandardMaterial({ color: 0x5a3f28, roughness: 1 })),
      pine: mat(new THREE.MeshStandardMaterial({ color: 0x26622f, roughness: 0.9 })),
      pine2: mat(new THREE.MeshStandardMaterial({ color: 0x1f5328, roughness: 0.9 })),
      leaf: mat(new THREE.MeshStandardMaterial({ color: 0x357a35, roughness: 0.9 })),
      bush: mat(new THREE.MeshStandardMaterial({ color: 0x3d7a3a, roughness: 0.95 }))
    };

    function meshOf(g, material, sx, sy, sz, px, py, pz) {
      var msh = new THREE.Mesh(g, material);
      if (msh.scale && msh.scale.set) msh.scale.set(sx, sy, sz);
      if (msh.position && msh.position.set) msh.position.set(px, py, pz);
      if (msh.castShadow !== undefined) msh.castShadow = true;
      return msh;
    }

    // --- Prop builders: each returns a THREE.Group (not yet added) ----------
    function buildDesert(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.3) {
        g.add(meshOf(G.cyl, PM.cactus, 0.24, 1.8, 0.24, 0, 1.8, 0));
        g.add(meshOf(G.sphere, PM.cactus, 0.26, 0.26, 0.26, 0, 3.6, 0));
        var armR = meshOf(G.cyl, PM.cactus, 0.13, 0.7, 0.13, 0.33, 2.1, 0);
        g.add(armR);
        g.add(meshOf(G.cyl, PM.cactus, 0.13, 0.55, 0.13, -0.3, 1.8, 0));
      } else if (pick < 0.55) {
        g.add(meshOf(G.icos, PM.rock, 1.1, 0.8, 1.0, 0, 0.45, 0));
        g.add(meshOf(G.icos, PM.rock2, 0.6, 0.5, 0.55, 0.9, 0.3, 0.3));
        g.add(meshOf(G.icos, PM.rock, 0.4, 0.35, 0.4, -0.7, 0.2, -0.4));
      } else if (pick < 0.82) {
        g.add(meshOf(G.sphere, PM.dune, 4.0, 1.2, 5.0, 0, -0.3, 0));
        g.add(meshOf(G.sphere, PM.dune, 2.4, 0.8, 3.0, 3.0, -0.3, 2.0));
      } else {
        // layered mesa
        g.add(meshOf(G.box1, PM.mesa, 8, 5.5, 8, 0, 2.75, 0));
        g.add(meshOf(G.box1, PM.mesa, 5.5, 2.2, 5.5, 0, 6.6, 0));
      }
      return g;
    }

    function buildCity(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.5) {
        var h = 10 + Math.floor(rng() * 40);
        var w = 5 + rng() * 7;
        var dpt = 5 + rng() * 7;
        var bm = pick < 0.18 ? PM.bldg1 : (pick < 0.32 ? PM.bldg2 : (pick < 0.42 ? PM.bldg3 : PM.glass));
        g.add(meshOf(G.box1, bm, w, h, dpt, 0, h / 2, 0));
        // emissive window strip facing the road (bloom at distance)
        var win = meshOf(G.box1, PM.windows, w * 0.92, h * 0.9, 0.1, 0, h / 2, dpt / 2 + 0.06);
        g.add(win);
        g.add(meshOf(G.box1, PM.bldg2, w * 0.4, 2.0, dpt * 0.4, 0, h + 1.0, 0));
        // antenna
        g.add(meshOf(G.cyl, PM.lampPost, 0.06, 3, 0.06, 0, h + 3.5, 0));
      } else if (pick < 0.82) {
        var h2 = 8 + Math.floor(rng() * 18);
        var w2 = 6 + rng() * 8;
        var d2 = 6 + rng() * 8;
        g.add(meshOf(G.box1, PM.bldg2, w2, h2, d2, 0, h2 / 2, 0));
        g.add(meshOf(G.box1, PM.windows, w2 * 0.9, h2 * 0.85, 0.1, 0, h2 / 2, d2 / 2 + 0.06));
      } else {
        // streetlight: post + arm + emissive head
        g.add(meshOf(G.cyl, PM.lampPost, 0.1, 5.0, 0.1, 0, 2.5, 0));
        g.add(meshOf(G.box1, PM.lampPost, 1.6, 0.1, 0.1, -0.7, 4.9, 0));
        g.add(meshOf(G.box1, PM.lampHead, 0.5, 0.2, 0.35, -1.35, 4.8, 0));
      }
      return g;
    }

    function buildBridge(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.4) {
        // suspension tower (tall A-frame) with deck-level crossbeams + stays
        g.add(meshOf(G.box1, PM.tower, 0.9, 26, 0.9, -1.1, 13, 0));
        g.add(meshOf(G.box1, PM.tower, 0.9, 26, 0.9, 1.1, 13, 0));
        g.add(meshOf(G.box1, PM.tower, 3.0, 0.7, 0.7, 0, 22, 0));
        g.add(meshOf(G.box1, PM.tower, 3.0, 0.7, 0.7, 0, 14, 0));
        // a few sloping stay cables
        for (var ci = 0; ci < 4; ci++) {
          var cable = meshOf(G.cyl, PM.cable, 0.05, 18 + ci * 1.5, 0.05, 0, 13 + ci, 0);
          if (cable.rotation && cable.rotation.set) cable.rotation.set(0, 0, 0.3 + ci * 0.08);
          g.add(cable);
        }
      } else if (pick < 0.72) {
        // pylon + railing segment
        g.add(meshOf(G.box1, PM.pylon, 1.4, 7, 1.4, 0, 3.5, 0));
        g.add(meshOf(G.box1, PM.pylon, 0.16, 0.16, 7, 0, 7.2, 0));
      } else {
        // light mast over the deck
        g.add(meshOf(G.cyl, PM.lampPost, 0.12, 8, 0.12, 0, 4, 0));
        g.add(meshOf(G.box1, PM.lampHead, 0.5, 0.25, 0.4, 0, 8, 0));
      }
      return g;
    }

    function buildSea(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.5) {
        // palm tree: leaning trunk + radial fronds
        var trunk = meshOf(G.cyl, PM.palmTrunk, 0.2, 5.0, 0.2, 0, 2.5, 0);
        if (trunk.rotation && trunk.rotation.set) trunk.rotation.set(0, 0, 0.12);
        g.add(trunk);
        for (var k = 0; k < 6; k++) {
          var leaf = meshOf(G.cone, PM.palmLeaf, 0.5, 2.4, 0.22, 0.32, 4.9, 0);
          if (leaf.rotation && leaf.rotation.set) leaf.rotation.set(1.2, k * 1.05, 0);
          g.add(leaf);
        }
        g.add(meshOf(G.sphere, PM.palmLeaf, 0.35, 0.3, 0.35, 0.3, 4.9, 0));
      } else if (pick < 0.8) {
        // causeway support pylon rising from the water
        g.add(meshOf(G.cyl, PM.pylon, 0.7, 5.0, 0.7, 0, -1.2, 0));
        g.add(meshOf(G.box1, PM.pylon, 1.8, 0.5, 1.8, 0, 1.3, 0));
      } else {
        // small rocky islet
        g.add(meshOf(G.icos, PM.rock2, 2.0, 1.0, 2.2, 0, -0.4, 0));
        g.add(meshOf(G.sphere, PM.bush, 0.8, 0.5, 0.8, 0.5, 0.5, 0.3));
      }
      return g;
    }

    function buildForest(rng) {
      var g = new THREE.Group();
      var pick = rng();
      if (pick < 0.5) {
        // pine: trunk + stacked cones
        g.add(meshOf(G.cyl, PM.pineTrunk, 0.2, 1.6, 0.2, 0, 0.8, 0));
        g.add(meshOf(G.cone, PM.pine, 1.8, 2.4, 1.8, 0, 2.2, 0));
        g.add(meshOf(G.cone, PM.pine2, 1.35, 2.0, 1.35, 0, 3.5, 0));
        g.add(meshOf(G.cone, PM.pine, 0.9, 1.6, 0.9, 0, 4.7, 0));
      } else if (pick < 0.82) {
        // broadleaf: trunk + layered canopy
        g.add(meshOf(G.cyl, PM.pineTrunk, 0.22, 2.2, 0.22, 0, 1.1, 0));
        g.add(meshOf(G.sphere, PM.leaf, 2.0, 1.8, 2.0, 0, 3.0, 0));
        g.add(meshOf(G.sphere, PM.pine, 1.3, 1.2, 1.3, 0.6, 3.8, 0.4));
      } else {
        // bush cluster
        g.add(meshOf(G.sphere, PM.bush, 1.2, 0.9, 1.2, 0, 0.55, 0));
        g.add(meshOf(G.sphere, PM.leaf, 0.8, 0.6, 0.8, 0.7, 0.45, 0.3));
      }
      return g;
    }

    var BUILDERS = {
      desert: buildDesert, city: buildCity, bridge: buildBridge, sea: buildSea, forest: buildForest
    };

    // Prop pool: a fixed set of recycled groups (denser than before, still
    // bounded — counts kept reasonable for the 120fps target).
    var PROPS_PER_SIDE = 26;
    var propPool = [];        // { group } — currently active props
    var propRng = makeRng(1337);

    function clearProps() {
      for (var p = 0; p < propPool.length; p++) {
        scene.remove(propPool[p].group);
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
          var baseOff = EDGE_X + SHOULDER + 2.5;
          var spread = 2 + propRng() * 26;
          var bx = side * (baseOff + spread);
          var pz = Z_RECYCLE - (n + 0.5) * (Math.abs(Z_SPAN) / PROPS_PER_SIDE) - propRng() * 6;
          grp.userData.z = pz;
          grp.userData.baseX = bx;
          grp.userData.baseY = 0;
          grp.userData.yaw0 = propRng() * 6.28;
          grp.userData.alignYaw = false;
          if (grp.rotation && grp.rotation.set) grp.rotation.set(0, grp.userData.yaw0, 0);
          curved(grp, bx, false);
          scene.add(grp); applyCurve(grp);
          propPool.push({ group: grp });
        }
      }
    }

    // ---- Apply palette ------------------------------------------------------
    function applyPalette(t) {
      try {
        if (scene.background && scene.background.setHex) scene.background.setHex(t.sky);
        else scene.background = new THREE.Color(t.sky);
      } catch (e) { scene.background = new THREE.Color(t.sky); }
      scene.fog = new THREE.Fog(t.fog, t.fogNear, t.fogFar);
      if (groundMat.color && groundMat.color.setHex) groundMat.color.setHex(t.ground);
      if (roadMat.color && roadMat.color.setHex) roadMat.color.setHex(t.road);
      if (typeof t.roadRough === "number") roadMat.roughness = t.roadRough;
      if (accentMat.color && accentMat.color.setHex) accentMat.color.setHex(t.accent);
      if (hemi.color && hemi.color.setHex) hemi.color.setHex(t.hemiSky);
      if (hemi.groundColor && hemi.groundColor.setHex) hemi.groundColor.setHex(t.hemiGround);
      if (sun.color && sun.color.setHex) sun.color.setHex(t.sun);
      if (sun.position && sun.position.set) sun.position.set(t.sunDir[0], t.sunDir[1], t.sunDir[2]);

      var showWater = (t.id === "sea" || t.id === "bridge");
      for (var w = 0; w < waterSegments.length; w++) waterSegments[w].visible = showWater;
      if (showWater && waterMat.color && waterMat.color.setHex) {
        waterMat.color.setHex(t.id === "sea" ? 0x1f6f9c : 0x2f6680);
      }
      // road gets glossier over water themes for a "wet-ish" reflective look
      if (t.id === "sea" || t.id === "bridge") roadMat.roughness = Math.min(roadMat.roughness, 0.4);
    }

    function applyTheme(id) {
      theme = themeById(id);
      applyPalette(theme);
      regenEnvironment(theme);
      buildPropsFor(theme.id);
    }

    applyTheme(theme.id);

    // ---- update -------------------------------------------------------------
    var waterPhase = 0;
    var travelled = 0;       // accumulates so curvature flows toward the player

    function recycleAndCurve(list, span, recycleZ, dz) {
      for (var j = 0; j < list.length; j++) {
        var o = list[j];
        var nz = o.userData.z + dz;
        if (nz > recycleZ) nz -= span;
        o.userData.z = nz;
        applyCurve(o);
      }
    }

    inst.update = function (dt, speed, distance) {
      var sp = typeof speed === "number" ? speed : 0;
      var d = typeof dt === "number" ? dt : 0;
      var dz = sp * d;
      travelled += dz;

      var groundSpan = groundSegN * GROUND_SEG_LEN;
      var roadSpan = roadSegN * ROAD_SEG_LEN;
      var jointSpan = jointN * JOINT_GAP;
      var curbSpan = curbN * CURB_LEN;
      var railSpan = railN * RAIL_LEN;
      var postSpan = postN * POST_GAP;
      var dashSpan = dashN * dashPitch;
      var edgeSpan = roadSegN * EDGE_SEG_LEN;
      var propSpan = Math.abs(Z_SPAN);
      var waterSpan = waterSegN * WATER_SEG_LEN;

      recycleAndCurve(groundSegments, groundSpan, Z_RECYCLE + GROUND_SEG_LEN, dz);
      recycleAndCurve(roadSegments, roadSpan, Z_RECYCLE + ROAD_SEG_LEN, dz);
      recycleAndCurve(joints, jointSpan, Z_RECYCLE + JOINT_GAP, dz);
      recycleAndCurve(shoulders, roadSpan, Z_RECYCLE + ROAD_SEG_LEN, dz);
      recycleAndCurve(curbs, curbSpan, Z_RECYCLE + CURB_LEN, dz);
      recycleAndCurve(rails, railSpan, Z_RECYCLE + RAIL_LEN, dz);
      recycleAndCurve(posts, postSpan, Z_RECYCLE, dz);
      recycleAndCurve(dashes, dashSpan, Z_RECYCLE, dz);
      recycleAndCurve(studs, dashSpan, Z_RECYCLE, dz);
      recycleAndCurve(edgeLines, edgeSpan, Z_RECYCLE + EDGE_SEG_LEN, dz);

      // props recycle a little behind the player so pop-in stays off-screen
      for (var j = 0; j < propPool.length; j++) {
        var o = propPool[j].group;
        var nz = o.userData.z + dz;
        if (nz > Z_RECYCLE + 8) nz -= propSpan;
        o.userData.z = nz;
        applyCurve(o);
      }

      // animated specular water
      if (waterSegments.length && waterSegments[0].visible) {
        waterPhase += d;
        for (j = 0; j < waterSegments.length; j++) {
          var ws = waterSegments[j];
          var nzw = ws.userData.z + dz;
          if (nzw > Z_RECYCLE + WATER_SEG_LEN) nzw -= waterSpan;
          ws.userData.z = nzw;
          if (ws.position) {
            ws.position.x = curveX(nzw);
            ws.position.y = -3.2 + Math.sin(waterPhase * 1.1 + nzw * 0.05) * 0.08;
            ws.position.z = nzw;
          }
        }
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
      // tear down IBL artifacts
      try { if (envRT && envRT.dispose) envRT.dispose(); } catch (e) {}
      try { if (skyTexture && skyTexture.dispose) skyTexture.dispose(); } catch (e) {}
      try { if (pmrem && pmrem.dispose) pmrem.dispose(); } catch (e) {}
      for (var di = 0; di < disposables.length; di++) {
        try { if (disposables[di] && disposables[di].dispose) disposables[di].dispose(); } catch (e) {}
      }
      disposables.length = 0;
      envRT = null; skyTexture = null; pmrem = null;
      scene.fog = null;
      try { scene.environment = null; } catch (e) {}
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
