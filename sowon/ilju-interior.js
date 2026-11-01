import * as THREE from 'three';

const ELEMENT_COLORS = {
  목: ['#71816b', '#a3ad91'], wood: ['#71816b', '#a3ad91'],
  화: ['#a06f5d', '#c7a28a'], fire: ['#a06f5d', '#c7a28a'],
  토: ['#9b855e', '#c1ad80'], earth: ['#9b855e', '#c1ad80'],
  금: ['#858c86', '#b8bdb1'], metal: ['#858c86', '#b8bdb1'],
  수: ['#647c8a', '#a0b2b9'], water: ['#647c8a', '#a0b2b9'],
};

/**
 * A separate, full-size gathering hall. The south wall and rear ceiling are
 * intentionally open to the viewing camera; the north mural is the focal point.
 * Incoming mural textures belong to the controller, not to this architecture.
 */
export function createIljuInterior() {
  const group = new THREE.Group();
  group.name = 'Ilju — quiet mountain temple interior';
  const bounds = { minX: -9, maxX: 9, minZ: -12, maxZ: 12 };
  const spawn = { x: 0, z: 8 };
  const groundMeshes = [], colliders = [], seats = [];
  const materials = {
    floor: new THREE.MeshStandardMaterial({ color: '#b18b60', roughness: .86 }),
    floorWarm: new THREE.MeshStandardMaterial({ color: '#b99369', roughness: .9 }),
    floorShade: new THREE.MeshStandardMaterial({ color: '#a78159', roughness: .9 }),
    wood: new THREE.MeshStandardMaterial({ color: '#725036', roughness: .86 }),
    woodLight: new THREE.MeshStandardMaterial({ color: '#ac8659', roughness: .84 }),
    woodDark: new THREE.MeshStandardMaterial({ color: '#44362b', roughness: .9 }),
    plaster: new THREE.MeshStandardMaterial({ color: '#ddd7c6', roughness: 1 }),
    paper: new THREE.MeshStandardMaterial({ color: '#e9e1cc', roughness: 1, emissive: '#e8d7ae', emissiveIntensity: .12 }),
    stone: new THREE.MeshStandardMaterial({ color: '#8c8b7c', roughness: 1 }),
    brass: new THREE.MeshStandardMaterial({ color: '#b8995f', metalness: .35, roughness: .65 }),
    accent: new THREE.MeshStandardMaterial({ color: '#71816b', roughness: 1 }),
    accentLight: new THREE.MeshStandardMaterial({ color: '#a3ad91', roughness: 1 }),
    lantern: new THREE.MeshStandardMaterial({ color: '#e9d3a3', roughness: .9, emissive: '#f2c685', emissiveIntensity: .32 }),
  };
  // Basic material keeps the illustration readable in every light setting.
  const muralMaterial = new THREE.MeshBasicMaterial({ color: '#dbd4bb', toneMapped: false });
  const batches = new Map();
  const transform = new THREE.Object3D();
  function add(key, geometry, position = [0, 0, 0], rotation = [0, 0, 0]) {
    transform.position.set(...position); transform.rotation.set(...rotation); transform.scale.set(1, 1, 1); transform.updateMatrix();
    geometry.applyMatrix4(transform.matrix);
    if (!batches.has(key)) batches.set(key, []);
    batches.get(key).push(geometry);
  }
  const box = (key, width, height, depth, x, y, z) => add(key, new THREE.BoxGeometry(width, height, depth), [x, y, z]);
  const cylinder = (key, top, bottom, height, x, y, z, sides = 12) => add(key, new THREE.CylinderGeometry(top, bottom, height, sides), [x, y, z]);
  function collide(x, z, width, depth) {
    colliders.push({ minX: x - width / 2, maxX: x + width / 2, minZ: z - depth / 2, maxZ: z + depth / 2 });
  }
  function merge(geometries) {
    const positions = [];
    for (const geometry of geometries) {
      const flat = geometry.index ? geometry.toNonIndexed() : geometry;
      positions.push(...flat.attributes.position.array);
      if (flat !== geometry) flat.dispose();
      geometry.dispose();
    }
    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.computeVertexNormals();
    result.computeBoundingBox(); result.computeBoundingSphere();
    return result;
  }

  // The broad, level wooden floor has a single picking surface at the exact
  // standing height. Narrow recessed seams and staggered joints reveal scale.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(18, .18, 24), materials.floor);
  floor.position.y = -.09; floor.receiveShadow = true;
  floor.name = 'Walkable temple floor'; group.add(floor); groundMeshes.push(floor);
  for (let row = 0; row < 48; row++) {
    const z = -11.75 + row * .5;
    const stagger = row % 2 ? 1.5 : 0;
    for (let x = -9 + stagger; x < 9; x += 3) {
      const left = Math.max(-9, x), right = Math.min(9, x + 3);
      box((row + Math.round(x * 2)) % 3 === 0 ? 'floorShade' : 'floorWarm', right - left - .014, .006, .48, (left + right) / 2, .003, z);
    }
    if (stagger) box(row % 3 ? 'floorWarm' : 'floorShade', 1.48, .006, .48, -8.25, .003, z);
  }
  for (const side of [-1, 1]) box('woodDark', .055, .018, 23.65, side * 8.78, .013, 0);

  // Solid rear and side walls, with deeply framed paper lattice windows.
  box('plaster', 18, 7.4, .24, 0, 3.7, -11.88);
  collide(0, -11.88, 18, .24);
  for (const side of [-1, 1]) {
    const x = side * 8.88;
    box('plaster', .24, 7.4, 24, x, 3.7, 0);
    box('wood', .32, 1.02, 24, x, .51, 0);
    box('woodDark', .4, .095, 24, x, 1.06, 0);
    box('woodLight', .4, .09, 24, x, .17, 0);
    collide(x, 0, .24, 24);
    for (const z of [-7, -1, 5]) {
      const inward = side * 8.735;
      box('woodDark', .08, 3.6, 3.9, inward, 3.14, z);
      box('paper', .085, 3.38, 3.66, inward - side * .055, 3.14, z);
      for (let band = 0; band <= 7; band++) box('wood', .12, .035, 3.66, inward - side * .1, 1.46 + band * .48, z);
      for (let line = 0; line <= 7; line++) box('wood', .12, 3.4, .035, inward - side * .11, 3.14, z - 1.83 + line * .523);
      box('woodLight', .14, .08, 3.93, inward - side * .13, 1.35, z);
      box('woodLight', .14, .08, 3.93, inward - side * .13, 4.94, z);
    }
  }
  for (const y of [.36, 1.02, 6.91]) box('wood', 17.8, .14, .16, 0, y, -11.71);
  // Dark ceiling boards stop short of the arrival camera. The upper lattice
  // and structural beams remain visible without making the interior a dollhouse.
  box('woodDark', 17.75, .13, 17.8, 0, 7.47, -3);
  for (let x = -8.5; x <= 8.5; x += .5) box('wood', .022, .025, 17.8, x, 7.385, -3);

  // Two parallel colonnades leave a broad, uninterrupted middle aisle.
  for (const x of [-7.45, 7.45]) for (const z of [-9.1, -3.4, 2.3, 8]) {
    cylinder('stone', .42, .49, .24, x, .12, z);
    cylinder('wood', .24, .33, 6.72, x, 3.6, z, 16);
    cylinder('woodDark', .34, .37, .16, x, .31, z);
    cylinder('woodLight', .28, .29, .08, x, .63, z);
    box('woodDark', .78, .22, .74, x, 6.95, z);
    box('woodLight', 1.08, .16, .88, x, 7.12, z);
    box('accent', 1.14, .12, .6, x, 7.23, z);
    box('woodDark', .58, .17, 1.28, x, 7.33, z);
    collide(x, z, .7, .7);
  }
  for (const z of [-9.1, -3.4, 2.3, 8]) {
    box('wood', 15.55, .34, .36, 0, 7.27, z);
    box('woodLight', 15.55, .055, .39, 0, 7.05, z);
    box('accent', 14.4, .065, .1, 0, 7.22, z + .2);
    for (const x of [-6.6, 6.6]) box('woodDark', 1.18, .18, .58, x, 6.9, z);
  }
  for (const x of [-7.45, 7.45]) box('wood', .3, .3, 18.7, x, 7.15, -.55);

  // The dais is deliberately empty: a quiet shared focal point below the art,
  // with no altar objects, deity, host, or seat placed on the platform.
  const dais = new THREE.Mesh(new THREE.BoxGeometry(10.7, .35, 3.25), materials.wood);
  dais.position.set(0, .175, -9.25); dais.castShadow = true; dais.receiveShadow = true;
  dais.name = 'Empty front dais'; dais.userData.emptyDais = true; group.add(dais);
  collide(0, -9.25, 10.7, 3.25);
  box('woodLight', 10.8, .07, 3.31, 0, .365, -9.25);
  box('woodDark', 10.55, .055, .06, 0, .15, -7.595);
  box('woodLight', 10.55, .035, .07, 0, .26, -7.59);
  for (const x of [-5.1, 5.1]) box('brass', .06, .18, .065, x, .19, -7.59);

  // Recessed mural and a timber picture rail make the day-pillar illustration
  // read as an architectural wall painting rather than a floating UI card.
  // All sixty shared app artworks are 960 × 717; preserve that native ratio.
  const muralWidth = 7.5, muralHeight = muralWidth * 717 / 960, muralCenter = 4.1;
  box('woodDark', muralWidth + .62, muralHeight + .54, .17, 0, muralCenter, -11.56);
  box('woodLight', muralWidth + .36, muralHeight + .3, .07, 0, muralCenter, -11.44);
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(muralWidth, muralHeight), muralMaterial);
  mural.position.set(0, muralCenter, -11.385); mural.name = 'Day-pillar mural'; mural.userData.iljuMural = true;
  group.add(mural);
  for (const y of [muralCenter - muralHeight / 2 - .11, muralCenter + muralHeight / 2 + .11]) box('brass', muralWidth + .38, .022, .025, 0, y, -11.385);
  for (const x of [-(muralWidth / 2 + .16), muralWidth / 2 + .16]) box('brass', .022, muralHeight + .24, .025, x, muralCenter, -11.385);

  // Four columns of six low textile cushions: large gaps between rows and a
  // central aisle wide enough for several travellers to pass each other.
  function roundedRectangle(width, height, radius) {
    const shape = new THREE.Shape(), left = -width / 2, right = width / 2, bottom = -height / 2, top = height / 2;
    shape.moveTo(left + radius, bottom); shape.lineTo(right - radius, bottom);
    shape.quadraticCurveTo(right, bottom, right, bottom + radius); shape.lineTo(right, top - radius);
    shape.quadraticCurveTo(right, top, right - radius, top); shape.lineTo(left + radius, top);
    shape.quadraticCurveTo(left, top, left, top - radius); shape.lineTo(left, bottom + radius);
    shape.quadraticCurveTo(left, bottom, left + radius, bottom);
    return shape;
  }
  const cushionGeometry = new THREE.ExtrudeGeometry(roundedRectangle(1.32, 1.15, .15), { depth: .065, bevelEnabled: true, bevelThickness: .045, bevelSize: .06, bevelSegments: 2, steps: 1, curveSegments: 4 });
  cushionGeometry.rotateX(-Math.PI / 2);
  const pipingShape = roundedRectangle(1.22, 1.05, .14);
  const hole = new THREE.Path(roundedRectangle(1.19, 1.02, .13).getPoints(24));
  pipingShape.holes.push(hole);
  const pipingGeometry = new THREE.ShapeGeometry(pipingShape, 5); pipingGeometry.rotateX(-Math.PI / 2);
  const piping = new THREE.InstancedMesh(pipingGeometry, materials.accentLight, 24);
  piping.name = 'Cushion woven piping'; group.add(piping);
  for (let row = 0; row < 6; row++) for (let column = 0; column < 4; column++) {
    const x = [-5.2, -2.65, 2.65, 5.2][column], z = -5.2 + row * 2.25;
    const id = `seat-${String(seats.length + 1).padStart(2, '0')}`;
    const seat = { id, label: `${row + 1}열 ${column + 1}번 자리`, x, z, heading: Math.PI, surfaceY: .17 };
    seats.push(seat);
    const cushion = new THREE.Mesh(cushionGeometry, materials.accent);
    cushion.position.set(x, .06, z); cushion.name = `Seat cushion — ${id}`;
    cushion.castShadow = true; cushion.receiveShadow = true;
    cushion.userData.seatId = id; group.add(cushion);
    seat.group = cushion;
    transform.position.set(x, .178, z); transform.rotation.set(0, 0, 0); transform.scale.set(1, 1, 1); transform.updateMatrix();
    piping.setMatrixAt(seats.length - 1, transform.matrix);
    box('woodDark', 1.56, .022, 1.4, x, .014, z);
  }
  piping.instanceMatrix.needsUpdate = true;

  // Small warm lamps hang clear of the mural and central sightline.
  for (const x of [-5.55, 5.55]) for (const z of [-5.9, 4.9]) {
    cylinder('brass', .016, .016, 1.17, x, 6.44, z, 6);
    cylinder('lantern', .28, .32, .71, x, 5.48, z, 10);
    cylinder('woodDark', .34, .35, .065, x, 5.87, z, 10);
    cylinder('woodDark', .34, .35, .065, x, 5.09, z, 10);
    for (let rib = 0; rib < 8; rib++) {
      const a = rib / 8 * Math.PI * 2;
      cylinder('wood', .009, .009, .71, x + Math.cos(a) * .3, 5.48, z + Math.sin(a) * .3, 4);
    }
  }
  for (const [key, geometries] of batches) {
    const mesh = new THREE.Mesh(merge(geometries), materials[key]);
    mesh.name = `Temple batch — ${key}`;
    mesh.castShadow = ['wood', 'woodDark', 'woodLight'].includes(key);
    mesh.receiveShadow = true; group.add(mesh);
  }
  group.updateMatrixWorld(true);
  let disposed = false;
  function setRoom(room, texture = null) {
    if (disposed) return;
    const colors = ELEMENT_COLORS[room?.element] || ELEMENT_COLORS.목;
    materials.accent.color.set(colors[0]); materials.accentLight.color.set(colors[1]);
    muralMaterial.map = texture || null;
    muralMaterial.color.set(texture ? '#ffffff' : '#dbd4bb');
    muralMaterial.needsUpdate = true;
    group.userData.roomKey = room?.key || null;
    group.userData.ilju = room?.ilju || '';
    mural.userData.ilju = room?.ilju || '';
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    const geometries = new Set();
    group.traverse(object => {
      if (object.geometry) geometries.add(object.geometry);
      if (object.isInstancedMesh) object.dispose();
    });
    geometries.forEach(geometry => geometry.dispose());
    // Material.dispose does not dispose a texture map. Explicitly detach it so
    // the controller can keep, replace, and eventually release its own texture.
    muralMaterial.map = null;
    Object.values(materials).forEach(material => material.dispose());
    muralMaterial.dispose();
    group.clear();
  }
  return {
    group, groundMeshes, colliders, bounds, spawn, seats,
    heightAt: () => 0,
    setRoom,
    update() {},
    dispose,
  };
}
