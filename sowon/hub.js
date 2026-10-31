import { FEATURES, HALLS, getFeature, getHall, parseView, viewHash, internalDestination, readJourney, writeJourney } from './hub-core.js';

const dialog = document.createElement('dialog');
dialog.className = 'hub-dialog';
dialog.id = 'hubDialog';
dialog.setAttribute('aria-labelledby', 'hubTitle');
dialog.innerHTML = `<header class="hub-header"><button class="hub-back" type="button" aria-label="이전 화면">←</button><div><p id="hubEyebrow">SAMRA SANCTUARY</p><h2 id="hubTitle">달빛 아래 삼라</h2></div><button class="hub-close" type="button" aria-label="신당으로 돌아가기">×</button></header><div class="hub-body" id="hubBody"></div><footer class="hub-footer"><span>달빛 아래, 잠시 머물러도 괜찮아요.</span><button type="button" data-hub-view="all">전체 기능</button><button type="button" data-hub-feature="library">내 서재</button></footer>`;
document.body.appendChild(dialog);
const referenceDialog = document.createElement('dialog');
referenceDialog.className = 'hub-dialog hub-reference';
referenceDialog.setAttribute('aria-labelledby', 'referenceTitle');
referenceDialog.innerHTML = '<header class="hub-header"><div><p>SAMRA REFERENCE</p><h2 id="referenceTitle">함께 읽기</h2></div><button class="reference-close hub-close" type="button" aria-label="읽던 화면으로 돌아가기">×</button></header><div class="hub-body reference-body"></div><footer class="hub-footer"><span>읽던 결과는 뒤에 그대로 펼쳐두었어요.</span><button class="reference-back" type="button">읽던 화면으로</button></footer>';
document.body.appendChild(referenceDialog);
let referencePath=null, referenceCleanup=null, referenceAbort=null, referenceVersion=0, referenceBaseDepth=0;
const content = dialog.querySelector('#hubBody');
const title = dialog.querySelector('#hubTitle');
const eyebrow = dialog.querySelector('#hubEyebrow');
let disposeView = null, generation = 0, opener = null, currentView = null, departing = false, afterClose = null, closeInFlight = false, viewAbort = null;
const readingOptions = new Map();
let session;
try { session = sessionStorage; } catch (_) { session = null; }
const previousJourney = readJourney(session);
const identity = Math.random().toString(36).slice(2);
let depth = 0;
const startingView = parseView(location.hash) || (previousJourney?.pending ? previousJourney.view : null);
if (previousJourney?.pending) writeJourney(session, { ...previousJourney, pending: false });
const baseHash = location.hash.startsWith('#blessing=') ? location.hash : '';
history.replaceState({ ...history.state, sowonHub: identity, depth: 0, view: null }, '', location.pathname + baseHash);

function el(tag, cls, text) {
  const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = text; return node;
}
function icon(name) { return `<svg class="icon" aria-hidden="true"><use href="#i-${name}"/></svg>`; }
function track(id) {
  if (!getFeature(id) && !getHall(id) && !['map', 'all'].includes(id)) return;
  try { window.__track?.('cta', 'sowon-hub-' + id); } catch (_) {}
}
function capture(pending = false) {
  const detail = { view: currentView, pending, snapshot: null };
  document.dispatchEvent(new CustomEvent('sowon:capture', { detail }));
  const snapshot = detail.snapshot || previousJourney || { position: [0, 0, 8], camera: [28, 25, 45], target: [0, 2, -2], rotation: Math.PI, entered: false };
  writeJourney(session, { ...snapshot, view: currentView, pending });
}
export function navigate(raw, { canonical = false, kind } = {}) {
  const url = internalDestination(raw, location.origin);
  if (!url) return;
  const destination = new URL(url, location.origin);
  const calculator = { '/calc/': 'saju', '/calc/index.html': 'saju', '/calc/gunghap/': 'gunghap', '/calc/jami/': 'jami', '/calc/star/': 'star' }[destination.pathname];
  if (calculator && !canonical && kind !== 'fallback') {
    // Cross-calculator carry remains in memory, never in the shrine's history.
    readingOptions.set(calculator, destination.search ? { search: destination.search } : {});
    const view = { type: 'feature', id: calculator };
    if (viewHash(view) === viewHash(currentView)) render(view); else open(view);
    return;
  }
  if (!canonical && kind !== 'fallback' && (['/store/', '/store/index.html'].includes(destination.pathname) || destination.pathname === '/' && ['#tests', '#readers'].includes(destination.hash))) {
    open({ type: 'feature', id: destination.hash === '#readers' ? 'readers' : 'catalog' }); return;
  }
  if (!canonical && kind !== 'fallback' && dialog.open && !destination.search && /^\/(learn|ilju|term|tti|jami|star|cheongan|jiji|year)\//.test(destination.pathname)) {
    if (!referenceDialog.open) referenceBaseDepth=depth;
    depth++;
    history.pushState({sowonHub:identity,depth,view:currentView,reference:destination.pathname},'',location.pathname+viewHash(currentView));
    showReference(destination.pathname);return;
  }
  departing = true; capture(true);
  location.assign(url);
}
function clearView() {
  generation++;
  viewAbort?.abort(); viewAbort=null;
  try { if (typeof disposeView === 'function') disposeView(); else disposeView?.dispose?.(); } catch (_) {}
  disposeView = null;
  content.replaceChildren();
}
function featureCard(id) {
  const item = getFeature(id), button = el('button', 'hub-feature');
  button.type = 'button'; button.dataset.hubFeature = id;
  button.append(el('span', 'hub-feature-tag', item.badge), el('strong', '', item.title), el('span', '', item.text), el('i', '', '↗'));
  return button;
}
function renderHall(id) {
  const hall = getHall(id);
  const intro = el('section', 'hub-hall-intro');
  intro.innerHTML = `<img src="/store/art/readers/${hall.reader}.webp" alt="" width="88" height="88"><div><span>${hall.guide}의 안내</span><h3>${hall.line}</h3><p>${hall.description}</p></div>`;
  const grid = el('div', 'hub-feature-grid'); hall.features.forEach(key => grid.appendChild(featureCard(key)));
  content.append(intro, grid);
  if (id === 'readers') content.append(el('p', 'hub-note', '술사 소개와 상품 둘러보기는 무료예요. 리포트는 가격과 내용을 확인한 뒤 별도로 구매해요.'));
}
function renderMap() {
  const lead = el('div', 'hub-map-lead'); lead.append(el('h3', '', '오늘은 어디에 머물까요?'), el('p', '', '장소를 고르면 나그네가 천천히 걸어가요. 바로 열기로 곧장 이용할 수도 있어요.'));
  const map = el('div', 'hub-map');
  map.innerHTML = `<svg class="hub-map-lines" viewBox="0 0 700 430" aria-hidden="true"><path d="M350 386V226M350 226H116V128M350 226H584V128M116 226V338M584 226V338M350 226V52"/><ellipse cx="350" cy="226" rx="62" ry="42"/><path class="hub-map-water" d="M440 282q58-38 72 5t-48 31-24-36Z"/></svg><span class="hub-map-moon" aria-hidden="true">☾</span><span class="hub-map-gate">지금, 이곳에서</span>`;
  const positions = { stars: [50, 12], myeongri: [17, 31], archive: [83, 31], readers: [17, 78], inyeon: [83, 78] };
  for (const [id, hall] of Object.entries(HALLS)) {
    const button = el('button', 'hub-map-place'); button.type = 'button'; button.dataset.hubWalk = id;
    button.style.setProperty('--mx', positions[id][0] + '%'); button.style.setProperty('--my', positions[id][1] + '%');
    button.innerHTML = `${icon(hall.icon)}<strong>${hall.name}</strong><small>${{myeongri:'사주 · 시간 비교',inyeon:'궁합 · 인연',stars:'자미두수 · 별자리',readers:'술사 · 리포트',archive:'배움 · 도감'}[id]}</small>`;
    map.appendChild(button);
  }
  const center = el('button', 'hub-map-center'); center.type='button'; center.dataset.hubRitual='wish'; center.innerHTML=icon('lantern')+'<strong>소원마당</strong><small>바람이 빛이 되는 자리</small>'; map.append(center);
  const list = el('div', 'hub-map-list');
  for (const [id, hall] of Object.entries(HALLS)) {
    const row = el('div', 'hub-map-row'); row.innerHTML=`<span>${hall.name}</span><button type="button" data-hub-walk="${id}">걸어가기 ↗</button><button type="button" data-hub-hall="${id}">바로 열기</button>`; list.append(row);
  }
  content.append(lead,map,list);
}
function renderAll() {
  const search = el('label', 'hub-search', '찾고 싶은 일이 있나요?');
  const input=el('input');input.type='search';input.placeholder='사주, 궁합, 리포트, 용어…';search.append(input);
  const host=el('div','hub-all-sections');
  function update() {
    host.replaceChildren();const query=input.value.trim().normalize('NFKC').toLocaleLowerCase('ko-KR');let count=0;
    for (const [id,hall] of Object.entries(HALLS)) {
      const ids=hall.features.filter(key=>[FEATURES[key].title,FEATURES[key].text,hall.name].join(' ').normalize('NFKC').toLocaleLowerCase('ko-KR').includes(query));
      if (!ids.length) continue;
      const section=el('section','hub-all-section');const head=el('button','hub-section-link',hall.name+' ↗');head.type='button';head.dataset.hubHall=id;section.append(head);
      const grid=el('div','hub-feature-grid');ids.forEach(key=>grid.append(featureCard(key)));count+=ids.length;section.append(grid);host.append(section);
    }
    if (!query || /서재|구매|리포트|pdf|복구/i.test(query)) {host.append(featureCard('library')); count++;}
    if (!count) host.append(el('p','hub-empty','찾는 기능이 없어요. 다른 말로 검색해 보세요.'));
  }
  input.addEventListener('input',update);update();
  const rituals=el('section','hub-rituals');rituals.innerHTML='<h3>소원마당에서 잠시 쉬기</h3><div><button type="button" data-hub-ritual="wish">소원 등불</button><button type="button" data-hub-ritual="breath">마음 고르기</button><button type="button" data-hub-ritual="blessing">응원 보내기</button><button type="button" data-hub-ritual="journal">내 등불 기록</button></div>';
  content.append(search,rituals,host);
}
async function render(view) {
  clearView(); const version=generation; currentView=view;
  viewAbort=new AbortController();
  dialog.classList.toggle('hub-is-reading',view.type==='feature'&&getFeature(view.id)?.kind==='reading');
  title.textContent=view.type==='hall'?getHall(view.id).name:view.type==='feature'?getFeature(view.id).title:view.id==='map'?'신당 지도':'삼라의 모든 길';
  eyebrow.textContent=view.type==='hall'?getHall(view.id).english:'SAMRA SANCTUARY';
  dialog.querySelector('.hub-back').hidden=depth<=1;
  if(!dialog.open) {
    document.querySelectorAll('dialog[open]').forEach(other=>other.close());
    opener=document.activeElement;dialog.showModal();document.body.classList.add('dialog-open');
    document.dispatchEvent(new CustomEvent('sowon:panel',{detail:{open:true}}));
  }
  content.scrollTop=0;
  if(view.type==='hall') {renderHall(view.id);return;}
  if(view.type==='view') {view.id==='map'?renderMap():renderAll();return;}
  const item=getFeature(view.id);
  if(item.kind==='invite') {
    content.innerHTML='<section class="hub-explanation"><span class="hub-large-symbol">♡</span><h3>마당에서 만나, 함께 읽는 인연</h3><p>각자 내 출생정보를 준비한 뒤 함께 걷기에 참여해요. 가까이 있는 나그네에게 연인·친구·가족·동료 궁합을 요청할 수 있어요.</p><p>상대가 승인하면 같은 결과를 두 사람만 볼 수 있어요. 생년월일 원문은 서로에게 공개하지 않으며, 어느 쪽이든 공유를 철회할 수 있어요.</p><button class="hub-primary" type="button" data-hub-social>함께 있는 나그네 만나기 ↗</button><button class="hub-primary" type="button" data-hub-feature="gunghap">정보를 직접 입력해 궁합 보기 ↗</button></section>';
    return;
  }
  const loading=el('p','hub-loading','잠시만요. 이야기를 펼치고 있어요.');loading.setAttribute('role','status');content.append(loading);
  const mount=el('div','hub-mounted');content.append(mount);
  try {
    let result;
    if(item.kind==='reading') {
      const module=await import('./readings.js?v=20261031-social1'); if(version!==generation)return;
      result=await module.mountReading(mount,item.value,{navigate,signal:viewAbort.signal,...readingOptions.get(item.value)});
    } else {
      const module=await import('./collection.js');if(version!==generation)return;
      result=await module.mountCollection(mount,item.value,{navigate,onView:()=>{},signal:viewAbort.signal});
    }
    if(version!==generation){if(typeof result==='function')result();else result?.dispose?.();return;}
    disposeView=result;loading.remove();
    if(item.anchor){const note=el('p','hub-note','사주를 계산한 뒤 결과 아래 ‘태어난 시간 비교’에서 범위를 정해 비교해 보세요.');mount.before(note);}
  } catch (_) {
    if(version!==generation)return;
    loading.remove();mount.replaceChildren(el('h3','','화면을 불러오지 못했어요.'),el('p','','연결을 확인한 뒤 다시 열어주세요.'));
    const retry=el('button','hub-primary','다시 열기');retry.type='button';retry.onclick=()=>render(view);mount.append(retry);
    const routes={saju:'/calc/',gunghap:'/calc/gunghap/',jami:'/calc/jami/',star:'/calc/star/',catalog:'/',readers:'/#readers',archive:'/learn/',library:'/store/library.html'};
    const route=routes[item.value];if(route){const link=el('a','hub-fallback-link','기존 삼라 화면에서 열기 ↗');link.href=route;link.onclick=event=>{event.preventDefault();navigate(route,{canonical:true});};mount.append(link);}
  }
}
function hide() {
  hideReference();
  clearView();currentView=null;
  if(dialog.open)dialog.close();
  document.body.classList.remove('dialog-open');
  document.dispatchEvent(new CustomEvent('sowon:panel',{detail:{open:false}}));
  if(opener?.isConnected)opener.focus({preventScroll:true});
  capture();
}
function hideReference() {
  referenceVersion++;referenceAbort?.abort();referenceAbort=null;referenceCleanup?.();referenceCleanup=null;referencePath=null;
  if(referenceDialog.open)referenceDialog.close();
  referenceDialog.querySelector('.reference-body').replaceChildren();
}
async function showReference(path) {
  hideReference();referencePath=path;const version=referenceVersion;
  referenceAbort=new AbortController();
  const host=referenceDialog.querySelector('.reference-body');host.textContent='페이지를 펼치고 있어요…';
  referenceDialog.querySelector('#referenceTitle').textContent='함께 읽기';
  referenceDialog.showModal();
  try {
    const module=await import('./reference.js');if(version!==referenceVersion)return;
    const result=await module.mountReference(host,path,{navigate,signal:referenceAbort.signal});
    if(version!==referenceVersion){result?.();return;}referenceCleanup=result;
  }catch(_){if(version!==referenceVersion)return;host.textContent='글을 불러오지 못했어요. ';const link=el('a','hub-fallback-link','기존 삼라 화면에서 열기 ↗');link.href=path;link.onclick=event=>{event.preventDefault();navigate(path,{canonical:true});};host.append(link);}
}
function closeReference() {
  if(closeInFlight)return;
  closeInFlight=true;
  history.go(Math.min(-1,referenceBaseDepth-depth));
}
referenceDialog.querySelector('.reference-close').onclick=closeReference;
referenceDialog.querySelector('.reference-back').onclick=closeReference;
referenceDialog.addEventListener('cancel',event=>{event.preventDefault();closeReference();});
function close(callback) {
  if(closeInFlight)return;
  afterClose = typeof callback === 'function' ? callback : null;
  if(depth>0&&history.state?.sowonHub===identity){closeInFlight=true;history.go(-depth);}
  else {history.replaceState({...history.state,view:null,depth:0},'',location.pathname+baseHash);depth=0;hide();const next=afterClose;afterClose=null;next?.();}
}
function open(view) {
  if(!viewHash(view))return;
  if(view.type==='feature'&&getFeature(view.id).kind==='link'){navigate(getFeature(view.id).url);return;}
  const hadReference=referenceDialog.open;
  if(hadReference)hideReference();
  if(viewHash(view)===viewHash(currentView)&&dialog.open&&!hadReference)return;
  depth++;
  history.pushState({sowonHub:identity,depth,view},'',location.pathname+viewHash(view));
  track(view.id);render(view);
}
function walk(id) {
  if(!getHall(id))return;
  const begin = () => {
    document.dispatchEvent(new CustomEvent('sowon:walk',{detail:{action:id}}));
    if(!document.body.classList.contains('world-ready'))open({type:'hall',id});
  };
  if(dialog.open)close(begin);else begin();
}
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-hub-social]')){event.preventDefault();close(()=>document.dispatchEvent(new CustomEvent('sowon:social-open')));return;}
  const button=event.target.closest?.('[data-hub-view],[data-hub-feature],[data-hub-hall],[data-hub-walk],[data-hub-ritual]');
  if(!button)return;
  event.preventDefault();
  if(button.dataset.hubView)open({type:'view',id:button.dataset.hubView});
  else if(button.dataset.hubFeature)open({type:'feature',id:button.dataset.hubFeature});
  else if(button.dataset.hubHall)open({type:'hall',id:button.dataset.hubHall});
  else if(button.dataset.hubWalk)walk(button.dataset.hubWalk);
  else if(button.dataset.hubRitual){
    const action=button.dataset.hubRitual;
    close(() => document.dispatchEvent(new CustomEvent('sowon:open',{detail:{action}})));
  }
});
document.addEventListener('sowon:open',event=>{if(getHall(event.detail?.action))open({type:'hall',id:event.detail.action});});
document.addEventListener('sowon:feature',event=>{if(getFeature(event.detail?.id))open({type:'feature',id:event.detail.id});});
document.addEventListener('sowon:hall',event=>{if(getHall(event.detail?.id))open({type:'hall',id:event.detail.id});});
document.addEventListener('sowon:navigate',event=>{if(event.detail?.url)navigate(event.detail.url);});
dialog.querySelector('.hub-close').onclick=close;
dialog.querySelector('.hub-back').onclick=()=>history.back();
dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
dialog.addEventListener('close',()=>{if(currentView&&!dialog.open)close();});
let outside=false;
dialog.addEventListener('pointerdown',event=>{outside=event.target===dialog&&event.clientX<dialog.getBoundingClientRect().left;});
dialog.addEventListener('pointerup',()=>{if(outside)close();outside=false;});
window.addEventListener('popstate',event=>{
  closeInFlight=false;
  const state=event.state;depth=state?.sowonHub===identity?state.depth:0;
  const view=state?.sowonHub===identity?state.view:parseView(location.hash);
  if(view&&viewHash(view)){
    if(viewHash(view)!==viewHash(currentView)||!dialog.open)render(view);
    if(state?.reference&&/^\/(learn|ilju|term|tti|jami|star|cheongan|jiji|year)\/[a-z0-9/-]*$/.test(state.reference))showReference(state.reference);else hideReference();
  }else {hide();const next=afterClose;afterClose=null;next?.();}
});
window.addEventListener('pagehide',()=>capture(departing));
window.addEventListener('pageshow',event=>{
  departing=false;
  // BFCache already retains the mounted result, search and scroll position.
  // Rebuilding here would discard them precisely when the visitor returns.
  if(event.persisted){const journey=readJourney(session);if(journey?.pending)writeJourney(session,{...journey,pending:false});}
});
if(startingView)open(startingView);
