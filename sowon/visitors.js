import * as THREE from 'three';
import { getAvatarPalette } from './avatar-palettes.js?v=20261101-sanctuary2';
import { safeIlju } from './ilju-room-core.js?v=20261101-sanctuary2';

// Only the public presence projection is accepted here; birth data never enters a model or label.
export function publicVisitor(raw) {
  if (!raw || typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(raw.id)) return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.z) || Math.abs(raw.x)>23 || raw.z < -25 || raw.z >22) return null;
  const nickname=typeof raw.nickname==='string'?raw.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20):'';
  return {id:raw.id,nickname:nickname||'이웃 나그네',x:raw.x,z:raw.z,heading:Number.isFinite(raw.heading)?raw.heading%(Math.PI*2):0,outfit:getAvatarPalette(raw.outfit)?.id||'sage',...(safeIlju(raw.ilju)?{ilju:safeIlju(raw.ilju)}:{})};
}

export function createVisitors({scene,world,camera,host,onSelect}) {
  const group=new THREE.Group(); group.name='Present travellers';scene.add(group);
  const peers=new Map();
  const projected=new THREE.Vector3();
  const geometry={head:new THREE.SphereGeometry(.27,12,8),body:new THREE.CylinderGeometry(.2,.24,.46,10),limb:new THREE.CapsuleGeometry(.083,.22,3,6),hair:new THREE.SphereGeometry(.28,12,8,0,Math.PI*2,0,Math.PI*.6),eye:new THREE.SphereGeometry(.02,6,4),shadow:new THREE.CircleGeometry(.34,16)};
  let disposed=false;
  function make(data) {
    const model=new THREE.Group();model.userData.visitorId=data.id;
    const palette=getAvatarPalette(data.outfit);
    const materials={skin:new THREE.MeshStandardMaterial({color:'#f2d8bb',roughness:.9}),cloth:new THREE.MeshStandardMaterial({color:palette.colors.cream,roughness:.9}),pants:new THREE.MeshStandardMaterial({color:palette.colors.sage,roughness:.9}),hair:new THREE.MeshStandardMaterial({color:'#302c32',roughness:.9}),eye:new THREE.MeshBasicMaterial({color:'#302c32'}),shadow:new THREE.MeshBasicMaterial({color:'#101a20',transparent:true,opacity:.17,depthWrite:false})};
    function mesh(key,mat,x,y,z){const item=new THREE.Mesh(geometry[key],materials[mat]);item.position.set(x,y,z);model.add(item);return item;}
    mesh('body','cloth',0,.76,0);
    mesh('head','skin',0,1.22,.02);
    mesh('hair','hair',0,1.25,-.01);
    for(const side of [-1,1]){mesh('eye','eye',side*.085,1.22,.275);mesh('limb','cloth',side*.27,.74,0);mesh('limb','pants',side*.115,.31,0);}
    const shadow=mesh('shadow','shadow',0,.02,0);shadow.rotation.x=-Math.PI/2;
    model.position.set(data.x,world.heightAt(data.x,data.z),data.z);model.rotation.y=data.heading;group.add(model);
    const label=host.ownerDocument.createElement('button');label.className='visitor-name';label.type='button';label.hidden=true;label.dataset.visitorId=data.id;
    const select=()=>onSelect?.(data.id);label.addEventListener('click',select);host.append(label);
    return {model,label,materials,data,select};
  }
  function remove(peer){peer.label.removeEventListener('click',peer.select);peer.label.remove();peer.model.removeFromParent();Object.values(peer.materials).forEach(material=>material.dispose());}
  function sync(visitors,selfId){
    if(disposed)return;
    const safe=(Array.isArray(visitors)?visitors:[]).map(publicVisitor).filter(value=>value&&value.id!==selfId).slice(0,24);
    const ids=new Set(safe.map(value=>value.id));
    for(const[id,peer]of peers)if(!ids.has(id)){remove(peer);peers.delete(id);}
    for(const data of safe){let peer=peers.get(data.id);if(!peer){peer=make(data);peers.set(data.id,peer);}peer.data=data;peer.label.textContent=data.ilju?data.ilju+' 일주\n'+data.nickname:data.nickname+' · 궁합';peer.label.setAttribute('aria-label',data.nickname+(data.ilju?' · '+data.ilju+' 일주':'')+'님에게 궁합 요청하기');const palette=getAvatarPalette(data.outfit);peer.materials.cloth.color.set(palette.colors.cream);peer.materials.pants.color.set(palette.colors.sage);}
  }
  function update(delta,{exploring,modalOpen,position}){
    if(disposed)return;
    for(const peer of peers.values()){
      const {model,data,label}=peer;const blend=1-Math.exp(-Math.min(delta,.1)*4);
      model.position.x=THREE.MathUtils.lerp(model.position.x,data.x,blend);model.position.z=THREE.MathUtils.lerp(model.position.z,data.z,blend);model.position.y=world.heightAt(model.position.x,model.position.z);
      const diff=Math.atan2(Math.sin(data.heading-model.rotation.y),Math.cos(data.heading-model.rotation.y));model.rotation.y+=diff*blend;
      model.visible=Boolean(exploring);
      projected.copy(model.position);projected.y+=1.85;projected.project(camera);
      label.hidden=!exploring||modalOpen||projected.z>1||Math.abs(projected.x)>.9||Math.abs(projected.y)>.78||Math.hypot(model.position.x-position.x,model.position.z-position.z)>18;
      if(!label.hidden){label.style.left=((projected.x+1)/2*100)+'%';label.style.top=((1-projected.y)/2*100)+'%';}
    }
  }
  return {group,sync,update,getPoint(id){const peer=peers.get(id);return peer?{x:peer.data.x,z:peer.data.z}:null;},hideLabels(){peers.forEach(peer=>{peer.label.hidden=true;});},dispose(){if(disposed)return;disposed=true;peers.forEach(remove);peers.clear();Object.values(geometry).forEach(item=>item.dispose());group.removeFromParent();}};
}
