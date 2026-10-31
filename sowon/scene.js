import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { createWorld } from './world.js?v=20261031-life1';
import { createAvatar } from './avatar.js?v=20261031-social1';
import { getOwnProfile } from './profile.js?v=20261101-editorial1';
import { createLocomotion, isWalkable } from './locomotion.js?v=20261031-life1';
import { readJourney } from './hub-core.js';
import { readSettings, normalizeSettings, effectiveQuality, nearestInteraction, pickedInteraction, interactionDistance } from './experience-core.js';
import { createWayfinder } from './wayfinder.js?v=20261031-life1';
import { HALLS, getFeature } from './hub-core.js';
import { createVisitors } from './visitors.js?v=20261031-social1';
import { createConversationFocus } from './conversation-focus.js?v=20261101-conversation2';

const host = document.getElementById('worldViewport');
const body = document.body;
const loading = document.getElementById('worldLoading');
const travelStatus = document.getElementById('travelStatus');
let renderer, world, avatar, movement, orbit, resizeObserver;
let frame = 0, previousTime = 0, running = false, exploring = false;
let travelTimer, activeJourney = null;
let cameraTransition = null;
let nearest = null, overview = false, lastHudTime = 0;
let preferences;
try { preferences = readSettings(localStorage); } catch (_) { preferences = normalizeSettings(); }
const cleanups = [];
const npcName = item => ({tojeong:'토정',seol:'설월',luna:'루나'}[item.readerId] || item.label);
function setOverviewState(value) {
  overview=Boolean(value);
  const button=document.getElementById('overviewWorld');
  button?.setAttribute('aria-pressed',String(overview));
  button?.setAttribute('aria-label',overview?'나그네 가까이 보기':'신당 전체 보기');
  host.dataset.camera=overview?'overview':'walk';
}

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
  setOverviewState(false);
  body.classList.add('is-exploring');
  movement?.setEnabled(true);
  cameraTransition = { elapsed: 0, camera: camera.position.clone(), target: orbit.target.clone() };
  status('달빛 나그네가 되어, 마음이 가는 곳으로 걸어보세요.', 4200);
}

function fail() {
  body.classList.add('world-failed');
  body.classList.remove('world-ready', 'is-exploring');
  movement?.setEnabled(false);
  activeJourney=null;status('',0);
  document.querySelectorAll('[data-world-place],.npc-name,#nearbyCard,#placeCaption').forEach(element=>{element.hidden=true;});
  if (loading) loading.hidden = true;
  document.getElementById('enterWorld').disabled = false;
  document.getElementById('enterWorld').setAttribute('aria-busy', 'false');
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
  scene.fog = new THREE.FogExp2('#172b40', .011);
  camera = new THREE.PerspectiveCamera(48, 1, .1, 150);
  camera.position.set(28, 25, 45);

  const sky = new THREE.HemisphereLight('#c3d6ee', '#73715d', 1.05);
  const ambient = new THREE.AmbientLight('#b7c7dc', .22);
  scene.add(sky, ambient);
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
  orbit.maxDistance = 60;
  orbit.minPolarAngle = .22;
  orbit.maxPolarAngle = Math.PI * .465;
  orbit.rotateSpeed = .6;
  orbit.zoomSpeed = .8;
  orbit.update();

  const conversationFocus = createConversationFocus({ camera, orbit, world, avatar });
  let conversationNpc = null, conversationOverview = false;
  function releaseConversation() {
    const restored = conversationFocus.restore();
    conversationNpc = null;
    body.classList.remove('npc-scene-focused');
    if (restored) { setOverviewState(conversationOverview); renderer.render(scene,camera); }
  }
  function focusConversation(npc) {
    const firstFocus = !conversationFocus.isActive();
    const wasOverview = overview;
    const width = window.innerWidth, height = window.innerHeight;
    const pose = conversationFocus.focus(npc,{viewport:{width,height},panelWidth:width>=1000&&height>=600?600:0});
    if (!pose) { releaseConversation(); return; }
    if (firstFocus) conversationOverview = wasOverview;
    conversationNpc = npc;
    cameraTransition = null;
    setOverviewState(false);
    body.classList.add('npc-scene-focused');
    renderer.render(scene,camera);
  }
  listen(document,'sowon:conversation-focus',event=>{
    if (event.detail?.open && ['tojeong','seol','luna'].includes(event.detail.npc)) focusConversation(event.detail.npc);
    else releaseConversation();
  });

  movement = createLocomotion({
    camera, domElement: renderer.domElement, avatar, world, orbitControls: orbit,
    onMove: source => { enter(); if (activeJourney && source !== 'path') { activeJourney = null; status('마음이 가는 곳으로 천천히 걸어보세요.', 2500); } },
    onArrival: () => {},
    onPick: raycaster => {
      const hits=raycaster.intersectObjects([...world.group.children,...visitors.group.children],true);
      const first=hits.find(hit=>hit.object?.isMesh&&Number.isFinite(hit.distance));
      for(let node=first?.object;node;node=node.parent)if(node.userData.visitorId){selectVisitor(node.userData.visitorId);return true;}
      const item=pickedInteraction(hits,world.interactions||[]);
      if(!item)return false;
      approachInteraction(item);return true;
    },
  });

  const name = document.getElementById('travelerName');
  function selectVisitor(visitorId){
    activeJourney=null;movement.cancel();status('',0);
    document.dispatchEvent(new CustomEvent('sowon:social-open',{detail:{visitorId}}));
  }
  const visitors=createVisitors({scene,world,camera,host:document.getElementById('visitorNames'),onSelect:selectVisitor});
  function applyProfile(){
    const profile=getOwnProfile();
    avatar.setGender?.(profile?.solar.g||null);
    const badge=document.createElement('span');badge.textContent='나';
    name.replaceChildren(badge,document.createTextNode(profile?.nickname||'달빛 나그네'));
  }
  applyProfile();
  listen(document,'sowon:profile-change',applyProfile);
  listen(document,'sowon:social-presence',event=>visitors.sync(event.detail?.visitors,event.detail?.selfId));
  listen(document,'sowon:capture-social',event=>{
    event.detail.snapshot={x:avatar.group.position.x,z:avatar.group.position.z,heading:avatar.group.rotation.y,outfit:preferences.outfit};
  });
  listen(document,'sowon:social-walk',event=>{
    const id=event.detail?.visitorId,point=visitors.getPoint(id);
    if(!point){status('그 나그네가 지금은 자리를 옮겼어요. 함께 걷기에서 다시 확인해 주세요.',3500);return;}
    if(document.querySelector('dialog[open]'))return;
    enter();movement.setEnabled(true);activeJourney='visitor:'+id;setCameraMode('walk');
    const dx=avatar.group.position.x-point.x,dz=avatar.group.position.z-point.z,length=Math.hypot(dx,dz)||1;
    const approach={x:point.x+dx/length*1.8,z:point.z+dz/length*1.8};
    const target=isWalkable(approach,world)?approach:point;
    status('나그네에게 다가가고 있어요.',0);
    const accepted=movement.goTo(target,()=>{if(activeJourney==='visitor:'+id)selectVisitor(id);});
    if(!accepted){activeJourney=null;status('가까운 바닥을 눌러 나그네에게 다가가 주세요.',3000);}
  });
  const projected = new THREE.Vector3();
  const placeButtons = Array.from(document.querySelectorAll('[data-world-place]'));
  const placePosition = new THREE.Vector3();
  const cameraOffset = new THREE.Vector3(0, 4.6, 9.7);
  const targetOffset = new THREE.Vector3(0, 2, 0);
  const nameOffset = new THREE.Vector3(0, 1.7, 0);
  const tweenCamera = new THREE.Vector3();
  const tweenTarget = new THREE.Vector3();
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const nearCard=document.getElementById('nearbyCard');
  const caption=document.getElementById('placeCaption');
  const npcNames=document.getElementById('npcNames');
  const npcButtons=(world.interactions||[]).filter(item=>item.type==='npc').map(item=>{
    const button=document.createElement('button');button.type='button';button.className='npc-name';button.textContent=npcName(item)+' · 이야기';button.hidden=true;
    button.setAttribute('aria-label',npcName(item)+'에게 다가가 이야기 나누기');npcNames.append(button);
    listen(button,'click',()=>approachInteraction(item));return{button,item};
  });
  const hudPoint=new THREE.Vector3();
  const wayfinder=createWayfinder(document.getElementById('worldWayfinder'),{destinations:world.destinations,bounds:world.bounds,onTravel:walkToAction,onCancel:()=>{
    activeJourney=null;movement.cancel();status('잠깐 멈춰 섰어요. 마음이 가는 곳으로 다시 걸어보세요.',2600);
  }});
  let activeQuality=null, qualitySamples=[], autoReduced=false;
  function applyPreferences(value) {
    preferences=normalizeSettings(value);
    const atmosphere=world.setAtmosphere?.(preferences.mood)||world.atmosphere;
    const palette=atmosphere?.palette;
    if(palette){
      scene.background.set(palette.background);scene.fog.color.set(palette.fog);
      scene.fog.density=atmosphere.fogDensity;
      sky.color.set(palette.sky);sky.groundColor.set(palette.ground);ambient.color.set(palette.ambient);moonlight.color.set(palette.key);
      sky.intensity=atmosphere.hemisphereIntensity;ambient.intensity=atmosphere.ambientIntensity;moonlight.intensity=atmosphere.keyIntensity;
      renderer.toneMappingExposure=atmosphere.exposure;
      const point=atmosphere.keyPosition;moonlight.position.set(point.x,point.y,point.z);
    }
    avatar.setAppearance?.(preferences.outfit);
    const quality=preferences.quality==='auto'&&autoReduced?'smooth':effectiveQuality(preferences.quality,{coarse:matchMedia('(pointer: coarse)').matches,memory:navigator.deviceMemory||8});
    if(activeQuality!==quality){
      activeQuality=quality;renderer.setPixelRatio(Math.min(devicePixelRatio||1,quality==='smooth'?1:innerWidth<760?1.5:1.8));
      renderer.shadowMap.enabled=quality==='clear';world.setQuality?.(quality);
      world.group.traverse(node=>{if(node.material)(Array.isArray(node.material)?node.material:[node.material]).forEach(material=>{material.needsUpdate=true;});});
      resize();
    }
    body.dataset.mood=preferences.mood;host.dataset.quality=quality;host.dataset.outfit=preferences.outfit;
    if(document.querySelector('dialog[open]'))renderer.render(scene,camera);
  }
  function setCameraMode(mode) {
    setOverviewState(mode==='overview');
    cameraTransition={elapsed:0,camera:camera.position.clone(),target:orbit.target.clone(),overview};
  }
  function activateInteraction(item) {
    if(!item||document.querySelector('dialog[open]'))return;
    activeJourney=null;movement.cancel();status('',0);
    const point=item.anchor3d||{...item.point,y:1};
    avatar.group.rotation.y=Math.atan2(point.x-avatar.group.position.x,point.z-avatar.group.position.z);
    if(item.type==='npc'){
      avatar.setGesture('bow');avatar.update(.15,false);renderer.render(scene,camera);
      document.dispatchEvent(new CustomEvent('sowon:encounter',{detail:{npc:item.readerId||item.id.replace('npc-','')}}));
    }else if(getFeature(item.feature))document.dispatchEvent(new CustomEvent('sowon:feature',{detail:{id:item.feature}}));
    else if(['wish','breath','blessing'].includes(item.action))document.dispatchEvent(new CustomEvent('sowon:open',{detail:{action:item.action}}));
    else if(HALLS[item.hall])document.dispatchEvent(new CustomEvent('sowon:hall',{detail:{id:item.hall}}));
  }
  function approachInteraction(item) {
    if(document.querySelector('dialog[open]'))return;
    enter();movement.setEnabled(true);
    if(interactionDistance(item.point,avatar.group.position)<=item.radius){activateInteraction(item);return;}
    activeJourney=item.id;setCameraMode('walk');status(item.type==='npc'?npcName(item)+'에게 다가가고 있어요.':'선택한 물건을 살펴보러 가고 있어요.',0);
    const accepted=movement.goTo(item.point,()=>{if(activeJourney===item.id)activateInteraction(item);});
    if(!accepted){activeJourney=null;status('조금 더 가까운 바닥을 눌러 다가가 보세요.',3000);}
  }
  function updateHud(time,modalOpen){
    if(time-lastHudTime<120)return;lastHudTime=time;
    const state=movement.getState();
    const journeyHall=(world.interactions||[]).find(item=>item.id===activeJourney)?.hall||activeJourney;
    wayfinder.update({position:state.position,rotation:avatar.group.rotation.y,path:state.path,target:state.target,action:journeyHall,exploring:exploring&&!modalOpen});
    const item=!state.moving&&!activeJourney&&exploring&&!modalOpen?nearestInteraction(world.interactions||[],state.position,nearest?.id):null;
    if(item?.id!==nearest?.id){
      nearest=item;nearCard.hidden=!item;host.dataset.nearby=item?.id||'';
      if(item){
        nearCard.querySelector('strong').textContent=item.label;
        nearCard.querySelector('small').textContent=item.type==='npc'?'이곳의 길잡이':'이야기가 놓인 자리';
        nearCard.querySelector('.nearby-action').textContent=item.type==='npc'?'이야기 나누기':'살펴보기';
        const image=nearCard.querySelector('img');image.hidden=item.type!=='npc';if(item.type==='npc')image.src='/store/art/readers/'+(item.readerId||item.id.replace('npc-',''))+'.webp';
      }
    }
    nearCard.hidden=!item;
    let hall=null,closest=7;
    for(const[id,point]of Object.entries(world.destinations))if(HALLS[id]){const distance=interactionDistance(point,state.position);if(distance<closest){closest=distance;hall=id;}}
    caption.hidden=!hall||!exploring||modalOpen;
    if(hall){caption.querySelector('strong').textContent=HALLS[hall].name;caption.querySelector('p').textContent=HALLS[hall].line;}
    host.dataset.hall=hall||'';
    npcButtons.forEach(({button,item})=>{
      const anchor=item.anchor3d||{...item.point,y:2};hudPoint.set(anchor.x,anchor.y+.45,anchor.z).project(camera);
      const inFrame=hudPoint.z<1&&Math.abs(hudPoint.x)<.9&&Math.abs(hudPoint.y)<.65;
      button.hidden=!exploring||modalOpen||!inFrame||interactionDistance(item.point,state.position)>9;
      if(!button.hidden){button.style.left=((hudPoint.x+1)/2*100)+'%';button.style.top=((1-hudPoint.y)/2*100)+'%';}
    });
  }
  function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < 760 ? 60 : exploring ? 54 : 48;
    camera.updateProjectionMatrix();
    if (conversationNpc) focusConversation(conversationNpc);
  }
  resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  applyPreferences(preferences);
  listen(document,'sowon:preferences',event=>{if(normalizeSettings(event.detail).quality!==preferences.quality){autoReduced=false;qualitySamples=[];}applyPreferences(event.detail);});
  listen(document,'sowon:preferences-request',()=>applyPreferences(preferences));
  listen(document,'sowon:wayfinder',event=>body.classList.toggle('wayfinder-expanded',Boolean(event.detail?.expanded)));
  listen(nearCard,'click',()=>activateInteraction(nearest));
  listen(document.getElementById('overviewWorld'),'click',()=>setCameraMode(overview?'walk':'overview'));
  listen(window,'keydown',event=>{
    if(event.repeat||event.ctrlKey||event.altKey||event.metaKey||document.querySelector('dialog[open]')||document.activeElement?.matches('input,textarea,select,[contenteditable=true]'))return;
    if(event.code==='KeyE'&&nearest){event.preventDefault();activateInteraction(nearest);}
    else if(event.code==='KeyV'&&exploring){event.preventDefault();setCameraMode(overview?'walk':'overview');}
  });

  let saved;
  try { saved = readJourney(sessionStorage); } catch (_) {}
  if (saved && isWalkable({ x: saved.position[0], z: saved.position[2] }, world)) {
    avatar.group.position.set(saved.position[0], world.heightAt(saved.position[0], saved.position[2]), saved.position[2]);
    avatar.group.rotation.y = saved.rotation;
    if (saved.entered) enter();
    cameraTransition = null;
    camera.position.fromArray(saved.camera);
    orbit.target.fromArray(saved.target);
    orbit.update(); resize();
    setOverviewState(camera.position.distanceTo(orbit.target)>25);
  }
  listen(document, 'sowon:capture', event => {
    const beforeConversation = conversationFocus.getRestoreState();
    event.detail.snapshot = { position: avatar.group.position.toArray(), rotation: avatar.group.rotation.y, camera: beforeConversation?.position || camera.position.toArray(), target: beforeConversation?.target || orbit.target.toArray(), entered: exploring };
  });

  function render(time) {
    if (!running) return;
    const delta = previousTime ? Math.min((time - previousTime) / 1000, .05) : 0;
    previousTime = time;
    const modalOpen = Boolean(document.querySelector('dialog[open]'));
    body.classList.toggle('world-modal-open', modalOpen);
    if (modalOpen && activeJourney) { activeJourney = null; status('', 0); }
    movement.setEnabled(!modalOpen);
    if (modalOpen) {
      name.hidden = true;
      visitors.hideLabels();
      nearCard.hidden=true;caption.hidden=true;npcButtons.forEach(({button})=>{button.hidden=true;});
      placeButtons.forEach(button => { button.hidden = true; });
      // Keep checking modal visibility without drawing the 3D world while reading.
      previousTime = 0;
      frame = requestAnimationFrame(render);
      return;
    }
    movement.update(delta);
    if(preferences.quality==='auto'&&!autoReduced&&delta>0){
      qualitySamples.push(delta);if(qualitySamples.length>=100){const average=qualitySamples.reduce((a,b)=>a+b,0)/qualitySamples.length;qualitySamples=[];if(average>.028){autoReduced=true;applyPreferences(preferences);}}
    }
    if (cameraTransition) {
      cameraTransition.elapsed += delta;
      const progress = reducedMotion.matches ? 1 : Math.min(1, cameraTransition.elapsed / 1.05);
      const ease = progress * progress * (3 - 2 * progress);
      if(cameraTransition.overview){tweenCamera.set(28,25,45);tweenTarget.set(0,2,-2);}
      else{tweenCamera.copy(avatar.group.position).add(cameraOffset);tweenTarget.copy(avatar.group.position).add(targetOffset);}
      camera.position.lerpVectors(cameraTransition.camera, tweenCamera, ease);
      orbit.target.lerpVectors(cameraTransition.target, tweenTarget, ease);
      if (progress >= 1) cameraTransition = null;
    }
    world.update(reducedMotion.matches ? 0 : time / 1000, delta);
    orbit.update();
    updateHud(time,modalOpen);
    visitors.update(delta,{exploring,modalOpen,position:avatar.group.position});
    projected.copy(avatar.group.position).add(nameOffset).project(camera);
    const visible = projected.z < 1 && Math.abs(projected.x) < .95 && Math.abs(projected.y) < .95;
    name.hidden = !visible || modalOpen;
    if (visible) { name.style.left = ((projected.x + 1) / 2 * 100) + '%'; name.style.top = ((1 - projected.y) / 2 * 100) + '%'; }
    placeButtons.forEach(button => {
      const point = world.destinations[button.dataset.worldPlace];
      if (!point) { button.hidden = true; return; }
      placePosition.set(point.x, world.heightAt(point.x, point.z) + 1.65, point.z).project(camera);
      const inFrame = placePosition.z < 1 && Math.abs(placePosition.x) < .88 && placePosition.y < .5 && placePosition.y > -.54;
      const nearbyNpc=npcButtons.some(({item})=>item.hall===button.dataset.worldPlace&&interactionDistance(item.point,avatar.group.position)<6);
      button.hidden = !exploring || !inFrame || modalOpen || nearbyNpc;
      button.classList.toggle('is-nearby',interactionDistance(point,avatar.group.position)<5);
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
    if(body.classList.contains('world-failed'))return;
    event.preventDefault(); event.stopPropagation(); enter();
    renderer.domElement.focus({ preventScroll: true });
  });
  listen(renderer.domElement, 'pointerdown', () => { cameraTransition = null; });

  const actionLabels = { wish: '소원 등불이 있는 신당', breath: '바람이 머무는 명상터', blessing: '마음을 전하는 소원나무', myeongri: '토정이 기다리는 명리전', inyeon: '설월이 기다리는 인연정', stars: '태어난 하늘을 펼치는 별마루', readers: '루나와 술사들이 있는 술사각', archive: '이야기가 쌓이는 서고' };
  function walkToAction(action) {
    if (body.classList.contains('world-failed') || !world.destinations[action] || document.querySelector('dialog[open]')) return;
    const personalHost=(world.interactions||[]).find(item=>item.type==='npc'&&item.hall===action);
    if(personalHost){approachInteraction(personalHost);return;}
    enter();
    // A map can close and request travel before the next animation frame has
    // resumed movement. Re-enable here instead of treating that pause as no path.
    movement.setEnabled(true);
    activeJourney = action;
    status(`${actionLabels[action]}에 가고 있어요 · 바닥을 누르면 자유롭게 이동해요.`);
    const result = movement.goTo(world.destinations[action], () => {
      if (activeJourney !== action) return;
      activeJourney = null;
      status('', 0);
      if (action === 'wish') avatar.setGesture('wish');
      document.dispatchEvent(new CustomEvent('sowon:open', { detail: { action } }));
    });
    if (result === false) { activeJourney = null; status('이곳에서 이야기를 펼칠게요.', 2500); document.dispatchEvent(new CustomEvent('sowon:open', { detail: { action } })); }
  }
  listen(document.querySelector('.hub-world-rituals'), 'click', event => {
    if(body.classList.contains('world-failed'))return;
    const button = event.target.closest('button');
    if (!button || button.hasAttribute('data-open-journal')) return;
    const action = button.hasAttribute('data-open-wish') ? 'wish' : button.hasAttribute('data-open-breath') ? 'breath' : 'blessing';
    event.preventDefault(); event.stopPropagation(); walkToAction(action);
  });
  listen(document, 'sowon:walk', event => walkToAction(event.detail?.action));
  placeButtons.forEach(button => listen(button, 'click', () => walkToAction(button.dataset.worldPlace)));
  listen(document.getElementById('greetTraveler'), 'click', () => {
    avatar.setGesture('greet');
    status('반가워요. 이곳에서 잠깐 쉬어가요.', 2500);
  });

  listen(document.getElementById('returnToGate'), 'click', () => {
    activeJourney = null;
    cameraTransition = null;
    setOverviewState(false);
    movement.reset();
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
  function resume() {
    if (running || document.hidden || body.classList.contains('world-failed')) return;
    running = true; previousTime = 0; frame = requestAnimationFrame(render);
  }
  listen(document, 'visibilitychange', () => {
    if (document.hidden) { activeJourney = null; status('', 0); running = false; cancelAnimationFrame(frame); previousTime = 0; }
    else resume();
  });
  listen(window, 'pagehide', event => {
    running = false;
    cancelAnimationFrame(frame);
    if (event.persisted) return;
    cleanups.forEach(cleanup => cleanup());
    resizeObserver.disconnect();
    conversationFocus.dispose();visitors.dispose();wayfinder.dispose();npcButtons.forEach(({button})=>button.remove());movement.dispose(); orbit.dispose(); avatar.dispose(); world.dispose(); renderer.dispose();
  });
  listen(window, 'pageshow', event => {
    if (event.persisted) resume();
  });

  loading.hidden = true;
  body.classList.add('world-ready');
  document.getElementById('enterWorld').disabled = false;
  document.getElementById('enterWorld').setAttribute('aria-busy', 'false');
  document.getElementById('enterWorldLabel').textContent = '신당에 들어가기';
  running = true;
  frame = requestAnimationFrame(render);
}

try { setup(); } catch (error) { console.warn('소원당 3D 공간을 시작하지 못했습니다.', error); fail(); }
