import {CULTURE_ROLES,CULTURE_TOPICS,normalizeCultureDayPillar,culturePath,selectCulturePeople,selectCultureArticles,featuredCulturePeople,validateCultureData} from './culture-core.js?v=20261101-sanctuary2';
import {sanitizeReferenceContent} from './reference.js?v=20261101-sanctuary2';

const mounts=new WeakMap();
const PAGE_SIZE=24;
let indexLoad;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function button(text,cls='culture-button'){const node=el('button',cls,text);node.type='button';return node;}
function link(text,href,cls='culture-link'){const node=el('a',cls,text);node.href=href;return node;}
function image(person,cls='culture-art'){const node=el('img',cls);node.src=person.image;node.alt=person.dayPillar+' 상징 그림 · 인물 사진이 아니에요';node.width=440;node.height=246;node.loading='lazy';node.decoding='async';return node;}
function setPressed(node,value){node.setAttribute('aria-pressed',String(value));}
function searchField(text,placeholder){const label=el('label','culture-search'),caption=el('span','culture-label',text),input=el('input');input.type='search';input.placeholder=placeholder;input.autocomplete='off';label.append(caption,input);return{label,input};}
function selectField(text,options){const label=el('label','culture-select'),caption=el('span','culture-label',text),select=el('select');for(const[value,title]of options){const option=el('option','',title);option.value=value;select.append(option);}label.append(caption,select);return{label,select};}
function animateScroll(node){node.scrollIntoView?.({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}
async function loadIndex(){
  if(!indexLoad)indexLoad=(async()=>{
    const response=await fetch(new URL('./culture-data.json?v=20261101-1',import.meta.url),{headers:{Accept:'application/json'},credentials:'same-origin',redirect:'error'});
    if(!response.ok)throw new Error('culture_index');
    const source=await response.text();if(source.length>2000000)throw new Error('culture_size');
    const data=JSON.parse(source);if(!validateCultureData(data))throw new Error('culture_data');return data;
  })().catch(error=>{indexLoad=null;throw error;});
  return indexLoad;
}

/** Public, local content only. A reader remains inside the shrine until explicit original-page navigation. */
export async function mountCulture(container,view,{navigate,signal,onView,dayPillar,initialPath}={}){
  if(!container||!['celeb','magazine'].includes(view))throw new Error('Unknown culture view');
  const token={};mounts.set(container,token);let disposed=false,readController=null,readSequence=0,readerOpener=null;
  const controller=new AbortController(),root=el('section','culture-root culture-'+view);
  const active=()=>!disposed&&mounts.get(container)===token;
  const listen=(node,type,handler)=>node.addEventListener(type,handler,{signal:controller.signal});
  let ownDay=normalizeCultureDayPillar(dayPillar),refreshIdentity=null;
  // Subscribe before the index request: the engine may finish while the shelf loads.
  listen(document,'sowon:identity-change',event=>{
    if(!active())return;
    const next=normalizeCultureDayPillar(event.detail?.ilju);if(next===ownDay)return;
    ownDay=next;refreshIdentity?.();
  });
  const cleanup=()=>{disposed=true;controller.abort();readController?.abort();signal?.removeEventListener('abort',cleanup);root.remove();if(mounts.get(container)===token)mounts.delete(container);};
  signal?.addEventListener('abort',cleanup,{once:true});container.replaceChildren(root);
  if(signal?.aborted){cleanup();return cleanup;}
  const loading=el('p','culture-status','서가의 글을 가져오고 있어요.');loading.setAttribute('role','status');root.append(loading);
  let data;
  try{data=await loadIndex();}catch(_){
    if(active()){root.replaceChildren(el('h2','culture-heading','잠시 서가를 열지 못했어요'),el('p','culture-intro','연결을 확인한 뒤 다시 열어주세요. 공개 페이지에서도 같은 글을 읽을 수 있어요.'),link('공개 매거진에서 읽기',view==='celeb'?'/celeb/':'/m/'));}
    return cleanup;
  }
  if(!active())return cleanup;
  root.replaceChildren();
  const browser=el('div','culture-browser'),reader=el('section','culture-reader');reader.hidden=true;
  root.append(browser,reader);
  const intro=el('header','culture-intro-block');intro.append(el('p','culture-eyebrow',view==='celeb'?'인물회랑':'삼라 매거진'),el('h2','culture-heading',view==='celeb'?'좋아하는 사람의\n명식을 만나는 곳':'한 편씩 읽으며,\n나를 알아가는 시간'),el('p','culture-intro',view==='celeb'?`${data.people.length.toLocaleString('ko-KR')}명의 공개 프로필과 명식. 이름이나 그룹으로 찾아보고, 같은 일주도 만나보세요.`:'인물의 명식부터 오행과 십신의 기초까지. 신당을 떠나지 않고 천천히 읽어보세요.'));
  browser.append(intro);
  const featured=el('section','culture-featured');
  const featuredHeader=el('div','culture-section-head');featuredHeader.append(el('h3','',view==='celeb'?'먼저 둘러볼 인물':'처음 펼쳐볼 세 편'),el('span','culture-subtle','편집 추천'));featured.append(featuredHeader);
  const featuredGrid=el('div','culture-feature-grid');featured.append(featuredGrid);
  if(view==='celeb')for(const person of featuredCulturePeople(data.people))featuredGrid.append(featureCard(person));
  else for(const article of data.articles.slice(0,3))featuredGrid.append(guideCard(article,true));
  const tools=el('section','culture-tools');tools.setAttribute('aria-label',view==='celeb'?'인물 검색과 조건':'매거진 검색과 주제');browser.append(tools);
  const search=searchField(view==='celeb'?'이름·그룹·일주 검색':'글·인물·주제로 검색',view==='celeb'?'예: 아이유, BTS, 정유일주':'예: 오행, 출생시간, 아이유');tools.append(search.label);
  const chips=el('div','culture-chips');chips.setAttribute('role','group');chips.setAttribute('aria-label',view==='celeb'?'활동 분야':'읽을거리 주제');
  let chosenRole='all',chosenTopic='all',shown=PAGE_SIZE;
  const chipNodes=[];
  for(const item of view==='celeb'?CULTURE_ROLES:CULTURE_TOPICS){
    const chip=button(item.label,'culture-chip');setPressed(chip,item.id==='all');chipNodes.push([item.id,chip]);chips.append(chip);
    listen(chip,'click',()=>{if(view==='celeb')chosenRole=item.id;else chosenTopic=item.id;chipNodes.forEach(([id,node])=>setPressed(node,id===item.id));shown=PAGE_SIZE;render();});
  }
  const filterRow=el('div','culture-filter-row');
  const element=selectField('일간의 오행',[['','모든 오행'],['木','목 · 木'],['火','화 · 火'],['土','토 · 土'],['金','금 · 金'],['水','수 · 水']]);
  const order=selectField('보기 순서',[['recommended','추천순'],['name','이름순']]);
  const same=el('label','culture-same'),sameInput=el('input'),sameLabel=el('span','',ownDay?'나와 같은 '+ownDay:'내 사주 분석 후 같은 일주 찾기');sameInput.type='checkbox';sameInput.disabled=!ownDay;
  same.append(sameInput,sameLabel);
  if(view==='celeb'){
    const advanced=el('details','culture-filter-details'),summary=el('summary','','오행·정렬 조건');
    filterRow.append(element.label,order.label);advanced.append(summary,filterRow);
    tools.append(same,chips,advanced);
  }else tools.append(chips);
  // Search and the personal filter are the first tasks; editor picks support browsing below.
  browser.append(featured);
  const resultHead=el('div','culture-results-head'),resultCount=el('p','culture-result-count'),reset=button('조건 초기화','culture-text-button');resultCount.setAttribute('role','status');resultCount.setAttribute('aria-live','polite');resultHead.append(resultCount,reset);browser.append(resultHead);
  const grid=el('div',view==='celeb'?'culture-person-grid':'culture-story-grid');browser.append(grid);
  const more=button('더 보기','culture-more');browser.append(more);
  const scope=el('p','culture-footnote',view==='celeb'?'그림은 일주를 표현한 상징 삽화예요. 인물 사진이 아니에요. 공개 생일을 기준으로 하며, 확인되지 않은 출생시각은 임의로 넣지 않아요.':'모든 글은 삼라의 공개 매거진과 기초 자료 원문이에요. 인물 풀이는 명리의 상징을 빌린 해석으로, 실제 성격이나 활동의 원인을 단정하지 않아요.');browser.append(scope);
  function featureCard(person){
    const card=button('','culture-feature-card');card.append(image(person),el('span','culture-card-overline',person.dayPillar),el('strong','',person.name),el('span','culture-card-summary',person.title),el('span','culture-card-cta','명식과 이야기 읽기 →'));card.dataset.culturePath=person.path;return card;
  }
  function guideCard(article,feature=false){
    const card=button('',feature?'culture-guide-card':'culture-story-card');
    card.dataset.culturePath=article.path;card.append(el('span','culture-card-overline',article.topic+' · 사주 입문'),el('strong','',article.title),el('span','culture-card-summary',article.summary),el('span','culture-card-cta',`약 ${article.minutes}분 · 본문 읽기 →`));return card;
  }
  function personCard(person){
    const card=button('','culture-person-card');card.dataset.culturePath=person.path;
    const copy=el('div','culture-person-copy');copy.append(el('span','culture-card-overline',person.dayPillar),el('strong','',person.name),el('span','culture-person-occupation',person.occupation),el('span','culture-person-birth',person.birth),el('span','culture-person-scope',person.scope));card.append(image(person),copy);return card;
  }
  function storyCard(article){
    if(article.kind==='guide')return guideCard(article);
    const card=button('','culture-story-card culture-story-person');card.dataset.culturePath=article.path;
    const copy=el('div');copy.append(el('span','culture-card-overline',article.name+' · '+article.dayPillar),el('strong','',article.title),el('span','culture-card-summary',article.summary),el('span','culture-card-cta',`약 ${article.minutes}분 · 인물 풀이 읽기 →`));card.append(image(article),copy);return card;
  }
  function render(){
    if(!active())return;
    const entries=view==='celeb'?selectCulturePeople(data.people,{query:search.input.value,role:chosenRole,element:element.select.value,sort:order.select.value,dayPillar:sameInput.checked?ownDay:''}):selectCultureArticles(data,{query:search.input.value,topic:chosenTopic});
    grid.replaceChildren();entries.slice(0,shown).forEach(entry=>grid.append(view==='celeb'?personCard(entry):storyCard(entry)));
    const noun=view==='celeb'?'명':'편';resultCount.textContent=entries.length.toLocaleString('ko-KR')+noun+(sameInput.checked&&ownDay?' · '+ownDay:'')+' · '+Math.min(shown,entries.length)+noun+' 보는 중';
    more.hidden=entries.length<=shown;more.textContent=`더 보기 · ${Math.max(0,entries.length-shown).toLocaleString('ko-KR')}${noun} 남음`;
    featured.hidden=Boolean(search.input.value.trim()||(view==='celeb'?(chosenRole!=='all'||element.select.value||sameInput.checked):chosenTopic!=='all'));
    reset.hidden=!search.input.value&&chosenRole==='all'&&chosenTopic==='all'&&!element.select.value&&!sameInput.checked&&order.select.value==='recommended';
    if(!entries.length){const empty=el('div','culture-empty');empty.append(el('h3','','조건에 맞는 글이 없어요'),el('p','','검색어를 짧게 입력하거나 다른 조건으로 찾아보세요.'));grid.append(empty);}
  }
  refreshIdentity=()=>{
    if(!active())return;
    sameInput.disabled=!ownDay;if(!ownDay)sameInput.checked=false;
    sameLabel.textContent=ownDay?'나와 같은 '+ownDay:'내 사주 분석 후 같은 일주 찾기';
    shown=PAGE_SIZE;render();
  };
  listen(search.input,'input',()=>{shown=PAGE_SIZE;render();});
  [element.select,order.select,sameInput].forEach(node=>listen(node,'change',()=>{shown=PAGE_SIZE;render();}));
  listen(reset,'click',()=>{search.input.value='';element.select.value='';order.select.value='recommended';sameInput.checked=false;chosenRole=chosenTopic='all';chipNodes.forEach(([id,node])=>setPressed(node,id==='all'));shown=PAGE_SIZE;render();search.input.focus();});
  listen(more,'click',()=>{const oldCount=grid.children.length;shown+=PAGE_SIZE;render();grid.children[oldCount]?.focus({preventScroll:true});});
  function closeReader(){
    readSequence++;readController?.abort();readController=null;reader.replaceChildren();reader.hidden=true;browser.hidden=false;readerOpener?.focus({preventScroll:true});readerOpener=null;
  }
  async function openReader(path,opener){
    if(!culturePath(path))return false;
    const item=data.people.find(person=>person.path===path)||data.articles.find(article=>article.path===path);if(!item)return false;
    readController?.abort();readController=new AbortController();const readSignal=readController.signal,sequence=++readSequence;
    if(opener&&browser.contains(opener))readerOpener=opener;
    browser.hidden=true;reader.hidden=false;reader.replaceChildren();
    const bar=el('div','culture-reader-bar'),back=button('← '+(view==='celeb'?'인물회랑':'매거진')+'으로','culture-text-button');listen(back,'click',closeReader);bar.append(back,el('span','culture-subtle',item.name?'인물 풀이':'사주 입문'));reader.append(bar);
    const header=el('header','culture-article-header'),heading=el('h2','culture-article-title',item.title);heading.tabIndex=-1;
    header.append(el('p','culture-eyebrow',item.name?[item.name,item.dayPillar].join(' · '):item.topic),heading);
    if(item.name)header.append(el('p','culture-article-meta',[item.occupation,item.birth].join(' · ')),el('p','culture-scope-notice',item.scope+' · 공개 자료를 기준으로 읽어요.'));
    else header.append(el('p','culture-article-meta',`사주 입문 · 약 ${item.minutes}분`));
    reader.append(header);const status=el('p','culture-status','원문을 펼치고 있어요.');status.setAttribute('role','status');reader.append(status);heading.focus({preventScroll:true});animateScroll(root);
    const current=()=>active()&&!readSignal.aborted&&sequence===readSequence;
    try{
      const response=await fetch(path,{headers:{Accept:'text/html'},credentials:'same-origin',redirect:'error',signal:readSignal});if(!response.ok)throw new Error('culture_article');
      const source=await response.text();if(source.length>1500000)throw new Error('culture_article_size');if(!current())return false;
      const parsed=new DOMParser().parseFromString(source,'text/html'),paper=parsed.querySelector('main .paper-inner');if(!paper||!paper.textContent.trim())throw new Error('culture_article_body');
      status.remove();
      if(parsed.querySelector('.celeb-editorial-review')){
        header.replaceChildren(el('p','culture-eyebrow',item.name||'공개 자료'),el('h2','culture-article-title','공개 프로필과 명식 검토 안내'));
        const notice=el('section','culture-review-notice');notice.append(el('h3','','자료를 다시 확인하고 있어요'),el('p','','공개 프로필과 계산 입력의 대조가 끝날 때까지 명식과 해석을 표시하지 않아요. 다른 인물이나 입문 글을 둘러봐 주세요.'));reader.append(notice);return true;
      }
      if(item.name)renderPersonBody(parsed,paper,item);else{
        paper.querySelectorAll('aside.cta-box,.quickcta').forEach(node=>node.remove());
        const body=el('article','culture-article');body.append(sanitizeReferenceContent(paper,document,new URL(path,location.origin).href).fragment);reader.append(body);
      }
      const footer=el('footer','culture-reader-footer'),original=link('공개 원문 페이지 열기 ↗',path);original.dataset.cultureOriginal='true';footer.append(original);
      if(item.updatedAt)footer.append(el('span','culture-subtle','원문 수정 '+item.updatedAt));reader.append(footer);
      const next=el('section','culture-read-next');next.append(el('h3','','이어 읽기'));
      const entries=item.name?[data.articles[0],data.articles.find(article=>article.id==='unknown-birth-time')]:data.articles.filter(article=>article.path!==path).slice(0,2);
      entries.filter(Boolean).forEach(article=>next.append(guideCard(article)));reader.append(next);
      onView?.(view,{path,count:data.people.length});return true;
    }catch(error){
      if(!current()||error?.name==='AbortError')return false;
      status.textContent='원문을 가져오지 못했어요. 연결을 확인하거나 공개 페이지에서 읽어주세요.';
      const fallback=link('공개 원문에서 읽기 ↗',path);fallback.dataset.cultureOriginal='true';reader.append(fallback);return false;
    }
  }
  function renderPersonBody(parsed,paper,item){
    const body=el('article','culture-article');
    const profile=parsed.querySelector('.celeb-profile'),chart=parsed.querySelector('table.myeongsik');
    if(profile){
      const info=el('section','culture-profile-facts');info.append(el('h3','','공개 프로필과 풀이 기준'));
      const list=el('dl');for(const[label,text]of [['활동',item.occupation],['공개 생일',item.birth],['계산 범위',item.scope]]){const group=el('div');group.append(el('dt','',label),el('dd','',text));list.append(group);}info.append(list);
      if(item.birthNote)info.append(el('p','culture-birth-note',item.birthNote));
      const sourceList=el('p','culture-source-links');sourceList.append(document.createTextNode('자료 출처 '));for(const source of item.sources){const anchor=link(source.label,source.url);anchor.target='_blank';anchor.rel='noopener noreferrer';sourceList.append(anchor);}info.append(sourceList);
      const explanation=profile.querySelector('.celeb-scope');if(explanation){const wrap=el('div','culture-scope-detail');wrap.append(sanitizeReferenceContent(explanation,document,new URL(item.path,location.origin).href).fragment);info.append(wrap);}body.append(info);
    }
    if(chart){
      const chartSection=el('section','culture-chart-section');chartSection.append(el('h3','',item.name+'의 공개 명식'),el('p','culture-subtle','년·월·일 세 기둥 · '+item.scope));
      const chartWrap=el('div','culture-chart');const sourceWrap=document.createElement('div');sourceWrap.append(chart.cloneNode(true));chartWrap.append(sanitizeReferenceContent(sourceWrap,document,new URL(item.path,location.origin).href).fragment);chartSection.append(chartWrap);
      const bars=parsed.querySelectorAll('.bars .row2');if(bars.length){const distribution=el('div','culture-elements');for(const row of bars){const count=row.querySelector('.pc')?.textContent?.trim(),name=row.querySelector('.nm')?.textContent?.trim();if(name&&/^\d+$/.test(count||'')){const value=el('div');value.append(el('span','',name),el('strong','',count));distribution.append(value);}}chartSection.append(distribution,el('p','culture-subtle','오행은 세 기둥의 여섯 글자만 센 개수예요. 강약이나 능력의 점수가 아니에요.'));}body.append(chartSection);
    }
    const reading=el('div','culture-story-body');
    const marker=paper.querySelector('.celeb-article-note,.celeb-editorial-note');
    if(marker){
      const narrative=document.createElement('div');let node=marker;
      while(node){if(node.nodeType===1&&(node.matches('.celeb-compat-scope,.celeb-read-next,.cta-box')))break;narrative.append(node.cloneNode(true));node=node.nextSibling;}
      reading.append(sanitizeReferenceContent(narrative,document,new URL(item.path,location.origin).href).fragment);
    }else{
      const source=paper.cloneNode(true);source.querySelectorAll('.celeb-profile,.celeb-read-next,.celeb-compat-scope,aside.cta-box,.celeb-chart-reading,.tablewrap,.bars').forEach(node=>node.remove());reading.append(sanitizeReferenceContent(source,document,new URL(item.path,location.origin).href).fragment);
    }
    body.append(reading);reader.append(body);
    const actions=el('nav','culture-article-actions');actions.setAttribute('aria-label','이 명식과 이어 보기');actions.append(link(item.dayPillar+' 도감 읽기',item.iljuPath),link('내 명식도 살펴보기','/calc/'));reader.append(actions);
  }
  listen(root,'click',event=>{
    if(event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const card=event.target.closest?.('[data-culture-path]');if(card&&root.contains(card)){event.preventDefault();void openReader(card.dataset.culturePath,card);return;}
    const anchor=event.target.closest?.('a[href]');if(!anchor||!root.contains(anchor))return;
    const raw=anchor.getAttribute('href');if(raw.startsWith('#')){
      const target=reader.querySelector('[id="'+raw.slice(1)+'"]');if(target){event.preventDefault();target.tabIndex=-1;target.focus({preventScroll:true});animateScroll(target);}return;
    }
    let url;try{url=new URL(raw,location.href);}catch(_){return;}
    if(url.origin!==location.origin)return;
    if(!anchor.dataset.cultureOriginal&&culturePath(url.pathname)&&!url.search&&!url.hash){event.preventDefault();void openReader(url.pathname);return;}
    if(navigate){event.preventDefault();navigate(url.pathname+url.search+url.hash,{kind:anchor.dataset.cultureOriginal?'fallback':'reference'});}
  });
  render();onView?.(view,{count:view==='celeb'?data.people.length:data.people.length+data.articles.length});
  if(initialPath)await openReader(initialPath);
  return cleanup;
}
