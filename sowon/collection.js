/* Collection panels use the existing store catalog and private library contracts. */
const mounts = new WeakMap();
const loads = new Map();
let finderQueue = Promise.resolve();

const RESOURCES = [
  {href:'/learn/', title:'사주 기초부터 읽기', group:'입문', description:'명식·오행·십신·대운을 차근차근 읽는 안내서'},
  {href:'/learn/read-chart/', title:'내 명식 읽는 순서', group:'입문', description:'여덟 글자에서 일간과 기운의 관계를 찾아요'},
  {href:'/learn/five-elements/', title:'오행의 관계', group:'입문', description:'목·화·토·금·수의 생극과 균형'},
  {href:'/learn/ten-gods/', title:'십신 이해하기', group:'입문', description:'비견·식신·정관 등 관계를 읽는 기준'},
  {href:'/learn/luck-cycles/', title:'대운과 세운', group:'입문', description:'원국 위에 시간의 흐름을 겹쳐 읽어요'},
  {href:'/learn/twelve-stages/', title:'12운성과 12신살', group:'입문', description:'기운의 단계와 신살을 읽는 범위'},
  {href:'/learn/combinations/', title:'합과 충 이해하기', group:'입문', description:'좋고 나쁨 하나로 단정하지 않는 글자 관계'},
  {href:'/learn/unknown-birth-time/', title:'태어난 시간을 모른다면', group:'입문', description:'출생시간이 없을 때 알 수 있는 부분과 확인이 필요한 부분'},
  {href:'/ilju/', title:'60갑자 일주 도감', group:'도감', description:'태어난 날의 천간과 지지가 이루는 60가지 결'},
  {href:'/cheongan/', title:'천간 10자', group:'도감', description:'갑·을·병·정부터 열 글자의 기질과 관계'},
  {href:'/jiji/', title:'지지 12자', group:'도감', description:'자·축·인·묘와 합·충의 관계'},
  {href:'/term/', title:'사주 용어사전', group:'도감', description:'십신·12운성·신살·형충회합을 찾아 읽어요'},
  {href:'/tti/', title:'12띠와 띠 궁합', group:'도감', description:'띠의 성격과 두 띠가 만났을 때의 결'},
  {href:'/year/', title:'년생별 사주', group:'도감', description:'태어난 해의 년주·색 띠와 같은 해의 인물'},
  {href:'/jami/', title:'자미두수 도감', group:'별과 명반', description:'14주성과 12궁·사화를 읽는 자료'},
  {href:'/star/', title:'별자리 도감', group:'별과 명반', description:'12사인·12하우스와 행성의 기능'},
  {href:'/celeb/', title:'연예인 명식 회랑', group:'인물', description:'공개 프로필과 명식 해설을 이름·그룹·오행으로 찾아요'},
  {href:'/m/', title:'인물 이야기 모아보기', group:'인물', description:'공개된 생년월일을 바탕으로 읽는 명식과 이야기'},
];

function words(value) { return String(value || '').normalize('NFKC').toLocaleLowerCase('ko-KR').trim().split(/\s+/).filter(Boolean); }
function matches(text, query) { const value=String(text).normalize('NFKC').toLocaleLowerCase('ko-KR'); return words(query).every(word=>value.includes(word)); }
export function getCollectionResources(query = '') { return RESOURCES.filter(item=>matches([item.title,item.description,item.group].join(' '),query)).map(item=>({...item})); }

function catalogData() {
  if (typeof PRODUCTS === 'undefined' || typeof READERS === 'undefined' || typeof CATS === 'undefined') return null;
  return {products:PRODUCTS,readers:READERS,categories:CATS,bySlug:PRODUCT_BY_SLUG,price:priceOf,won,select:selectStoreProducts};
}
export function selectCollectionProducts({query='',category='all',reader='all',sort='recommended',now=Date.now()}={}) {
  const data=catalogData();
  if (!data) return [];
  return data.select({query,category,sort,now}).filter(product=>reader==='all'||product.reader===reader);
}
function libraryApi() {
  if(typeof libAll!=='function'||typeof libraryState!=='function')return null;
  return {all:libAll,state:libraryState,labels:LIBRARY_STATE_LABELS,refresh:refreshLibraryStatus,recoveryUrl,importLink:importRecoveryLink,error:storeErrMsg};
}
function script(path, ready, repeat=false) {
  if(!repeat&&ready?.())return Promise.resolve();
  if(path==='/store/catalog.js'&&window.__samraCatalogReady)return window.__samraCatalogReady;
  if(!repeat&&loads.has(path))return loads.get(path);
  const promise=new Promise((resolve,reject)=>{
    const node=document.createElement('script');node.src=path;node.async=true;
    let settled=false;let timeout;
    const finish=error=>{if(settled)return;settled=true;clearTimeout(timeout);node.onload=null;node.onerror=null;if(error){node.remove();loads.delete(path);if(path==='/store/catalog.js')window.__samraCatalogReady=null;reject(new Error('collection_load'));}else{if(repeat)node.remove();resolve();}};
    node.onload=()=>finish(ready&&!ready());
    node.onerror=()=>finish(true);
    timeout=setTimeout(()=>finish(true),30000);
    document.head.appendChild(node);
  });
  if(!repeat)loads.set(path,promise);
  if(path==='/store/catalog.js')window.__samraCatalogReady=promise;
  return promise;
}
function el(tag, cls, text) { const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node; }
function button(text,cls='sc-button'){const node=el('button',cls,text);node.type='button';return node;}
function link(text,href,cls='sc-link',kind='resource'){const node=el('a',cls,text);node.href=href;node.dataset.collectionKind=kind;return node;}
function heading(root,kicker,title,description){root.append(el('p','sc-kicker',kicker),el('h2','sc-title',title));if(description)root.append(el('p','sc-intro',description));}
function status(root){const node=el('p','sc-status');node.setAttribute('role','status');node.setAttribute('aria-live','polite');root.append(node);return node;}
function searchField(label,placeholder){const wrap=el('label','sc-search',label),input=el('input');input.type='search';input.placeholder=placeholder;input.autocomplete='off';wrap.append(input);return{wrap,input};}
function selectField(label,options){const wrap=el('label','sc-select',label),select=el('select');options.forEach(([value,text])=>{const option=el('option','',text);option.value=value;select.append(option);});wrap.append(select);return{wrap,select};}
function cover(product){const image=el('img','sc-cover');image.src='/store/art/covers/'+product.slug+'.webp';image.alt='';image.width=120;image.height=150;image.loading='lazy';return image;}
function productCard(product,data){
  const card=link('','/store/product.html?id='+encodeURIComponent(product.slug),'sc-product','product');
  const copy=el('div','sc-product-copy');copy.append(el('span','sc-category',data.categories[product.catId||product.cat]?.label||'리포트'),el('h3','',product.title),el('p','sc-product-summary',product.bullets));
  const reader=data.readers[product.reader];copy.append(el('p','sc-meta',`${reader?.name||'삼라'} · ${product.chaptersN}장 · 약 ${product.readMin}분`),el('strong','sc-price',data.won(data.price(product.slug))));
  card.append(cover(product),copy,el('span','sc-card-arrow','↗'));return card;
}

/** Mount one panel. Navigation receives the canonical URL; metadata never contains private tokens. */
export async function mountCollection(container, view, {navigate,onView,signal}={}) {
  if(!container||!['readers','catalog','archive','library'].includes(view))throw new Error('Unknown collection view');
  const token={};mounts.set(container,token);let disposed=false;
  const root=el('section','sc-root sc-'+view);container.replaceChildren(root);
  const controller=new AbortController();const active=()=>!disposed&&mounts.get(container)===token;
  const listen=(node,type,fn)=>node.addEventListener(type,fn,{signal:controller.signal});
  const cleanup=()=>{disposed=true;controller.abort();signal?.removeEventListener('abort',cleanup);root.remove();if(mounts.get(container)===token)mounts.delete(container);};
  signal?.addEventListener('abort',cleanup,{once:true});
  if(signal?.aborted){cleanup();return cleanup;}
  listen(root,'click',event=>{
    const anchor=event.target.closest?.('a[href]');
    if(!anchor||!root.contains(anchor)||!navigate||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const href=anchor.getAttribute('href');
    const kind=anchor.dataset.collectionKind||(href.startsWith('/store/product.html')?'product':href.startsWith('/calc/')?'calculator':'resource');
    event.preventDefault();navigate(href,{view,kind});
  });
  if(view==='archive'){
    heading(root,'THE QUIET ARCHIVE','한 장씩, 나를 알아가는 서고','사주가 처음이라면 입문 글부터, 궁금한 글자가 있다면 도감부터 펼쳐보세요.');
    const search=searchField('자료 찾기','오행, 출생시간, 연예인…');root.append(search.wrap);
    const notice=status(root),grid=el('div','sc-resource-grid');root.append(grid);
    function render(){grid.replaceChildren();const items=getCollectionResources(search.input.value);notice.textContent=items.length+'개의 읽을거리';items.forEach(item=>{const card=link('',item.href,'sc-resource');card.append(el('span','sc-category',item.group),el('h3','',item.title),el('p','',item.description),el('span','sc-resource-more','펼쳐보기 ↗'));grid.append(card);});if(!items.length)grid.append(el('p','sc-empty','다른 낱말로 찾아보세요.'));}
    listen(search.input,'input',render);render();onView?.(view,{count:RESOURCES.length});return cleanup;
  }
  root.append(el('p','sc-status','서가를 여는 중이에요…'));
  try{await script('/store/catalog.js',catalogData);}catch(_){if(active()){root.replaceChildren();heading(root,'SAMRA COLLECTION','서가를 열지 못했어요','연결을 확인한 뒤 다시 열어주세요.');root.append(link('기존 리포트 서가 열기','/store/','sc-button','fallback'));}return cleanup;}
  if(!active())return cleanup;
  const data=catalogData();root.replaceChildren();
  if(!data)throw new Error('Catalog unavailable');

  if(view==='readers'){
    heading(root,'TWELVE VOICES OF SAMRA','어떤 목소리로 만나볼까요?','술사마다 말투와 이야기를 풀어내는 결이 달라요. 소개와 담당 리포트를 살펴보세요.');
    const search=searchField('술사 찾기','이름, 다정한 위로, 차분한 분석…');root.append(search.wrap);
    const notice=status(root),grid=el('div','sc-reader-grid'),detail=el('section','sc-reader-detail');detail.hidden=true;root.append(grid,detail);
    function showReader(id,opener){
      const reader=data.readers[id];detail.replaceChildren();detail.hidden=false;
      const top=el('div','sc-reader-detail-top'),image=el('img','sc-reader-portrait');image.src='/store/art/readers/'+id+'.webp';image.alt=reader.name;image.width=110;image.height=138;
      const copy=el('div');const title=el('h3','',reader.title+' '+reader.name);title.tabIndex=-1;copy.append(el('p','sc-kicker','MEET YOUR READER'),title,el('p','',reader.tag),el('p','sc-meta',reader.spec));top.append(image,copy);detail.append(top);
      const products=selectCollectionProducts({reader:id});detail.append(el('h4','sc-subtitle',products.length?'이 술사가 들려주는 이야기':'삼라의 목소리'));
      const shelf=el('div','sc-product-grid');products.forEach(product=>shelf.append(productCard(product,data)));detail.append(shelf);
      if(!products.length)detail.append(el('p','sc-note','현재 담당 리포트가 없어요. 다른 술사의 이야기도 둘러보세요.'));
      const close=button('소개 접기','sc-text-button');listen(close,'click',()=>{detail.hidden=true;if(opener.isConnected)opener.focus();});detail.append(close);title.focus({preventScroll:true});detail.scrollIntoView?.({behavior:'smooth',block:'nearest'});
    }
    function render(){grid.replaceChildren();const readers=Object.entries(data.readers).filter(([,reader])=>matches([reader.name,reader.title,reader.tag,reader.spec].join(' '),search.input.value));notice.textContent=readers.length+'명의 술사';readers.forEach(([id,reader])=>{const card=button('','sc-reader');const image=el('img');image.src='/store/art/readers/'+id+'.webp';image.alt='';image.width=96;image.height=120;image.loading='lazy';card.append(image,el('span','sc-category',reader.title),el('strong','',reader.name),el('span','sc-reader-spec',reader.spec),el('span','sc-reader-more','이야기 만나기 →'));listen(card,'click',()=>showReader(id,card));grid.append(card);});if(!readers.length)grid.append(el('p','sc-empty','다른 이름이나 분위기로 찾아보세요.'));}
    listen(search.input,'input',render);render();onView?.(view,{count:Object.keys(data.readers).length});return cleanup;
  }

  if(view==='catalog'){
    heading(root,'A BOOK FOR YOUR QUESTION','지금의 질문에, 한 권의 이야기','고민으로 골라보거나, 주제와 술사로 나에게 맞는 리포트를 찾아보세요.');
    const finder=el('section','sc-finder'),finderHost=el('div');finder.append(finderHost);root.append(finder);
    const controls=el('div','sc-controls'),search=searchField('리포트 찾기','질문, 제목, 술사 검색');
    const category=selectField('주제',[['all','모든 주제'],...Object.entries(data.categories).map(([id,item])=>[id,item.label])]);
    const reader=selectField('술사',[['all','모든 술사'],...Object.entries(data.readers).map(([id,item])=>[id,item.name])]);
    const sort=selectField('순서',[['recommended','편집 추천순'],['reading','짧게 읽는 순']]);controls.append(search.wrap,category.wrap,reader.wrap,sort.wrap);root.append(controls);
    const notice=status(root),grid=el('div','sc-product-grid');root.append(grid,el('p','sc-note','목차와 입력 조건은 상품 소개에서 확인할 수 있어요. 추천은 고른 질문과 구성을 기준으로 한 편집 안내예요.'));
    function render(){const products=selectCollectionProducts({query:search.input.value,category:category.select.value,reader:reader.select.value,sort:sort.select.value});grid.replaceChildren();products.forEach(product=>grid.append(productCard(product,data)));notice.textContent=products.length+'권의 리포트';if(!products.length)grid.append(el('p','sc-empty','조건에 맞는 리포트가 없어요. 주제나 술사를 바꿔보세요.'));}
    listen(search.input,'input',render);[category.select,reader.select,sort.select].forEach(node=>listen(node,'change',render));render();
    finderQueue=finderQueue.catch(()=>{}).then(async()=>{
      if(!active())return;
      // The canonical finder closes over its host. Serial mounting avoids global-selector collisions.
      if(document.querySelector('[data-report-finder]')){finder.append(link('고민으로 리포트 고르기','/store/','sc-link','catalog'));return;}
      finderHost.setAttribute('data-report-finder','');
      try{await script('/store/report-finder.js',null,true);}catch(_){if(active())finder.append(link('리포트 서가에서 고민으로 고르기','/store/','sc-link','catalog'));}finally{finderHost.removeAttribute('data-report-finder');}
    });
    await finderQueue;if(active())onView?.(view,{count:selectCollectionProducts().length});return cleanup;
  }

  heading(root,'MY PRIVATE BOOKSHELF','내가 간직한 리포트','이 브라우저에서 주문한 실제 리포트예요. 미결제·생성 중인 주문도 함께 표시돼요.');
  const loading=el('p','sc-status','보관함을 여는 중이에요…');root.append(loading);
  try{await script('/store/store-api.js',libraryApi);}catch(_){if(active()){loading.textContent='보관함을 열지 못했어요.';root.append(link('기존 보관함 열기','/store/library.html','sc-button','fallback'));}return cleanup;}
  if(!active())return cleanup;loading.remove();const api=libraryApi();
  const controls=el('div','sc-controls'),search=searchField('내 리포트 찾기','제목 또는 이름'),filter=selectField('상태',[['all','모든 상태'],...Object.entries(api.labels)]),refresh=button('상태 다시 확인','sc-outline-button');controls.append(search.wrap,filter.wrap,refresh);root.append(controls);
  const notice=status(root),list=el('div','sc-library-list');root.append(list);
  const recovery=el('form','sc-recovery'),recoveryTitle=el('h3','','개인 복구 링크로 불러오기'),privacy=el('p','sc-note','링크를 가진 사람은 전체 리포트를 열 수 있어요. 본인만 보관해 주세요.'),label=el('label','sc-search','개인 복구 링크'),input=el('input');input.type='url';input.autocomplete='off';input.placeholder='https://samra.cc/store/recover/#rid=…';label.append(input);const importButton=button('리포트 불러오기','sc-outline-button');importButton.type='submit';const error=el('p','sc-error');error.setAttribute('role','alert');recovery.append(recoveryTitle,privacy,label,importButton,error);root.append(recovery,el('p','sc-note','다른 브라우저·기기의 기록은 자동으로 동기화되지 않아요. PDF는 완성된 리포트를 열어 저장할 수 있어요.'),link('주문·리포트 문의처','/legal/business/','sc-link','support'));
  function renderLibrary(){
    const all=api.all().sort((a,b)=>(Number(b.at)||Date.parse(b.created_at)||0)-(Number(a.at)||Date.parse(a.created_at)||0));
    const entries=all.filter(entry=>matches([entry.title,entry.name,entry.sig].join(' '),search.input.value)&&(filter.select.value==='all'||api.state(entry)===filter.select.value));list.replaceChildren();
    entries.forEach(entry=>{
      const product=Object.hasOwn(data.bySlug,entry.slug)?data.bySlug[entry.slug]:null,card=el('article','sc-library-entry'),copy=el('div','sc-library-copy');
      const title=entry.title||product?.title||'사주 리포트';copy.append(el('h3','',title));
      const date=new Date(entry.at||entry.created_at);copy.append(el('p','sc-meta',[entry.name?entry.name+'님':'',Number.isFinite(date.getTime())?date.toLocaleDateString('ko-KR'):''].filter(Boolean).join(' · ')),el('span','sc-library-state',api.labels[api.state(entry)]||'상태 확인 중'));
      const reportUrl='/store/report.html#rid='+encodeURIComponent(entry.rid);const actions=el('div','sc-library-actions');actions.append(link('리포트 열기',reportUrl,'sc-button','report'));
      if(api.state(entry)==='ready')actions.append(link('열어서 PDF 저장',reportUrl,'sc-link','pdf'));
      const copyLink=button('개인 복구 링크 복사','sc-text-button');listen(copyLink,'click',async()=>{try{await navigator.clipboard.writeText(api.recoveryUrl(entry.rid));if(active())notice.textContent='개인 복구 링크를 복사했어요. 본인만 안전하게 보관해 주세요.';}catch(_){if(active()){input.value=api.recoveryUrl(entry.rid);input.focus();input.select();notice.textContent='복구 링크를 선택했어요. 복사해서 본인만 보관해 주세요.';}}});actions.append(copyLink);if(product)card.append(cover(product));copy.append(actions);card.append(copy);list.append(card);
    });
    if(!entries.length){const empty=el('div','sc-empty',all.length?'조건에 맞는 리포트가 없어요.':'이 브라우저에 저장된 리포트가 없어요.');empty.append(link('리포트 둘러보기','/store/','sc-link','catalog'));list.append(empty);}
  }
  async function refreshLibrary(){refresh.disabled=true;notice.textContent='주문 상태를 확인하고 있어요.';try{await api.refresh(api.all());if(active()){renderLibrary();notice.textContent='저장된 주문의 상태를 확인했어요.';}}catch(_){if(active())notice.textContent='연결이 원활하지 않아 저장된 상태를 보여드려요. 리포트를 열거나 다시 확인해 주세요.';}finally{if(active())refresh.disabled=false;}}
  listen(search.input,'input',renderLibrary);listen(filter.select,'change',renderLibrary);listen(refresh,'click',refreshLibrary);
  listen(window,'storage',event=>{if(event.key==='samra_store_library'||event.key===null)renderLibrary();});
  listen(recovery,'submit',async event=>{event.preventDefault();error.textContent='';importButton.disabled=true;try{const rid=await api.importLink(input.value);if(!active())return;renderLibrary();const href='/store/report.html#rid='+encodeURIComponent(rid);if(navigate)navigate(href,{view,kind:'report'});else location.assign(href);}catch(failure){if(active())error.textContent=api.error(failure);}finally{if(active())importButton.disabled=false;}});
  renderLibrary();notice.textContent='이 브라우저의 개인 보관함이에요.';if(api.all().length)void refreshLibrary();onView?.(view,{count:api.all().length});return cleanup;
}
