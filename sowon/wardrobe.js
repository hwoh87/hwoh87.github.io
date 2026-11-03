import { decodeAppearance, encodeAppearance, randomAppearance, SKIN_COLORS, HAIR_COLORS } from './appearance-core.js?v=20261103-benchmark2';
import { AVATAR_PALETTES } from './avatar-palettes.js?v=20261103-benchmark2';
import { readSettings } from './experience-core.js?v=20261103-benchmark2';

const categories = { skin:'피부', hair:'머리', ink:'머리색', palette:'한복 색', cut:'한복 형태', hat:'머리 소품', prop:'함께 들기' };
const labels = { skin:['살구','밝은 살구','모래','꿀빛','밤빛','깊은 밤'], hair:['올림머리','짧은 머리','단발','긴머리','묶은 머리'], ink:['먹빛','밤색','황갈색','은빛','자줏빛','적갈색'], palette:Object.values(AVATAR_PALETTES).map(x=>x.label), cut:['바지','치마','긴 도포'], hat:['없음','갓','꽃핀','머리띠','리본'], prop:['여행 주머니','작은 등불','책 한 권','찻잔'] };
const palettes=Object.keys(AVATAR_PALETTES);
const dialog=document.createElement('dialog');dialog.className='wardrobe-dialog';dialog.setAttribute('aria-labelledby','wardrobeTitle');
dialog.innerHTML=`<header><div><p>나를 닮은 작은 나그네</p><h2 id="wardrobeTitle">오늘은 어떤 모습일까요?</h2></div><button type="button" data-wardrobe-close aria-label="캐릭터 꾸미기 닫기">×</button></header><div class="wardrobe-layout"><section class="wardrobe-preview" aria-label="내 캐릭터 미리보기"><div class="wardrobe-stage" role="img" aria-label="선택한 모습의 실제 3D 캐릭터. 드래그로 돌려볼 수 있어요."></div><p class="wardrobe-loading" role="status">나그네를 불러오고 있어요.</p><div class="wardrobe-turn"><button type="button" data-turn="-1" aria-label="캐릭터 왼쪽으로 돌리기">↶</button><button type="button" data-turn="front">앞모습</button><button type="button" data-turn="back">뒷모습</button><button type="button" data-turn="1" aria-label="캐릭터 오른쪽으로 돌리기">↷</button></div><div class="wardrobe-poses" aria-label="동작 미리보기"><button type="button" data-pose="idle" aria-pressed="true">서 있기</button><button type="button" data-pose="walk" aria-pressed="false">걷기</button><button type="button" data-pose="greet" aria-pressed="false">인사</button><button type="button" data-pose="sit" aria-pressed="false">앉기</button></div><p class="wardrobe-preview-note">돌려 보고, 움직여 보고 골라요.</p></section><section class="wardrobe-choices"><div class="wardrobe-tabs" role="tablist" aria-label="꾸미기 종류">${Object.entries(categories).map(([key,label],i)=>`<button type="button" role="tab" id="wardrobe-tab-${key}" aria-controls="wardrobeOptions" aria-selected="${i===0}" tabindex="${i===0?0:-1}" data-category="${key}">${label}</button>`).join('')}</div><div id="wardrobeOptions" role="tabpanel" tabindex="0"></div><div class="wardrobe-actions"><button type="button" data-random>새로운 조합</button><button type="button" data-reset>기본 모습</button></div><p class="wardrobe-privacy">꾸미기는 사주 계산용 성별과 관계없어요. 출생정보를 입력하지 않아도 자유롭게 고를 수 있어요.</p></section></div><footer><p class="wardrobe-status" role="status">적용하기 전까지 지금 모습은 바뀌지 않아요.</p><div><button type="button" data-wardrobe-close>취소</button><button type="button" data-apply>이 모습으로 산책하기</button></div></footer>`;
document.body.append(dialog);
let draft, category='skin', opener, preview, previewPromise, opening=0, pose='idle';
const stage=dialog.querySelector('.wardrobe-stage');
function renderChoices(){
  dialog.querySelectorAll('[data-category]').forEach(button=>{const selected=button.dataset.category===category;button.setAttribute('aria-selected',String(selected));button.tabIndex=selected?0:-1;});
  const panel=dialog.querySelector('#wardrobeOptions');panel.setAttribute('aria-labelledby',`wardrobe-tab-${category}`);
  panel.innerHTML=`<h3>${categories[category]}</h3><div class="wardrobe-option-grid ${['skin','ink','palette'].includes(category)?'is-colors':''}">${labels[category].map((label,index)=>{const value=category==='palette'?palettes[index]:index;const color=category==='skin'?SKIN_COLORS[index]:category==='ink'?HAIR_COLORS[index]:category==='palette'?AVATAR_PALETTES[value].swatch:null;return `<button type="button" data-choice="${index}" aria-pressed="${draft[category]===value}">${color?`<i style="--swatch:${color}" aria-hidden="true"></i>`:''}<span>${label}</span><b aria-hidden="true">✓</b></button>`;}).join('')}</div>`;
  preview?.avatar.setAppearance(encodeAppearance(draft));
}
async function ensurePreview(){
  if(preview)return preview;
  if(previewPromise)return previewPromise;
  previewPromise=(async()=>{
  const [THREE,{createAvatar}]=await Promise.all([import('three'),import('./avatar.js?v=20261103-benchmark2')]);
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.2;
  const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(32,1,.1,20);camera.position.set(0,1.08,3.65);camera.lookAt(0,.83,0);
  scene.add(new THREE.HemisphereLight('#fff8e9','#7b8e83',2.5));const key=new THREE.DirectionalLight('#fff3db',3);key.position.set(2,3,4);scene.add(key);const rim=new THREE.DirectionalLight('#c4d8e4',1.5);rim.position.set(-2,2,-1);scene.add(rim);
  const avatar=createAvatar();scene.add(avatar.group);stage.append(renderer.domElement);
  let frame=0,last=0,rotation=-.22,drag=null;
  function resize(){const r=stage.getBoundingClientRect();renderer.setSize(Math.max(1,r.width),Math.max(1,r.height),false);camera.aspect=Math.max(1,r.width)/Math.max(1,r.height);camera.updateProjectionMatrix();}
  const observer=new ResizeObserver(resize);observer.observe(stage);
  function animate(now){if(!dialog.open||document.hidden){frame=0;return;}const dt=last?Math.min(.05,(now-last)/1000):0;last=now;avatar.group.rotation.y=rotation;avatar.update(dt,pose==='walk');renderer.render(scene,camera);frame=requestAnimationFrame(animate);}
  stage.addEventListener('pointerdown',event=>{drag={x:event.clientX,rotation};stage.setPointerCapture(event.pointerId);});
  stage.addEventListener('pointermove',event=>{if(drag)rotation=drag.rotation+(event.clientX-drag.x)*.012;});
  for(const type of ['pointerup','pointercancel','lostpointercapture'])stage.addEventListener(type,()=>{drag=null;});
  preview={avatar,start(){resize();last=0;if(!frame)frame=requestAnimationFrame(animate);},stop(){cancelAnimationFrame(frame);frame=0;last=0;},turn(value){rotation=value==='front'?0:value==='back'?Math.PI:rotation+Number(value)*Math.PI/4;}};
  return preview;
  })().catch(error=>{previewPromise=null;throw error;});
  return previewPromise;
}
async function openWardrobe(){
  if(document.querySelector('dialog[open]'))return;
  opener=document.activeElement;let stored;try{stored=readSettings(localStorage);}catch{}draft=decodeAppearance(stored?.outfit);category='skin';pose='idle';
  dialog.querySelectorAll('[data-pose]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pose==='idle')));
  renderChoices();dialog.showModal();document.body.classList.add('dialog-open');dialog.querySelector('.wardrobe-loading').hidden=false;
  const generation=++opening;
  try{const result=await ensurePreview();if(generation!==opening||!dialog.open)return;result.avatar.setSeated(false);result.avatar.setAppearance(encodeAppearance(draft));result.start();dialog.querySelector('.wardrobe-loading').hidden=true;}
  catch{if(generation!==opening)return;dialog.querySelector('.wardrobe-loading').textContent='3D 미리보기를 열지 못했어요. 항목을 골라 적용하거나 취소할 수 있어요.';}
}
dialog.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-wardrobe-close')){dialog.close();return;}
  if(button.dataset.category){category=button.dataset.category;renderChoices();return;}
  if(button.dataset.choice!==undefined){draft[category]=category==='palette'?palettes[Number(button.dataset.choice)]:Number(button.dataset.choice);renderChoices();return;}
  if(button.hasAttribute('data-random')){draft=decodeAppearance(randomAppearance());renderChoices();return;}
  if(button.hasAttribute('data-reset')){draft=decodeAppearance('sage:0');renderChoices();return;}
  if(button.dataset.turn){preview?.turn(button.dataset.turn);return;}
  if(button.dataset.pose){pose=button.dataset.pose;preview?.avatar.setSeated(pose==='sit',0);if(pose==='greet')preview?.avatar.setGesture('greet');dialog.querySelectorAll('[data-pose]').forEach(x=>x.setAttribute('aria-pressed',String(x.dataset.pose===pose)));return;}
  if(button.hasAttribute('data-apply')){document.dispatchEvent(new CustomEvent('sowon:appearance-apply',{detail:{outfit:encodeAppearance(draft)}}));dialog.close();document.dispatchEvent(new CustomEvent('sowon:journey-action',{detail:{id:'wardrobe'}}));}
});
dialog.querySelector('.wardrobe-tabs').addEventListener('keydown',event=>{
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;event.preventDefault();const keys=Object.keys(categories),at=keys.indexOf(category);category=keys[event.key==='Home'?0:event.key==='End'?keys.length-1:(at+(event.key==='ArrowRight'?1:-1)+keys.length)%keys.length];renderChoices();dialog.querySelector(`[data-category="${category}"]`).focus();
});
dialog.addEventListener('close',()=>{opening++;preview?.stop();if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');if(opener?.isConnected)opener.focus({preventScroll:true});});
document.addEventListener('sowon:wardrobe-open',openWardrobe);
document.addEventListener('click',event=>{if(event.target.closest?.('[data-open-wardrobe]'))openWardrobe();});

document.addEventListener('visibilitychange',()=>{if(document.hidden)preview?.stop();else if(dialog.open)preview?.start();});
