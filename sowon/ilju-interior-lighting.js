import * as THREE from 'three';

/** Warm reflected daylight and two paper lamps, with one shadow map at most. */
export function createIljuInteriorLighting({ quality = 'auto', narrow = false } = {}) {
  const group = new THREE.Group();
  group.name = 'Ilju — quiet evening interior light';
  const hemisphere = new THREE.HemisphereLight('#e6e4cf', '#4a4038', 1.2);
  hemisphere.name = 'Soft reflected evening light';
  const ambient = new THREE.AmbientLight('#f7e3bd', .24);
  ambient.name = 'Warm timber bounce';
  const keyLight = new THREE.DirectionalLight('#fff0d0', 2);
  keyLight.name = 'Low evening light inside the timber ceiling';
  keyLight.position.set(-5.4, 6.6, 4.5);
  keyLight.target.position.set(0, .4, -4.5);
  keyLight.target.name = 'Interior evening light target';
  Object.assign(keyLight.shadow.camera, { left: -12, right: 12, top: 18, bottom: -18, near: .1, far: 38 });
  keyLight.shadow.camera.updateProjectionMatrix();
  keyLight.shadow.bias = -.0003;
  keyLight.shadow.normalBias = .03;
  keyLight.shadow.radius = 3;
  group.add(hemisphere, ambient, keyLight, keyLight.target);

  // Keep these centres inside the matching paper lanterns in the architecture.
  // Point-light shadows would multiply the mobile draw cost, so only the key
  // light casts a shadow. The lamps provide a local pool of warmth instead.
  const lamps = [-1, 1].map(side => {
    const lamp = new THREE.PointLight('#ffcd83', 8, 8, 2);
    lamp.name = side < 0 ? 'Left front paper lamp light' : 'Right front paper lamp light';
    lamp.position.set(side * 6.2, 1.9, -7.1);
    lamp.castShadow = false;
    group.add(lamp);
    return lamp;
  });
  let currentQuality = 'auto', currentNarrow = false, lampStrength = 8, disposed = false;

  function releaseShadowMap() {
    // Three does not resize an existing shadow target after mapSize changes.
    // Releasing it also returns its GPU memory when smooth mode is selected.
    keyLight.shadow.dispose();
    keyLight.shadow.map = null;
    keyLight.shadow.mapPass = null;
  }
  function setQuality({ quality: nextQuality = currentQuality, narrow: nextNarrow = currentNarrow } = {}) {
    if (disposed) return;
    currentQuality = ['auto', 'clear', 'smooth'].includes(nextQuality) ? nextQuality : 'auto';
    currentNarrow = Boolean(nextNarrow);
    const shadows = currentQuality !== 'smooth', size = currentNarrow ? 512 : 1024;
    if (keyLight.shadow.mapSize.x !== size || keyLight.shadow.mapSize.y !== size || !shadows) releaseShadowMap();
    keyLight.shadow.mapSize.set(size, size);
    keyLight.castShadow = shadows;
    keyLight.shadow.needsUpdate = shadows;
    lampStrength = currentQuality === 'smooth' ? 7 : 8;
    lamps.forEach(lamp => { lamp.intensity = lampStrength; });
  }
  function update(time) {
    if (disposed) return;
    // Seconds, not frame deltas: visits and frame-rate changes cannot build
    // up brightness. A slow 2% variation stays below a perceptible flicker.
    const seconds = Number.isFinite(time) ? time : 0;
    lamps[0].intensity = lampStrength * (1 + .02 * Math.sin(seconds * .62));
    lamps[1].intensity = lampStrength * (1 + .02 * Math.sin(seconds * .62 + 1.1));
  }
  function dispose() {
    if (disposed) return;
    disposed = true;
    releaseShadowMap();
    for (const light of [hemisphere, ambient, keyLight, ...lamps]) light.dispose();
    group.removeFromParent();
    group.clear();
  }
  setQuality({ quality, narrow });
  return { group, keyLight, setQuality, update, dispose };
}
