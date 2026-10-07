/* 웹 리포트 장 이동. 고객 본문을 새로 저장하거나 전송하지 않는다. */
function reportContentsHtml(chapters) {
  if (!Array.isArray(chapters) || chapters.length < 2) return "";
  return '<nav class="rp-contents" id="report-contents" tabindex="-1" aria-label="리포트 목차">' +
    '<details open><summary>목차 · ' + chapters.length + '장</summary><ol>' +
    chapters.map((ch, i) => '<li><a href="#report-chapter-' + i + '">' + escHtml(ch.title) + '</a></li>').join('') +
    '</ol></details></nav>';
}

/* Store only a chapter id and an offset, never the report body. */
function bindReadingPosition(rid) {
  const key = 'samra_store_reading_' + rid;
  // Keep the recovery fragment stable while navigating chapters so reload still opens this report.
  document.getElementById('paperIn').addEventListener('click', event => {
    const link = event.target.closest?.('a[href^="#report-"]');
    if (!link) return;
    const target = document.getElementById(link.getAttribute('href').slice(1));
    if (!target) return;
    event.preventDefault();
    target.scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
    target.focus({preventScroll:true});
  });
  let restored = false;
  try {
    const value = JSON.parse(localStorage.getItem(key) || 'null');
    const target = value && document.getElementById(value.chapter);
    if (target && /^report-chapter-\d+$/.test(value.chapter)) {
      requestAnimationFrame(() => { window.scrollTo({top:target.getBoundingClientRect().top + window.scrollY + Math.max(0,Number(value.offset)||0),behavior:'instant'}); });
      restored = true;
    }
  } catch (_) {}
  const save = () => {
    const chapters = Array.from(document.querySelectorAll('.rp-ch'));
    let current = chapters[0];
    for (const chapter of chapters) if (chapter.getBoundingClientRect().top <= 160) current = chapter;
    if (!current) return;
    try { localStorage.setItem(key, JSON.stringify({chapter:current.id,offset:Math.max(0,-current.getBoundingClientRect().top)})); } catch (_) {}
  };
  let timer;
  window.addEventListener('scroll',()=>{clearTimeout(timer);timer=setTimeout(save,180);},{passive:true});
  window.addEventListener('pagehide',save);
  return restored;
}
