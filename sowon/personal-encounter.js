import { getOwnProfile } from './profile.js?v=20261031-social1';
import { profileSearch } from './profile-core.js';

const hosts={tojeong:{name:'토정',kind:'saju',line:'입력해 둔 정보로 사주와 흐름을 펼쳤어요.'},seol:{name:'설월',kind:'saju',line:'먼저 나의 결을 읽고, 함께 온 나그네와 궁합을 살펴봐요.'},luna:{name:'루나',kind:'star',line:'입력해 둔 정보로 태어난 하늘을 펼쳤어요. 출생 도시는 아래에서 바꿀 수 있어요.'}};
export function mountPersonalEncounter(container,npc,{onClose,onGuide,onProfile,onSocial}={}){
  const host=hosts[npc],profile=getOwnProfile();if(!host||!profile)throw new Error('내 정보를 먼저 입력해 주세요.');
  const document=container.ownerDocument,abort=new AbortController();let cleanup;
  const make=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!=null)node.textContent=text;return node;};
  container.replaceChildren();container.classList.add('xp-personal-dialog');
  const header=make('header','personal-encounter-header');
  const portrait=make('img','');portrait.src='/store/art/readers/'+npc+'.webp';portrait.alt='';
  const identity=make('div','');identity.append(make('p','','나의 정보를 이어받은 무료 해석'),make('h2','',host.name+'의 이야기'),make('p','',host.line));
  const close=make('button','','×');close.type='button';close.setAttribute('aria-label','해석을 닫고 신당으로 돌아가기');close.onclick=onClose;header.append(portrait,identity,close);
  const actions=make('nav','personal-encounter-actions');actions.setAttribute('aria-label','술사와 함께하기');
  for(const[text,callback]of [['내 정보 수정',onProfile],['궁합 나그네 만나기',onSocial],['소원당 길잡이',onGuide]]){const button=make('button','',text);button.type='button';button.onclick=callback;actions.append(button);}
  const content=make('div','personal-encounter-body');content.textContent='나의 해석을 펼치고 있어요…';
  container.append(header,actions,content);
  const dispose=()=>{abort.abort();cleanup?.();container.classList.remove('xp-personal-dialog');};
  void (async()=>{try{
    const {mountReading}=await import('./readings.js?v=20261031-social1');
    if(abort.signal.aborted||!container.open)return;
    content.replaceChildren();
    const mounted=await mountReading(content,host.kind,{search:profileSearch(host.kind,profile),signal:abort.signal,navigate:url=>document.dispatchEvent(new CustomEvent('sowon:navigate',{detail:{url}}))});
    cleanup=typeof mounted==='function'?mounted:()=>mounted?.dispose?.();
    if(abort.signal.aborted)cleanup?.();
  }catch(error){if(!abort.signal.aborted){content.textContent='해석을 불러오지 못했어요. 연결을 확인하고 다시 만나 주세요.';}}})();
  return dispose;
}
