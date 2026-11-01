import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createIljuInterior } from './ilju-interior.js?v=20261101-templewarm1';
import { createIljuInteriorLighting } from './ilju-interior-lighting.js?v=20261101-templewarm1';
import { interiorForRoom, interiorViewPose, applyInteriorSeat } from './ilju-interior-core.js?v=20261101-templeroom2';
import { createAvatar } from './avatar.js?v=20261101-templeroom1';
import { createLocomotion } from './locomotion.js?v=20261101-templeroom1';
import { createVisitors } from './visitors.js?v=20261101-freepath4';
import { getOwnProfile } from './profile.js?v=20261101-freepath4';
import { getOwnIdentity } from './identity.js?v=20261101-freepath4';
import { readSettings } from './experience-core.js?v=20261101-freepath4';
import { enterSocialRoom, getSocialRoomState } from './social.js?v=20261101-pairpaths4';

const layer = document.createElement('section');
layer.id = 'iljuInterior'; layer.className = 'ilju-interior'; layer.hidden = true;
layer.setAttribute('aria-labelledby', 'interiorTitle');
layer.innerHTML = `<div class="interior-canvas" aria-label="일주방의 넓은 마루와 벽화"></div>
  <header class="interior-header"><button type="button" data-interior-back><span aria-hidden="true">←</span> 신당 마당</button><div class="interior-heading"><p>삼라 · 일주방</p><h1 id="interiorTitle" tabindex="-1"></h1></div><button type="button" data-open-ilju-rooms>다른 방</button></header>
  <div class="interior-presence"><span class="interior-presence-dot" aria-hidden="true"></span><span data-interior-presence>혼자 둘러보는 중</span><button type="button" data-interior-social>함께 머물기</button></div>
  <div class="interior-visitor-names" aria-label="같은 일주방에 머무는 나그네"></div>
  <div class="interior-name" hidden></div>
  <aside class="interior-mural-caption"><span data-interior-ganzi></span><h2 data-interior-mural-title></h2><p>나의 일주를 담은 물상 벽화</p></aside>
  <p class="interior-status" role="status" aria-live="polite">마음에 드는 자리를 골라 잠시 쉬어가세요.</p>
  <div class="interior-stick" role="group" aria-label="방 안에서 이동"><div class="interior-stick-thumb"></div></div>
  <nav class="interior-tools" aria-label="일주방에서 머물기"><button type="button" data-interior-seats aria-expanded="false" aria-controls="interiorSeats"><span aria-hidden="true">▧</span> 자리 고르기</button><button type="button" data-interior-mural aria-pressed="false"><span aria-hidden="true">▥</span> 벽화 감상</button><button type="button" data-interior-overview>방 전체 보기</button><button type="button" data-interior-stand hidden>일어나기</button></nav>
  <section class="interior-seats" id="interiorSeats" aria-label="앉을 자리 선택" hidden><div><h2>어디에 앉을까요?</h2><button type="button" data-interior-seats-close aria-label="자리 선택 닫기">×</button></div><p>앞쪽에는 빈 단상, 가운데에는 넓은 통로가 있어요.</p><div class="interior-seat-list"></div></section>
  <div class="interior-loading" role="status"><span></span><p>목조 방에 빛을 들이고 있어요.</p></div>
  <div class="interior-fallback" hidden><img alt=""><h2>벽화를 마주하는 시간</h2><p>이 기기에서는 그림과 함께 잠시 쉬어가세요.</p><button type="button" data-interior-retry>입체 공간 다시 열기</button></div>`;
document.body.appendChild(layer);
const $ = selector => layer.querySelector(selector);
const sanctuary = document.querySelector('.sanctuary');
const canvasHost = $('.interior-canvas');
let active = null, engine = null, opener = null, pendingExit = false, activeSeat = null;
let frame = 0, previous = 0, muralVersion = 0, muralTexture = null, transition = null, muralView = false;
let presence = null, oldInert = false, disposed = false, roomVersion = 0;
let outsideTitle = '';
const cleanup = [];
function listen(target, name, callback, options) { target.addEventListener(name, callback, options); cleanup.push(() => target.removeEventListener(name, callback, options)); }
function message(text) { $('.interior-status').textContent = text; }
function dialogOpen() { return Boolean(document.querySelector('dialog[open]')); }
function connectedHere() { const state = getSocialRoomState(); return state.joined && state.roomKey === active?.room.key; }
function updatePresence() {
  if (!active) return;
  const state = getSocialRoomState(), here = state.joined && state.roomKey === active.room.key;
  const count = here && state.connected ? Math.max(1, state.roomCounts[active.room.key] || 1) : 0;
  $('.interior-presence').dataset.connected = String(here && state.connected);
  $('[data-interior-presence]').textContent = here ? state.connected ? `같은 방에 ${count}명 머무는 중` : '나그네와 다시 연결하는 중' : '혼자 조용히 둘러보는 중';
  $('[data-interior-social]').textContent = here ? '나그네 보기' : '함께 머물기';
  $('[data-interior-social]').disabled = state.busy;
  $('[data-interior-back]').disabled = pendingExit || state.busy;
  const valid = here && presence?.roomKey === active.room.key && state.connected;
  engine?.visitors.sync(valid ? presence.visitors : [], valid ? presence.selfId : '');
}
function applyAppearance() {
  if (!engine) return;
  const profile = getOwnProfile();
  engine.avatar.setGender?.(profile?.solar.g || null);
  let settings; try { settings = readSettings(localStorage); } catch (_) {}
  engine.avatar.setAppearance(settings?.outfit || 'sage');
  applyLightingQuality(settings);
  const identity = getOwnIdentity();
  $('.interior-name').textContent = identity.hasIdentity ? `${identity.ilju}일주 · ${profile?.nickname || '나'}` : profile?.nickname || '나';
}
function applyLightingQuality(settings) {
  if (!engine) return;
  if (!settings) { try { settings = readSettings(localStorage); } catch (_) {} }
  const quality = settings?.quality || 'auto', narrow = innerWidth < 760;
  engine.lighting.setQuality({quality, narrow});
  const shadows = quality !== 'smooth';
  if (engine.renderer.shadowMap.enabled !== shadows) {
    engine.renderer.shadowMap.enabled = shadows;
    // Shadow availability is part of Three.js's material program selection.
    engine.scene.traverse(node => {
      if (node.material) for (const material of [node.material].flat()) material.needsUpdate = true;
    });
  }
}
function resize() {
  if (!engine || layer.hidden) return;
  const width = canvasHost.clientWidth, height = canvasHost.clientHeight;
  if (!width || !height) return;
  engine.renderer.setSize(width, height, false);
  applyLightingQuality();
  engine.camera.aspect = width / height; engine.camera.fov = width / height < .85 ? 62 : 48; engine.camera.updateProjectionMatrix();
  setView(muralView ? 'mural' : 'overview', true);
}
function viewPose(mode) {
  return interiorViewPose({width:innerWidth,height:innerHeight,mode});
}
function setView(mode, immediate = false) {
  if (!engine) return;
  muralView = mode === 'mural';
  $('[data-interior-mural]').setAttribute('aria-pressed', String(muralView));
  const pose = viewPose(mode);
  engine.camera.fov = pose.fov; engine.camera.updateProjectionMatrix();
  // The far wall stays ahead of the viewer; controlled orbit avoids looking
  // through the open camera side of the room.
  engine.orbit.minAzimuthAngle = -.48; engine.orbit.maxAzimuthAngle = .48;
  engine.orbit.minPolarAngle = .65; engine.orbit.maxPolarAngle = Math.PI * .49;
  if (immediate || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    engine.camera.position.fromArray(pose.position); engine.orbit.target.fromArray(pose.target); engine.orbit.update(); transition = null;
  } else transition = {time: 0, from: engine.camera.position.clone(), target: engine.orbit.target.clone(), pose};
}
function stand() {
  activeSeat = null; engine?.avatar.setSeated?.(false);
  $('[data-interior-stand]').hidden = true;
  layer.querySelectorAll('[data-interior-seat]').forEach(button => button.setAttribute('aria-pressed', 'false'));
}
function toggleSeats(open) {
  $('#interiorSeats').hidden = !open; $('[data-interior-seats]').setAttribute('aria-expanded', String(open));
}
function chooseSeat(id) {
  if (!engine || !active || dialogOpen()) return;
  const seat = engine.world.seats.find(seat => seat.id === id); if (!seat) return;
  stand(); toggleSeats(false); engine.movement.setEnabled(true); setView('overview');
  message(`${seat.label}로 천천히 걸어가고 있어요.`);
  const accepted = engine.movement.goTo(seat, () => {
    activeSeat = seat;
    engine.avatar.group.rotation.y = seat.heading;
    engine.avatar.setSeated?.(true, seat.surfaceY ?? .17);
    $('[data-interior-stand]').hidden = false;
    layer.querySelectorAll('[data-interior-seat]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.interiorSeat === seat.id)));
    message(`${seat.label}에 앉았어요. 벽화를 바라보며 잠시 쉬어가세요.`);
  });
  if (!accepted) message('가운데 통로에서 다시 자리를 골라보세요.');
}
function createEngine() {
  const pendingResources = [];
  try {
  const renderer = new THREE.WebGLRenderer({antialias: true, powerPreference: 'low-power'});
  pendingResources.push(() => { renderer.dispose(); renderer.domElement.remove(); });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, innerWidth < 760 ? 1.35 : 1.7));
  renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.domElement.tabIndex = 0; renderer.domElement.setAttribute('role', 'application'); renderer.domElement.setAttribute('aria-label', '일주방 입체 공간. 바닥이나 방석을 누르거나 방향키로 이동해요.');
  canvasHost.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#312b26');
  const camera = new THREE.PerspectiveCamera(48, 1, .1, 150);
  const world = createIljuInterior(); scene.add(world.group);
  pendingResources.push(() => world.dispose());
  const lighting = createIljuInteriorLighting({narrow: innerWidth < 760}); scene.add(lighting.group);
  pendingResources.push(() => lighting.dispose());
  const avatar = createAvatar(); avatar.group.position.set(world.spawn.x, 0, world.spawn.z); avatar.group.rotation.y = Math.PI; scene.add(avatar.group);
  pendingResources.push(() => avatar.dispose());
  const orbit = new OrbitControls(camera, renderer.domElement); orbit.enableDamping = true; orbit.enablePan = false; orbit.dampingFactor = .07; orbit.minDistance = 5; orbit.maxDistance = 44; orbit.rotateSpeed = .4;
  pendingResources.push(() => orbit.dispose());
  const visitors = createVisitors({scene, world, camera, host: $('.interior-visitor-names'), onSelect: id => document.dispatchEvent(new CustomEvent('sowon:social-open', {detail: {visitorId: id}}))});
  pendingResources.push(() => visitors.dispose());
  const movement = createLocomotion({camera, domElement: renderer.domElement, avatar, world, orbitControls: orbit,
    follow: false,
    controls: {stick: $('.interior-stick'), thumb: $('.interior-stick-thumb'), directionButtons: []},
    onMove: () => { if (activeSeat) { stand(); message('마음이 가는 자리로 천천히 걸어보세요.'); } },
    onPick: raycaster => {
      const peer = raycaster.intersectObject(visitors.group, true)[0];
      if (peer) { let node = peer.object; while (node && !node.userData.visitorId) node = node.parent; if (node) { document.dispatchEvent(new CustomEvent('sowon:social-open', {detail: {visitorId: node.userData.visitorId}})); return true; } }
      const hit = raycaster.intersectObjects(world.seats.map(seat => seat.group), true)[0];
      if (!hit) return false; let node = hit.object; while (node && !node.userData.seatId) node = node.parent;
      if (node) { chooseSeat(node.userData.seatId); return true; } return false;
    }});
  engine = {renderer, scene, camera, world, lighting, avatar, orbit, movement, visitors};
  const list = $('.interior-seat-list'); list.replaceChildren();
  world.seats.forEach(seat => { const button = document.createElement('button'); button.type = 'button'; button.dataset.interiorSeat = seat.id; button.textContent = seat.label; button.setAttribute('aria-pressed', 'false'); list.appendChild(button); });
  renderer.domElement.addEventListener('webglcontextlost', event => { event.preventDefault(); showFallback(); });
  applyAppearance(); resize();
  } catch (error) {
    if (engine) destroyEngine();
    else pendingResources.reverse().forEach(dispose => { try { dispose(); } catch (_) {} });
    throw error;
  }
}
function destroyEngine() {
  if (!engine) return;
  const current = engine; engine = null;
  current.movement.dispose(); current.visitors.dispose(); current.orbit.dispose(); current.avatar.dispose(); current.world.dispose(); current.lighting.dispose();
  current.renderer.dispose(); current.renderer.domElement.remove(); transition = null;
}
function showFallback() {
  cancelAnimationFrame(frame); frame = 0; destroyEngine();
  $('.interior-fallback').hidden = false; $('.interior-loading').hidden = true;
  layer.dataset.renderMode = 'fallback';
  const img = $('.interior-fallback img'); img.src = active.mural.src; img.alt = active.mural.alt;
  message('벽화와 함께 조용히 머물러 보세요.');
}
function loadMural(data) {
  const version = ++muralVersion;
  $('.interior-loading').hidden = false;
  new THREE.TextureLoader().load(data.mural.src, texture => {
    if (disposed || version !== muralVersion || !active || active.room.key !== data.room.key || !engine) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = Math.min(4, engine.renderer.capabilities.getMaxAnisotropy());
    const old = muralTexture; muralTexture = texture;
    engine.world.setRoom(data.room, texture); old?.dispose();
    $('.interior-loading').hidden = true; layer.dataset.muralReady = 'true';
  }, undefined, () => {
    if (version !== muralVersion || !active) return;
    $('.interior-loading').hidden = true; layer.dataset.muralReady = 'false';
    message('벽화를 불러오지 못했어요. 방을 다시 열면 그림을 새로 준비해요.');
  });
}
function render(time) {
  frame = 0; if (!active || !engine || document.hidden || disposed) return;
  const dt = previous ? Math.min(.05, (time - previous) / 1000) : 0; previous = time;
  const modal = dialogOpen(); engine.movement.setEnabled(!modal && !pendingExit);
  if (!modal) {
    engine.movement.update(dt);
    applyInteriorSeat(engine.avatar, activeSeat);
    if (transition) {
      transition.time += dt; const t = Math.min(1, transition.time / .8), eased = t * t * (3 - 2 * t);
      engine.camera.position.lerpVectors(transition.from, new THREE.Vector3(...transition.pose.position), eased);
      engine.orbit.target.lerpVectors(transition.target, new THREE.Vector3(...transition.pose.target), eased);
      if (t === 1) transition = null;
    }
    engine.orbit.update(); engine.world.update(time / 1000, dt);
    engine.lighting.update(matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : time / 1000);
    engine.visitors.update(dt, {exploring: true, modalOpen: false, position: engine.avatar.group.position});
    const point = engine.avatar.group.position.clone().add(new THREE.Vector3(0, activeSeat ? 1.35 : 1.8, 0)).project(engine.camera);
    const name = $('.interior-name'); name.hidden = point.z > 1 || Math.abs(point.x) > .9 || Math.abs(point.y) > .8;
    if (!name.hidden) { name.style.left = `${(point.x + 1) * 50}%`; name.style.top = `${(1 - point.y) * 50}%`; }
    engine.renderer.render(engine.scene, engine.camera);
    layer.dataset.position = `${engine.avatar.group.position.x.toFixed(2)},${engine.avatar.group.position.z.toFixed(2)}`;
    layer.dataset.moving = String(engine.movement.getState().moving); layer.dataset.seated = String(engine.avatar.getSeated?.() === true); layer.dataset.drawCalls = String(engine.renderer.info.render.calls);
  } else { engine.visitors.hideLabels(); $('.interior-name').hidden = true; }
  frame = requestAnimationFrame(render);
}
function start() { if (active && engine && !frame && !document.hidden) { previous = 0; frame = requestAnimationFrame(render); } }
export async function openIljuInterior(key) {
  if (disposed) return false;
  if (key === 'courtyard') return leaveRoom();
  const data = interiorForRoom(key); if (!data) return false;
  const social = getSocialRoomState();
  if (social.joined && social.roomKey !== key) {
    const accepted = await enterSocialRoom(key);
    const latest = getSocialRoomState();
    if (disposed || !accepted || !latest.joined || latest.roomKey !== key) return false;
  }
  if (active?.room.key === key) { updatePresence(); if (!dialogOpen()) $('#interiorTitle').focus({preventScroll:true}); return true; }
  const first = !active; ++roomVersion;
  if (first) { opener = document.activeElement; outsideTitle = document.title; oldInert = Boolean(sanctuary?.inert); if (sanctuary) sanctuary.inert = true; }
  active = data; activeSeat = null; pendingExit = false; muralView = false;
  layer.hidden = false; layer.dataset.room = key; layer.dataset.muralReady = 'false'; layer.dataset.seated = 'false';
  layer.dataset.renderMode = 'loading'; document.title = `${data.room.label} — 삼라 소원당`;
  layer.style.setProperty('--room-accent', data.accent); document.body.classList.add('ilju-interior-open');
  $('#interiorTitle').textContent = data.room.label; $('[data-interior-ganzi]').textContent = `${data.room.ilju} · ${data.room.ganzi}`;
  $('[data-interior-mural-title]').textContent = data.mural.title;
  $('[data-interior-stand]').hidden = true; toggleSeats(false);
  $('.interior-fallback').hidden = true; $('.interior-loading').hidden = false;
  document.dispatchEvent(new CustomEvent('sowon:interior-state', {detail: {open: true, roomKey: key, preview: !connectedHere()}}));
  try {
    if (!engine) createEngine();
    else { engine.movement.cancel(); engine.avatar.setSeated?.(false); engine.avatar.group.position.set(engine.world.spawn.x, 0, engine.world.spawn.z); engine.avatar.group.rotation.y = Math.PI; }
    engine.world.setRoom(data.room, null); layer.dataset.renderMode = '3d'; setView('overview', true); resize(); loadMural(data); applyAppearance(); updatePresence(); start();
  } catch (error) { console.warn('일주방 입체 공간을 준비하지 못했습니다.', error); showFallback(); }
  if (engine) message('마음에 드는 자리를 골라 잠시 쉬어가세요.'); $('#interiorTitle').focus({preventScroll: true});
  return true;
}
export async function leaveRoom() {
  if (!active || pendingExit || dialogOpen()) return false;
  const social = getSocialRoomState(); pendingExit = true; updatePresence();
  if (social.joined && social.roomKey !== 'courtyard') {
    const accepted = await enterSocialRoom('courtyard');
    if (!accepted || getSocialRoomState().roomKey !== 'courtyard') { pendingExit = false; updatePresence(); message('마당으로 연결하지 못했어요. 잠시 후 다시 눌러주세요.'); return false; }
  }
  closeRoom(); return true;
}
function closeRoom() {
  if (!active) return;
  ++roomVersion; ++muralVersion; cancelAnimationFrame(frame); frame = 0;
  engine?.movement.cancel(); active = null; activeSeat = null; pendingExit = false; presence = null;
  destroyEngine(); muralTexture?.dispose(); muralTexture = null;
  layer.hidden = true; document.body.classList.remove('ilju-interior-open'); if (sanctuary) sanctuary.inert = oldInert;
  document.title = outsideTitle;
  document.dispatchEvent(new CustomEvent('sowon:interior-state', {detail: {open: false, roomKey: 'courtyard'}}));
  if (opener?.isConnected && !opener.closest('dialog')) opener.focus({preventScroll: true});
}
listen(layer, 'click', async event => {
  const button = event.target.closest('button'); if (!button) return;
  if (button.hasAttribute('data-interior-back')) await leaveRoom();
  else if (button.hasAttribute('data-interior-social')) {
    if (connectedHere()) document.dispatchEvent(new CustomEvent('sowon:social-open'));
    else if (active) { const version = roomVersion, key = active.room.key; await enterSocialRoom(key); if (version === roomVersion && active?.room.key === key) updatePresence(); }
  } else if (button.hasAttribute('data-interior-seat')) chooseSeat(button.dataset.interiorSeat);
  else if (button.hasAttribute('data-interior-seats')) toggleSeats($('#interiorSeats').hidden);
  else if (button.hasAttribute('data-interior-seats-close')) toggleSeats(false);
  else if (button.hasAttribute('data-interior-mural')) { toggleSeats(false); setView(muralView ? 'overview' : 'mural'); }
  else if (button.hasAttribute('data-interior-overview')) setView('overview');
  else if (button.hasAttribute('data-interior-stand')) { stand(); message('일어났어요. 다른 자리로 걸어가도 좋아요.'); }
  else if (button.hasAttribute('data-interior-retry') && active) { const key = active.room.key; closeRoom(); await openIljuInterior(key); }
});
listen(document, 'sowon:ilju-interior-open', event => openIljuInterior(event.detail?.roomKey));
listen(document, 'sowon:room-change', event => {
  const key = event.detail?.roomKey;
  if (key === 'courtyard') { if (active) closeRoom(); }
  else if (getSocialRoomState().joined) openIljuInterior(key);
});
listen(document, 'sowon:social-presence', event => { presence = event.detail; updatePresence(); });
listen(document, 'sowon:social-state', updatePresence);
listen(document, 'sowon:profile-change', applyAppearance); listen(document, 'sowon:identity-change', applyAppearance); listen(document, 'sowon:preferences', applyAppearance);
listen(document, 'sowon:capture-social', event => { if (active && connectedHere() && engine) event.detail.snapshot = {x: engine.avatar.group.position.x, z: engine.avatar.group.position.z, heading: engine.avatar.group.rotation.y, outfit: engine.avatar.getAppearance()}; });
listen(document, 'sowon:social-walk', event => {
  if (!active || !engine || dialogOpen()) return;
  const point = engine.visitors.getPoint(event.detail?.visitorId); if (!point) return;
  stand(); setView('overview'); engine.movement.setEnabled(true);
  const dz = engine.avatar.group.position.z >= point.z ? 1.5 : -1.5;
  engine.movement.goTo({x: point.x, z: point.z + dz});
});
listen(window, 'keydown', event => {
  if (!active || dialogOpen() || event.key !== 'Escape') return;
  if (!$('#interiorSeats').hidden) { toggleSeats(false); $('[data-interior-seats]').focus(); }
  else if (muralView) setView('overview');
  else return;
  event.preventDefault();
});
listen(window, 'resize', resize);
listen(document, 'visibilitychange', () => { if (document.hidden) { cancelAnimationFrame(frame); frame = 0; engine?.movement.setEnabled(false); } else start(); });
listen(window, 'pagehide', event => { cancelAnimationFrame(frame); frame = 0; if (event.persisted) return; closeRoom(); disposed = true; cleanup.splice(0).forEach(fn => fn()); layer.remove(); });
listen(window, 'pageshow', start);
const initial = getSocialRoomState(); if (initial.joined && initial.roomKey !== 'courtyard') openIljuInterior(initial.roomKey);
