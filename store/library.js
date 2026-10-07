(function () {
  const host = document.getElementById('list');
  const search = document.getElementById('librarySearch'), filter = document.getElementById('libraryFilter');
  const notice = document.getElementById('libraryNotice');
  function render() {
    const all = libAll().sort((a,b)=>(Number(b.at)||Date.parse(b.created_at)||0)-(Number(a.at)||Date.parse(a.created_at)||0)), query = search.value.trim().toLocaleLowerCase();
    const list = all.filter(x => (!query || [x.title,x.name,x.sig].join(' ').toLocaleLowerCase().includes(query)) && (filter.value === 'all' || libraryState(x) === filter.value));
    host.innerHTML = list.length ? list.map(x => {
      const p = Object.prototype.hasOwnProperty.call(PRODUCT_BY_SLUG,x.slug) ? PRODUCT_BY_SLUG[x.slug] : null;
      const date = x.at || x.created_at; const label = date ? new Date(date).toLocaleDateString('ko-KR') : '';
      return `<div class="lib-entry"><a class="lib-card" href="report.html#rid=${encodeURIComponent(x.rid)}">${p?`<img src="art/covers/${p.slug}.webp" alt="" loading="lazy">`:''}<div style="min-width:0"><p class="tt">${escHtml(x.title || p?.title || '사주 리포트')}</p><p class="mt">${escHtml(x.name || '')}${x.name?'님 · ':''}${escHtml(label)}</p><span class="lib-status">${LIBRARY_STATE_LABELS[libraryState(x)]}${x.total>0?` · ${x.completed||0}/${x.total}장`:''}</span></div><span class="go">열기 →</span></a><button type="button" class="lib-copy" data-rid="${escHtml(x.rid)}" aria-label="${escHtml(x.title || '리포트')} 개인 복구 링크 복사">복구 링크 복사</button></div>`;
    }).join('') : `<div class="lib-empty">${all.length?'조건에 맞는 리포트가 없어요.':'이 브라우저에 저장된 리포트가 없어요.'}<br><a href="/#tests">리포트 둘러보기 →</a></div>`;
    host.querySelectorAll?.('.lib-copy').forEach(button=>button.addEventListener('click',async()=>{
      const url=recoveryUrl(button.dataset.rid);
      try {await navigator.clipboard.writeText(url);notice.textContent='개인 복구 링크를 복사했어요. 링크 소지자는 전체 리포트를 열 수 있으니 본인만 보관해 주세요.';}
      catch(_){const input=document.getElementById('recoveryInput');input.value=url;input.focus();input.select();notice.textContent='아래 개인 복구 링크를 선택했어요. 복사해 보관해 주세요.';}
    }));
  }
  async function refresh() {
    notice.textContent='주문 상태를 확인하고 있어요.';
    try { await refreshLibraryStatus(libAll()); render(); notice.textContent=`${libAll().length}개의 리포트 · 상태 확인 완료`; }
    catch (_) { notice.textContent='연결이 원활하지 않아 저장된 상태를 보여드려요. 리포트를 열거나 상태를 다시 확인해 주세요.'; }
  }
  search.addEventListener('input',render); filter.addEventListener('change',render);
  document.getElementById('libraryRefresh').addEventListener('click',refresh);
  document.getElementById('recoveryImport').addEventListener('click',async () => {
    const button=document.getElementById('recoveryImport'), error=document.getElementById('recoveryError');
    button.disabled=true; error.textContent='';
    try {const rid=await importRecoveryLink(document.getElementById('recoveryInput').value);location.href='report.html#rid='+encodeURIComponent(rid);}
    catch(e){error.textContent=storeErrMsg(e);button.disabled=false;}
  });
  render(); if(libAll().length)refresh(); else notice.textContent='이 브라우저의 보관함 · 개인 복구 링크로 다른 기기에서도 열 수 있어요.';
})();
