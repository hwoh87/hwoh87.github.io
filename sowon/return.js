import { readJourney } from './hub-core.js?v=20261101-sanctuary2';

// This explicit return link carries no report, birthday or return URL. It only
// appears after a visitor leaves the sanctuary from this browser tab.
let journey;
try { journey = readJourney(sessionStorage); } catch (_) {}
if (journey?.pending && !location.pathname.startsWith('/sowon/')) {
  const link = document.createElement('a');
  link.href = '/sowon/';
  link.rel = 'noreferrer';
  link.className = 'samra-shrine-return';
  link.textContent = '☾ 신당으로 돌아가기';
  link.setAttribute('aria-label', '소원당의 원래 자리로 돌아가기');
  const style = document.createElement('style');
  style.textContent = '.samra-shrine-return{position:fixed;z-index:900;left:16px;bottom:max(16px,env(safe-area-inset-bottom));display:flex;align-items:center;min-height:40px;padding:8px 15px;box-sizing:border-box;background:#213d35ee;color:#ede8d3!important;font:500 12px/1.5 sans-serif!important;letter-spacing:0!important;border:1px solid #b9c9a777;border-radius:28px;text-decoration:none!important;box-shadow:0 4px 18px #0003;backdrop-filter:blur(10px)}.samra-shrine-return:focus-visible{outline:3px solid #d0c7a0;outline-offset:3px}@media print{.samra-shrine-return{display:none}}';
  document.head.appendChild(style);
  document.body.appendChild(link);
}
