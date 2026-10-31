import * as THREE from 'three';

/** A small, original hanbok traveller. Its face points toward local +Z. */
export function createAvatar() {
  const group = new THREE.Group();
  group.name = 'SamraTraveller';
  const figure = new THREE.Group();
  group.add(figure);
  const materials = {};
  const material = (name, color, extra = {}) => {
    const result = new THREE.MeshStandardMaterial({ color, roughness: 0.83, metalness: 0, ...extra });
    materials[name] = result;
    return result;
  };
  material('skin', '#f2d8bb');
  material('blush', '#dda596');
  material('hair', '#302c32');
  material('hairLight', '#46404a');
  material('cream', '#e9e4cf');
  material('collar', '#f8f0dc');
  material('sage', '#8eaa98');
  material('sageShade', '#718f81');
  material('ribbon', '#b79972');
  material('shoe', '#555b56');
  material('eye', '#3b3735');
  material('glint', '#fff6df');

  function mesh(geometry, mat, parent, position, scale) {
    const item = new THREE.Mesh(geometry, mat);
    if (position) item.position.set(...position);
    if (scale) item.scale.set(...scale);
    item.castShadow = true;
    item.receiveShadow = false;
    (parent || figure).add(item);
    return item;
  }
  const sphere = (radius, mat, parent, position, scale) => mesh(new THREE.SphereGeometry(radius, 24, 18), mat, parent, position, scale);
  const capsule = (radius, length, mat, parent, position, scale) => mesh(new THREE.CapsuleGeometry(radius, length, 6, 12), mat, parent, position, scale);

  // Compact rounded shoulders and a wrap jacket, with a sewn collar at the front.
  const torso = mesh(new THREE.CylinderGeometry(0.18, 0.225, 0.34, 24), materials.cream, figure, [0, 0.79, 0]);
  sphere(0.2, materials.cream, figure, [0, 0.88, 0], [1.08, 0.58, 0.85]);
  const hem = mesh(new THREE.CylinderGeometry(0.22, 0.265, 0.13, 28), materials.cream, figure, [0, 0.64, 0]);
  hem.scale.z = 0.78;
  const collarLeft = capsule(0.026, 0.22, materials.collar, figure, [-0.055, 0.88, 0.174]);
  collarLeft.rotation.z = -0.63;
  const collarRight = capsule(0.027, 0.25, materials.collar, figure, [0.053, 0.86, 0.179]);
  collarRight.rotation.z = 0.55;
  const tie = new THREE.Group();
  tie.position.set(0.075, 0.775, 0.192);
  figure.add(tie);
  const tieLeft = sphere(0.045, materials.ribbon, tie, [-0.026, 0.013, 0], [1, 0.42, 0.40]);
  tieLeft.rotation.z = -0.4;
  const tieRight = sphere(0.045, materials.ribbon, tie, [0.029, 0.013, 0], [1, 0.42, 0.40]);
  tieRight.rotation.z = 0.4;
  const ribbonEnd = capsule(0.016, 0.14, materials.ribbon, tie, [0.014, -0.075, 0]);
  ribbonEnd.rotation.z = 0.12;

  const waist = mesh(new THREE.CylinderGeometry(0.205, 0.245, 0.19, 24), materials.sage, figure, [0, 0.535, -0.012]);
  waist.scale.z = 0.78;
  const leftLeg = new THREE.Group();
  const rightLeg = new THREE.Group();
  [leftLeg, rightLeg].forEach((leg, index) => {
    leg.position.set(index ? 0.115 : -0.115, 0.48, 0);
    figure.add(leg);
    capsule(0.105, 0.18, materials.sage, leg, [0, -0.135, 0], [1, 1, 0.96]);
    capsule(0.073, 0.04, materials.sageShade, leg, [0, -0.285, 0]);
    sphere(0.102, materials.shoe, leg, [0, -0.357, 0.035], [0.92, 0.57, 1.5]);
    sphere(0.047, materials.cream, leg, [0, -0.339, 0.139], [1.5, 0.45, 0.45]);
  });

  const leftArm = new THREE.Group();
  const rightArm = new THREE.Group();
  [leftArm, rightArm].forEach((arm, index) => {
    const side = index ? 1 : -1;
    arm.position.set(side * 0.226, 0.9, 0);
    arm.rotation.z = side * 0.14;
    figure.add(arm);
    capsule(0.096, 0.18, materials.cream, arm, [side * 0.018, -0.13, 0]);
    capsule(0.083, 0.02, materials.collar, arm, [side * 0.026, -0.267, 0.008]);
    sphere(0.066, materials.skin, arm, [side * 0.027, -0.314, 0.012], [0.9, 1, 0.95]);
  });

  const head = new THREE.Group();
  head.position.y = 1.18;
  figure.add(head);
  sphere(0.278, materials.skin, head, [0, 0, 0.015], [1, 1.04, 0.94]);
  sphere(0.062, materials.skin, head, [-0.267, -0.025, 0.005], [0.65, 1, 0.73]);
  sphere(0.062, materials.skin, head, [0.267, -0.025, 0.005], [0.65, 1, 0.73]);
  const hairCap = mesh(new THREE.SphereGeometry(0.291, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.55), materials.hair, head, [0, 0.016, -0.007]);
  hairCap.scale.set(1.02, 1.04, 1.01);
  sphere(0.223, materials.hair, head, [0, 0.035, -0.14], [1.05, 1.1, 0.70]);
  [-1, 1].forEach(side => {
    const fringe = sphere(0.115, materials.hair, head, [side * 0.128, 0.145, 0.188], [1.22, 0.62, 0.48]);
    fringe.rotation.z = side * 0.24;
    sphere(0.073, materials.hair, head, [side * 0.237, 0.03, 0.08], [0.53, 1.5, 0.60]);
  });
  sphere(0.12, materials.hair, head, [0, 0.282, -0.09], [1, 0.86, 0.97]);
  const bunTie = mesh(new THREE.TorusGeometry(0.092, 0.012, 8, 24), materials.sage, head, [0, 0.26, -0.09]);
  bunTie.rotation.x = Math.PI / 2;
  const hairpin = capsule(0.012, 0.29, materials.ribbon, head, [0, 0.29, -0.098]);
  hairpin.rotation.z = Math.PI / 2 + 0.08;
  sphere(0.031, materials.sage, head, [0.17, 0.275, -0.098], [1, 0.8, 1]);

  const eyes = [];
  [-1, 1].forEach(side => {
    const eye = sphere(0.022, materials.eye, head, [side * 0.088, 0.006, 0.257], [0.78, 1.13, 0.43]);
    eyes.push(eye);
    sphere(0.006, materials.glint, head, [side * 0.088 - 0.004, 0.014, 0.267]);
    sphere(0.035, materials.blush, head, [side * 0.139, -0.054, 0.231], [1, 0.45, 0.2]);
  });
  sphere(0.018, materials.skin, head, [0, -0.026, 0.279], [0.6, 0.9, 0.55]);
  const smile = new THREE.EllipseCurve(0, 0, 0.028, 0.019, Math.PI * 1.08, Math.PI * 1.92, false, 0);
  const mouthGeometry = new THREE.BufferGeometry().setFromPoints(smile.getPoints(14).map(p => new THREE.Vector3(p.x, p.y - 0.073, 0.262)));
  const mouth = new THREE.Line(mouthGeometry, new THREE.LineBasicMaterial({ color: '#9a7361' }));
  head.add(mouth);

  // A tiny travel pouch gives the back a readable silhouette while walking away.
  const strap = capsule(0.019, 0.42, materials.sageShade, figure, [0, 0.79, -0.17]);
  strap.rotation.z = -0.48;
  sphere(0.12, materials.ribbon, figure, [0.132, 0.6, -0.177], [0.82, 1, 0.48]);
  sphere(0.035, materials.cream, figure, [0.13, 0.64, -0.236], [1, 0.36, 0.3]);

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.41, 36), new THREE.MeshBasicMaterial({ color: '#111b20', transparent: true, opacity: 0.22, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.018;
  shadow.scale.y = 0.77;
  group.add(shadow);

  let time = 0;
  let walkBlend = 0;
  let gesture = null;
  let gestureTime = 0;
  let blinkUntil = 2.8;

  function setGesture(kind) {
    if (!['wish', 'greet', 'arrival'].includes(kind)) return;
    gesture = kind;
    gestureTime = 0;
  }

  function update(delta, moving = false) {
    const dt = Math.max(0, Math.min(0.1, Number.isFinite(delta) ? delta : 0));
    const isMoving = typeof moving === 'object' ? Boolean(moving.moving) : Boolean(moving);
    time += dt;
    walkBlend = THREE.MathUtils.damp(walkBlend, isMoving ? 1 : 0, 12, dt);
    const stride = Math.sin(time * 9.2) * 0.46 * walkBlend;
    leftLeg.rotation.x = stride;
    rightLeg.rotation.x = -stride;
    leftArm.rotation.x = -stride * 0.78;
    rightArm.rotation.x = stride * 0.78;
    leftArm.rotation.z = -0.14;
    rightArm.rotation.z = 0.14;
    figure.position.y = -0.065 + Math.abs(Math.sin(time * 9.2)) * 0.033 * walkBlend + Math.sin(time * 1.8) * 0.009 * (1 - walkBlend);
    torso.rotation.z = Math.sin(time * 4.6) * 0.015 * walkBlend;
    head.rotation.z = Math.sin(time * 2.1) * 0.023 * (1 - walkBlend);
    head.rotation.x = Math.sin(time * 1.8) * 0.014;
    if (gesture) {
      gestureTime += dt;
      const length = gesture === 'wish' ? 2.1 : 1.65;
      const fade = Math.min(1, gestureTime * 4, Math.max(0, (length - gestureTime) * 4));
      if (gesture === 'wish') {
        leftArm.rotation.x = -0.85 * fade;
        rightArm.rotation.x = -0.85 * fade;
        leftArm.rotation.z = 0.36 * fade - 0.14;
        rightArm.rotation.z = -0.36 * fade + 0.14;
        head.rotation.x += 0.16 * fade;
      } else {
        rightArm.rotation.z = (1.95 + Math.sin(gestureTime * 12) * 0.17) * fade + 0.14;
        rightArm.rotation.x = -0.2 * fade;
      }
      if (gestureTime >= length) gesture = null;
    }
    blinkUntil -= dt;
    if (blinkUntil < -0.12) blinkUntil = 3.2 + Math.sin(time) * 0.8;
    const eyeScale = blinkUntil < 0 ? 0.10 : 1.13;
    eyes.forEach(eye => { eye.scale.y = eyeScale; });
    shadow.scale.set(1 - walkBlend * 0.05, 0.77 - walkBlend * 0.03, 1);
  }

  function dispose() {
    const geometries = new Set();
    const usedMaterials = new Set();
    group.traverse(item => {
      if (item.geometry) geometries.add(item.geometry);
      if (item.material) (Array.isArray(item.material) ? item.material : [item.material]).forEach(value => usedMaterials.add(value));
    });
    geometries.forEach(geometry => geometry.dispose());
    usedMaterials.forEach(value => value.dispose());
    group.removeFromParent();
  }

  return { group, update, setGesture, dispose };
}
