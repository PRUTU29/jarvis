/**
 * J.A.R.V.I.S. — Three.js Cyberpunk Scene Engine
 * ================================================
 * A full-viewport 3D background for the AI dashboard.
 * THREE is expected as a global from the CDN script tag.
 *
 * Public API: window.JarvisScene.init(container)
 *             window.JarvisScene.setReactorState(state)
 *             window.JarvisScene.dispose()
 */
(function () {
  'use strict';

  // ─── Constants ──────────────────────────────────────────────
  var COLORS = {
    cyan:    0x00f2fe,
    magenta: 0xff2d95,
    purple:  0xb400ff,
    green:   0x39ff14,
    red:     0xff3e3e,
    white:   0xffffff
  };

  var GRID_SPACING   = 2;
  var GRID_EXTENT    = 100;
  var PARTICLE_COUNT = 1500;
  var MATRIX_COLS    = 20;
  var MATRIX_PER_COL = 30;

  // ─── Module-level state ─────────────────────────────────────
  var renderer, scene, camera, clock;
  var container;
  var animFrameId = null;

  // Objects
  var gridLines;
  var reactorGroup, coreLight, coreMesh;
  var rings = [];          // { mesh, baseSpeed, axis }
  var particleSystem, particlePositions, particleVelocities;
  var matrixSystems = [];  // [ { points, positions, speeds } ]

  // Mouse parallax
  var mouse = { x: 0, y: 0 };
  var cameraBase = { x: 0, y: 8, z: 20 };

  // Reactor state
  var currentState   = 'idle';
  var stateStartTime = 0;
  var errorTimeout   = null;

  // Ring base speeds (rad / frame at 60 fps → we'll multiply by dt)
  var BASE_RING_SPEEDS = [0.003 * 60, 0.005 * 60, 0.004 * 60]; // converted to rad/s

  // ─── Helpers ────────────────────────────────────────────────
  function lerp(a, b, t) { return a + (b - a) * t; }

  function colorLerp(colA, colB, t) {
    var a = new THREE.Color(colA);
    var b = new THREE.Color(colB);
    return a.lerp(b, t);
  }

  // ─── Grid Floor ─────────────────────────────────────────────
  function createGrid() {
    var positions = [];
    // Lines parallel to X axis (running along Z)
    for (var z = -GRID_EXTENT; z <= GRID_EXTENT; z += GRID_SPACING) {
      positions.push(-GRID_EXTENT, 0, z, GRID_EXTENT, 0, z);
    }
    // Lines parallel to Z axis (running along X)
    for (var x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_SPACING) {
      positions.push(x, 0, -GRID_EXTENT, x, 0, GRID_EXTENT);
    }

    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));

    var mat = new THREE.LineBasicMaterial({
      color:       COLORS.cyan,
      transparent: true,
      opacity:     0.15
    });

    gridLines = new THREE.LineSegments(geo, mat);
    scene.add(gridLines);
  }

  // ─── Arc Reactor ────────────────────────────────────────────
  function createReactor() {
    reactorGroup = new THREE.Group();
    reactorGroup.position.set(0, 5, 0);

    // Core sphere
    var coreGeo = new THREE.SphereGeometry(0.5, 32, 32);
    var coreMat = new THREE.MeshBasicMaterial({ color: COLORS.cyan });
    coreMesh = new THREE.Mesh(coreGeo, coreMat);
    reactorGroup.add(coreMesh);

    // Core glow (slightly larger, additive)
    var glowGeo = new THREE.SphereGeometry(0.7, 32, 32);
    var glowMat = new THREE.MeshBasicMaterial({
      color:       COLORS.cyan,
      transparent: true,
      opacity:     0.25,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false
    });
    var glowMesh = new THREE.Mesh(glowGeo, glowMat);
    reactorGroup.add(glowMesh);

    // Outer halo ring (very faint, large)
    var haloGeo = new THREE.RingGeometry(1.2, 1.8, 64);
    var haloMat = new THREE.MeshBasicMaterial({
      color:       COLORS.cyan,
      transparent: true,
      opacity:     0.08,
      side:        THREE.DoubleSide,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false
    });
    var haloMesh = new THREE.Mesh(haloGeo, haloMat);
    reactorGroup.add(haloMesh);

    // Point light inside core
    coreLight = new THREE.PointLight(COLORS.cyan, 2, 30);
    reactorGroup.add(coreLight);

    // Orbital rings
    var ringDefs = [
      { radius: 2.5, tube: 0.04, color: COLORS.cyan,    rx: 30,  ry: 0,   rz: 0   },
      { radius: 3.0, tube: 0.03, color: COLORS.magenta,  rx: -20, ry: 0,   rz: 45  },
      { radius: 3.5, tube: 0.025, color: COLORS.purple,  rx: 60,  ry: -30, rz: 0   }
    ];

    for (var i = 0; i < ringDefs.length; i++) {
      var def = ringDefs[i];
      var torusGeo = new THREE.TorusGeometry(def.radius, def.tube, 16, 100);
      var torusMat = new THREE.MeshBasicMaterial({
        color:       def.color,
        transparent: true,
        opacity:     0.85
      });
      var torus = new THREE.Mesh(torusGeo, torusMat);

      // Apply initial tilt
      torus.rotation.x = THREE.MathUtils.degToRad(def.rx);
      torus.rotation.y = THREE.MathUtils.degToRad(def.ry);
      torus.rotation.z = THREE.MathUtils.degToRad(def.rz);

      reactorGroup.add(torus);
      rings.push({
        mesh:      torus,
        baseSpeed: BASE_RING_SPEEDS[i],
        initRot:   { x: torus.rotation.x, y: torus.rotation.y, z: torus.rotation.z },
        // Each ring rotates around a different combination of axes for visual interest
        axis:      i  // 0 → Z, 1 → Y, 2 → X primary rotation
      });
    }

    // Add a subtle ambient light so the torus materials catch some shading (though BasicMaterial doesn't need it, kept for future material upgrades)
    scene.add(reactorGroup);
  }

  // ─── Particle System (Holographic Dust) ─────────────────────
  function createParticles() {
    var geo = new THREE.BufferGeometry();
    var pos = new Float32Array(PARTICLE_COUNT * 3);
    var vel = new Float32Array(PARTICLE_COUNT * 3); // vx, vy, vz

    for (var i = 0; i < PARTICLE_COUNT; i++) {
      var i3 = i * 3;
      pos[i3]     = (Math.random() - 0.5) * 60;  // x: [-30, 30]
      pos[i3 + 1] = Math.random() * 25;           // y: [0, 25]
      pos[i3 + 2] = (Math.random() - 0.5) * 60;  // z: [-30, 30]

      vel[i3]     = (Math.random() - 0.5) * 0.005; // x wander
      vel[i3 + 1] = 0.002 + Math.random() * 0.008; // y drift up
      vel[i3 + 2] = (Math.random() - 0.5) * 0.005; // z wander
    }

    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

    var mat = new THREE.PointsMaterial({
      color:       COLORS.cyan,
      size:        0.08,
      transparent: true,
      opacity:     0.5,
      blending:    THREE.AdditiveBlending,
      depthWrite:  false,
      sizeAttenuation: true
    });

    particleSystem     = new THREE.Points(geo, mat);
    particlePositions  = pos;
    particleVelocities = vel;
    scene.add(particleSystem);
  }

  // ─── Matrix Rain ────────────────────────────────────────────
  function createMatrixRain() {
    for (var col = 0; col < MATRIX_COLS; col++) {
      var count = MATRIX_PER_COL;
      var pos   = new Float32Array(count * 3);
      var speeds = new Float32Array(count);

      var baseX = (Math.random() - 0.5) * 80;
      var baseZ = -15 - Math.random() * 10;

      for (var j = 0; j < count; j++) {
        var j3 = j * 3;
        pos[j3]     = baseX + (Math.random() - 0.5) * 0.3; // tight column with slight jitter
        pos[j3 + 1] = (j / count) * 30 - 5;                // spread from -5 to 25
        pos[j3 + 2] = baseZ + (Math.random() - 0.5) * 0.3;

        speeds[j] = 0.03 + Math.random() * 0.06;
      }

      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));

      var mat = new THREE.PointsMaterial({
        color:       COLORS.green,
        size:        0.12,
        transparent: true,
        opacity:     0.3,
        blending:    THREE.AdditiveBlending,
        depthWrite:  false,
        sizeAttenuation: true
      });

      var points = new THREE.Points(geo, mat);
      scene.add(points);

      matrixSystems.push({ points: points, positions: pos, speeds: speeds, count: count });
    }
  }

  // ─── Event Handlers ─────────────────────────────────────────
  function onMouseMove(e) {
    // Normalize to -1 .. +1
    mouse.x = (e.clientX / window.innerWidth)  * 2 - 1;
    mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
  }

  function onWindowResize() {
    if (!renderer || !camera) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  }

  // ─── Animation Loop ─────────────────────────────────────────
  function animate() {
    animFrameId = requestAnimationFrame(animate);

    var dt    = Math.min(clock.getDelta(), 0.1); // clamp to avoid jumps
    var time  = clock.getElapsedTime();
    var speed = dt * 60; // normalize to 60fps baseline

    // --- Grid Scroll ---
    if (gridLines) {
      gridLines.position.z -= 0.02 * speed;
      if (gridLines.position.z <= -GRID_SPACING) {
        gridLines.position.z += GRID_SPACING;
      }
    }

    // --- Reactor State Modifiers ---
    var ringSpeedMult = 1;
    var targetCoreColor = COLORS.cyan;
    var particleSpeedMult = 1;

    switch (currentState) {
      case 'listening':
        ringSpeedMult     = 4;
        targetCoreColor   = COLORS.magenta;
        particleSpeedMult = 2.5;
        break;
      case 'speaking':
        ringSpeedMult     = 1 + Math.sin(time * 3) * 0.8;
        targetCoreColor   = COLORS.white;
        particleSpeedMult = 1.5;
        break;
      case 'error':
        // Flash red — the timeout will revert to idle
        targetCoreColor = COLORS.red;
        ringSpeedMult   = 0.2;
        break;
      default: // 'idle'
        break;
    }

    // --- Ring Rotation ---
    for (var r = 0; r < rings.length; r++) {
      var ring  = rings[r];
      var spd   = ring.baseSpeed * ringSpeedMult * dt;
      switch (ring.axis) {
        case 0: ring.mesh.rotation.z += spd; ring.mesh.rotation.x += spd * 0.3; break;
        case 1: ring.mesh.rotation.y += spd; ring.mesh.rotation.z += spd * 0.2; break;
        case 2: ring.mesh.rotation.x += spd; ring.mesh.rotation.y += spd * 0.4; break;
      }
    }

    // --- Core Pulse ---
    if (coreLight) {
      coreLight.intensity = 1.5 + Math.sin(time * 2) * 0.5;
      coreLight.color.set(targetCoreColor);
    }
    if (coreMesh) {
      coreMesh.material.color.lerp(new THREE.Color(targetCoreColor), 0.08);
    }

    // Gentle reactor bob
    if (reactorGroup) {
      reactorGroup.position.y = 5 + Math.sin(time * 0.8) * 0.25;
    }

    // --- Particle Update ---
    if (particleSystem) {
      var posArr = particlePositions;
      var velArr = particleVelocities;
      for (var p = 0; p < PARTICLE_COUNT; p++) {
        var p3 = p * 3;
        posArr[p3]     += velArr[p3]     * speed * particleSpeedMult;
        posArr[p3 + 1] += velArr[p3 + 1] * speed * particleSpeedMult;
        posArr[p3 + 2] += velArr[p3 + 2] * speed * particleSpeedMult;

        // Respawn
        if (posArr[p3 + 1] > 25) {
          posArr[p3]     = (Math.random() - 0.5) * 60;
          posArr[p3 + 1] = 0;
          posArr[p3 + 2] = (Math.random() - 0.5) * 60;
        }
      }
      particleSystem.geometry.attributes.position.needsUpdate = true;
    }

    // --- Matrix Rain Update ---
    for (var m = 0; m < matrixSystems.length; m++) {
      var sys = matrixSystems[m];
      for (var mi = 0; mi < sys.count; mi++) {
        var mi3 = mi * 3;
        sys.positions[mi3 + 1] -= sys.speeds[mi] * speed;
        if (sys.positions[mi3 + 1] < -5) {
          sys.positions[mi3 + 1] = 25;
        }
      }
      sys.points.geometry.attributes.position.needsUpdate = true;
    }

    // --- Camera Parallax ---
    var targetX = cameraBase.x + mouse.x * 2;
    var targetY = cameraBase.y - mouse.y * 1;
    camera.position.x = lerp(camera.position.x, targetX, 0.05);
    camera.position.y = lerp(camera.position.y, targetY, 0.05);
    camera.lookAt(0, 2, 0);

    // --- Render ---
    renderer.render(scene, camera);
  }

  // ─── Init ───────────────────────────────────────────────────
  function init(canvasContainer) {
    container = canvasContainer;

    // Renderer
    renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha:     true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0); // fully transparent
    container.appendChild(renderer.domElement);

    // Scene
    scene = new THREE.Scene();
    scene.background = null;

    // Subtle fog for depth
    scene.fog = new THREE.FogExp2(0x000000, 0.012);

    // Camera
    camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 200);
    camera.position.set(cameraBase.x, cameraBase.y, cameraBase.z);
    camera.lookAt(0, 2, 0);

    // A dim ambient so things aren't pitch-black (has no effect on MeshBasicMaterial, but good practice)
    var ambient = new THREE.AmbientLight(0x111122, 0.5);
    scene.add(ambient);

    // Clock
    clock = new THREE.Clock();

    // Build scene
    createGrid();
    createReactor();
    createParticles();
    createMatrixRain();

    // Events
    window.addEventListener('mousemove', onMouseMove, false);
    window.addEventListener('resize', onWindowResize, false);

    // Start
    animate();
  }

  // ─── Reactor State ──────────────────────────────────────────
  function setReactorState(state) {
    if (errorTimeout) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }

    var validStates = ['idle', 'listening', 'speaking', 'error'];
    if (validStates.indexOf(state) === -1) {
      console.warn('[JarvisScene] Unknown state:', state);
      return;
    }

    currentState   = state;
    stateStartTime = clock ? clock.getElapsedTime() : 0;

    if (state === 'error') {
      errorTimeout = setTimeout(function () {
        currentState = 'idle';
        errorTimeout = null;
      }, 1000);
    }
  }

  // ─── Dispose ────────────────────────────────────────────────
  function dispose() {
    if (animFrameId !== null) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }

    window.removeEventListener('mousemove', onMouseMove, false);
    window.removeEventListener('resize', onWindowResize, false);

    if (errorTimeout) {
      clearTimeout(errorTimeout);
      errorTimeout = null;
    }

    // Dispose all scene children
    if (scene) {
      scene.traverse(function (obj) {
        if (obj.geometry)  obj.geometry.dispose();
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach(function (m) { m.dispose(); });
          } else {
            obj.material.dispose();
          }
        }
      });
    }

    if (renderer) {
      renderer.dispose();
      if (renderer.domElement && renderer.domElement.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    }

    // Null out references
    renderer = scene = camera = clock = null;
    gridLines = reactorGroup = coreLight = coreMesh = null;
    rings = [];
    particleSystem = particlePositions = particleVelocities = null;
    matrixSystems = [];
    currentState = 'idle';
  }

  // ─── Public API ─────────────────────────────────────────────
  window.JarvisScene = {
    init:            init,
    setReactorState: setReactorState,
    dispose:         dispose
  };

})();
