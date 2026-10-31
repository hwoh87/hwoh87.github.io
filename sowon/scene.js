import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createWorld } from './world.js';
import { createAvatar } from './avatar.js';
import { createLocomotion } from './locomotion.js';

const host = document.getElementById('worldViewport');
const body = document.body;
const loading = document.getElementById('worldLoading');
const travelStatus = document.getElementById('travelStatus');
let renderer, world, avatar, movement, orbit, resizeObserver;
let frame = 0, previousTime = 0, running = false, exploring = false;
let travelTimer, activeJourney = null;
let cameraTransition = null;
const cleanups = [];

function listen(target, name, callback, options) {
  target.addEventListener(name, callback, options);
  cleanups.push(() => target.removeEventListener(name, callback, options));
}

function status(message, duration = 0) {
  clearTimeout(travelTimer);
  travelStatus.textContent = message;
  travelStatus.hidden = !message;
  if (message && duration) travelTimer = setTimeout(() => { travelStatus.hidden = true; }, duration);
}

function enter() {
  if (exploring) return;
  exploring = true;
  body.classList.add('is-exploring');
  movement?.setEnabled(true);
  cameraTransition = { elapsed: 0, camera: camera.position.clone(), target: orbit.target.clone() };
  status('달빛 나그네가 되어, 마음이 가는 곳으로 걸어보세요.', 4200);
}

function fail() {
  body.classList.add('world-failed');
  body.classList.remove('world-ready', 'is-exploring');
  movement?.setEnabled(false);
  if (loading) loading.hidden = true;
  document.getElementById('worldFallback').hidden = false;
  document.getElementById('enterWorldLabel').textContent = '소원 등불 밝히기';
  document.getElementById('entranceNote').textContent = '가입 없이 무료로 · 나만 볼 수 있는 소원';
}

let camera;
function setup() {
  renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 760 ? 1.5 : 1.8));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', '삼라 소원당 3D. 바닥을 눌러 이동하고 방향키 또는 W A S D로 걸어보세요.');
  renderer.domElement.setAttribute('role', 'application');
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#111e32');
  scene.fog = new THREE.FogExp2('#172b40', .016);
  camera = new THREE.PerspectiveCamera(48, 1, .1, 150);
  camera.position.set(11.8, 8.5, 24);

  const sky = new THREE.HemisphereLight('#c3d6ee', '#73715d', 1.05);
  scene.add(sky, new THREE.AmbientLight('#b7c7dc', .22));
  const moonlight = new THREE.DirectionalLight('#c1d8f0', 1.5);
  moonlight.position.set(-12, 24, 12);
  moonlight.castShadow = true;
  moonlight.shadow.mapSize.set(1024, 1024);
  Object.assign(moonlight.shadow.camera, { left: -20, right: 20, top: 20, bottom: -20, near: 1, far: 65 });
  moonlight.shadow.bias = -.0005;
  moonlight.shadow.normalBias = .04;
  scene.add(moonlight);

  world = createWorld();
  scene.add(world.group);
  avatar = createAvatar();
  avatar.group.position.set(0, world.heightAt(0, 8), 8);
  avatar.group.rotation.y = Math.PI;
  scene.add(avatar.group);

  orbit = new OrbitControls(camera, renderer.domElement);
  orbit.target.set(0, 2, -2);
  orbit.enableDamping = true;
  orbit.dampingFactor = .065;
  orbit.enablePan = false;
  orbit.minDistance = 5;
  orbit.maxDistance = 33;
  orbit.minPolarAngle = .22;
  orbit.maxPolarAngle = Math.PI * .465;
  orbit.rotateSpeed = .6;
  orbit.zoomSpeed = .8;
  orbit.update();

  movement = createLocomotion({
    camera, domElement: renderer.domElement, avatar, world, orbitControls: orbit,
    onMove: source => { enter(); if (activeJourney && source !== 'path') { activeJourney = null; status('마음이 가는 곳으로 천천히 걸어보세요.', 2500); } },
    onArrival: () => {}
  });

  const name = document.getElementById('travelerName');
  const projected = new THREE.Vector3();
  const placeButtons = Array.from(document.querySelectorAll('[data-world-place]'));
  const placePosition = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3(0, 4.6, 9.7);
  const targetOffset = new THREE.Vector3(0, 2, 0);
  const nameOffset = new THREE.Vector3(0, 1.7, 0);
  const tweenCamera = new THREE.Vector3();
  const tweenTarget = new THREE.Vector3();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 760 ? 60 : exploring ? 54 : 48;
    camera.updateProjectionMatrix();
  }
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();

  function render(time) {
    if (!running) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, .05) : 0;
    previousTime = time;
    const modalOpen = Boolean(document.querySelector('dialog[open]'));
    body.classList.toggle('world-modal-open', modalOpen);
    if (modalOpen && activeJourney) { activeJourney = null; status('', 0); }
    movement.setEnabled(!modalOpen);
    movement.update(delta);
    if (cameraTransition) {
      cameraTransition.elapsed += delta;
      const progress = reducedMotion.matches ? 1 : Math.min(1, cameraTransition.elapsed / 1.05);
      const ease = progress * progress * (3 - 2 * progress);
      tweenCamera.copy(avatar.group.position).add(cameraOffset);
      tweenTarget.copy(avatar.group.position).add(targetOffset);
      camera.position.lerpVectors(cameraTransition.camera, tweenCamera, ease);
      orbit.target.lerpVectors(cameraTransition.target, tweenTarget, ease);
      if (progress >= 1) cameraTransition = null;
    }
    world.update(reducedMotion.matches ? 0 : time / 1000, delta);
    orbit.update();
    projected.copy(avatar.group.position).add(nameOffset).project(camera);
    const visible = projected.z < 1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95;
    name.hidden = !visible || modalOpen;
    if (visible) { name.style.left = ((projected.x + 1) / 2 * 100) + '%'; name.style.top = ((1 - projected.y) / 2 * 100) + '%'; }
    placeButtons.forEach(button => {
      const point = world.destinations[button.dataset.worldPlace];
      placePosition.set(point.x, world.heightAt(point.x, point.z) + 1.65, point.z).project(camera);
      const inFrame = placePosition.z < 1 && Math.abs(placePosition.x) < .88 && placePosition.y < .5 && placePosition.y > -.54;
      button.hidden = !exploring || !inFrame || modalOpen;
      if (inFrame) { button.style.left = ((placePosition.x + 1) / 2 * 100) + '%'; button.style.top = ((1 - placePosition.y) / 2 * 100) + '%'; }
    });
    renderer.render(scene, camera);
    host.dataset.ready = 'true';
    const playerPosition = avatar.group.position;
    // Visible DOM diagnostics keep accessibility and manual QA independent of renderer internals.
    host.dataset.position = `${playerPosition.x.toFixed(2)},${playerPosition.z.toFixed(2)}`;
    host.dataset.moving = String(movement.getState().moving);
    host.dataset.drawCalls = String(renderer.info.render.calls);
    frame = requestAnimationFrame(render);
  }

  listen(document.getElementById('enterWorld'), 'click', event => {
    event.preventDefault(); event.stopPropagation(); enter();
    renderer.domElement.focus({ preventScroll: true });
  });
  listen(renderer.domElement, 'pointerdown', () => { cameraTransition = null; });

  const actionLabels = { wish: '소원 등불이 있는 신당', breath: '바람이 머무는 명상터', blessing: '마음을 전하는 소원나무' };
  function walkToAction(action) {
    enter();
    activeJourney = action;
    status(`${actionLabels[action]}로 걸어가는 중 · 바닥을 누르면 자유롭게 이동해요.`);
    const result = movement.goTo(world.destinations[action], () => {
      if (activeJourney !== action) return;
      activeJourney = null;
      status('', 0);
      if (action === 'wish') avatar.setGesture('wish');
      document.dispatchEvent(new CustomEvent('sowon:open', { detail: { action } }));
    });
    if (result === false) { activeJourney = null; status('이곳에서 마음을 남겨보세요.', 2500); document.dispatchEvent(new CustomEvent('sowon:open', { detail: { action } })); }
  }
  listen(document.querySelector('.ritual-dock'), 'click', event => {
    const button = event.target.closest('button');
    if (!button) return;
    const action = button.hasAttribute('data-open-wish') ? 'wish' : button.hasAttribute('data-open-breath') ? 'breath' : 'blessing';
    event.preventDefault(); event.stopPropagation(); walkToAction(action);
  });
  placeButtons.forEach(button => listen(button, 'click', () => walkToAction(button.dataset.worldPlace)));
  listen(document.getElementById('greetTraveler'), 'click', () => {
    avatar.setGesture('greet');
    status('반가워요. 이곳에서 잠깐 쉬어가요.', 2500);
  });

  listen(document.getElementById('returnToGate'), 'click', () => {
    activeJourney = null;
    cameraTransition = null;
    camera.position.copy(avatar.group.position).add(cameraOffset);
    orbit.target.copy(avatar.group.position).add(targetOffset);
    orbit.update();
    status('처음의 달빛 아래로 돌아왔어요.', 2400);
  });
  listen(document, 'sowon:state', event => world.setWishCount(event.detail?.wishCount || 0));
  listen(document, 'sowon:gesture', event => avatar.setGesture(event.detail?.kind || 'wish'));
  world.setWishCount(Number(document.getElementById('lanternCount').textContent) || 0);

  listen(renderer.domElement, 'webglcontextlost', event => {
    event.preventDefault(); running = false; cancelAnimationFrame(frame); fail();
  });
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { activeJourney = null; status('', 0); running = false; cancelAnimationFrame(frame); previousTime = 0; }
    else if (!body.classList.contains('world-failed')) { running = true; previousTime = 0; frame = requestAnimationFrame(render); }
  });
  listen(window, 'pagehide', event => {
    running = false;
    cancelAnimationFrame(frame);
    if (event.persisted) return;
    cleanups.forEach(cleanup => cleanup());
    resizeObserver.disconnect();
    movement.dispose(); orbit.dispose(); avatar.dispose(); world.dispose(); renderer.dispose();
  });
  listen(window, 'pageshow', event => {
    if (event.persisted && !body.classList.contains('world-failed')) { running = true; previousTime = 0; frame = requestAnimationFrame(render); }
  });

  loading.hidden = true;
  body.classList.add('world-ready');
  running = true;
  frame = requestAnimationFrame(render);
}

try { setup(); } catch (error) { console.warn('소원당 3D 공간을 시작하지 못했습니다.', error); fail(); }
