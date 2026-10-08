/* One catalogue, searchable without sending personal queries to analytics. */
(function () {
  const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  let category = 'all';
  const byId = id => document.getElementById(id);
  try {
    const saved = JSON.parse(sessionStorage.getItem('samra_store_filters') || 'null');
    if (saved) {
      category = saved.category === 'all' || Object.prototype.hasOwnProperty.call(CATS,saved.category) ? saved.category : 'all';
      byId('shopSearch').value = typeof saved.query === 'string' ? saved.query.slice(0,200) : '';
      byId('shopSort').value = saved.sort === 'reading' ? 'reading' : 'recommended';
    }
  } catch (_) {}
  const people = p => STORE_INPUT[p.slug] === 'pair' ? '두 사람' : STORE_INPUT[p.slug] === 'pet' ? '나와 반려동물' : '한 사람';
  const card = p => `<a class="shop-card" data-cta="store-product-${p.slug}" href="/store/product.html?id=${p.slug}"><div class="shop-cover"><img src="/store/art/covers/${p.slug}.webp" alt="" loading="lazy" width="400" height="300"></div><div class="shop-card-body"><span class="shop-category">${esc(CATS[p.cat].label)} · ${esc(READERS[p.reader].name)}</span><h3>${esc(p.title)}</h3><p class="shop-question">${esc(p.kicker || p.bullets)}</p><p class="shop-details">${people(p)} · ${p.chaptersN}장 · 약 ${p.readMin}분</p><strong>${won(priceOf(p.slug))}</strong></div></a>`;
  function render() {
    byId('chips').querySelectorAll('button').forEach(button => {
      const selected = button.dataset.category === category;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    try {sessionStorage.setItem('samra_store_filters',JSON.stringify({query:byId('shopSearch').value,category,sort:byId('shopSort').value}));} catch (_) {}
    const products = selectStoreProducts({query: byId('shopSearch').value, category, sort: byId('shopSort').value === 'reading' ? 'reading' : 'recommended'});
    byId('shopCount').textContent = `${products.length}개의 리포트`;
    byId('groups').innerHTML = products.length ? products.map(card).join('') : '<div class="shop-empty"><h3>맞는 리포트를 찾지 못했어요</h3><p>다른 단어로 검색하거나 전체 카테고리를 선택해 주세요.</p><button type="button" id="shopReset">검색 조건 초기화</button></div>';
    byId('shopReset')?.addEventListener('click', () => { byId('shopSearch').value = ''; category = 'all'; render(); byId('shopSearch').focus(); });
  }
  function renderChips() {
    byId('chips').innerHTML = [['all',{label:'전체'}],...Object.entries(CATS)].map(([id,c]) => `<button type="button" class="chip${id===category?' selected':''}" data-category="${id}" aria-pressed="${id===category}">${esc(c.label)}</button>`).join('');
    byId('chips').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { category = button.dataset.category; render(); }));
  }
  byId('priceNow').textContent = won(Math.min(PRICING.solo,PRICING.pair,PRICING.pet))+'부터';
  byId('productCount').textContent = PRODUCTS.filter(p=>storeAvailable(p)).length;
  byId('featured').innerHTML = FEATURED.filter(p=>storeAvailable(p)).slice(0,3).map(card).join('');
  byId('readersRail').innerHTML = Object.entries(READERS).map(([id,r])=>`<div class="reader-card"><div class="ph"><img src="/store/art/readers/${id}.webp" alt="" loading="lazy"></div><div class="txt"><div class="role">${esc(r.title)}</div><h4>${esc(r.name)}</h4><p>${esc(r.tag)}</p></div></div>`).join('');
  byId('shopSearch').addEventListener('input',render); byId('shopSort').addEventListener('change',render);
  renderChips(); render();
  // rem-based media query follows browser font settings; OS text enlargement also changes the probe.
  const probe = document.createElement('span'); probe.style.cssText='position:absolute;visibility:hidden;font-size:1rem'; probe.textContent='M'; document.body.appendChild(probe);
  function fontLayout(){document.documentElement.classList.toggle('large-text',parseFloat(getComputedStyle(probe).fontSize)>=20);}
  fontLayout(); if(window.ResizeObserver)new ResizeObserver(fontLayout).observe(probe);
})();
