import * as THREE from 'three';
import { getAvatarPalette } from './avatar-palettes.js?v=20261103-benchmark2';
import { validAppearance, decodeAppearance, SKIN_COLORS, HAIR_COLORS } from './appearance-core.js?v=20261103-benchmark2';
import { safeIlju } from './ilju-room-core.js?v=20261103-benchmark2';

// Only the public presence projection is accepted here; birth data never enters a model or label.
export function publicVisitor(raw) {
  if (!raw || typeof raw.id !== 'string' || !/^[a-zA-Z0-9-]{8,80}$/.test(raw.id)) return null;
  if (!Number.isFinite(raw.x) || !Number.isFinite(raw.z) || Math.abs(raw.x)>23 || raw.z < -25 || raw.z >22) return null;
  const nickname=typeof raw.nickname==='string'?raw.nickname.replace(/[\u0000-\u001f\u007f]/g,'').trim().slice(0,20):'';
  return {id:raw.id,nickname:nickname||'이웃 나그네',x:raw.x,z:raw.z,heading:Number.isFinite(raw.heading)?raw.heading%(Math.PI*2):0,outfit:validAppearance(raw.outfit)?raw.outfit:'sage',...(safeIlju(raw.ilju)?{ilju:safeIlju(raw.ilju)}:{})};
}

/** Offsets are separate from the world projection; a request keeps its anchor. */
export function demoLabelOffsets(items, gap=8) {
  const ranks={'pending-incoming':0,'pending-outgoing':1,approved:2};
  const offsets=items.map(()=>0),placed=[];
  const ordered=items.map((item,index)=>({...item,index})).filter(({rect})=>rect&&['left','right','top','bottom'].every(key=>Number.isFinite(rect[key]))&&rect.right>rect.left&&rect.bottom>rect.top)
    .sort((a,b)=>(ranks[a.phase]??3)-(ranks[b.phase]??3)||a.index-b.index);
  for(const item of ordered){
    let offset=0;
    for(let pass=0;pass<=placed.length;pass++){
      const collisions=placed.filter(rect=>item.rect.left<rect.right&&item.rect.right>rect.left&&item.rect.top+offset<rect.bottom+gap&&item.rect.bottom+offset>rect.top-gap);
      if(!collisions.length)break;
      offset=Math.min(offset,...collisions.map(rect=>rect.top-gap-item.rect.bottom));
    }
    offsets[item.index]=offset;
    placed.push({left:item.rect.left,right:item.rect.right,top:item.rect.top+offset,bottom:item.rect.bottom+offset});
  }
  return offsets;
}

export function createVisitors({scene,world,camera,host,onSelect,demo=false}) {
  const group=new THREE.Group(); group.name='Present travellers';scene.add(group);
  const peers=new Map();
  const requestStates=new Map();
  const projected=new THREE.Vector3();
  const geometry={head:new THREE.SphereGeometry(.27,12,8),body:new THREE.CylinderGeometry(.2,.24,.46,10),limb:new THREE.CapsuleGeometry(.083,.22,3,6),hair:new THREE.SphereGeometry(.28,12,8,0,Math.PI*2,0,Math.PI*.47),eye:new THREE.SphereGeometry(.02,6,4),shadow:new THREE.CircleGeometry(.34,16)};
  let disposed=false;
  Object.assign(geometry,{bun:new THREE.SphereGeometry(.11,8,6),longHair:new THREE.CapsuleGeometry(.18,.22,3,8),hatBrim:new THREE.CylinderGeometry(.38,.38,.012,12),hatCrown:new THREE.CylinderGeometry(.135,.17,.25,10),band:new THREE.TorusGeometry(.28,.025,4,16),flower:new THREE.SphereGeometry(.07,8,6),ribbon:new THREE.BoxGeometry(.22,.07,.05),skirt:new THREE.CylinderGeometry(.21,.35,.44,12),lantern:new THREE.CylinderGeometry(.065,.06,.14,8),book:new THREE.BoxGeometry(.14,.19,.05),cup:new THREE.CylinderGeometry(.055,.038,.075,8),pouch:new THREE.SphereGeometry(.10,8,6)});
  function make(data) {
    const model=new THREE.Group();model.userData.visitorId=data.id;
    const palette=getAvatarPalette(decodeAppearance(data.outfit).palette);
    const materials={skin:new THREE.MeshStandardMaterial({color:'#f2d8bb',roughness:.9}),cloth:new THREE.MeshStandardMaterial({color:palette.colors.cream,roughness:.9}),pants:new THREE.MeshStandardMaterial({color:palette.colors.sage,roughness:.9}),hair:new THREE.MeshStandardMaterial({color:'#302c32',roughness:.9}),eye:new THREE.MeshBasicMaterial({color:'#302c32'}),shadow:new THREE.MeshBasicMaterial({color:'#101a20',transparent:true,opacity:.17,depthWrite:false})};
    function mesh(key,mat,x,y,z){const item=new THREE.Mesh(geometry[key],materials[mat]);item.position.set(x,y,z);model.add(item);return item;}
    mesh('body','cloth',0,.76,0);
    mesh('head','skin',0,1.22,.02);
    mesh('hair','hair',0,1.25,-.01);
    const arms=[],legs=[];
    for(const side of [-1,1]){mesh('eye','eye',side*.085,1.22,.275);arms.push(mesh('limb','cloth',side*.27,.74,0));legs.push(mesh('limb','pants',side*.115,.31,0));}
    const shadow=mesh('shadow','shadow',0,.02,0);shadow.rotation.x=-Math.PI/2;
    model.position.set(data.x,world.heightAt(data.x,data.z),data.z);model.rotation.y=data.heading;group.add(model);
    const label=host.ownerDocument.createElement('button');label.className='visitor-name';label.type='button';label.hidden=true;label.dataset.visitorId=data.id;
    if(demo)label.dataset.virtual='true';
    const select=()=>onSelect?.(data.id);label.addEventListener('click',select);host.append(label);
    return {model,label,materials,data,select,arms,legs,stride:0,walkBlend:0};
  }
  function applyAppearance(peer){
    const style=decodeAppearance(peer.data.outfit),palette=getAvatarPalette(style.palette),{materials,model}=peer;
    materials.cloth.color.set(palette.colors.cream);materials.pants.color.set(palette.colors.sage);materials.skin.color.set(SKIN_COLORS[style.skin]);materials.hair.color.set(HAIR_COLORS[style.ink]);
    if(style.customized&&!peer.cosmetics){
      const extra=key=>{const mesh=new THREE.Mesh(geometry[key],materials.hair);model.add(mesh);return mesh;};
      peer.cosmetics={hair:extra('bun'),hat:extra('hatBrim'),crown:extra('hatCrown'),cut:extra('skirt'),prop:extra('pouch')};
      for(const [key,mesh] of Object.entries(peer.cosmetics))mesh.name=`VisitorCosmetic-${key}`;
    }
    if(!peer.cosmetics)return;
    const c=peer.cosmetics;Object.values(c).forEach(mesh=>{mesh.visible=style.customized;mesh.rotation.set(0,0,0);mesh.scale.set(1,1,1);});
    c.hair.visible=style.customized&&style.hair!==1;c.hair.geometry=geometry[style.hair===0?'bun':'longHair'];c.hair.position.set(0,style.hair===0?1.50:1.08,style.hair===0?-.1:-.19);c.hair.scale.set(style.hair===4?.5:1,style.hair===2?.65:1,style.hair===0?1:.55);
    c.hat.visible=style.customized&&style.hat!==0;c.hat.material=style.hat===1?materials.eye:materials.pants;c.hat.geometry=geometry[['hatBrim','hatBrim','flower','band','ribbon'][style.hat]];c.hat.position.set(style.hat===2?.23:0,style.hat===2?1.39:1.52,style.hat===2?.14:0);if(style.hat===3)c.hat.rotation.x=Math.PI/2;
    c.crown.visible=style.customized&&style.hat===1;c.crown.material=materials.eye;c.crown.position.set(0,1.62,0);
    c.cut.visible=style.customized&&style.cut!==0;c.cut.material=materials.pants;c.cut.position.set(0,.43,0);c.cut.scale.set(style.cut===2?.77:1,style.cut===2?1.4:1,.86);
    c.prop.geometry=geometry[['pouch','lantern','book','cup'][style.prop]];c.prop.material=style.prop===2?materials.pants:materials.cloth;c.prop.position.set(style.prop===0?.13:.29,style.prop===1?.38:.5,style.prop===0?-.18:.13);
    model.userData.appearance=peer.data.outfit;
  }
  function describe(peer){
    const {data,label}=peer,phase=requestStates.get(data.id);
    if(demo){
      const status={'pending-incoming':'요청 도착','pending-outgoing':'승인 대기',approved:'궁합 보기'}[phase]||'체험';
      label.textContent=data.nickname+' · '+status;
      label.dataset.requestPhase=phase||'idle';
      label.setAttribute('aria-label','가상 나그네 '+data.nickname+'님'+(phase==='pending-incoming'?'의 궁합 요청 확인하기':phase==='pending-outgoing'?'의 궁합 승인 기다리는 중':phase==='approved'?'과 궁합 결과 보기':'에게 궁합 요청하기'));
    }else{
      const status={'pending-incoming':'요청 도착','pending-outgoing':'승인 대기',approved:'궁합 보기'}[phase];
      label.textContent=(data.ilju?data.ilju+' 일주\n':'')+data.nickname+(status?' · '+status:data.ilju?'':' · 궁합');
      label.dataset.requestPhase=status?phase:'idle';
      label.setAttribute('aria-label',data.nickname+(data.ilju?' · '+data.ilju+' 일주':'')+'님'+(phase==='pending-incoming'?'의 궁합 요청 확인하기':phase==='pending-outgoing'?'의 궁합 승인 기다리는 중':phase==='approved'?'과 궁합 결과 보기':'에게 궁합 요청하기'));
    }
  }
  function setRequestStates(states){
    if(disposed)return;
    requestStates.clear();
    for(const state of Array.isArray(states)?states:[]){
      const id=state?.peerId||state?.id;
      if(typeof id==='string'&&['idle','pending-incoming','pending-outgoing','approved','cancelled','declined','revoked'].includes(state.phase))requestStates.set(id,state.phase);
    }
    peers.forEach(describe);
  }
  function remove(peer){peer.label.removeEventListener('click',peer.select);peer.label.remove();peer.model.removeFromParent();Object.values(peer.materials).forEach(material=>material.dispose());}
  function sync(visitors,selfId){
    if(disposed)return;
    const safe=(Array.isArray(visitors)?visitors:[]).map(publicVisitor).filter(value=>value&&value.id!==selfId).slice(0,24);
    const ids=new Set(safe.map(value=>value.id));
    for(const[id,peer]of peers)if(!ids.has(id)){remove(peer);peers.delete(id);}
    for(const data of safe){let peer=peers.get(data.id);const fresh=!peer,changed=peer&&(peer.data.nickname!==data.nickname||peer.data.ilju!==data.ilju),outfitChanged=fresh||peer.data.outfit!==data.outfit;if(!peer){peer=make(data);peers.set(data.id,peer);}peer.data=data;if(fresh||changed)describe(peer);if(outfitChanged)applyAppearance(peer);}
  }
  function update(delta,{exploring,modalOpen,position}){
    if(disposed)return;
    for(const peer of peers.values()){
      const {model,data,label}=peer;const dt=Number.isFinite(delta)?Math.max(0,Math.min(delta,.1)):0;const blend=demo?1:1-Math.exp(-dt*12);
      const oldX=model.position.x,oldZ=model.position.z;
      model.position.x=THREE.MathUtils.lerp(model.position.x,data.x,blend);model.position.z=THREE.MathUtils.lerp(model.position.z,data.z,blend);
      const travelled=Math.hypot(model.position.x-oldX,model.position.z-oldZ),walking=dt>0&&travelled/dt>.035;
      peer.walkBlend=THREE.MathUtils.lerp(peer.walkBlend,walking?1:0,1-Math.exp(-dt*12));
      peer.stride+=Math.min(travelled,.2)*8;
      const swing=Math.sin(peer.stride)*peer.walkBlend;
      peer.arms.forEach((arm,index)=>{arm.rotation.x=swing*(index?-.4:.4);});
      peer.legs.forEach((leg,index)=>{leg.rotation.x=swing*(index?.5:-.5);});
      model.position.y=world.heightAt(model.position.x,model.position.z)+Math.abs(Math.sin(peer.stride))*peer.walkBlend*.018;
      const diff=Math.atan2(Math.sin(data.heading-model.rotation.y),Math.cos(data.heading-model.rotation.y));model.rotation.y+=diff*(demo?1-Math.exp(-dt*9):blend);
      model.visible=Boolean(exploring);
      projected.copy(model.position);projected.y+=1.85;projected.project(camera);
      if(demo)label.style.translate='0 0px';
      label.hidden=!exploring||modalOpen||projected.z>1||Math.abs(projected.x)>.9||Math.abs(projected.y)>.78||Math.hypot(model.position.x-position.x,model.position.z-position.z)>18;
      if(!label.hidden){label.style.left=((projected.x+1)/2*100)+'%';label.style.top=((1-projected.y)/2*100)+'%';}
    }
    if(demo){
      // Read the whole small set after projection writes, then apply offsets.
      // Rects include responsive margins and the existing CSS transform.
      const measured=[...peers.values()].filter(peer=>!peer.label.hidden&&typeof peer.label.getBoundingClientRect==='function')
        .map(peer=>({peer,phase:requestStates.get(peer.data.id),rect:peer.label.getBoundingClientRect()}));
      const offsets=demoLabelOffsets(measured);
      measured.forEach(({peer},index)=>{peer.label.style.translate=`0 ${offsets[index]}px`;});
    }
  }
  return {group,sync,update,setRequestStates,getPoint(id){const peer=peers.get(id);return peer?{x:peer.data.x,z:peer.data.z}:null;},hideLabels(){peers.forEach(peer=>{peer.label.hidden=true;});},dispose(){if(disposed)return;disposed=true;peers.forEach(remove);peers.clear();requestStates.clear();Object.values(geometry).forEach(item=>item.dispose());group.removeFromParent();}};
}
