import * as THREE from 'three';
import { makeHangulGeometry } from './atmosphere.js';

/** Five quiet side gardens. Repeated architectural detail is batched by material. */
export function createCampus() {
  const group = new THREE.Group();
  group.name = 'Samra — halls and moon garden';
  const groundMeshes = [];
  const colliders = [];
  const interactions = [];
  const destinations = {
    myeongri: { x: -17, z: -4.9 },
    inyeon: { x: 17, z: 6.7 },
    stars: { x: 0, z: -20 },
    readers: { x: -16, z: 8.2 },
    archive: { x: 17, z: -6.7 },
  };
  const places = {
    myeongri: { label: '명리전', ...destinations.myeongri, height: 1.7 },
    inyeon: { label: '인연정', ...destinations.inyeon, height: 1.7 },
    stars: { label: '별마루', ...destinations.stars, height: 1.7 },
    readers: { label: '술사각', ...destinations.readers, height: 1.7 },
    archive: { label: '서고', ...destinations.archive, height: 1.7 },
  };
  const materials = {
    stone: new THREE.MeshStandardMaterial({ color: '#657578', roughness: 0.94 }),
    pavingShade: new THREE.MeshStandardMaterial({ color: '#5d6e72', roughness: 0.96 }),
    stoneLight: new THREE.MeshStandardMaterial({ color: '#899593', roughness: 0.93 }),
    stoneDark: new THREE.MeshStandardMaterial({ color: '#3e5558', roughness: 0.96 }),
    wood: new THREE.MeshStandardMaterial({ color: '#654a34', roughness: 0.88 }),
    woodLight: new THREE.MeshStandardMaterial({ color: '#987852', roughness: 0.9 }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#352f2a', roughness: 0.94 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#a6a58d', roughness: 1 }),
    tile: new THREE.MeshStandardMaterial({ color: '#294858', roughness: 0.8, metalness: 0.06, side: THREE.DoubleSide }),
    tileRib: new THREE.MeshStandardMaterial({ color: '#54707a', roughness: 0.83 }),
    gold: new THREE.MeshStandardMaterial({ color: '#c2a267', roughness: 0.5, metalness: 0.48, emissive: '#a87839', emissiveIntensity: 0.18 }),
    paper: new THREE.MeshStandardMaterial({ color: '#eadcba', roughness: 1, emissive: '#ffd08a', emissiveIntensity: 0.34 }),
    paperRose: new THREE.MeshStandardMaterial({ color: '#d7bcad', roughness: 1, emissive: '#e9b394', emissiveIntensity: 0.32 }),
    paperBlue: new THREE.MeshStandardMaterial({ color: '#bdced0', roughness: 1, emissive: '#b4cbd6', emissiveIntensity: 0.24 }),
    darkPaper: new THREE.MeshStandardMaterial({ color: '#a6b8b3', roughness: 1 }),
    sage: new THREE.MeshStandardMaterial({ color: '#547669', roughness: 1, flatShading: true }),
    sageLight: new THREE.MeshStandardMaterial({ color: '#729080', roughness: 1, flatShading: true }),
    pink: new THREE.MeshStandardMaterial({ color: '#ad9291', roughness: 1, flatShading: true }),
    bookBlue: new THREE.MeshStandardMaterial({ color: '#526e7b', roughness: 1 }),
    bookRose: new THREE.MeshStandardMaterial({ color: '#9b7971', roughness: 1 }),
    bookSage: new THREE.MeshStandardMaterial({ color: '#748273', roughness: 1 }),
  };
  const batches = new Map();
  const dummy = new THREE.Object3D();
  function addGeometry(key, geometry, position = [0, 0, 0], rotation = [0, 0, 0], scale = [1, 1, 1]) {
    dummy.position.set(...position); dummy.rotation.set(...rotation); dummy.scale.set(...scale); dummy.updateMatrix();
    geometry.applyMatrix4(dummy.matrix);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geometry);
  }
  const box = (key, w, h, d, x, y, z, rotation) => addGeometry(key, new THREE.BoxGeometry(w, h, d), [x, y, z], rotation);
  const cylinder = (key, r1, r2, h, x, y, z, sides = 12, rotation) => addGeometry(key, new THREE.CylinderGeometry(r1, r2, h, sides), [x, y, z], rotation);
  const sphere = (key, r, x, y, z, scale = [1, 1, 1]) => addGeometry(key, new THREE.IcosahedronGeometry(r, 1), [x, y, z], [0, 0, 0], scale);
  function collider(minX, maxX, minZ, maxZ) { colliders.push({ minX, maxX, minZ, maxZ }); }
  const pickMaterial = new THREE.MeshBasicMaterial({ visible: false });
  function objectInteraction({ id, hall, feature, action = feature, label, point, anchor3d, size = [1, 1, 1] }) {
    const proxy = new THREE.Mesh(new THREE.BoxGeometry(...size), pickMaterial);
    proxy.position.set(anchor3d.x, anchor3d.y, anchor3d.z); proxy.name = `Interaction volume — ${id}`;
    proxy.userData.interactionId = id; proxy.userData.pickProxy = true; group.add(proxy);
    interactions.push({ id, type: 'object', hall, action, feature, label, point, radius: 2.2, anchor3d, group: proxy });
  }
  function merge(geometries) {
    const positions = [];
    for (const geometry of geometries) {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      const source = flat.getAttribute('position').array;
      for (let i = 0; i < source.length; i += 1) positions.push(source[i]);
      if (flat !== geometry) flat.dispose();
      geometry.dispose();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    return geometry;
  }
  function beam(key, a, b, radius, sides = 7) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const direction = new THREE.Vector3().subVectors(end, start);
    const geometry = new THREE.CylinderGeometry(radius * 0.8, radius, direction.length(), sides);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize()));
    geometry.translate(...start.add(end).multiplyScalar(0.5).toArray());
    addGeometry(key, geometry);
  }
  function plaque(text, x, y, z, width = 2.12) {
    box('woodDark', width, 0.5, 0.11, x, y, z);
    box('woodLight', width - 0.1, 0.39, 0.025, x, y, z + 0.064);
    box('woodDark', width - 0.18, 0.32, 0.025, x, y, z + 0.08);
    for (const side of [-1, 1]) {
      box('gold', width - 0.1, 0.012, 0.014, x, y + side * 0.198, z + 0.084);
      box('gold', 0.012, 0.4, 0.014, x + side * (width / 2 - 0.05), y, z + 0.084);
      cylinder('gold', 0.012, 0.012, 0.21, x + side * width * 0.34, y + 0.34, z, 5);
    }
    addGeometry('gold', makeHangulGeometry(text, 0.31), [x, y, z + 0.105]);
  }
  function hangingLantern(key, x, y, z, square = false) {
    if (square) box(key, 0.31, 0.48, 0.28, x, y, z);
    else cylinder(key, 0.19, 0.21, 0.44, x, y, z, 10);
    cylinder('woodDark', 0.215, 0.22, 0.045, x, y + 0.245, z, 10);
    cylinder('woodDark', 0.215, 0.22, 0.045, x, y - 0.245, z, 10);
    cylinder('gold', 0.01, 0.01, 0.3, x, y + 0.41, z, 5);
    for (let i = 0; i < 8; i += 1) {
      const a = i / 8 * Math.PI * 2;
      cylinder('wood', 0.007, 0.007, 0.44, x + Math.cos(a) * 0.19, y, z + Math.sin(a) * 0.19, 4);
    }
  }
  const campusGround = new THREE.Mesh(new THREE.PlaneGeometry(46, 47), materials.stoneDark);
  campusGround.rotation.x = -Math.PI / 2;
  campusGround.position.set(0, -0.005, -1.5);
  campusGround.receiveShadow = true;
  campusGround.name = 'Walkable connecting gardens';
  group.add(campusGround); groundMeshes.push(campusGround);

  // New paving occupies only the side and rear gardens, preserving the old courtyard.
  for (let x = -22; x < 23; x += 1.75) {
    for (let z = -24; z < 22; z += 1.75) {
      if (Math.abs(x) < 12.8 && z > -14.7 && z < 14.7) continue;
      box(Math.round(x * 7 + z * 11) % 5 === 0 ? 'pavingShade' : 'stone', 1.71, 0.025, 1.71, x, -0.004, z);
    }
  }
  function path(from, to, width = 1.9) {
    const length = Math.hypot(to.x - from.x, to.z - from.z);
    const count = Math.ceil(length / 1.18);
    const angle = Math.atan2(to.x - from.x, to.z - from.z);
    for (let i = 0; i < count; i += 1) {
      const t = (i + 0.5) / count;
      box('stoneLight', width, 0.045, length / count - 0.09, from.x + (to.x - from.x) * t, 0.012, from.z + (to.z - from.z) * t, [0, angle, 0]);
    }
  }
  path({ x: -9, z: 8.2 }, destinations.readers, 2);
  path({ x: -13.5, z: 0 }, { x: -17, z: 0 }, 2);
  path({ x: -17, z: 0 }, destinations.myeongri, 2);
  path({ x: 9, z: 6.7 }, destinations.inyeon, 2);
  path({ x: 13.5, z: 0 }, { x: 17, z: 0 }, 2);
  path({ x: 17, z: 0 }, destinations.archive, 2);
  path({ x: -7.1, z: -14 }, { x: -7.1, z: -18 }, 2);
  path({ x: 7.1, z: -14 }, { x: 7.1, z: -18 }, 2);
  path({ x: -7.1, z: -18 }, { x: 0, z: -18 }, 2);
  path({ x: 7.1, z: -18 }, { x: 0, z: -18 }, 2);
  path({ x: 0, z: -18 }, destinations.stars, 2);

  // Outer low wall encloses the expanded precinct, with a broad arrival opening.
  const outerWalls = [
    [-22.85, -1.5, 0.3, 46.6], [22.85, -1.5, 0.3, 46.6], [0, -24.85, 45.7, 0.3],
    [-13.1, 21.85, 19.5, 0.3], [13.1, 21.85, 19.5, 0.3],
  ];
  for (const [x, z, w, d] of outerWalls) {
    box('stoneDark', w, 0.55, d, x, 0.275, z);
    box('tile', w + 0.08, 0.13, d + 0.12, x, 0.6, z);
    collider(x - w / 2, x + w / 2, z - d / 2, z + d / 2);
  }

  function roof(cx, cz, width, depth, eaveY, ridgeY) {
    const halfW = width / 2, halfD = depth / 2, ridgeHalf = halfW * 0.63;
    function point(face, u, v) {
      const span = ridgeHalf + (halfW - ridgeHalf) * v;
      const x = face < 2 ? u * span : (face === 2 ? 1 : -1) * span;
      const z = face < 2 ? (face === 0 ? 1 : -1) * v * halfD : u * v * halfD;
      const y = ridgeY - (ridgeY - eaveY + 0.22) * v + 0.22 * v * v + 0.26 * Math.pow(Math.abs(x) / halfW, 5) * v * v;
      return new THREE.Vector3(cx + x, y, cz + z);
    }
    for (let face = 0; face < 4; face += 1) {
      const positions = [], indices = [], columns = face < 2 ? 18 : 10, rows = 9;
      for (let j = 0; j <= rows; j += 1) for (let i = 0; i <= columns; i += 1) positions.push(...point(face, i / columns * 2 - 1, j / rows).toArray());
      for (let j = 0; j < rows; j += 1) for (let i = 0; i < columns; i += 1) {
        const a = j * (columns + 1) + i, b = a + columns + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      const surface = new THREE.BufferGeometry();
      surface.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      surface.setIndex(indices); surface.computeVertexNormals(); addGeometry('tile', surface);
      const ribs = face < 2 ? 18 : 8;
      for (let i = 0; i <= ribs; i += 1) {
        const points = [];
        for (let j = 0; j <= 7; j += 1) { const p = point(face, i / ribs * 2 - 1, j / 7); p.y += 0.035; points.push(p); }
        addGeometry('tileRib', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 8, 0.036, 4, false));
      }
      const eave = [];
      for (let i = 0; i <= 18; i += 1) { const p = point(face, i / 18 * 2 - 1, 1); p.y -= 0.06; eave.push(p); }
      addGeometry('woodDark', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(eave), 18, 0.065, 5, false));
    }
    const ridge = [];
    for (let i = 0; i <= 14; i += 1) {
      const x = (i / 14 * 2 - 1) * ridgeHalf;
      ridge.push(new THREE.Vector3(cx + x, ridgeY + 0.1 + Math.pow(Math.abs(x) / ridgeHalf, 5) * 0.14, cz));
    }
    addGeometry('tileRib', new THREE.TubeGeometry(new THREE.CatmullRomCurve3(ridge), 20, 0.085, 6, false));
  }
  const floors = [];
  function pavilion({ id, label, x, z, width, depth, open = false, roofHeight = 4.5 }) {
    const front = z + depth / 2, back = z - depth / 2, left = x - width / 2, right = x + width / 2;
    box('stoneDark', width + 0.3, 0.12, depth + 0.3, x, 0.025, z);
    const floor = new THREE.Mesh(new THREE.BoxGeometry(width, 0.065, depth), materials.woodLight);
    floor.position.set(x, 0.08, z); floor.receiveShadow = true; floor.name = `Walkable ${id} floor`;
    group.add(floor); groundMeshes.push(floor); floors.push({ left, right, back, front });
    for (let pz = back + 0.15; pz < front; pz += 0.45) box('woodDark', width - 0.05, 0.01, 0.012, x, 0.116, pz);
    const columns = [[left + 0.2, front - 0.18], [right - 0.2, front - 0.18], [left + 0.2, back + 0.18], [right - 0.2, back + 0.18]];
    for (const [px, pz] of columns) {
      cylinder('wood', 0.12, 0.15, 2.85, px, 1.52, pz, 10);
      cylinder('stoneDark', 0.24, 0.26, 0.13, px, 0.15, pz, 8);
      box('wood', 0.48, 0.1, 0.55, px, 2.98, pz);
      box('woodLight', 0.7, 0.09, 0.45, px, 3.07, pz);
      collider(px - 0.17, px + 0.17, pz - 0.17, pz + 0.17);
    }
    box('wood', width + 0.14, 0.18, 0.18, x, 2.99, front - 0.18);
    box('wood', width + 0.14, 0.18, 0.18, x, 2.99, back + 0.18);
    box('wood', 0.18, 0.18, depth, left + 0.2, 2.99, z);
    box('wood', 0.18, 0.18, depth, right - 0.2, 2.99, z);
    if (!open) {
      box('plaster', width - 0.3, 2.55, 0.14, x, 1.43, back + 0.12);
      box('plaster', 0.14, 2.55, depth - 0.3, left + 0.12, 1.43, z);
      box('plaster', 0.14, 2.55, depth - 0.3, right - 0.12, 1.43, z);
      collider(left, right, back - 0.05, back + 0.28);
      collider(left - 0.04, left + 0.28, back, front);
      collider(right - 0.28, right + 0.04, back, front);
      const panelWidth = width / 2 - 1.2;
      for (const side of [-1, 1]) {
        const px = x + side * (1.2 + panelWidth / 2);
        box('wood', panelWidth, 2.45, 0.1, px, 1.39, front - 0.16);
        box('paper', panelWidth - 0.15, 2.23, 0.03, px, 1.43, front - 0.092);
        for (let q = -panelWidth / 2 + 0.11; q < panelWidth / 2; q += 0.22) box('woodDark', 0.02, 2.27, 0.025, px + q, 1.43, front - 0.068);
        for (let q = 0.34; q < 2.55; q += 0.24) box('woodDark', panelWidth - 0.1, 0.02, 0.025, px, q, front - 0.066);
      }
      collider(left, x - 1.2, front - 0.25, front + 0.04);
      collider(x + 1.2, right, front - 0.25, front + 0.04);
    }
    roof(x, z, width + 1.1, depth + 1.4, 3.22, roofHeight);
    plaque(label, x, 2.77, front + 0.06, label.length === 2 ? 1.82 : 2.12);
    const lanternKey = label === '인연정' ? 'paperRose' : label === '서고' ? 'paperBlue' : 'paper';
    for (const side of [-1, 1]) hangingLantern(lanternKey, x + side * width * 0.34, 2.46, front - 0.24, label === '서고');
    return { x, z, front, back, left, right };
  }

  // 명리전: five material colours and a circular, astronomical reading desk.
  const myeongri = pavilion({ id: 'Myeongri hall', label: '명리전', x: -17, z: -8, width: 7.6, depth: 4.8, roofHeight: 4.7 });
  cylinder('woodDark', 1.12, 1.22, 0.12, -17, 0.87, -8.4, 28);
  cylinder('wood', 0.21, 0.33, 0.68, -17, 0.47, -8.4, 12);
  addGeometry('gold', new THREE.TorusGeometry(0.84, 0.022, 5, 48), [-17, 0.94, -8.4], [Math.PI / 2, 0, 0]);
  const elementKeys = ['sageLight', 'bookRose', 'stoneLight', 'gold', 'bookBlue'];
  for (let i = 0; i < 5; i += 1) {
    const a = i / 5 * Math.PI * 2;
    cylinder(elementKeys[i], 0.16, 0.18, 0.045, -17 + Math.cos(a) * 0.63, 0.965, -8.4 + Math.sin(a) * 0.63, 18);
    const to = new THREE.Vector3(-17 + Math.cos(a + Math.PI * 0.8) * 0.63, 0.963, -8.4 + Math.sin(a + Math.PI * 0.8) * 0.63);
    beam('gold', [-17 + Math.cos(a) * 0.63, 0.963, -8.4 + Math.sin(a) * 0.63], to.toArray(), 0.009, 4);
  }
  collider(-18.25, -15.75, -9.65, -7.15);
  box('woodDark', 5.1, 0.13, 0.68, -17, 0.92, -9.75);
  for (const x of [-19.15, -17, -14.85]) {
    box('wood', 0.09, 0.78, 0.5, x, 0.49, -9.75);
    cylinder('paper', 0.15, 0.15, 0.68, x + 0.1, 1.1, -9.75, 12, [0, 0, Math.PI / 2]);
  }
  collider(-19.6, -14.4, -10.15, -9.35);
  box('paper', 1.7, 1.12, 0.026, -17, 1.89, -10.25);
  for (let i = 0; i < 5; i += 1) {
    const a = i / 5 * Math.PI * 2;
    sphere(elementKeys[i], 0.075, -17 + Math.sin(a) * 0.48, 1.89 + Math.cos(a) * 0.43, -10.22, [1, 1, 0.2]);
    const b = a + Math.PI * 0.8;
    beam('gold', [-17 + Math.sin(a) * 0.48, 1.89 + Math.cos(a) * 0.43, -10.205], [-17 + Math.sin(b) * 0.48, 1.89 + Math.cos(b) * 0.43, -10.205], 0.008, 4);
  }
  cylinder('gold', 0.3, 0.3, 0.035, -14.85, 1.27, -9.75, 28);
  addGeometry('gold', new THREE.TorusGeometry(0.29, 0.014, 5, 32), [-14.85, 1.34, -9.75], [Math.PI / 2, 0, 0]);
  beam('gold', [-14.85, 1.28, -9.75], [-14.85, 1.59, -9.85], 0.018, 5);
  objectInteraction({ id: 'object-saju-table', hall: 'myeongri', feature: 'saju', label: '내 사주 살펴보기', point: { x: -17, z: -6.5 }, anchor3d: { x: -17, y: 1.12, z: -8.4 }, size: [2.35, 1.4, 2.35] });
  objectInteraction({ id: 'object-time-dial', hall: 'myeongri', feature: 'time', label: '나의 출생시간 알아보기', point: { x: -14.6, z: -8.6 }, anchor3d: { x: -14.85, y: 1.4, z: -9.75 }, size: [0.72, 0.7, 0.72] });

  // 인연정: an open pavilion with paired seats and two flowering courtyard trees.
  pavilion({ id: 'Inyeon pavilion', label: '인연정', x: 17, z: 3.6, width: 6.4, depth: 5, open: true, roofHeight: 4.4 });
  for (const side of [-1, 1]) {
    const x = 17 + side * 1.46;
    box('woodLight', 0.78, 0.11, 1.8, x, 0.6, 3.7);
    box('wood', 0.09, 0.49, 1.5, x - side * 0.29, 0.34, 3.7);
    box('wood', 0.09, 0.6, 1.85, x + side * 0.33, 0.91, 3.7);
    collider(x - 0.45, x + 0.45, 2.7, 4.7);
  }
  const smallTable = cylinder('woodDark', 0.49, 0.55, 0.1, 17, 0.58, 3.65, 20);
  void smallTable;
  cylinder('wood', 0.17, 0.2, 0.45, 17, 0.31, 3.65, 12);
  for (const x of [16.8, 17.2]) cylinder('paper', 0.075, 0.06, 0.09, x, 0.68, 3.65, 12);
  collider(16.4, 17.6, 3.05, 4.25);
  for (const x of [16.7, 17.3]) addGeometry('gold', new THREE.TorusGeometry(0.46, 0.024, 6, 40), [x, 2.12, 1.24]);
  for (const x of [16.7, 17.3]) cylinder('gold', 0.01, 0.01, 0.43, x, 2.78, 1.24, 5);
  objectInteraction({ id: 'object-inyeon-tea', hall: 'inyeon', feature: 'gunghap', label: '마주 앉아 인연 살펴보기', point: { x: 17, z: 5.25 }, anchor3d: { x: 17, y: 0.9, z: 3.65 }, size: [1.2, 0.95, 1.2] });
  for (const [x, z, direction] of [[13.9, -0.1, -1], [20.2, 0.2, 1]]) {
    beam('woodDark', [x, 0, z], [x + direction * 0.15, 2.5, z], 0.16);
    beam('woodDark', [x, 1.6, z], [x - direction * 0.8, 2.7, z + 0.1], 0.08);
    for (let i = 0; i < 5; i += 1) {
      const a = i * 2.39;
      sphere(i % 2 ? 'pink' : 'sageLight', 0.75, x + Math.cos(a) * 0.67, 2.7 + (i % 2) * 0.36, z + Math.sin(a) * 0.58, [1.08, 0.61, 0.91]);
    }
    collider(x - 0.23, x + 0.23, z - 0.23, z + 0.23);
  }

  // 서고: shelves contain individual folded volumes and bound scrolls.
  const archive = pavilion({ id: 'Archive', label: '서고', x: 17, z: -10, width: 7.4, depth: 5.4, roofHeight: 4.8 });
  for (const shelfX of [14.75, 19.25]) {
    box('woodDark', 1.46, 2.2, 0.48, shelfX, 1.28, -11.89);
    for (const y of [0.31, 0.94, 1.57, 2.2]) box('woodLight', 1.5, 0.07, 0.59, shelfX, y, -11.8);
    for (let row = 0; row < 3; row += 1) for (let i = 0; i < 7; i += 1) {
      const key = ['bookBlue', 'bookRose', 'bookSage', 'paper'][(i + row) % 4];
      box(key, 0.12 + i % 2 * 0.025, 0.35 + i % 3 * 0.06, 0.33, shelfX - 0.55 + i * 0.18, 0.54 + row * 0.63, -11.66, [0, 0, (i % 3 - 1) * 0.045]);
      box('gold', 0.09, 0.013, 0.015, shelfX - 0.55 + i * 0.18, 0.65 + row * 0.63, -11.48);
    }
    collider(shelfX - 0.82, shelfX + 0.82, -12.2, -11.42);
  }
  box('woodLight', 2.3, 0.1, 1.05, 17, 0.81, -9.35);
  for (const x of [16.05, 17.95]) for (const z of [-9.73, -8.97]) box('wood', 0.09, 0.7, 0.09, x, 0.43, z);
  box('paper', 0.73, 0.025, 0.55, 17, 0.88, -9.35, [0, 0.12, 0]);
  box('bookBlue', 0.59, 0.09, 0.47, 17.63, 0.91, -9.3, [0, -0.08, 0]);
  collider(15.78, 18.22, -9.94, -8.76);
  box('paper', 0.82, 1.55, 0.025, 17, 1.7, -12.51);
  for (const y of [0.88, 2.52]) cylinder('woodLight', 0.027, 0.027, 0.98, 17, y, -12.5, 7, [0, 0, Math.PI / 2]);
  for (let i = 0; i < 7; i += 1) box('woodLight', 0.39 - i % 3 * 0.05, 0.014, 0.008, 17, 1.13 + i * 0.16, -12.48);
  cylinder('woodDark', 0.12, 0.1, 0.05, 16.28, 0.9, -9.33, 16);
  beam('woodDark', [16.28, 0.94, -9.33], [16.4, 1.21, -9.41], 0.011, 5);
  objectInteraction({ id: 'object-archive-desk', hall: 'archive', feature: 'archive', label: '나의 사유 기록 열기', point: { x: 17, z: -8 }, anchor3d: { x: 17, y: 1.12, z: -9.35 }, size: [2.35, 1.2, 1.12] });
  objectInteraction({ id: 'object-learning-books', hall: 'archive', feature: 'learn', label: '명리와 별 이야기 읽기', point: { x: 14.75, z: -10.7 }, anchor3d: { x: 14.75, y: 1.5, z: -11.78 }, size: [1.54, 2.25, 0.62] });

  // 술사각: three low-poly original hosts, merged by costume material per person.
  pavilion({ id: 'Readers hall', label: '술사각', x: -17, z: 4.9, width: 8.1, depth: 5.1, open: true, roofHeight: 4.6 });
  const npcEntries = [];
  function npc(id, x, z, colors, kind) {
    const host = new THREE.Group(); host.name = `Host — ${id}`; host.position.set(x, 0.05, z);
    const bins = new Map();
    const palette = {
      skin: new THREE.MeshStandardMaterial({ color: '#ead0b2', roughness: 0.91 }),
      hair: new THREE.MeshStandardMaterial({ color: colors.hair, roughness: 0.92 }),
      robe: new THREE.MeshStandardMaterial({ color: colors.robe, roughness: 0.95 }),
      sleeve: new THREE.MeshStandardMaterial({ color: colors.sleeve, roughness: 0.96 }),
      trim: new THREE.MeshStandardMaterial({ color: colors.trim, roughness: 0.65, metalness: 0.15 }),
      eye: new THREE.MeshStandardMaterial({ color: '#34363c', roughness: 1 }),
    };
    function part(key, geometry, pos, scale = [1, 1, 1], rot = [0, 0, 0]) {
      dummy.position.set(...pos); dummy.rotation.set(...rot); dummy.scale.set(...scale); dummy.updateMatrix(); geometry.applyMatrix4(dummy.matrix);
      if (!bins.has(key)) bins.set(key, []); bins.get(key).push(geometry);
    }
    const ball = (key, r, pos, scale) => part(key, new THREE.SphereGeometry(r, 14, 10), pos, scale);
    const cyl = (key, r1, r2, h, pos, rot) => part(key, new THREE.CylinderGeometry(r1, r2, h, 14), pos, [1, 1, 1], rot);
    cyl('robe', 0.2, 0.39, 0.79, [0, 0.59, 0]);
    ball('sleeve', 0.24, [0, 0.96, 0], [1.02, 0.64, 0.75]);
    for (const side of [-1, 1]) {
      ball('sleeve', 0.16, [side * 0.27, 0.81, 0], [0.78, 1.3, 0.94]);
      ball('skin', 0.075, [side * 0.29, 0.59, 0.035]);
      ball('eye', 0.12, [side * 0.14, 0.12, 0.08], [1.05, 0.45, 1.35]);
    }
    ball('skin', 0.28, [0, 1.3, 0.018], [1, 1.02, 0.94]);
    part('hair', new THREE.SphereGeometry(0.295, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.52), [0, 1.33, 0]);
    ball('hair', 0.2, [0, 1.35, -0.15], [1.18, 1.14, 0.75]);
    for (const side of [-1, 1]) {
      ball('eye', 0.019, [side * 0.087, 1.3, 0.267], [0.8, 1.05, 0.44]);
      ball('hair', 0.09, [side * 0.22, 1.31, 0.07], [0.63, 1.5, 0.62]);
    }
    // A crossed collar and long hanging tie make each silhouette recognisably hanbok.
    cyl('trim', 0.024, 0.024, 0.27, [-0.04, 0.95, 0.19], [0, 0, -0.58]);
    cyl('trim', 0.024, 0.024, 0.27, [0.05, 0.95, 0.2], [0, 0, 0.58]);
    cyl('trim', 0.018, 0.018, 0.2, [0.1, 0.77, 0.23], [0, 0, 0.1]);
    if (kind === 'sage') {
      cyl('hair', 0.47, 0.47, 0.045, [0, 1.61, 0], [0, 0, 0]);
      cyl('hair', 0.23, 0.26, 0.21, [0, 1.72, 0], [0, 0, 0]);
      part('trim', new THREE.ConeGeometry(0.15, 0.32, 12), [0, 1.07, 0.23], [1, 1, 0.6], [Math.PI, 0, 0]);
      cyl('hair', 0.026, 0.035, 1.28, [0.46, 0.72, 0.14], [0, 0, -0.08]);
      ball('trim', 0.075, [0.5, 1.39, 0.14]);
    } else if (kind === 'ice') {
      for (const side of [-1, 1]) ball('hair', 0.14, [side * 0.22, 1.03, -0.055], [0.68, 2.1, 0.73]);
      part('trim', new THREE.OctahedronGeometry(0.16), [0.38, 0.76, 0.17], [0.72, 1.5, 0.72]);
      cyl('trim', 0.016, 0.016, 0.42, [0, 1.58, 0], [0, 0, Math.PI / 2]);
    } else {
      for (const side of [-1, 1]) ball('hair', 0.15, [side * 0.2, 1.07, -0.12], [0.8, 1.8, 0.72]);
      ball('hair', 0.11, [0, 1.6, -0.05], [1, 0.85, 1]);
      part('trim', new THREE.TorusGeometry(0.085, 0.022, 6, 16, Math.PI * 1.35), [0.22, 1.51, 0.16], [1, 1, 1], [0, 0, 0.6]);
      ball('trim', 0.04, [0.29, 1.59, 0.16]);
    }
    for (const [key, geometries] of bins) {
      const object = new THREE.Mesh(merge(geometries), palette[key]); object.castShadow = true; host.add(object);
    }
    group.add(host); npcEntries.push({ id, host, phase: npcEntries.length * 2 });
    collider(x - 0.4, x + 0.4, z - 0.37, z + 0.4);
    return host;
  }
  const tojeong = npc('tojeong', -19.3, -5.1, { hair: '#4c4943', robe: '#6b7b67', sleeve: '#d7d1b6', trim: '#dedccb' }, 'sage');
  cylinder('stoneDark', 0.65, 0.73, 0.12, -19.3, 0.05, -5.1, 24);
  const seol = npc('seol', 19, 5.15, { hair: '#d1d9d5', robe: '#789cac', sleeve: '#dbe3df', trim: '#b7d4d9' }, 'ice');
  const luna = npc('luna', -17, 5.1, { hair: '#393643', robe: '#79758e', sleeve: '#d7d5d8', trim: '#d9c497' }, 'moon');
  interactions.push(
    { id: 'npc-tojeong', type: 'npc', hall: 'myeongri', action: 'readers', feature: 'saju', readerId: 'tojeong', label: '토정과 이야기하기', point: { x: -19.3, z: -3.7 }, radius: 2.2, anchor3d: { x: -19.3, y: 2.14, z: -5.1 }, group: tojeong },
    { id: 'npc-seol', type: 'npc', hall: 'inyeon', action: 'readers', feature: 'gunghap', readerId: 'seol', label: '설월과 이야기하기', point: { x: 19, z: 6.65 }, radius: 2.2, anchor3d: { x: 19, y: 2.05, z: 5.15 }, group: seol },
    { id: 'npc-luna', type: 'npc', hall: 'readers', action: 'readers', feature: 'readers', readerId: 'luna', label: '루나와 이야기하기', point: { x: -17, z: 7.2 }, radius: 2.2, anchor3d: { x: -17, y: 2.05, z: 5.1 }, group: luna },
  );
  for (const x of [-19.05, -17, -14.95]) {
    cylinder('stoneDark', 0.72, 0.8, 0.06, x, 0.1, 5.1, 24);
    box('woodLight', 1.16, 0.1, 0.46, x, 0.56, 6.08);
    for (const dx of [-0.45, 0.45]) box('wood', 0.08, 0.42, 0.32, x + dx, 0.32, 6.08);
    cylinder('paper', 0.12, 0.12, 0.32, x + 0.25, 0.78, 6.08, 10, [0, 0, Math.PI / 2]);
    collider(x - 0.65, x + 0.65, 5.8, 6.37);
  }
  for (let i = 0; i < 3; i += 1) box(['bookBlue', 'bookSage', 'bookRose'][i], 0.64, 0.07, 0.37, -19.15, 0.67 + i * 0.07, 6.06, [0, (i - 1) * 0.09, 0]);
  for (let i = 0; i < 5; i += 1) box('paper', 0.26, 0.015, 0.4, -15.3 + i * 0.12, 0.64 + i * 0.006, 6.08, [0, (i - 2) * 0.07, 0]);
  objectInteraction({ id: 'object-reader-catalog', hall: 'readers', feature: 'catalog', label: '술사들의 상담 둘러보기', point: { x: -19.05, z: 7.25 }, anchor3d: { x: -19.05, y: 0.95, z: 6.08 }, size: [1.2, 0.9, 0.55] });

  // 별마루: a broad stone observatory, not a fifth copy of a building.
  const terrace = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.95, 0.1, 64), materials.stoneLight);
  terrace.position.set(0, 0.04, -20.5); terrace.receiveShadow = true; terrace.name = 'Walkable star terrace';
  group.add(terrace); groundMeshes.push(terrace);
  for (const r of [1.2, 2.4, 3.6, 4.45]) addGeometry('gold', new THREE.TorusGeometry(r, 0.014, 4, 64), [0, 0.098, -20.5], [Math.PI / 2, 0, 0]);
  for (let i = 0; i < 12; i += 1) {
    const a = i / 12 * Math.PI * 2;
    beam('gold', [Math.cos(a) * 1.45, 0.098, -20.5 + Math.sin(a) * 1.45], [Math.cos(a) * 4.45, 0.098, -20.5 + Math.sin(a) * 4.45], 0.009, 4);
    cylinder('stoneDark', 0.12, 0.18, 0.65, Math.cos(a) * 4.6, 0.37, -20.5 + Math.sin(a) * 4.6, 8);
    sphere('paper', 0.13, Math.cos(a) * 4.6, 0.75, -20.5 + Math.sin(a) * 4.6, [1, 0.75, 1]);
  }
  const armillary = new THREE.Group(); armillary.position.set(0, 1.5, -22.2); armillary.name = 'Slow celestial instrument';
  const armillaryMat = new THREE.MeshStandardMaterial({ color: '#c4ab77', roughness: 0.42, metalness: 0.55 });
  for (const [x, y, z] of [[0, 0, 0], [0.66, 0.2, 0], [Math.PI / 2, 0, 0], [0, Math.PI / 2, 0.45]]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.88, 0.024, 6, 64), armillaryMat); ring.rotation.set(x, y, z); armillary.add(ring);
  }
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), materials.paper); armillary.add(pearl); group.add(armillary);
  cylinder('stoneDark', 0.42, 0.56, 0.23, 0, 0.21, -22.2, 16);
  cylinder('gold', 0.055, 0.08, 1.1, 0, 0.85, -22.2, 10);
  collider(-1, 1, -23.15, -21.25);
  box('stoneDark', 2.12, 0.75, 0.36, -3.55, 0.46, -18.35);
  plaque('별마루', -3.55, 1.12, -18.35, 2.12);
  collider(-4.65, -2.45, -18.62, -18.08);
  cylinder('wood', 0.05, 0.08, 1.07, 2.8, 0.7, -22.2, 8);
  cylinder('gold', 0.12, 0.12, 1.14, 2.8, 1.41, -22.2, 14, [0.86, 0, 0]);
  cylinder('woodDark', 0.15, 0.15, 0.06, 2.8, 1.82, -22.63, 14, [0.86, 0, 0]);
  for (const x of [2.45, 3.15]) beam('wood', [2.8, 0.71, -22.2], [x, 0.12, -21.94], 0.038, 6);
  collider(2.3, 3.3, -22.8, -21.6);
  objectInteraction({ id: 'object-celestial-instrument', hall: 'stars', feature: 'jami', label: '자미두수의 별자리 보기', point: { x: 0, z: -20 }, anchor3d: { x: 0, y: 1.7, z: -22.2 }, size: [2, 2.15, 2] });
  objectInteraction({ id: 'object-star-telescope', hall: 'stars', feature: 'star', label: '별과 나의 흐름 살펴보기', point: { x: 2.7, z: -20.4 }, anchor3d: { x: 2.8, y: 1.5, z: -22.2 }, size: [0.9, 1.9, 1.25] });
  const stars = [[-2.6, 2.9, -22.5], [-1.9, 3.6, -22.4], [-0.8, 3.3, -22.4], [0.8, 3.9, -22.5], [1.8, 3.4, -22.5], [2.7, 4.1, -22.4]];
  for (let i = 0; i < stars.length; i += 1) {
    sphere('paper', i % 2 ? 0.06 : 0.08, ...stars[i]);
    if (i) beam('gold', stars[i - 1], stars[i], 0.008, 4);
  }

  // Shrubs and small boundary pines frame the new places without blocking paths.
  for (const [x, z, scale] of [[-21.5, -13, 0.95], [21.5, -14.3, 1.1], [-21.4, 11.8, 0.9], [21.4, 10.4, 1.05], [-10.5, -22.3, 0.9], [10.5, -22.3, 0.95]]) {
    beam('woodDark', [x, 0, z], [x + 0.15, 3.8 * scale, z], 0.16 * scale);
    for (let i = 0; i < 4; i += 1) {
      const side = i % 2 ? 1 : -1;
      const bx = x + side * 0.65 * scale;
      const by = (2 + i * 0.53) * scale;
      beam('woodDark', [x, by - 0.3, z], [bx, by + 0.1, z + (i % 3 - 1) * 0.3], 0.055);
      sphere(i % 2 ? 'sage' : 'sageLight', 0.9, bx, by + 0.25, z + (i % 3 - 1) * 0.3, [1.1 * scale, 0.39 * scale, 0.8 * scale]);
    }
    collider(x - 0.2, x + 0.2, z - 0.2, z + 0.2);
  }
  for (const [x, z] of [[-21.5, -2.4], [-21, 1], [21.3, -3.6], [21.3, -5.5], [-6.8, -22.2], [6.8, -22.2], [-6.5, 18.5], [6.5, 18.5]]) {
    sphere('sage', 0.6, x, 0.25, z, [1.4, 0.6, 0.9]);
    sphere('stoneDark', 0.5, x + 0.65, 0.17, z - 0.2, [1, 0.65, 0.85]);
  }
  // No additional point lights; emissive paper gives the campus a warm rhythm.
  for (const [x, z] of [[-13.5, 8.2], [-13.5, 0], [13.5, 6.7], [13.5, 0], [-6.5, -17.3], [6.5, -17.3], [-3.7, 18], [3.7, 18]]) {
    cylinder('wood', 0.055, 0.075, 1.38, x, 0.69, z, 8);
    cylinder('stoneDark', 0.17, 0.22, 0.2, x, 0.1, z, 8);
    cylinder('paper', 0.19, 0.21, 0.42, x, 1.53, z, 8);
    cylinder('woodDark', 0.22, 0.24, 0.045, x, 1.77, z, 8);
    cylinder('woodDark', 0.22, 0.24, 0.045, x, 1.29, z, 8);
    collider(x - 0.19, x + 0.19, z - 0.19, z + 0.19);
  }
  for (const [key, geometries] of batches) {
    const object = new THREE.Mesh(merge(geometries), materials[key]);
    object.castShadow = ['wood', 'woodDark', 'plaster', 'tile', 'sage', 'sageLight', 'pink'].includes(key);
    object.receiveShadow = true; object.name = `Campus batch — ${key}`; group.add(object);
  }

  function heightAt(x, z) {
    if (Math.hypot(x, z + 20.5) < 4.8) return 0.09;
    if (floors.some(({ left, right, back, front }) => x > left && x < right && z > back && z < front)) return 0.113;
    return 0.02;
  }
  function update(time = 0) {
    armillary.rotation.y = Math.sin(time * 0.08) * 0.3;
    npcEntries.forEach(({ host, phase }) => {
      host.position.y = 0.05 + Math.sin(time * 1.5 + phase) * 0.008;
      host.rotation.y = Math.sin(time * 0.35 + phase) * 0.035;
    });
  }
  function setAtmosphere(mood) {
    const intensity = mood === 'dawn' ? 0.105 : 0.53;
    materials.paper.emissiveIntensity = intensity;
    materials.paperRose.emissiveIntensity = intensity * 0.83;
    materials.paperBlue.emissiveIntensity = intensity * 0.66;
    materials.gold.emissiveIntensity = mood === 'dawn' ? 0.04 : 0.18;
  }
  interactions.forEach((interaction) => { interaction.group.userData.interactionId = interaction.id; });
  return { group, colliders, groundMeshes, destinations, places, interactions, heightAt, update, setAtmosphere, npcs: npcEntries.map(({ id, host }) => ({ id, group: host })) };
}
