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
    ceramic: new THREE.MeshStandardMaterial({ color: '#91a69a', roughness: .45, metalness: .04 }),
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
  const line = (key, points, radius = .025) => add(key, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), Math.max(4, points.length * 3), radius, 5, false));
  function ellipse(key, x, y, z, width, height, depth, rotation = 0) {
    const geometry = new THREE.SphereGeometry(1, 8, 5);
    geometry.scale(width / 2, height / 2, depth / 2);
    add(key, geometry, [x, y, z], [0, 0, rotation]);
  }
  const decor = group.userData.decor = { screens: [], floorLanterns: [], teaShelves: [], planters: [] };
  function describe(name, placement) {
    const marker = new THREE.Group(); marker.name = name; marker.userData.decor = placement;
    marker.position.set(placement.x, placement.y || 0, placement.z); group.add(marker);
    return placement;
  }
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

  // A shallow timber sanctum belongs to the wall, entirely behind the empty
  // dais. Its stepped cornice and carved returns add depth around, never over,
  // the shared illustration's complete rectangle.
  decor.frontSanctum = describe('Timber mural sanctum', { x: 0, y: .55, z: -11.34, width: 8.86, height: 6.88, depth: .66 });
  for (const side of [-1, 1]) {
    box('wood', .25, 6.38, .34, side * 4.18, 3.86, -11.32);
    box('woodLight', .085, 6.2, .055, side * 4.04, 3.84, -11.115);
    box('woodDark', .4, .16, .46, side * 4.18, .76, -11.28);
    box('woodLight', .37, .12, .41, side * 4.18, 1, -11.28);
    for (const y of [1.4, 6.45]) {
      box('wood', .6, .15, .47, side * 4.1, y, -11.26);
      box('accent', .51, .045, .05, side * 4.1, y + .04, -11.005);
      add('brass', new THREE.BoxGeometry(.1, .1, .025), [side * 4.1, y, -10.97], [0, 0, Math.PI / 4]);
    }
  }
  for (const [width, height, y, z, depth] of [[8.55, .11, 7.02, -11.32, .43], [8.86, .13, 7.16, -11.3, .59], [8.62, .09, 7.29, -11.32, .52]]) {
    box('woodDark', width, height, depth, 0, y, z);
    box('woodLight', width - .1, .028, depth + .012, 0, y - height / 2 + .018, z);
  }
  for (let x = -4.04; x <= 4.05; x += .42) box('wood', .1, .12, .41, x, 7.095, -11.25);
  box('wood', 8.72, .17, .37, 0, .96, -11.33);
  box('woodLight', 8.85, .07, .47, 0, 1.08, -11.29);
  box('woodDark', 8.5, .16, .23, 0, .72, -11.42);
  // The decorative structure is shallow, but its full projection is solid.
  collide(0, -11.34, 8.86, .66);

  // Paired folding-screen panels make the surrounding wall feel considered:
  // carved lotus and moon on one side, a moonlit branch on the other. These are
  // restrained relief geometry rather than another downloaded picture.
  function petal(x, y, z, angle, scale = 1) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0);
    shape.quadraticCurveTo(-.46, .5, 0, 1.03);
    shape.quadraticCurveTo(.46, .5, 0, 0);
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .022, bevelEnabled: false, curveSegments: 5 });
    geometry.scale(scale, scale, 1);
    add('accentLight', geometry, [x, y, z], [0, 0, angle]);
  }
  for (const side of [-1, 1]) {
    const x = side * 5.83, z = -11.18;
    decor.screens.push(describe(side < 0 ? 'Lotus relief screen' : 'Moon and branch relief screen', { x, y: .1, z, width: 2.27, height: 5.8, depth: .46, motif: side < 0 ? 'lotus-moon' : 'branch-moon' }));
    box('woodDark', 2.18, 5.48, .16, x, 3.03, z);
    box('paper', 1.93, 5.18, .08, x, 3.03, z + .12);
    for (const dx of [-1.02, 1.02]) box('wood', .1, 5.62, .2, x + dx, 3.03, z + .08);
    for (const y of [.27, .56, 5.5, 5.79]) box('woodLight', 2.2, .07, .23, x, y, z + .1);
    box('wood', 2.27, .18, .4, x, .2, z);
    for (const y of [.8, 5.24]) for (let i = -3; i <= 3; i++) {
      add('wood', new THREE.BoxGeometry(.12, .12, .04), [x + i * .23, y, z + .185], [0, 0, Math.PI / 4]);
    }
    add('brass', new THREE.RingGeometry(.39, .425, 36), [x, 4.45, z + .19]);
    if (side < 0) {
      for (const angle of [-1.05, -.67, -.32, 0, .32, .67, 1.05]) petal(x, 2.08, z + .2, angle, .85);
      line('woodLight', [[x - .65, 1.88, z + .21], [x, 1.83, z + .21], [x + .65, 1.88, z + .21]], .018);
      line('accent', [[x, 1.25, z + .21], [x - .03, 1.6, z + .21], [x, 2.12, z + .21]], .018);
      ellipse('accent', x - .3, 1.55, z + .21, .55, .14, .035, -.2);
      ellipse('accent', x + .25, 1.36, z + .21, .48, .13, .035, .18);
    } else {
      line('wood', [[x - .6, 1.1, z + .21], [x - .32, 1.95, z + .21], [x + .1, 2.8, z + .21], [x + .35, 3.8, z + .21]], .035);
      line('wood', [[x - .3, 1.95, z + .21], [x + .18, 2.1, z + .21], [x + .63, 2.45, z + .21]], .021);
      line('wood', [[x + .03, 2.7, z + .21], [x - .4, 3, z + .21], [x - .62, 3.5, z + .21]], .02);
      for (const [dx, y, angle] of [[-.53, 3.36, -.55], [-.3, 3.02, .64], [.3, 3.55, -.55], [.25, 3.15, .5], [.57, 2.43, -.55], [.26, 2.13, .7], [-.4, 1.72, -.4]]) ellipse('accent', x + dx, y, z + .23, .17, .42, .035, angle);
    }
    collide(x, z, 2.27, .46);
  }

  // Freestanding paper lamps sit on the floor beside the dais, never on it.
  // Their broad stepped feet, paper ribs and little brass finials read at the
  // overview distance; all decorative surfaces share the architecture batches.
  for (const side of [-1, 1]) {
    const x = side * 6.2, z = -7.1;
    decor.floorLanterns.push(describe('Standing paper lantern', { x, y: 0, z, width: .94, height: 2.66, depth: .94 }));
    cylinder('woodDark', .43, .47, .14, x, .07, z, 8);
    cylinder('woodLight', .34, .39, .1, x, .19, z, 8);
    cylinder('wood', .12, .17, .73, x, .58, z, 8);
    cylinder('brass', .2, .22, .08, x, .97, z, 8);
    cylinder('woodDark', .43, .38, .12, x, 1.1, z, 8);
    cylinder('lantern', .36, .36, 1.24, x, 1.78, z, 8);
    for (let rib = 0; rib < 8; rib++) {
      const angle = rib * Math.PI / 4;
      cylinder('wood', .016, .016, 1.25, x + Math.cos(angle) * .365, 1.78, z + Math.sin(angle) * .365, 5);
    }
    cylinder('woodDark', .4, .43, .12, x, 2.45, z, 8);
    cylinder('woodLight', .27, .36, .08, x, 2.55, z, 8);
    cylinder('brass', .07, .13, .07, x, 2.625, z, 8);
    collide(x, z, .94, .94);
  }

  // Low side cabinets and tea utensils suggest a cared-for shared room.
  // Keep everything beyond the colonnades so the occupied seats stay visible.
  for (const side of [-1, 1]) {
    const x = side * 8.17, z = -6.5;
    decor.teaShelves.push(describe('Tea and scroll cabinet', { x, y: 0, z, width: 1.04, height: 1.58, depth: 2.72 }));
    box('woodDark', .96, .12, 2.56, x, .17, z);
    box('wood', .94, .6, 2.54, x, .51, z);
    box('woodLight', 1.04, .09, 2.72, x, .855, z);
    box('woodDark', .025, .41, 2.36, x - side * .485, .53, z);
    for (const dz of [-.78, 0, .78]) {
      box('wood', .04, .4, .7, x - side * .51, .52, z + dz);
      box('brass', .035, .035, .11, x - side * .538, .6, z + dz);
    }
    for (const dz of [-1.02, 1.02]) box('woodDark', .66, .22, .11, x, .11, z + dz);
    // A tray, lidded pot, cup and nested bowls on each cabinet.
    box('woodDark', .7, .035, .82, x, .92, z - .63);
    cylinder('ceramic', .13, .2, .25, x, 1.065, z - .72, 12);
    cylinder('ceramic', .16, .11, .045, x, 1.21, z - .72, 12);
    cylinder('brass', .027, .037, .04, x, 1.25, z - .72, 8);
    line('ceramic', [[x - side * .12, 1.09, z - .72], [x - side * .27, 1.12, z - .72], [x - side * .3, 1.19, z - .72]], .038);
    add('ceramic', new THREE.TorusGeometry(.135, .025, 5, 12), [x + side * .17, 1.09, z - .72], [0, Math.PI / 2, 0]);
    for (const dz of [-.44, -.25]) {
      cylinder('ceramic', .072, .052, .09, x - side * .15, .98, z + dz, 10);
      cylinder('woodDark', .058, .058, .006, x - side * .15, 1.028, z + dz, 10);
    }
    for (let i = 0; i < 3; i++) {
      cylinder('paper', .16, .13, .035, x + side * .09, .95 + i * .028, z + .2, 12);
    }
    // Rolled paper and a folded cloth occupy the far end of the shelf.
    for (let i = 0; i < 3; i++) {
      add('paper', new THREE.CylinderGeometry(.064, .064, .52, 10), [x - side * .04, .98 + (i === 2 ? .11 : 0), z + .7 + (i % 2) * .14], [0, 0, Math.PI / 2]);
      add('woodDark', new THREE.CylinderGeometry(.025, .025, .58, 8), [x - side * .04, .98 + (i === 2 ? .11 : 0), z + .7 + (i % 2) * .14], [0, 0, Math.PI / 2]);
    }
    box('accent', .62, .045, .34, x, .94, z + 1.05);
    // A small bud vase, separate from the larger floor planting below.
    cylinder('ceramic', .05, .13, .3, x + side * .12, 1.05, z - 1.1, 12);
    line('wood', [[x + side * .12, 1.18, z - 1.1], [x + side * .16, 1.36, z - 1.09], [x + side * .08, 1.57, z - 1.05]], .013);
    ellipse('accentLight', x + side * .02, 1.45, z - 1.05, .16, .08, .09, -.35);
    collide(x, z, 1.04, 2.72);

    const px = side * 8.12, pz = 6.4;
    decor.planters.push(describe('Quiet side planting', { x: px, y: 0, z: pz, width: 1.02, height: 2.18, depth: 1.02 }));
    cylinder('stone', .35, .43, .1, px, .05, pz, 12);
    cylinder('ceramic', .4, .29, .5, px, .35, pz, 12);
    cylinder('woodDark', .345, .345, .025, px, .61, pz, 12);
    for (const [dx, dz, h] of [[-.16, -.08, 1.45], [.13, .05, 1.9], [0, .12, 1.65]]) {
      line('wood', [[px + dx, .62, pz + dz], [px + dx * .7, h * .72, pz + dz], [px + dx * 1.2, h + .2, pz + dz]], .017);
      for (let i = 0; i < 4; i++) {
        const y = .95 + i * (h - .7) / 4, leafSide = i % 2 ? -1 : 1;
        ellipse('accent', px + dx + leafSide * .15, y, pz + dz, .38, .12, .18, leafSide * .4);
      }
    }
    // The foliage is walk-through at head height, but the ceramic vessel isn't.
    collide(px, pz, .86, .86);
  }

  // A woven runner draws the eye down the long, unobstructed central aisle.
  // Low thread relief catches side-light without introducing another image or
  // any collision above the walkable floor.
  decor.aisleRunner = describe('Woven central aisle runner', { x: 0, y: .013, z: 1.55, width: 1.46, height: .014, depth: 16.9 });
  box('accent', 1.46, .012, 16.9, 0, .015, 1.55);
  for (const x of [-.66, -.59, .59, .66]) box('accentLight', .018, .002, 16.75, x, .022, 1.55);
  for (let z = -6.8; z <= 9.9; z += .075) box('accentLight', 1.08, .0015, .009, 0, .022, z);
  for (const z of [-6.99, 10.09]) for (let x = -.69; x <= .7; x += .055) box('paper', .018, .004, .17, x, .014, z);

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
