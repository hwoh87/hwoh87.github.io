import * as THREE from 'three';
import { createCampus } from './campus.js';

/** A walkable Korean courtyard with five adjoining gardens and halls. */
export function createWorld() {
  const group = new THREE.Group();
  group.name = 'Samra — moonlit wish courtyard';
  const groundMeshes = [];
  const colliders = [];
  const bounds = { minX: -23, maxX: 23, minZ: -25, maxZ: 22 };
  const destinations = {
    wish: { x: 0, z: -6 },
    breath: { x: -7, z: 1 },
    blessing: { x: 7, z: 1 },
  };
  const up = new THREE.Vector3(0, 1, 0);
  const dummy = new THREE.Object3D();
  let seed = 7718;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const material = (color, options = {}) => new THREE.MeshStandardMaterial({
    color, roughness: 0.9, metalness: 0, ...options,
  });
  const stone = material('#69747a');
  const stoneEdge = material('#526066');
  const darkStone = material('#39494d');
  const timber = material('#573e2c');
  const timberLight = material('#806043');
  const timberDark = material('#302923');
  const plaster = material('#8e8f7c');
  const roofTile = material('#233d4e', { roughness: 0.72, metalness: 0.08 });
  const roofRib = material('#3c5969', { roughness: 0.72, metalness: 0.08 });
  const foliage = material('#35534d');
  const foliageLight = material('#527165');
  const treeBark = material('#645442');
  const brass = material('#b49556', { roughness: 0.48, metalness: 0.45 });
  const paper = material('#f3d99e', { emissive: '#ffb545', emissiveIntensity: 0.55 });
  const glow = new THREE.MeshBasicMaterial({ color: '#ffd48b' });
  const wishPaper = material('#e2d8bc', { emissive: '#a48e5c', emissiveIntensity: 0.13, side: THREE.DoubleSide });

  function mesh(geometry, mat, x = 0, y = 0, z = 0, shadow = true) {
    const object = new THREE.Mesh(geometry, mat);
    object.position.set(x, y, z);
    object.castShadow = shadow;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function box(w, h, d, mat, x, y, z, shadow = true) {
    return mesh(new THREE.BoxGeometry(w, h, d), mat, x, y, z, shadow);
  }
  function collider(minX, maxX, minZ, maxZ) {
    colliders.push({ minX, maxX, minZ, maxZ });
  }
  function instances(geometry, mat, transforms, shadow = true) {
    const object = new THREE.InstancedMesh(geometry, mat, transforms.length);
    transforms.forEach((entry, index) => {
      dummy.position.set(entry.x || 0, entry.y || 0, entry.z || 0);
      dummy.rotation.set(entry.rx || 0, entry.ry || 0, entry.rz || 0);
      dummy.scale.set(entry.sx ?? 1, entry.sy ?? 1, entry.sz ?? 1);
      dummy.updateMatrix();
      object.setMatrixAt(index, dummy.matrix);
      if (entry.color) object.setColorAt(index, new THREE.Color(entry.color));
    });
    object.instanceMatrix.needsUpdate = true;
    if (object.instanceColor) object.instanceColor.needsUpdate = true;
    object.castShadow = shadow;
    object.receiveShadow = true;
    group.add(object);
    return object;
  }
  function merged(geometries) {
    const positions = [];
    geometries.forEach((geometry) => {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      positions.push(...flat.getAttribute('position').array);
      if (flat !== geometry) flat.dispose();
      geometry.dispose();
    });
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
  function beamGeometry(a, b, radius, radial = 7) {
    const start = new THREE.Vector3(...a);
    const end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const geometry = new THREE.CylinderGeometry(radius * 0.85, radius, direction.length(), radial);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, direction.normalize());
    geometry.applyQuaternion(quaternion);
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    return geometry;
  }

  // Large dark ground beyond the walls keeps the world grounded when the camera turns.
  const outerGround = mesh(new THREE.CircleGeometry(76, 64), material('#1e3033'), 0, -0.16, 0, false);
  outerGround.rotation.x = -Math.PI / 2;
  const ground = mesh(new THREE.PlaneGeometry(26, 30), stone, 0, 0, 0, false);
  ground.rotation.x = -Math.PI / 2;
  ground.name = 'Walkable stone courtyard';
  groundMeshes.push(ground);
  box(26, 0.22, 30, stoneEdge, 0, -0.12, 0, false);

  // Individually coloured large paving flags share one draw call.
  const flags = [];
  const flagColors = ['#748084', '#6c787d', '#65747a', '#6e7d80', '#7b8586'];
  for (let iz = 0; iz < 24; iz += 1) {
    for (let ix = 0; ix < 20; ix += 1) {
      flags.push({
        x: -12.35 + ix * 1.3, y: -0.008, z: -14.375 + iz * 1.25,
        sx: 1.275, sy: 0.035, sz: 1.225,
        color: flagColors[Math.floor(random() * flagColors.length)],
      });
    }
  }
  instances(new THREE.BoxGeometry(1, 1, 1), material('#ffffff'), flags, false);

  const pathFlags = [];
  for (let z = -4.4; z < 12.5; z += 1.35) {
    pathFlags.push({ x: 0, y: 0.018, z, sx: 2.7, sy: 0.055, sz: 1.19, color: '#929c99' });
  }
  instances(new THREE.BoxGeometry(1, 1, 1), material('#ffffff'), pathFlags, false);

  // Boundary walls, capped with blue-grey traditional tiles.
  const walls = [
    // Gaps in the old precinct walls lead into the east and west halls.
    ...[-12.75, 12.75].flatMap((x) => [
      { x, z: -13, sx: 0.5, sz: 3 },
      { x, z: -4.5, sx: 0.5, sz: 4 },
      { x, z: 4, sx: 0.5, sz: 3 },
      { x, z: 12.5, sx: 0.5, sz: 4 },
    ]),
    { x: -11.125, z: -14.5, sx: 3.25, sz: 0.5 },
    { x: 0, z: -14.5, sx: 9, sz: 0.5 },
    { x: 11.125, z: -14.5, sx: 3.25, sz: 0.5 },
    { x: -8.15, z: 14.5, sx: 9.2, sz: 0.5 },
    { x: 8.15, z: 14.5, sx: 9.2, sz: 0.5 },
  ];
  instances(new THREE.BoxGeometry(1, 1, 1), stoneEdge, walls.map((w) => ({ ...w, y: 0.42, sy: 0.84 })));
  instances(new THREE.BoxGeometry(1, 1, 1), roofTile, walls.map((w) => ({ ...w, y: 0.91, sy: 0.18, sx: w.sx + 0.16, sz: w.sz + 0.16 })));
  walls.forEach((w) => collider(w.x - w.sx / 2, w.x + w.sx / 2, w.z - w.sz / 2, w.z + w.sz / 2));
  const wallPosts = [];
  [-12.75, 12.75].forEach((x) => {
    [-13.8, -11.5, -6.5, -2.5, 2.5, 5.5, 10.5, 13.8].forEach((z) => wallPosts.push({ x, y: 0.55, z, sx: 0.72, sy: 1.1, sz: 0.72 }));
  });
  [-11.5, -9.5, -4.5, 0, 4.5, 9.5, 11.5].forEach((x) => wallPosts.push({ x, y: 0.55, z: -14.5, sx: 0.72, sy: 1.1, sz: 0.72 }));
  instances(new THREE.BoxGeometry(1, 1, 1), darkStone, wallPosts);

  // Main shrine: a raised wooden floor with an accessible central stone approach.
  const hallZ = -9.5;
  box(9.4, 0.3, 6.2, stoneEdge, 0, 0.15, hallZ, false);
  const porch = box(9.1, 0.09, 6, timberLight, 0, 0.285, hallZ, false);
  porch.name = 'Walkable shrine floor';
  groundMeshes.push(porch);
  const rampGeometry = new THREE.BufferGeometry();
  rampGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    -1.65, 0.02, -4.7, 1.65, 0.02, -4.7, -1.65, 0.33, -6.5,
    1.65, 0.02, -4.7, 1.65, 0.33, -6.5, -1.65, 0.33, -6.5,
  ], 3));
  rampGeometry.computeVertexNormals();
  const ramp = mesh(rampGeometry, stone, 0, 0, 0, false);
  ramp.name = 'Accessible shrine approach';
  groundMeshes.push(ramp);
  const stepLedges = [];
  for (let i = 0; i < 3; i += 1) {
    const z = -5.95 - i * 0.22;
    [-3.15, 3.15].forEach((x) => stepLedges.push({ x, y: 0.04 + i * 0.055, z, sx: 2.9, sy: 0.08 + i * 0.11, sz: 0.26 }));
  }
  instances(new THREE.BoxGeometry(1, 1, 1), stone, stepLedges, false);
  // Porch edges are physical; approach the building through the central ramp.
  collider(-4.7, -1.65, -6.61, -6.27);
  collider(1.65, 4.7, -6.61, -6.27);
  collider(-4.72, -4.45, -12.6, -6.27);
  collider(4.45, 4.72, -12.6, -6.27);
  collider(-4.72, 4.72, -12.6, -12.3);

  const floorPlanks = [];
  for (let z = -12.25; z < -6.5; z += 0.43) floorPlanks.push({ x: 0, y: 0.337, z, sx: 9, sy: 0.012, sz: 0.018 });
  instances(new THREE.BoxGeometry(1, 1, 1), timberDark, floorPlanks, false);
  box(8.6, 2.95, 0.18, plaster, 0, 1.8, -12);
  box(0.18, 2.95, 5.2, plaster, -4.22, 1.8, -9.4);
  box(0.18, 2.95, 5.2, plaster, 4.22, 1.8, -9.4);
  collider(-4.34, -4.1, -12.14, -6.8);
  collider(4.1, 4.34, -12.14, -6.8);
  collider(-4.34, 4.34, -12.14, -11.9);
  collider(-4.1, -1.15, -6.93, -6.65);
  collider(1.15, 4.1, -6.93, -6.65);

  const columnPositions = [];
  [-4.15, -2.7, -1.23, 1.23, 2.7, 4.15].forEach((x) => {
    columnPositions.push({ x, y: 1.88, z: -6.8, sx: 0.16, sy: 3.15, sz: 0.16 });
  });
  [-4.15, 4.15].forEach((x) => {
    [-9.4, -11.9].forEach((z) => columnPositions.push({ x, y: 1.88, z, sx: 0.16, sy: 3.15, sz: 0.16 }));
  });
  instances(new THREE.CylinderGeometry(1, 1.08, 1, 10), timber, columnPositions);
  instances(new THREE.CylinderGeometry(1, 1.1, 1, 8), darkStone, columnPositions.map((p) => ({ ...p, y: 0.39, sx: 0.28, sy: 0.13, sz: 0.28 })), false);
  const structuralBeams = [
    { x: 0, y: 3.38, z: -6.8, sx: 9.25, sy: 0.25, sz: 0.26 },
    { x: 0, y: 3.68, z: -6.8, sx: 9.6, sy: 0.16, sz: 0.25 },
    { x: 0, y: 3.4, z: -11.95, sx: 9.25, sy: 0.25, sz: 0.26 },
    { x: -4.15, y: 3.4, z: -9.4, sx: 0.25, sy: 0.25, sz: 5.5 },
    { x: 4.15, y: 3.4, z: -9.4, sx: 0.25, sy: 0.25, sz: 5.5 },
  ];
  instances(new THREE.BoxGeometry(1, 1, 1), timber, structuralBeams);
  const windowMat = material('#d2ad65', { emissive: '#ffc35c', emissiveIntensity: 0.5, roughness: 1, side: THREE.DoubleSide });
  [-2.72, 2.72].forEach((x) => {
    box(2.8, 2.58, 0.075, timberLight, x, 1.7, -6.83);
    box(2.6, 2.3, 0.024, windowMat, x, 1.73, -6.775, false);
  });
  const lattice = [];
  [-2.72, 2.72].forEach((x) => {
    for (let i = 0; i <= 10; i += 1) lattice.push({ x: x - 1.3 + i * 0.26, y: 1.73, z: -6.75, sx: 0.025, sy: 2.34, sz: 0.035 });
    for (let i = 0; i <= 9; i += 1) lattice.push({ x, y: 0.58 + i * 0.255, z: -6.742, sx: 2.64, sy: 0.026, sz: 0.035 });
    lattice.push({ x, y: 1.73, z: -6.73, sx: 0.07, sy: 2.45, sz: 0.07 });
  });
  instances(new THREE.BoxGeometry(1, 1, 1), timberDark, lattice, false);

  // Curved hipped Korean roof: continuous curved tile skins and rounded tile ribs.
  const roofY = (v, x) => 5.43 - 1.95 * v + 0.39 * v * v + 0.43 * Math.pow(Math.abs(x) / 5.65, 5) * v * v;
  function roofPoint(face, u, v) {
    const width = 3.95 + 1.7 * v;
    if (face === 0 || face === 1) {
      const x = u * width;
      return new THREE.Vector3(x, roofY(v, x), hallZ + (face === 0 ? 1 : -1) * v * 3.8);
    }
    const x = (face === 2 ? 1 : -1) * width;
    return new THREE.Vector3(x, roofY(v, x), hallZ + u * v * 3.8);
  }
  function roofSurface(face, columns = 28, rows = 14) {
    const positions = [];
    const indices = [];
    for (let row = 0; row <= rows; row += 1) {
      for (let col = 0; col <= columns; col += 1) positions.push(...roofPoint(face, col / columns * 2 - 1, row / rows).toArray());
    }
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < columns; col += 1) {
        const a = row * (columns + 1) + col;
        const b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    return geometry;
  }
  const tileSkinMat = roofTile.clone();
  tileSkinMat.side = THREE.DoubleSide;
  const roof = mesh(merged([0, 1, 2, 3].map((face) => roofSurface(face))), tileSkinMat);
  roof.name = 'Curved Korean tile roof';
  const ribs = [];
  [0, 1].forEach((face) => {
    for (let i = 0; i <= 30; i += 1) {
      const points = [];
      for (let j = 0; j <= 12; j += 1) {
        const point = roofPoint(face, i / 30 * 2 - 1, j / 12);
        point.y += 0.035;
        points.push(point);
      }
      ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 12, 0.045, 5, false));
    }
  });
  [2, 3].forEach((face) => {
    for (let i = 0; i <= 16; i += 1) {
      const points = [];
      for (let j = 0; j <= 10; j += 1) {
        const point = roofPoint(face, i / 16 * 2 - 1, j / 10);
        point.y += 0.035;
        points.push(point);
      }
      ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 10, 0.043, 5, false));
    }
  });
  // The two roof slopes meet under one raised tiled ridge.
  const ridgePoints = [];
  for (let i = 0; i <= 18; i += 1) {
    const x = -4.12 + i / 18 * 8.24;
    ridgePoints.push(new THREE.Vector3(x, 5.52 + 0.2 * Math.pow(Math.abs(x) / 4.12, 5), hallZ));
  }
  ribs.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridgePoints), 30, 0.12, 8, false));
  mesh(merged(ribs), roofRib, 0, 0, 0, false);
  const eaveTrims = [];
  [0, 1].forEach((face) => {
    const points = [];
    for (let i = 0; i <= 30; i += 1) {
      const point = roofPoint(face, i / 30 * 2 - 1, 1);
      point.y -= 0.08;
      points.push(point);
    }
    eaveTrims.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 32, 0.1, 6, false));
  });
  [2, 3].forEach((face) => {
    const points = [];
    for (let i = 0; i <= 18; i += 1) {
      const point = roofPoint(face, i / 18 * 2 - 1, 1);
      point.y -= 0.08;
      points.push(point);
    }
    eaveTrims.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 20, 0.1, 6, false));
  });
  mesh(merged(eaveTrims), timberDark, 0, 0, 0, false);
  const rafters = [];
  for (let x = -4.8; x < 5; x += 0.39) {
    rafters.push({ x, y: 3.8 + 0.32 * Math.pow(Math.abs(x) / 5, 4), z: -6.3, sx: 0.095, sy: 0.12, sz: 1.36, rx: 0.16 });
    rafters.push({ x, y: 3.8 + 0.32 * Math.pow(Math.abs(x) / 5, 4), z: -12.7, sx: 0.095, sy: 0.12, sz: 1.36, rx: -0.16 });
  }
  instances(new THREE.BoxGeometry(1, 1, 1), timberLight, rafters, false);
  const brackets = [];
  [-4.15, -2.7, -1.23, 1.23, 2.7, 4.15].forEach((x) => {
    brackets.push({ x, y: 3.45, z: -6.82, sx: 0.62, sy: 0.11, sz: 0.5 });
    brackets.push({ x, y: 3.57, z: -6.82, sx: 0.9, sy: 0.1, sz: 0.45 });
    brackets.push({ x, y: 3.66, z: -6.82, sx: 0.2, sy: 0.14, sz: 0.72 });
  });
  instances(new THREE.BoxGeometry(1, 1, 1), timber, brackets, false);

  // A modest altar, empty of religious figures, invites the user into the hall.
  box(3.8, 0.18, 1.25, timberDark, 0, 0.43, -10.72);
  box(3.4, 0.17, 1.1, timberLight, 0, 1.12, -10.72);
  const altarLegs = [];
  [-1.42, 1.42].forEach((x) => [-11.06, -10.38].forEach((z) => altarLegs.push({ x, y: 0.78, z, sx: 0.12, sy: 0.7, sz: 0.12 })));
  instances(new THREE.BoxGeometry(1, 1, 1), timber, altarLegs);
  const altarBowl = mesh(new THREE.CylinderGeometry(0.34, 0.2, 0.17, 18, 1, true), brass, 0, 1.29, -10.72, false);
  altarBowl.material.side = THREE.DoubleSide;
  mesh(new THREE.CylinderGeometry(0.24, 0.29, 0.06, 18), material('#ddd1af'), 0, 1.27, -10.72, false);
  const altarCandles = [];
  [-1.12, 1.12].forEach((x) => altarCandles.push({ x, y: 1.37, z: -10.72, sx: 0.075, sy: 0.42, sz: 0.075 }));
  instances(new THREE.CylinderGeometry(1, 1, 1, 10), paper, altarCandles, false);
  const candleFlames = [];
  [-1.12, 1.12].forEach((x) => candleFlames.push({ x, y: 1.63, z: -10.72, sx: 0.04, sy: 0.1, sz: 0.04 }));
  instances(new THREE.SphereGeometry(1, 8, 6), glow, candleFlames, false);
  collider(-1.95, 1.95, -11.4, -10.06);

  // The left pool contains real, softly animated lantern meshes.
  const pondX = -8;
  const pondZ = -3.9;
  const waterMat = material('#173c48', { roughness: 0.22, metalness: 0.52, transparent: true, opacity: 0.91, emissive: '#0b2732', emissiveIntensity: 0.22 });
  const water = mesh(new THREE.CircleGeometry(3, 56), waterMat, pondX, 0.065, pondZ, false);
  water.rotation.x = -Math.PI / 2;
  water.scale.y = 0.81;
  water.name = 'Lantern pool';
  mesh(new THREE.CylinderGeometry(3.2, 3.35, 0.16, 40), darkStone, pondX, -0.05, pondZ, false).scale.z = 0.81;
  collider(-11.32, -4.68, -6.57, -1.23);
  const pondStones = [];
  for (let i = 0; i < 28; i += 1) {
    const angle = i / 28 * Math.PI * 2;
    pondStones.push({ x: pondX + Math.cos(angle) * 3.12, y: 0.09, z: pondZ + Math.sin(angle) * 2.55, sx: 0.39 + random() * 0.1, sy: 0.23 + random() * 0.08, sz: 0.32 + random() * 0.1, ry: -angle, color: random() > 0.5 ? '#6a7776' : '#566666' });
  }
  instances(new THREE.IcosahedronGeometry(1, 0), material('#ffffff', { flatShading: true }), pondStones, false);
  const rippleMat = new THREE.MeshBasicMaterial({ color: '#60808b', transparent: true, opacity: 0.13, side: THREE.DoubleSide, depthWrite: false });
  const ripples = [];
  [0.7, 1.5, 2.25].forEach((radius) => {
    const ripple = mesh(new THREE.RingGeometry(radius, radius + 0.012, 56), rippleMat, pondX, 0.075, pondZ, false);
    ripple.rotation.x = -Math.PI / 2;
    ripple.scale.y = 0.81;
    ripples.push(ripple);
  });
  const maxWishLights = 28;
  const wishLanterns = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.19, 0.27, 8), paper, maxWishLights);
  const wishBases = new THREE.InstancedMesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), timberLight, maxWishLights);
  const wishCaps = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.155, 0.155, 0.035, 8), brass, maxWishLights);
  [wishLanterns, wishBases, wishCaps].forEach((object) => {
    object.castShadow = false;
    object.receiveShadow = true;
    object.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    object.frustumCulled = false;
    group.add(object);
  });
  const lanternPositions = Array.from({ length: maxWishLights }, (_, i) => {
    const angle = i * 2.39996;
    const radius = 0.4 + Math.sqrt((i + 0.3) / maxWishLights) * 2.22;
    return { x: pondX + Math.cos(angle) * radius, z: pondZ + Math.sin(angle) * radius * 0.78, phase: random() * Math.PI * 2 };
  });
  let wishLightCount = 0;
  function setWishCount(count) {
    // A small welcome light remains even before a visitor leaves their first wish.
    wishLightCount = Math.min(maxWishLights, Math.max(1, Math.round(Number(count) || 0) + 1));
    wishLanterns.count = wishLightCount;
    wishBases.count = wishLightCount;
    wishCaps.count = wishLightCount;
  }
  setWishCount(0);

  // An accessible meditation circle lies on the near-left side of the water.
  const meditationX = -7;
  const meditationZ = 1;
  const meditation = mesh(new THREE.CylinderGeometry(2.15, 2.3, 0.06, 36), stoneEdge, meditationX, 0.025, meditationZ, false);
  meditation.name = 'Walkable breathing circle';
  groundMeshes.push(meditation);
  const meditationRing = mesh(new THREE.TorusGeometry(1.8, 0.025, 5, 64), brass, meditationX, 0.065, meditationZ, false);
  meditationRing.rotation.x = Math.PI / 2;
  const mat = mesh(new THREE.CylinderGeometry(0.82, 0.82, 0.045, 32), material('#87918a'), meditationX, 0.08, meditationZ, false);
  mat.name = 'Woven resting mat';
  groundMeshes.push(mat);
  const matRings = [];
  [0.27, 0.49, 0.7].forEach((r) => {
    const geometry = new THREE.TorusGeometry(r, 0.008, 4, 40);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(meditationX, 0.104, meditationZ);
    matRings.push(geometry);
  });
  mesh(merged(matRings), timberLight, 0, 0, 0, false);

  // Blessing tree: individually tapered branches, asymmetrical sage leaf clusters,
  // and small paper wishes which sway independently in the night air.
  const treeX = 7;
  const treeZ = -0.3;
  const treeBranches = [
    [[treeX, 0, treeZ], [treeX - 0.25, 1.8, treeZ + 0.08], 0.3],
    [[treeX - 0.25, 1.6, treeZ + 0.08], [treeX + 0.1, 3.5, treeZ], 0.2],
    [[treeX - 0.1, 2.4, treeZ], [treeX - 1.5, 3.5, treeZ + 0.1], 0.15],
    [[treeX, 2.7, treeZ], [treeX + 1.45, 3.7, treeZ - 0.2], 0.14],
    [[treeX + 0.05, 3.1, treeZ], [treeX + 0.1, 4.45, treeZ + 0.1], 0.1],
    [[treeX - 0.7, 2.95, treeZ], [treeX - 1.6, 4, treeZ - 0.7], 0.09],
    [[treeX + 0.65, 3.13, treeZ], [treeX + 1.8, 3.95, treeZ + 0.65], 0.085],
  ];
  mesh(merged(treeBranches.map(([a, b, r]) => beamGeometry(a, b, r))), treeBark);
  collider(6.55, 7.4, -0.7, 0.13);
  const blessingLeaves = [
    { x: 5.5, y: 3.8, z: -0.4, sx: 1.18, sy: 0.58, sz: 0.97 },
    { x: 6.5, y: 4.3, z: -0.8, sx: 1.15, sy: 0.69, sz: 0.96 },
    { x: 7.45, y: 4.55, z: -0.3, sx: 1.13, sy: 0.65, sz: 1.03 },
    { x: 8.5, y: 4.02, z: -0.6, sx: 1.23, sy: 0.61, sz: 0.99 },
    { x: 8.15, y: 3.95, z: 0.6, sx: 1.07, sy: 0.6, sz: 0.91 },
    { x: 6.18, y: 3.63, z: 0.55, sx: 1.1, sy: 0.62, sz: 0.9 },
  ];
  instances(new THREE.IcosahedronGeometry(1, 1), foliageLight, blessingLeaves);
  const ribbonPivots = [];
  for (let i = 0; i < 16; i += 1) {
    const angle = i * 2.3999;
    const radius = 0.9 + (i % 3) * 0.32;
    const pivot = new THREE.Group();
    pivot.position.set(treeX + Math.cos(angle) * radius, 3.65 + (i % 4) * 0.14, treeZ + Math.sin(angle) * radius * 0.68);
    const ribbon = new THREE.Mesh(new THREE.PlaneGeometry(0.12 + (i % 2) * 0.025, 0.48), wishPaper);
    ribbon.position.y = -0.28;
    ribbon.rotation.y = angle;
    const tie = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.1, 4), brass);
    tie.position.y = -0.04;
    pivot.add(ribbon, tie);
    group.add(pivot);
    ribbonPivots.push({ pivot, phase: i * 0.8 });
  }
  const treeBorder = [];
  for (let i = 0; i < 12; i += 1) {
    const angle = i / 12 * Math.PI * 2;
    treeBorder.push({ x: treeX + Math.cos(angle) * 0.8, y: 0.1, z: treeZ + Math.sin(angle) * 0.65, sx: 0.3, sy: 0.18, sz: 0.25, ry: angle });
  }
  instances(new THREE.IcosahedronGeometry(1, 0), stoneEdge, treeBorder, false);

  // Flattened clusters form irregular Korean pines rather than a forest of cones.
  const pineTrunks = [];
  const pineLeaves = [];
  const pineSites = [
    [-10.8, -10.3, 1], [-8.3, -12.3, 0.88], [10.6, -10.7, 1.07], [8.2, -12.6, 0.92],
    [-11.25, 5.2, 0.84], [-10.8, 10.6, 1.05], [11, 7.1, 0.82], [10.7, 11.5, 1.1],
    [-17, -16, 1.4], [17.4, -17, 1.5], [-23.8, 0.3, 1.4], [23.8, 3.6, 1.35],
    [-25.5, 17, 1.2], [25.5, 19, 1.25],
  ];
  pineSites.forEach(([x, z, scale], index) => {
    const lean = (index % 2 ? 1 : -1) * 0.3 * scale;
    const h = 4.4 * scale;
    pineTrunks.push(beamGeometry([x, 0, z], [x + lean, h * 0.86, z + 0.12], 0.2 * scale));
    for (let branch = 0; branch < 4; branch += 1) {
      const side = branch % 2 ? 1 : -1;
      const by = h * (0.43 + branch * 0.14);
      const bx = x + lean + side * (0.8 - branch * 0.08) * scale;
      const bz = z + (branch % 3 - 1) * 0.6 * scale;
      pineTrunks.push(beamGeometry([x + lean * 0.6, by - 0.25, z], [bx, by + 0.3, bz], 0.07 * scale));
      pineLeaves.push({ x: bx, y: by + 0.45, z: bz, sx: (1.1 - branch * 0.06) * scale, sy: 0.42 * scale, sz: 0.89 * scale, ry: index * 0.7 + branch, color: branch % 2 ? '#3b5b51' : '#304e47' });
    }
    pineLeaves.push({ x: x + lean, y: h + 0.03, z: z + 0.1, sx: 0.77 * scale, sy: 0.48 * scale, sz: 0.72 * scale, color: '#466356' });
    if (x > bounds.minX && x < bounds.maxX && z > bounds.minZ && z < bounds.maxZ) collider(x - 0.3, x + 0.3, z - 0.3, z + 0.3);
  });
  mesh(merged(pineTrunks), treeBark);
  instances(new THREE.IcosahedronGeometry(1, 1), material('#ffffff', { flatShading: true }), pineLeaves);

  const rockSites = [];
  const shrubs = [];
  pineSites.slice(0, 8).forEach(([x, z, scale], index) => {
    for (let i = 0; i < 3; i += 1) {
      const rx = x + (random() - 0.5) * 2;
      const rz = z + (random() - 0.5) * 1.6;
      rockSites.push({ x: rx, y: 0.17, z: rz, sx: (0.38 + random() * 0.44) * scale, sy: 0.3 + random() * 0.35, sz: 0.35 + random() * 0.4, ry: random() * 3, color: index % 2 ? '#647170' : '#4e6464' });
      shrubs.push({ x: rx + 0.25, y: 0.21, z: rz - 0.15, sx: 0.5 + random() * 0.2, sy: 0.3, sz: 0.4 + random() * 0.2 });
    }
  });
  instances(new THREE.IcosahedronGeometry(1, 0), material('#ffffff', { flatShading: true }), rockSites);
  instances(new THREE.IcosahedronGeometry(1, 1), foliage, shrubs, false);

  // Warm paper lanterns: silhouettes have caps, ribs, cords and wooden pedestals.
  const lanternSites = [
    [-3.7, -5.9, 2.8, false], [3.7, -5.9, 2.8, false],
    [-5.8, -9.8, 1.85, true], [5.8, -9.8, 1.85, true],
    [-3.7, 6.1, 1.65, true], [3.7, 6.1, 1.65, true],
    [-3.7, 12, 1.8, true], [3.7, 12, 1.8, true],
    [-9.6, -0.65, 1.4, true], [9.9, 1.2, 1.65, true],
  ];
  const lanternBodies = [];
  const lanternMetal = [];
  const lanternRibs = [];
  const lanternPosts = [];
  const lanternFoot = [];
  lanternSites.forEach(([x, z, y, onPost]) => {
    lanternBodies.push({ x, y, z, sx: 0.25, sy: 0.58, sz: 0.25 });
    lanternMetal.push({ x, y: y + 0.32, z, sx: 0.28, sy: 0.05, sz: 0.28 });
    lanternMetal.push({ x, y: y - 0.32, z, sx: 0.28, sy: 0.05, sz: 0.28 });
    for (let i = 0; i < 8; i += 1) {
      const angle = i / 8 * Math.PI * 2;
      lanternRibs.push({ x: x + Math.cos(angle) * 0.247, y, z: z + Math.sin(angle) * 0.247, sx: 0.015, sy: 0.59, sz: 0.015 });
    }
    if (onPost) {
      lanternPosts.push({ x, y: (y - 0.3) / 2, z, sx: 0.085, sy: y - 0.3, sz: 0.085 });
      lanternFoot.push({ x, y: 0.12, z, sx: 0.3, sy: 0.24, sz: 0.3 });
      collider(x - 0.24, x + 0.24, z - 0.24, z + 0.24);
    } else {
      lanternRibs.push({ x, y: y + 0.59, z, sx: 0.012, sy: 0.55, sz: 0.012 });
    }
  });
  instances(new THREE.CylinderGeometry(1, 1, 1, 8), paper, lanternBodies, false);
  instances(new THREE.CylinderGeometry(1, 1.1, 1, 8), timberDark, lanternMetal, false);
  instances(new THREE.BoxGeometry(1, 1, 1), timberDark, lanternRibs, false);
  instances(new THREE.CylinderGeometry(1, 1.2, 1, 8), timber, lanternPosts);
  instances(new THREE.BoxGeometry(1, 1, 1), stoneEdge, lanternFoot, false);
  const shrineLight = new THREE.PointLight('#ffc469', 8, 11, 1.7);
  shrineLight.position.set(0, 2.3, -9.1);
  group.add(shrineLight);
  const treeLight = new THREE.PointLight('#e6bd79', 3, 7, 2);
  treeLight.position.set(7, 2.1, -0.3);
  group.add(treeLight);
  const pondLight = new THREE.PointLight('#f9be6e', 2.5, 6, 2);
  pondLight.position.set(-8, 0.9, -3.8);
  group.add(pondLight);

  // Mountains are extruded, layered geometry. No sky or scenery image is used.
  function mountainRange(points, z, color, depth) {
    const shape = new THREE.Shape();
    shape.moveTo(points[0][0], -1.6);
    points.forEach(([x, y]) => shape.lineTo(x, y));
    shape.lineTo(points[points.length - 1][0], -1.6);
    shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
    const object = mesh(geometry, material(color, { flatShading: true }), 0, -0.2, z, false);
    return object;
  }
  mountainRange([[-60, 4], [-49, 8], [-40, 6], [-33, 11], [-27, 14], [-19, 10], [-12, 12], [-6, 8], [2, 13], [8, 9], [17, 15], [25, 10], [33, 12], [41, 7], [51, 9], [60, 4]], -60, '#334a63', 5);
  mountainRange([[-50, 3], [-41, 7], [-35, 6], [-28, 11], [-20, 7], [-14, 9], [-6, 5], [2, 8], [10, 11], [17, 7], [25, 10], [32, 6], [42, 8], [50, 3]], -46, '#263e51', 4);
  mountainRange([[-41, 3], [-33, 7], [-25, 5], [-19, 9], [-11, 4], [-4, 6], [5, 4], [13, 7], [19, 10], [26, 6], [35, 7], [42, 3]], -34, '#1f3543', 4);
  const moon = mesh(new THREE.SphereGeometry(3.15, 40, 24), new THREE.MeshBasicMaterial({ color: '#f1e6c2', fog: false }), -5, 16, -45, false);
  moon.name = 'Full moon';
  const moonHalo = mesh(new THREE.SphereGeometry(3.55, 32, 20), new THREE.MeshBasicMaterial({ color: '#b7d0df', transparent: true, opacity: 0.045, depthWrite: false, side: THREE.BackSide, fog: false }), -5, 16, -45, false);
  moonHalo.name = 'Soft moon halo';
  const moonCraters = [];
  for (let i = 0; i < 9; i += 1) {
    const angle = i * 2.3999;
    const radius = 0.5 + (i % 3) * 0.63;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    const z = Math.sqrt(3.15 * 3.15 - x * x - y * y);
    moonCraters.push({ x: -5 + x, y: 16 + y, z: -45 + z + 0.015, sx: 0.23 + (i % 3) * 0.1, sy: 0.16 + (i % 2) * 0.06, sz: 0.025, rz: angle });
  }
  instances(new THREE.SphereGeometry(1, 10, 8), new THREE.MeshBasicMaterial({ color: '#d7cfae', transparent: true, opacity: 0.28, fog: false }), moonCraters, false);
  const starPositions = [];
  for (let i = 0; i < 170; i += 1) {
    const angle = random() * Math.PI * 2;
    const distance = 50 + random() * 25;
    starPositions.push(Math.cos(angle) * distance, 13 + random() * 30, Math.sin(angle) * distance);
  }
  const starsGeometry = new THREE.BufferGeometry();
  starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(starsGeometry, new THREE.PointsMaterial({ color: '#c1d2df', size: 0.11, transparent: true, opacity: 0.76, sizeAttenuation: true, fog: false, depthWrite: false }));
  group.add(stars);

  const fireflyPositions = Array.from({ length: 20 }, () => ({ x: (random() - 0.5) * 21, y: 0.8 + random() * 2.5, z: (random() - 0.5) * 21, phase: random() * Math.PI * 2 }));
  const fireflyGeometry = new THREE.BufferGeometry();
  fireflyGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(fireflyPositions.length * 3), 3));
  const fireflyMat = new THREE.PointsMaterial({ color: '#d5dc91', size: 0.055, transparent: true, opacity: 0.65, depthWrite: false });
  const fireflies = new THREE.Points(fireflyGeometry, fireflyMat);
  fireflies.frustumCulled = false;
  group.add(fireflies);

  const campus = createCampus();
  group.add(campus.group);
  colliders.push(...campus.colliders);
  groundMeshes.push(...campus.groundMeshes);
  Object.assign(destinations, campus.destinations);
  const places = {
    wish: { label: '소원당', ...destinations.wish, height: 1.7 },
    breath: { label: '숨고르기', ...destinations.breath, height: 1.7 },
    blessing: { label: '기원나무', ...destinations.blessing, height: 1.7 },
    ...campus.places,
  };

  function heightAt(x, z) {
    if (x >= -4.55 && x <= 4.55 && z <= -6.5 && z >= -12.5) return 0.33;
    if (Math.abs(x) <= 1.65 && z < -4.7 && z > -6.5) return 0.02 + Math.min(1, (-z - 4.7) / 1.8) * 0.31;
    const meditationDistance = Math.hypot(x - meditationX, z - meditationZ);
    if (meditationDistance < 0.82) return 0.103;
    if (meditationDistance < 2.15) return 0.055;
    if (x < -13 || x > 13 || z < -15 || z > 15) return campus.heightAt(x, z);
    return 0.02;
  }

  function update(time = 0, delta = 0) {
    const t = Number(time) || 0;
    campus.update(t, delta);
    ribbonPivots.forEach(({ pivot, phase }) => {
      pivot.rotation.z = Math.sin(t * 0.7 + phase) * 0.1;
      pivot.rotation.x = Math.cos(t * 0.52 + phase) * 0.08;
    });
    for (let i = 0; i < wishLightCount; i += 1) {
      const p = lanternPositions[i];
      const y = 0.13 + Math.sin(t * 0.85 + p.phase) * 0.025;
      const x = p.x + Math.sin(t * 0.12 + p.phase) * 0.05;
      const z = p.z + Math.cos(t * 0.11 + p.phase) * 0.05;
      dummy.position.set(x, y, z);
      dummy.rotation.set(0, p.phase + Math.sin(t * 0.2 + p.phase) * 0.12, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      wishBases.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 0.165;
      dummy.updateMatrix();
      wishLanterns.setMatrixAt(i, dummy.matrix);
      dummy.position.y = y + 0.315;
      dummy.updateMatrix();
      wishCaps.setMatrixAt(i, dummy.matrix);
    }
    wishBases.instanceMatrix.needsUpdate = true;
    wishLanterns.instanceMatrix.needsUpdate = true;
    wishCaps.instanceMatrix.needsUpdate = true;
    ripples.forEach((ripple, i) => {
      const scale = 1 + Math.sin(t * 0.5 + i * 2) * 0.04;
      ripple.scale.set(scale, scale * 0.81, 1);
    });
    const attribute = fireflyGeometry.getAttribute('position');
    fireflyPositions.forEach((p, i) => attribute.setXYZ(i, p.x + Math.sin(t * 0.2 + p.phase) * 0.4, p.y + Math.sin(t * 0.48 + p.phase) * 0.2, p.z + Math.cos(t * 0.17 + p.phase) * 0.4));
    attribute.needsUpdate = true;
    shrineLight.intensity = 8 + Math.sin(t * 2.1) * 0.12;
    paper.emissiveIntensity = 0.55 + Math.sin(t * 1.2) * 0.025;
    // delta is intentionally accepted for the scene controller's shared contract.
    void delta;
  }
  update(0, 0);

  function dispose() {
    const geometries = new Set();
    const materials = new Set();
    group.traverse((object) => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.material) {
        (Array.isArray(object.material) ? object.material : [object.material]).forEach((mat) => materials.add(mat));
      }
      if (object.isInstancedMesh && typeof object.dispose === 'function') object.dispose();
    });
    geometries.forEach((geometry) => geometry.dispose());
    materials.forEach((mat) => mat.dispose());
    group.clear();
  }

  return { group, groundMeshes, colliders, bounds, heightAt, destinations, places, npcs: campus.npcs, update, setWishCount, dispose };
}
