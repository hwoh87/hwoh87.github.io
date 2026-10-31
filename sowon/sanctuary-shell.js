import { getOwnProfile } from './profile.js?v=20261101-sanctuary2';
import { getOwnIdentity } from './identity.js?v=20261101-sanctuary2';
import { configureSocial } from './social.js?v=20261101-sanctuary2';
import './ilju-rooms.js?v=20261101-sanctuary2';

configureSocial({getRoomPosition:roomKey=>roomKey==='courtyard'?{x:0,z:14,heading:Math.PI}:{x:-11,z:14,heading:Math.PI}});
const shell=document.querySelector('.sanctuary');
const nav=document.createElement('nav');nav.className='sanctuary-destinations';nav.setAttribute('aria-label','나의 해석과 새 공간');
let pendingOwnReport=false;
const items=[['personal','내 해석','나의 사주·하늘·흐름'],['rooms','일주방','같은 일주의 나그네'],['celeb','연예인 사주','익숙한 얼굴의 명식'],['magazine','매거진','읽을수록 선명해지는 나']];
for(const [id,title,description] of items){
  const button=document.createElement('button');button.type='button';button.dataset.destination=id;
  const label=document.createElement('strong');label.textContent=title;
  const hint=document.createElement('span');hint.textContent=description;
  button.append(label,hint);
  if(id==='rooms')button.dataset.openIljuRooms='';
  else if(id!=='personal')button.dataset.hubFeature=id;
  else button.addEventListener('click',()=>{
    if(getOwnProfile())document.dispatchEvent(new CustomEvent('sowon:personal-reading',{detail:{npc:'tojeong',kind:'saju'}}));
    else {pendingOwnReport=true;document.dispatchEvent(new CustomEvent('sowon:profile-open'));}
  });
  nav.append(button);
}
shell.append(nav);
const roomBar=document.createElement('div');roomBar.className='sanctuary-room-status';roomBar.setAttribute('aria-label','현재 머무는 공간');
const roomName=document.createElement('strong');roomName.textContent='공용 마당';
const roomHint=document.createElement('span');roomHint.textContent='혼자 산책 중';
const change=document.createElement('button');change.type='button';change.dataset.openIljuRooms='';change.textContent='방 바꾸기';
roomBar.append(roomName,roomHint,change);shell.append(roomBar);
let own=getOwnIdentity(), connected=false, room='courtyard';
function updateIdentity(){
  const label=nav.querySelector('[data-destination="personal"] span');
  label.textContent=own.hasIdentity?`${own.ilju}일주 · 내 이야기 이어 읽기`:'나의 사주·하늘·흐름';
}
document.addEventListener('sowon:identity-change',event=>{own=event.detail;updateIdentity();});updateIdentity();
document.addEventListener('sowon:room-change',event=>{
  const detail=event.detail||{};room=detail.roomKey||'courtyard';
  roomName.textContent=room==='courtyard'?'공용 마당':detail.room?.label || room.replace('ilju:','')+'일주방';
  roomBar.dataset.room=room;roomHint.textContent=connected?'함께 걷는 중':'혼자 둘러보는 중';
});
document.addEventListener('sowon:social-state',event=>{connected=event.detail?.connected===true;roomHint.textContent=connected?`함께 걷는 중 · 다른 나그네 ${event.detail.count||0}명`:room==='courtyard'?'혼자 산책 중':'혼자 둘러보는 중';});

document.addEventListener('sowon:profile-change',()=>{if(pendingOwnReport&&getOwnProfile()){pendingOwnReport=false;queueMicrotask(()=>document.dispatchEvent(new CustomEvent('sowon:personal-reading',{detail:{npc:'tojeong',kind:'saju'}})));}});
document.getElementById('ownProfileDialog')?.addEventListener('close',()=>{pendingOwnReport=false;});
