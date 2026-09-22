/* Editorial routing by the visitor's chosen question, not a personal saju diagnosis. */
(() => {
  const topics = [
    {id:'love', label:'연애·썸', mark:'♡', question:'연애에서 어떤 점이 궁금한가요?', options:[['나의 연애 성향부터','love-sal'],['상대와의 관계를 읽고 싶어요','love-mind'],['먼저 연락할지 고민돼요','contact-timing']]},
    {id:'pair', label:'궁합·결혼', mark:'合', question:'두 사람의 어떤 모습을 보고 싶나요?', options:[['전반적인 궁합','gunghap'],['결혼을 앞둔 관계','marriage'],['더 깊은 관계의 결','sok-hap']]},
    {id:'breakup', label:'이별·재회', mark:'↔', question:'지금 더 필요한 이야기는 무엇인가요?', options:[['헤어진 관계를 돌아보고 싶어요','why-breakup'],['다시 만날 가능성을 읽고 싶어요','reunion']]},
    {id:'work', label:'일·앞으로의 흐름', mark:'路', question:'어느 범위로 읽어보고 싶나요?', options:[['이직을 고민하고 있어요','job-change'],['앞으로 석 달을 넓게 보고 싶어요','three-months']]},
    {id:'money', label:'재물', mark:'財', question:'돈에 대해 무엇부터 살펴볼까요?', options:[['돈을 버는 성향과 새는 지출','money-bowl'],['2026년 하반기 월별 흐름','money-months','2026-12-31']]},
    {id:'self', label:'나·특별한 인연', mark:'緣', question:'어떤 이야기에 마음이 가나요?', options:[['겉과 다른 내면의 나','midnight-self'],['두 사람의 인연을 이야기로','past-life'],['반려동물과 나의 인연','pet-past-life']]},
  ];
  const host = document.querySelector('[data-report-finder]');
  if (!host || typeof PRODUCT_BY_SLUG === 'undefined') return;
  let topic = null;
  const el = (tag, cls, text) => {const e=document.createElement(tag); if(cls)e.className=cls; if(text)e.textContent=text; return e;};
  function track(label) { window.__track?.('cta',label); }
  function shell(step, title) {
    host.replaceChildren(); host.className='report-finder'; host.setAttribute('data-track-view','reading-options-guide');
    const top=el('div','finder-top'); top.append(el('span','journey-kicker','고민으로 찾는 리포트'),el('span','finder-step',step));
    const heading=el('h2','',title); heading.tabIndex=-1;
    host.append(top,heading);
    return heading;
  }
  function start(focus=false) {
    topic=null; const h=shell('1 / 2 · 주제','지금, 어떤 이야기가 필요한가요?');
    host.append(el('p','finder-note','생년월일 없이 두 번 고르면, 고민에 맞는 리포트를 소개해요.'));
    const grid=el('div','finder-grid'); grid.setAttribute('role','group'); grid.setAttribute('aria-label','관심 주제');
    topics.forEach(t=>{const b=el('button','finder-option'); b.type='button'; const mark=el('span','finder-mark',t.mark); mark.setAttribute('aria-hidden','true'); b.append(mark,el('span','',t.label)); b.addEventListener('click',()=>{topic=t;track('reading-interest-guide-'+t.id);choose();});grid.append(b);});
    host.append(grid); footer(); if(focus)h.focus({preventScroll:true});
  }
  function footer() {
    const p=el('p','finder-note'); const a=el('a','','무료로 내 명식부터 보기 →');a.href='/calc/';a.dataset.cta='calc-guide';p.append(a);host.append(p);
  }
  function back(label, fn) { const b=el('button','finder-back',label);b.type='button';b.addEventListener('click',fn);host.append(b); }
  function choose() {
    const h=shell('2 / 2 · 질문',topic.question); const grid=el('div','finder-grid finder-questions');
    const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Seoul'});
    topic.options.filter(o=>!o[2]||today<=o[2]).forEach(([label,slug])=>{const b=el('button','finder-option',label+' →');b.type='button';b.addEventListener('click',()=>{track('reading-interest-guide-'+slug);result(slug,label);});grid.append(b);});
    host.append(grid);back('← 주제 다시 고르기',()=>start(true));h.focus({preventScroll:true});
  }
  function result(slug, answer) {
    const p=PRODUCT_BY_SLUG[slug]; if(!p)return start(true);
    const h=shell('선택 완료','이 고민에는 이 리포트부터');
    host.append(el('p','finder-note','선택한 질문: '+answer));
    const card=el('div','finder-result');
    const img=el('img');img.src='/store/art/covers/'+p.slug+'.webp';img.alt='';img.width=100;img.height=140;img.loading='lazy';card.append(img);
    const copy=el('div');copy.append(el('h3','',p.title),el('p','',p.bullets),el('strong','finder-price',won(priceOf(p.slug))+' · '+p.chaptersN+'장'));
    const needs=STORE_INPUT[slug]==='pair'?'두 사람의 생년월일이 필요해요.':STORE_INPUT[slug]==='pet'?'내 생년월일과 반려동물 정보가 필요해요.':'내 생년월일로 읽는 리포트예요.';
    copy.append(el('p','finder-note',needs+' 구독 없이 단건 구매예요.'));
    const a=el('a','finder-primary','구성 미리보기 · 목차 확인 →');a.href='/store/product.html?id='+p.slug+'#report-preview';a.dataset.cta='reading-product-guide-'+p.slug;copy.append(a);card.append(copy);host.append(card);
    host.append(el('p','finder-note','고른 질문을 기준으로 소개한 상품이에요.'));
    back('← 질문 다시 고르기',choose);footer();h.focus({preventScroll:true});
  }
  start();
})();
