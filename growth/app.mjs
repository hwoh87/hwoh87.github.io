import {monetizationPolicy, revenueModel} from './policy.mjs';
const $ = id => document.getElementById(id);
let policy = monetizationPolicy('web');
function select(platform) {
  policy = monetizationPolicy(platform);
  ['web','android'].forEach(p => $(p).setAttribute('aria-pressed', String(p === platform)));
  $('platform-note').textContent = policy.rewarded ? '선택형 리워드 · 전면 광고는 첫날 제외, 3편 완료 후. 5분 간격 / 세션 1회 / 하루 2회.' : '설치 없이 무료 결과 → 리포트 미리보기. 강제 전면 광고 없음.';
  $('offer-title').textContent = policy.rewarded ? '더 궁금할 때만' : '내 사주, 한 장 먼저 읽기';
  $('offer-copy').textContent = policy.rewarded ? '시청 완료 후 인연 크레딧 1개. 융합 리포트는 포함되지 않아요. 기본 운세는 무료예요.' : '유료 리포트가 궁금하다면 먼저 미리보기로 확인하세요.';
  $('offer-button').textContent = policy.rewarded ? '광고 보상 시뮬레이션 ↗' : '리포트 미리보기 ↗';
  $('offer-status').textContent = '';
}
['web','android'].forEach(p => $(p).addEventListener('click', () => select(p)));
$('read').addEventListener('click', () => { $('briefing').hidden = !$('briefing').hidden; $('read').setAttribute('aria-expanded',String(!$('briefing').hidden)); });
const recordKey = `samra-growth-demo:${new Date().toLocaleDateString('en-CA')}`;
function recorded(){ $('record').disabled = true; $('record').textContent = '오늘의 기록을 남겼어요 ✓'; }
try { if(localStorage.getItem(recordKey)) recorded(); } catch {}
$('record').addEventListener('click', () => {try {localStorage.setItem(recordKey,'1');}catch {} recorded();});
$('offer-button').addEventListener('click', () => { $('offer-status').textContent = policy.rewarded ? '시뮬레이션 완료 · 실제 광고 재생 및 크레딧 적립 없음' : '샘플 목차: 나의 기질 → 관계의 흐름 → 일과 삶. 실제 리포트는 하단 스토어에서 확인하세요.'; });
function update(){try {const r = revenueModel({fx: Number($('fx').value), impressionsPerDau: Number($('imp').value)}); $('dau').textContent = Math.ceil(r.requiredDau).toLocaleString('ko-KR')+'명'; $('needed').textContent = '하루 광고 노출 약 '+Math.ceil(r.dailyImpressions).toLocaleString('ko-KR')+'회 필요';} catch {$('dau').textContent = '양수를 입력하세요';$('needed').textContent = '';}}
['fx','imp'].forEach(id=>$(id).addEventListener('input',update));update();
