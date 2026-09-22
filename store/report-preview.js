/* Catalog-backed format preview. No invented personal reading or paywalled sample. */
(() => {
  const host=document.getElementById('report-preview');
  if(!host || typeof PRODUCT_BY_SLUG==='undefined')return;
  const slug=new URLSearchParams(location.search).get('id');
  const p=PRODUCT_BY_SLUG[slug] || PRODUCTS[0];
  const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text)e.textContent=text;return e;};
  host.className='report-preview'; host.dataset.trackView='store-report-preview-'+p.slug;
  host.append(el('span','journey-kicker','구매 전, 구성부터'),el('h2','','한 권 안에 무엇이 담길까요?'),el('p','preview-note','상품 구성 미리보기예요. 개인 사주 결과나 유료 리포트 본문 샘플은 아니에요.'));
  const tabs=el('div','preview-tabs');tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','리포트 구성');
  const panels=el('div','preview-pages');
  const titles=['핵심 주제','계산 근거','읽을 목차'];
  const buttons=[];
  titles.forEach((title,i)=>{
    const b=el('button','',String(i+1).padStart(2,'0')+' '+title);b.type='button';b.id='preview-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','preview-page-'+i);
    const panel=el('div','preview-page');panel.id='preview-page-'+i;panel.setAttribute('role','tabpanel');panel.setAttribute('aria-labelledby',b.id);panel.tabIndex=0;
    panel.append(el('span','preview-number',String(i+1).padStart(2,'0')));
    if(i===0){panel.append(el('h3','',p.title),el('p','',p.deliver));}
    if(i===1){panel.append(el('h3','','이 주제를 읽는 명리의 근거'));const chips=el('div','preview-chips');p.axes.split('·').forEach(axis=>chips.append(el('span','',axis.trim())));panel.append(chips,el('p','','입력한 생년월일시로 계산한 명식과 분석지를 바탕으로 AI가 해석을 구성해요. 출생시간을 모르면 시주를 제외하며, 알게 되면 해석이 달라질 수 있어요.'));}
    if(i===2){panel.append(el('h3','',p.chaptersN+'장으로 이어지는 이야기'));const list=el('ol');p.chapters.slice(0,4).forEach(ch=>list.append(el('li','',ch)));panel.append(list);const a=el('a','','전체 '+p.chaptersN+'장 목차 펼쳐 보기 ↓');a.href='#report-contents';a.dataset.cta='store-report-preview-toc-'+p.slug;panel.append(a);}
    b.addEventListener('click',()=>select(i,true));
    b.addEventListener('keydown',e=>{let next;if(e.key==='ArrowRight')next=(i+1)%3;if(e.key==='ArrowLeft')next=(i+2)%3;if(e.key==='Home')next=0;if(e.key==='End')next=2;if(next!==undefined){e.preventDefault();select(next,true);buttons[next].focus();}});
    buttons.push(b);tabs.append(b);panels.append(panel);
  });
  function select(index,track=false){buttons.forEach((b,i)=>{b.setAttribute('aria-selected',String(i===index));b.tabIndex=i===index?0:-1;panels.children[i].hidden=i!==index;});if(track)window.__track?.('cta','store-report-preview-'+p.slug+'-'+(index+1));}
  host.append(tabs,panels);select(0);
  // The product body and preview are inserted after parsing. Reconcile a deep link
  // after images load so arrival from the finder reaches the promised preview.
  if(location.hash === '#report-preview') {
    const reveal=()=>host.scrollIntoView({block:'start',behavior:'instant'});
    if(document.readyState === 'complete')reveal();
    else window.addEventListener('load',reveal,{once:true});
  }
})();
