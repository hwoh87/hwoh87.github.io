import * as THREE from 'three';

export const ATMOSPHERES = Object.freeze({
  moon: Object.freeze({
    mood: 'moon',
    palette: Object.freeze({ background: '#101d31', fog: '#192d42', sky: '#bfd4ed', ground: '#687269', ambient: '#aebfd7', key: '#c8ddf2' }),
    fogDensity: 0.0105, exposure: 1.22, hemisphereIntensity: 1.65, ambientIntensity: 0.33, keyIntensity: 1.9,
    keyPosition: Object.freeze({ x: -12, y: 24, z: 12 }),
  }),
  dawn: Object.freeze({
    mood: 'dawn',
    palette: Object.freeze({ background: '#b3a4b5', fog: '#dbbaa8', sky: '#ead6c3', ground: '#8b9987', ambient: '#d7cbd0', key: '#ffd19b' }),
    fogDensity: 0.0085, exposure: 1.1, hemisphereIntensity: 1.68, ambientIntensity: 0.36, keyIntensity: 1.88,
    keyPosition: Object.freeze({ x: -25, y: 12, z: -16 }),
  }),
});

// A small monoline Hangul alphabet for architectural plaques. The actual strokes
// are rounded 3D bars, so signs remain crisp without a font download or texture.
const consonants = {
  0: [[0, 1, 1, 1], [1, 1, 1, 0]],
  2: [[0, 1, 0, 0], [0, 0, 1, 0]],
  3: [[0, 1, 1, 1], [0, 1, 0, 0], [0, 0, 1, 0]],
  5: [[0, 1, 1, 1], [1, 1, 1, 0.5], [1, 0.5, 0, 0.5], [0, 0.5, 0, 0], [0, 0, 1, 0]],
  6: [[0, 0, 0, 1], [0, 1, 1, 1], [1, 1, 1, 0], [1, 0, 0, 0]],
  7: [[0, 0, 0, 1], [1, 0, 1, 1], [0, 0.5, 1, 0.5], [0, 0, 1, 0]],
  9: [[0.5, 1, 0, 0], [0.5, 1, 1, 0]],
  12: [[0, 1, 1, 1], [0.5, 0.92, 0, 0], [0.5, 0.92, 1, 0]],
};
const vowels = {
  0: [[0.38, 0, 0.38, 1], [0.38, 0.5, 1, 0.5]],
  4: [[0.62, 0, 0.62, 1], [0, 0.5, 0.62, 0.5]],
  6: [[0.62, 0, 0.62, 1], [0, 0.32, 0.62, 0.32], [0, 0.68, 0.62, 0.68]],
  8: [[0, 0.2, 1, 0.2], [0.5, 0.2, 0.5, 1]],
  13: [[0, 0.8, 1, 0.8], [0.5, 0, 0.5, 0.8]],
  18: [[0, 0.5, 1, 0.5]],
  20: [[0.5, 0, 0.5, 1]],
};
export function makeHangulGeometry(text, height = 0.34) {
  const positions = [];
  const up = new THREE.Vector3(0, 1, 0);
  const advance = height * 0.98, width = height * 0.8;
  const left = -(text.length * advance - advance + width) / 2;
  function stroke(x1, y1, x2, y2) {
    const a = new THREE.Vector3(x1, y1, 0), b = new THREE.Vector3(x2, y2, 0);
    const direction = new THREE.Vector3().subVectors(b, a);
    if (direction.lengthSq() < 1e-8) return;
    const geometry = new THREE.CylinderGeometry(height * 0.023, height * 0.023, direction.length(), 5);
    geometry.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, direction.normalize()));
    geometry.translate(...a.add(b).multiplyScalar(0.5).toArray());
    const flat = geometry.toNonIndexed();
    for (const value of flat.getAttribute('position').array) positions.push(value);
    flat.dispose(); geometry.dispose();
  }
  function draw(code, rect, x, isVowel = false) {
    const [rx, ry, rw, rh] = rect;
    const lines = isVowel ? vowels[code] : consonants[code];
    const transform = (u, v) => [x + (rx + u * rw) * width, (ry + v * rh - 0.5) * height];
    if (!isVowel && code === 11) {
      for (let i = 0; i < 14; i += 1) {
        const a = i / 14 * Math.PI * 2, b = (i + 1) / 14 * Math.PI * 2;
        stroke(...transform(0.5 + Math.cos(a) * 0.48, 0.5 + Math.sin(a) * 0.48), ...transform(0.5 + Math.cos(b) * 0.48, 0.5 + Math.sin(b) * 0.48));
      }
    } else {
      for (const [a, b, c, d] of lines || []) stroke(...transform(a, b), ...transform(c, d));
    }
  }
  [...text].forEach((character, index) => {
    const n = character.codePointAt(0) - 0xac00;
    if (n < 0 || n > 11171) return;
    const initial = Math.floor(n / 588), vowel = Math.floor(n % 588 / 28), final = n % 28, hasFinal = final > 0;
    const x = left + index * advance;
    const bottom = hasFinal ? 0.37 : 0.03;
    if ([8, 13, 18].includes(vowel)) {
      draw(initial, [0.1, hasFinal ? 0.61 : 0.5, 0.8, hasFinal ? 0.34 : 0.45], x);
      draw(vowel, [0.08, bottom, 0.84, hasFinal ? 0.19 : 0.35], x, true);
    } else if (vowel === 14) {
      draw(initial, [0.03, 0.62, 0.55, 0.33], x);
      draw(13, [0.02, bottom, 0.56, 0.19], x, true);
      draw(4, [0.64, bottom, 0.32, 0.6], x, true);
    } else {
      draw(initial, [0.02, bottom, 0.56, 0.96 - bottom], x);
      draw(vowel, [0.65, bottom, 0.33, 0.96 - bottom], x, true);
    }
    if (hasFinal) draw({ 1: 0, 4: 2, 8: 5, 16: 6, 21: 11 }[final], [0.1, 0.04, 0.8, 0.23], x);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  return geometry;
}

const pointVertex = `
  attribute float aPhase;
  attribute float aSize;
  attribute vec3 aColor;
  uniform float uTime;
  uniform float uScale;
  uniform float uLimit;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = clamp(aSize * uScale / max(1.0, -mv.z), 1.0, uLimit);
    vAlpha = 0.66 + 0.34 * sin(uTime * 0.42 + aPhase);
    vColor = aColor;
  }
`;
const pointFragment = `
  uniform float uOpacity;
  varying float vAlpha;
  varying vec3 vColor;
  void main() {
    float radius = length(gl_PointCoord - vec2(0.5)) * 2.0;
    float alpha = (exp(-radius * radius * 7.0) + 0.16 * (1.0 - smoothstep(0.0, 1.0, radius))) * vAlpha * uOpacity;
    if (radius > 1.0 || alpha < 0.005) discard;
    gl_FragColor = vec4(vColor, alpha);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/** Geometry and procedural shaders only: no image, panorama, or particle texture. */
export function createAtmosphere() {
  const group = new THREE.Group(); group.name = 'Air, drifting leaves and water';
  const dummy = new THREE.Object3D();
  let seed = 39317;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  let mood = 'moon', quality = 'clear';
  const state = { ...ATMOSPHERES.moon, palette: { ...ATMOSPHERES.moon.palette }, keyPosition: { ...ATMOSPHERES.moon.keyPosition }, quality };
  const skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color('#101d31') }, uHorizon: { value: new THREE.Color('#284257') } },
    vertexShader: `varying vec3 vDirection;void main(){vDirection=normalize(position);vec4 clip=projectionMatrix*vec4(mat3(viewMatrix)*position,1.0);gl_Position=clip.xyww;}`,
    fragmentShader: `varying vec3 vDirection;uniform vec3 uTop;uniform vec3 uHorizon;void main(){float up=smoothstep(0.01,0.62,normalize(vDirection).y);gl_FragColor=vec4(mix(uHorizon,uTop,up),1.0);#include <colorspace_fragment>}`.replace('#include', '\n#include'),
    side: THREE.BackSide, depthWrite: false, depthTest: false, toneMapped: false,
  });
  const sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMat); sky.name = 'Procedural sky horizon'; sky.renderOrder = -1000; sky.frustumCulled = false; group.add(sky);
  function glowingPoints(positions, colors, sizes, phases, limit, scale) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('aColor', new THREE.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('aSize', new THREE.Float32BufferAttribute(sizes, 1));
    geometry.setAttribute('aPhase', new THREE.Float32BufferAttribute(phases, 1));
    const material = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uOpacity: { value: 1 }, uScale: { value: scale }, uLimit: { value: limit } },
      vertexShader: pointVertex, fragmentShader: pointFragment, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const points = new THREE.Points(geometry, material); points.frustumCulled = false; group.add(points);
    return points;
  }
  const starPosition = [], starColors = [], starSizes = [], starPhases = [];
  for (let i = 0; i < 440; i += 1) {
    const angle = random() * Math.PI * 2, radius = 53 + random() * 24;
    starPosition.push(Math.cos(angle) * radius, 13 + random() * 39, Math.sin(angle) * radius);
    const color = new THREE.Color(i % 7 === 0 ? '#e9cfa4' : i % 3 === 0 ? '#cad9eb' : '#e4e9ec');
    starColors.push(color.r, color.g, color.b); starSizes.push(0.8 + random() * 0.9); starPhases.push(random() * Math.PI * 2);
  }
  const stars = glowingPoints(starPosition, starColors, starSizes, starPhases, 2.8, 125); stars.name = 'Round, slowly twinkling stars';
  const fireflyData = [], fireflyPosition = [], fireflyColors = [], fireflySizes = [], fireflyPhases = [];
  const zones = [[-8, -3.9], [7, -0.3], [17, 1], [-16, 1], [0, -19.5]];
  for (let i = 0; i < 36; i += 1) {
    const zone = zones[i % zones.length];
    const entry = { x: zone[0] + (random() - 0.5) * 4.2, z: zone[1] + (random() - 0.5) * 3.8, y: 0.5 + random() * 1.9, phase: random() * Math.PI * 2 };
    fireflyData.push(entry); fireflyPosition.push(entry.x, entry.y, entry.z);
    const color = new THREE.Color(i % 4 ? '#dce29a' : '#eed29a'); fireflyColors.push(color.r, color.g, color.b);
    fireflySizes.push(0.7 + random() * 0.9); fireflyPhases.push(entry.phase);
  }
  const fireflies = glowingPoints(fireflyPosition, fireflyColors, fireflySizes, fireflyPhases, 8, 180); fireflies.name = 'Garden fireflies';
  fireflies.geometry.getAttribute('position').setUsage(THREE.DynamicDrawUsage);

  const leafGeometry = new THREE.BufferGeometry();
  leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, -0.11, 0, 0.052, -0.025, 0, 0.042, 0.07, 0, 0, 0.145, 0, -0.042, 0.07, 0, -0.052, -0.025, 0, 0, 0.01, 0.018,
  ], 3));
  leafGeometry.setIndex([6, 0, 1, 6, 1, 2, 6, 2, 3, 6, 3, 4, 6, 4, 5, 6, 5, 0]); leafGeometry.computeVertexNormals();
  const leafMat = new THREE.MeshStandardMaterial({ color: '#ffffff', side: THREE.DoubleSide, roughness: 1, transparent: true, opacity: 0.78, depthWrite: false });
  const leaves = new THREE.InstancedMesh(leafGeometry, leafMat, 32); leaves.instanceMatrix.setUsage(THREE.DynamicDrawUsage); leaves.frustumCulled = false; leaves.name = 'Small drifting leaves'; group.add(leaves);
  const leafData = [];
  const leafZones = [[7, -0.3], [13.9, -0.1], [20.2, 0.2], [-10.8, 5.2], [-10.5, -10.3]];
  for (let i = 0; i < 32; i += 1) {
    const zone = leafZones[i % leafZones.length];
    leafData.push({ x: zone[0] + (random() - 0.5) * 2.6, z: zone[1] + (random() - 0.5) * 2.4, phase: random() * 15, speed: 0.14 + random() * 0.12, scale: 0.55 + random() * 0.5 });
    leaves.setColorAt(i, new THREE.Color(i % 5 === 0 ? '#b8a09b' : i % 3 === 0 ? '#a9ad82' : '#799982'));
  }
  leaves.instanceColor.needsUpdate = true;

  const cloudMat = new THREE.MeshBasicMaterial({ color: '#8ba2ba', transparent: true, opacity: 0.023, depthWrite: false });
  const clouds = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), cloudMat, 18); clouds.frustumCulled = false; clouds.name = 'Distant drifting cloud banks'; group.add(clouds);
  const cloudData = Array.from({ length: 18 }, (_, i) => ({ x: -40 + (i % 6) * 15 + random() * 5, y: 8.7 + Math.floor(i / 6) * 3.7 + random(), z: -32 - Math.floor(i / 6) * 13 - random() * 5, phase: random() * Math.PI * 2 }));
  const hazeMat = new THREE.MeshBasicMaterial({ color: '#b4c8ce', transparent: true, opacity: 0.025, depthWrite: false });
  const haze = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), hazeMat, 8); haze.frustumCulled = false; haze.name = 'Low garden haze'; group.add(haze);
  const hazeData = [[-10, -9], [10, -10], [-20, -13], [21, -13], [-7, -20], [7, -20], [-20, 10], [20, 11]];

  const waterMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uOpacity: { value: 0.19 }, uWarm: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `
      varying vec2 vUv; uniform float uTime; uniform float uOpacity; uniform float uWarm;
      void main(){
        vec2 p=(vUv-0.5)*2.0;
        float edge=1.0-smoothstep(0.76,0.99,length(p));
        float bend=sin(p.y*14.0+uTime*0.8)*0.026+sin(p.y*29.0-uTime*0.4)*0.016;
        float path=exp(-pow((p.x-bend)*5.0,2.0));
        float wave=pow(max(0.0,sin(p.y*77.0+uTime*1.25+sin(p.x*18.0))),14.0);
        float gold=exp(-pow((p.x+0.42)*8.0,2.0))*0.32;
        vec3 col=mix(vec3(0.53,0.68,0.77),vec3(0.86,0.69,0.42),uWarm*0.6);
        float alpha=edge*wave*(path*0.8+gold)*uOpacity;
        gl_FragColor=vec4(col,alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
    side: THREE.DoubleSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const shimmer = new THREE.Mesh(new THREE.CircleGeometry(2.97, 48), waterMat); shimmer.rotation.x = -Math.PI / 2; shimmer.scale.y = 0.81; shimmer.position.set(-8, 0.079, -3.9); shimmer.name = 'Procedural moon reflection'; group.add(shimmer);
  const risingSun = new THREE.Mesh(new THREE.SphereGeometry(3.05, 32, 16), new THREE.MeshBasicMaterial({ color: '#f2c7a1', transparent: true, opacity: 0.78, fog: false }));
  risingSun.position.set(-23, 10.2, -48); risingSun.name = 'Soft sun beyond the eastern ridge'; group.add(risingSun);
  const sunriseHalo = new THREE.Mesh(new THREE.SphereGeometry(5.1, 24, 14), new THREE.MeshBasicMaterial({ color: '#eac1aa', transparent: true, opacity: 0.04, fog: false, depthWrite: false }));
  sunriseHalo.position.copy(risingSun.position); sunriseHalo.name = 'Peach light above the mountain ridge'; group.add(sunriseHalo);

  const lightPoolMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.14 } },
    vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.0);}`,
    fragmentShader: `varying vec2 vUv;uniform float uOpacity;void main(){float r=length(vUv-0.5)*2.0;float a=pow(max(0.0,1.0-r),2.0)*uOpacity;gl_FragColor=vec4(1.0,0.67,0.27,a);}`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  });
  const lightPools = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 24), lightPoolMat, 12); lightPools.name = 'Soft lantern light on stone'; lightPools.frustumCulled = false; group.add(lightPools);
  const lightSites = [[-3.7, 6.1, 1.55], [3.7, 6.1, 1.55], [-3.7, 12, 1.5], [3.7, 12, 1.5], [-13.5, 8.2, 1.3], [-13.5, 0, 1.3], [13.5, 6.7, 1.3], [13.5, 0, 1.3], [-17, -5, 1.8], [17, -6.7, 1.8], [-17, 8, 1.8], [17, 6.5, 1.8]];
  lightSites.forEach(([x, z, scale], i) => { dummy.position.set(x, 0.052, z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.set(scale, scale * 0.75, 1); dummy.updateMatrix(); lightPools.setMatrixAt(i, dummy.matrix); });

  function setMood(next) {
    if (!Object.hasOwn(ATMOSPHERES, next)) return state;
    mood = next;
    const preset = ATMOSPHERES[mood];
    Object.assign(state, preset, { palette: { ...preset.palette }, keyPosition: { ...preset.keyPosition }, quality });
    skyMat.uniforms.uTop.value.set(preset.palette.background);
    skyMat.uniforms.uHorizon.value.set(mood === 'moon' ? '#284257' : '#e2bba2');
    stars.material.uniforms.uOpacity.value = mood === 'moon' ? 0.88 : 0.10;
    fireflies.material.uniforms.uOpacity.value = mood === 'moon' ? 0.72 : 0.08;
    cloudMat.color.set(mood === 'moon' ? '#8ba2ba' : '#e0d2c5'); cloudMat.opacity = mood === 'moon' ? 0.023 : 0.055;
    hazeMat.color.set(mood === 'moon' ? '#b4c8ce' : '#d0d6cc'); hazeMat.opacity = mood === 'moon' ? 0.025 : 0.065;
    waterMat.uniforms.uOpacity.value = mood === 'moon' ? 0.22 : 0.13; waterMat.uniforms.uWarm.value = mood === 'dawn' ? 1 : 0;
    lightPoolMat.uniforms.uOpacity.value = mood === 'moon' ? 0.2 : 0.035;
    risingSun.visible = mood === 'dawn'; sunriseHalo.visible = mood === 'dawn';
    return state;
  }
  function setQuality(next) {
    if (!['smooth', 'clear'].includes(next)) return quality;
    quality = next; state.quality = quality;
    stars.geometry.setDrawRange(0, quality === 'clear' ? 440 : 190);
    fireflies.geometry.setDrawRange(0, quality === 'clear' ? 36 : 15);
    leaves.count = quality === 'clear' ? 32 : 12;
    clouds.count = quality === 'clear' ? 18 : 8;
    haze.count = quality === 'clear' ? 8 : 4;
    return quality;
  }
  function update(time = 0) {
    const t = Number.isFinite(time) ? time : 0;
    stars.material.uniforms.uTime.value = t; fireflies.material.uniforms.uTime.value = t; waterMat.uniforms.uTime.value = t;
    const positions = fireflies.geometry.getAttribute('position');
    fireflyData.forEach((p, i) => positions.setXYZ(i, p.x + Math.sin(t * 0.23 + p.phase) * 0.42, p.y + Math.sin(t * 0.52 + p.phase) * 0.22, p.z + Math.cos(t * 0.19 + p.phase) * 0.35)); positions.needsUpdate = true;
    for (let i = 0; i < leaves.count; i += 1) {
      const p = leafData[i], cycle = (t * p.speed + p.phase) % 4.6;
      dummy.position.set(p.x + Math.sin(t * 0.3 + p.phase) * 0.8, 4.8 - cycle, p.z + Math.cos(t * 0.26 + p.phase) * 0.55);
      dummy.rotation.set(Math.sin(t + p.phase) * 0.7, p.phase + t * 0.3, Math.cos(t * 0.7 + p.phase) * 0.8); dummy.scale.setScalar(p.scale); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix);
    }
    leaves.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < clouds.count; i += 1) {
      const p = cloudData[i]; dummy.position.set(p.x + Math.sin(t * 0.018 + p.phase) * 4, p.y, p.z); dummy.rotation.set(0, 0.15 * i, 0); dummy.scale.set(8 + i % 3 * 1.8, 0.28 + i % 2 * 0.16, 2.1 + i % 3 * 0.5); dummy.updateMatrix(); clouds.setMatrixAt(i, dummy.matrix);
    }
    clouds.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < haze.count; i += 1) {
      const p = hazeData[i]; dummy.position.set(p[0] + Math.sin(t * 0.08 + i) * 0.65, 0.2, p[1]); dummy.rotation.set(0, i * 0.7, 0); dummy.scale.set(3.8, 0.19, 1.3); dummy.updateMatrix(); haze.setMatrixAt(i, dummy.matrix);
    }
    haze.instanceMatrix.needsUpdate = true;
  }
  setMood('moon'); setQuality('clear'); update(0);
  return { group, state, setMood, setQuality, update };
}
