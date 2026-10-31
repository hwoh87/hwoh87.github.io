import * as THREE from 'three';
import { isWalkable } from './locomotion.js';

const finite3 = value => value && ['x','y','z'].every(key => Number.isFinite(value[key]));
const finite2 = value => value && ['x','z'].every(key => Number.isFinite(value[key]));
const validBounds = value => value && ['minX','maxX','minZ','maxZ'].every(key => Number.isFinite(value[key])) && value.minX < value.maxX && value.minZ < value.maxZ;
const UP = new THREE.Vector3(0,1,0);
const ANGLES = [0,.45,-.45,.75,-.75,1.02,-1.02];
const CLEARANCE = .24;
const visibleMaterial = material => material && material.visible !== false && (!material.transparent || material.opacity >= .35);
function visibleMesh(node) {
  if (!node.isMesh || node.userData?.pickProxy || !(Array.isArray(node.material) ? node.material : [node.material]).some(visibleMaterial)) return false;
  for (let parent = node; parent; parent = parent.parent) if (parent.visible === false) return false;
  return true;
}
function inGroup(node, group) { for (let current=node; current; current=current.parent) if (current===group) return true; return false; }

/**
 * A CPU-only camera planner for the actual shrine meshes. No renderer, DOM, timers or world edits.
 * plan(id,{viewport:{width,height},panelWidth}) returns a checked pose without applying it.
 * focus(id,options) applies that pose and remembers the first camera/target/control state.
 * restore() returns to that state; the caller owns its overview flag and animation/render loop.
 */
export function createConversationFocus({ camera, orbit, world, avatar } = {}) {
  if (!camera?.isPerspectiveCamera || !finite3(camera.position) || !finite3(orbit?.target) || !world?.group?.traverse || !validBounds(world.bounds)) throw new TypeError('대화 시점을 준비할 카메라와 공간이 필요해요.');
  const raycaster = new THREE.Raycaster();
  // Double-sided query proxies also detect an exit when a proposed camera starts
  // inside a closed solid. The live materials/geometry are never changed.
  const queryMaterial = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
  const poseData = new WeakMap();
  let proxies = [], snapshot = null, disposed = false;

  function clearProxies() {
    proxies.forEach(proxy => { if (proxy.isInstancedMesh) proxy.dispose(); });
    proxies = [];
  }
  function updateGeometry() {
    clearProxies();
    world.group.updateWorldMatrix(true,true);
    avatar?.group?.updateWorldMatrix(true,true);
    const collect = node => {
      if (!visibleMesh(node)) return;
      let proxy;
      if (node.isInstancedMesh) {
        proxy = new THREE.InstancedMesh(node.geometry,queryMaterial,node.count);
        proxy.instanceMatrix = node.instanceMatrix;
      } else proxy = new THREE.Mesh(node.geometry,queryMaterial);
      proxy.matrixAutoUpdate = false; proxy.matrixWorldAutoUpdate = false;
      proxy.matrixWorld.copy(node.matrixWorld);
      proxy.userData.source = node;
      proxies.push(proxy);
    };
    world.group.traverse(collect);
    if (avatar?.group && !inGroup(avatar.group,world.group)) avatar.group.traverse(collect);
  }
  function subjectFor(value) {
    const item = world.interactions?.find(item => item?.type==='npc' && (typeof value==='string' ? item.id===value || item.readerId===value : item===value));
    if (!item || !finite2(item.point) || item.anchor3d && !finite3(item.anchor3d)) return null;
    const id = item.readerId || item.id.replace(/^npc-/,'');
    const model = world.npcs?.find(npc => npc.id===id)?.group || item.group;
    if (!model?.isObject3D || !finite3(model.position)) return null;
    const origin = model.getWorldPosition(new THREE.Vector3());
    if (!finite3(origin)) return null;
    const direction = new THREE.Vector3(0,0,1).transformDirection(model.matrixWorld); direction.y=0;
    if (direction.lengthSq()<.5 || !finite3(direction)) return null;
    direction.normalize();
    const center = model.localToWorld(new THREE.Vector3(0,1.05,.10));
    const samples = [[0,1.3,.29],[0,1.04,.22],[-.13,1.3,.23],[.13,1.3,.23]].map(point => model.localToWorld(new THREE.Vector3(...point)));
    return { id, item, model, origin, direction, center, samples };
  }
  function targetsClear(position, subject) {
    const occluders = proxies.filter(proxy => !inGroup(proxy.userData.source,subject.model));
    for (const target of subject.samples) {
      const direction = new THREE.Vector3().subVectors(target,position), length = direction.length();
      if (!Number.isFinite(length) || length<1) return false;
      raycaster.set(position,direction.multiplyScalar(1/length)); raycaster.near=0; raycaster.far=length-.035;
      if (raycaster.intersectObjects(occluders,false).length) return false;
    }
    // The near plane must also have room beside/above/below it, not just along the face ray.
    for (const direction of [new THREE.Vector3(1,0,0),new THREE.Vector3(-1,0,0),UP,new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,1),new THREE.Vector3(0,0,-1)]) {
      raycaster.set(position,direction); raycaster.near=0; raycaster.far=CLEARANCE;
      if (raycaster.intersectObjects(occluders,false).length) return false;
    }
    return true;
  }
  function poseIsSafe(pose, subject) {
    if (!pose || !finite3(pose.position) || !finite3(pose.target) || !finite3(subject.center) ||
      !isWalkable(pose.position,world,CLEARANCE)) return false;
    const height = world.heightAt?.(pose.position.x,pose.position.z);
    if (!Number.isFinite(height) || pose.position.y<height+.9 || pose.position.y>height+3.2) return false;
    const distance = pose.position.distanceTo(pose.target);
    if (!Number.isFinite(distance) || distance<Math.max(1,orbit.minDistance||0) || distance>Math.min(12,orbit.maxDistance||60)) return false;
    const view = camera.clone(); view.position.copy(pose.position); view.lookAt(pose.target); view.updateMatrixWorld(true);
    const points = subject.samples.map(point=>point.clone().project(view));
    if (points.some(point=>!finite3(point)||point.z<=-1||point.z>=1||Math.abs(point.x)>.9||Math.abs(point.y)>.84)) return false;
    return targetsClear(pose.position,subject);
  }
  function framing(options) {
    const width=options.viewport?.width, height=options.viewport?.height, panelWidth=options.panelWidth??0;
    if (options.viewport && (!Number.isFinite(width)||!Number.isFinite(height)||width<1||height<1)) return null;
    if (!Number.isFinite(panelWidth)||panelWidth<0||panelWidth>(width||Infinity)*.72) return null;
    // The rendered canvas may be shorter than the window. Its actual camera
    // aspect controls projection; viewport width only locates the side panel.
    return { x:width ? -panelWidth/width : 0, y:0, aspect:camera.aspect };
  }
  function framedTarget(position, center, screen) {
    const view=camera.clone(); view.aspect=screen.aspect; view.updateProjectionMatrix(); view.position.copy(position);
    const target=center.clone(), right=new THREE.Vector3(), up=new THREE.Vector3();
    // Iterative off-axis aim: screen x=-panel/viewport places the NPC at the
    // middle of the unobscured left region without modifying the projection matrix.
    for(let i=0;i<5;i++) {
      view.lookAt(target); view.updateMatrixWorld(true);
      const point=center.clone().project(view), depth=center.clone().applyMatrix4(view.matrixWorldInverse).z*-1;
      if (!Number.isFinite(depth)||depth<=0) return null;
      const extent=Math.tan(THREE.MathUtils.degToRad(view.fov/2))*depth/view.zoom;
      right.setFromMatrixColumn(view.matrixWorld,0); up.setFromMatrixColumn(view.matrixWorld,1);
      target.addScaledVector(right,(point.x-screen.x)*extent*screen.aspect).addScaledVector(up,(point.y-screen.y)*extent);
    }
    return finite3(target)?target:null;
  }
  function plan(npc,options={}) {
    if (disposed || !Number.isFinite(camera.fov)||camera.fov<=10||camera.fov>=100||!Number.isFinite(camera.aspect)||camera.aspect<=0) return null;
    const screen=framing(options); if(!screen||!Number.isFinite(screen.aspect)||screen.aspect<=0) return null;
    updateGeometry(); const subject=subjectFor(npc); if(!subject)return null;
    const radius=Math.max(5.2,Number.isFinite(orbit.minDistance)?orbit.minDistance+.2:5.2);
    if(radius>7.5)return null;
    let candidate=0;
    for(const distance of [radius,radius+.9])for(const elevation of [2.3,2.75])for(const angle of ANGLES) {
      candidate++;
      const direction=subject.direction.clone().applyAxisAngle(UP,angle);
      const position=subject.origin.clone().addScaledVector(direction,distance);
      const ground=world.heightAt?.(position.x,position.z);
      if(!Number.isFinite(ground))continue;
      position.y=ground+elevation;
      const target=framedTarget(position,subject.center,screen); if(!target)continue;
      const pose={npcId:subject.id,position,target,focus:subject.center.clone(),screen:{x:screen.x,y:screen.y},candidate,angle};
      if(!poseIsSafe(pose,subject))continue;
      poseData.set(pose,{id:subject.id,screen}); return pose;
    }
    return null;
  }
  function isSafe(pose) {
    const metadata=poseData.get(pose);if(disposed||!metadata)return false;
    updateGeometry();const subject=subjectFor(metadata.id);
    return Boolean(subject&&poseIsSafe(pose,subject));
  }
  function capture() {
    return {position:camera.position.clone(),quaternion:camera.quaternion.clone(),target:orbit.target.clone(),enabled:orbit.enabled,enableDamping:orbit.enableDamping};
  }
  function apply(pose) {
    if(!isSafe(pose))return null;
    snapshot ||= capture();
    orbit.enabled=false;orbit.enableDamping=false;
    orbit.update?.(); // Drain any old damping deltas before assigning the checked pose.
    camera.position.copy(pose.position);orbit.target.copy(pose.target);camera.lookAt(pose.target);camera.updateMatrixWorld(true);
    orbit.update?.();
    return pose;
  }
  function restore() {
    if(!snapshot)return false;
    const saved=snapshot;snapshot=null;
    orbit.enableDamping=false;orbit.update?.();
    camera.position.copy(saved.position);camera.quaternion.copy(saved.quaternion);orbit.target.copy(saved.target);camera.updateMatrixWorld(true);
    orbit.update?.();orbit.enableDamping=saved.enableDamping;orbit.enabled=saved.enabled;
    return true;
  }
  function dispose() { if(disposed)return;restore();disposed=true;clearProxies();queryMaterial.dispose(); }
  function getRestoreState() {
    return snapshot ? {position:snapshot.position.toArray(),target:snapshot.target.toArray(),quaternion:snapshot.quaternion.toArray(),enabled:snapshot.enabled,enableDamping:snapshot.enableDamping} : null;
  }
  return {plan,apply,focus:(npc,options)=>{const pose=plan(npc,options);return pose?apply(pose):null;},restore,getRestoreState,isSafe,isActive:()=>Boolean(snapshot),dispose};
}
