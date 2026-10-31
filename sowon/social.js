import { getOwnProfile } from './profile.js?v=20261101-editorial1';
import { RELATION_KINDS, safePosition, serverProfile, sameServerProfile, safeVisitors, safeRequests, availableActions, safeResult, socialError, cleanText, createSocialClient } from './social-core.js';

let storage;
try { storage = sessionStorage; } catch (_) {}
const client = createSocialClient({ storage });
const dialog = document.createElement('dialog');
dialog.id = 'socialDialog'; dialog.className = 'social-dialog'; dialog.setAttribute('aria-labelledby', 'socialTitle');
document.body.appendChild(dialog);
const state = { joined: false, joining: false, busy: false, stale: false, selfId: '', visitors: [], requests: [], tab: 'visitors', selected: null, kind: 'FRIEND', deleteArmed: false, confirm: null, result: null, resultId: null, error: '', status: '' };
let opener, timer, refreshPromise, operation = 0, resultVersion = 0, visibilityVersion = 0, lastProfile = '';
let config = {};
const controllers = new Set();
const announcedRequests = new Set();
const liveAnnouncement = document.createElement('p');
liveAnnouncement.className = 'social-live-announcement'; liveAnnouncement.setAttribute('role', 'status'); liveAnnouncement.setAttribute('aria-live', 'polite'); liveAnnouncement.setAttribute('aria-atomic', 'true'); document.body.appendChild(liveAnnouncement);
export function configureSocial(options = {}) { config = { ...config, ...options }; }
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const button = (action, label, extra = '') => `<button type="button" data-social-action="${action}" ${extra}>${label}</button>`;
const profile = () => (config.getProfile || getOwnProfile)();
lastProfile = JSON.stringify(serverProfile(profile()));
function snapshot() {
  if (config.getPosition) return safePosition(config.getPosition());
  const capture = { snapshot: null }; document.dispatchEvent(new CustomEvent('sowon:capture-social', { detail: capture }));
  return safePosition(capture.snapshot || {});
}
function updateLauncher() {
  const pending = state.requests.filter(request => request.direction === 'incoming' && request.status === 'pending');
  document.querySelectorAll('[data-open-social]').forEach(launcher => {
    let badge = launcher.querySelector('.social-launcher-badge');
    if (!badge) { badge = document.createElement('span'); badge.className = 'social-launcher-badge'; badge.setAttribute('aria-hidden', 'true'); launcher.appendChild(badge); }
    badge.textContent = String(pending.length); badge.hidden = pending.length === 0;
    launcher.setAttribute('aria-label', `함께 있는 나그네와 궁합${pending.length ? `, 받은 궁합 요청 ${pending.length}개` : ''}`);
    launcher.title = state.joined ? state.stale ? '만남에 다시 연결하고 있어요' : `만남 참여 중 · 다른 나그네 ${state.visitors.length}명` : '함께 있는 나그네와 궁합';
    launcher.dataset.socialConnected = String(state.joined && !state.stale);
  });
  const fresh = pending.filter(request => !announcedRequests.has(request.id));
  pending.forEach(request => announcedRequests.add(request.id));
  if (fresh.length) {
    const message = fresh.length === 1 ? `${fresh[0].peer.nickname}에게서 새 궁합 요청이 왔어요. 함께 걷기에서 확인해 주세요.` : `새 궁합 요청 ${fresh.length}개가 왔어요. 함께 걷기에서 확인해 주세요.`;
    liveAnnouncement.replaceChildren(document.createTextNode(message));
  }
}
function emitPresence() {
  updateLauncher();
  document.dispatchEvent(new CustomEvent('sowon:social-presence', { detail: { selfId: state.selfId, visitors: state.joined && !state.stale ? state.visitors.map(v => ({ ...v })) : [] } }));
  const incoming = state.requests.filter(r => r.direction === 'incoming' && r.status === 'pending').length;
  document.dispatchEvent(new CustomEvent('sowon:social-state', { detail: { joined: state.joined, connected: state.joined && !state.stale, count: state.visitors.length, incoming } }));
}
function resetTransient() { ++resultVersion; state.result = null; state.resultId = null; state.confirm = null; state.selected = null; state.deleteArmed = false; }
function statusText(status) { return ({ pending: '승인을 기다려요', approved: '함께 볼 수 있어요', declined: '이번에는 사양했어요', cancelled: '요청을 취소했어요', revoked: '공유가 철회됐어요', expired: '시간이 지났어요' })[status] || ''; }
function requestActions(request) {
  const labels = { approve: '승인하고 함께 보기', decline: '사양하기', cancel: '요청 취소', result: '궁합 다시 보기', revoke: '공유 철회' };
  return availableActions(request).map(action => button(action, labels[action], `data-request-id="${request.id}" ${action === 'approve' || action === 'result' ? 'class="social-primary"' : ''}`)).join('');
}
function visitorCard(visitor) {
  const active = state.requests.find(r => r.peer.id === visitor.id && ['pending', 'approved'].includes(r.status));
  const selected = state.selected === visitor.id;
  const here = snapshot(), distance = Math.hypot(here.x - visitor.x, here.z - visitor.z), nearby = distance <= 8;
  return `<article class="social-person"><div class="social-avatar social-cloth-${visitor.outfit}" aria-hidden="true">人</div><div class="social-person-main"><h3>${esc(visitor.nickname)}</h3><p>${active ? statusText(active.status) : (nearby ? '가까이에 머무는 나그네' : '마당을 산책하는 나그네')}</p></div>${button('choose', selected ? '접기' : '궁합 나누기', `data-visitor-id="${visitor.id}" aria-expanded="${selected}"`)}${selected ? `<div class="social-request-compose"><label>어떤 인연으로 만날까요?<select data-social-kind>${Object.entries(RELATION_KINDS).map(([key, label]) => `<option value="${key}" ${key === state.kind ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p>요청을 보내는 것은 내 결과 공유에 동의하는 뜻이에요. 상대도 승인해야 두 사람이 같은 결과를 볼 수 있어요.</p>${!nearby ? `<p>서로 가까이 있어야 인연을 청할 수 있어요.</p>${button('approach', '이 나그네에게 다가가기', `class="social-primary" data-visitor-id="${visitor.id}"`)}` : active ? `<p>이미 나누고 있는 소식이 있어요. ‘궁합 소식’에서 이어 보세요.</p>${button('news', '궁합 소식 열기')}` : button('request', '이 관계로 궁합 요청', `class="social-primary" data-visitor-id="${visitor.id}"`)}</div>` : ''}</article>`;
}
function requestCard(request) {
  return `<article class="social-request"><div class="social-request-label"><span>${request.direction === 'incoming' ? '받은 요청' : '보낸 요청'}</span><small>${esc(RELATION_KINDS[request.kind])}</small></div><h3>${esc(request.peer.nickname)}${request.direction === 'incoming' ? '에게서 온 궁합 초대' : '에게 보낸 궁합 초대'}</h3><p>${statusText(request.status)}</p><div class="social-request-actions">${requestActions(request)}</div></article>`;
}
function resultMarkup() {
  const r = state.result, request = state.requests.find(item => item.id === state.resultId);
  if (!r || !request || request.status !== 'approved') return '';
  const names = r.names.a && r.names.b ? `${r.names.a} · ${r.names.b}` : `${profile()?.nickname || '나'} · ${request.peer.nickname}`;
  const text = value => esc(value).replace(/(^|[^A-Za-z])([AB])(?![A-Za-z])/g, (_m, pre, who) => pre + esc(who === 'A' ? r.names.a || '첫 번째 나그네' : r.names.b || '두 번째 나그네'));
  const section = (title, values, content) => values.length ? `<section class="social-result-section"><h3>${title}</h3>${values.map(content).join('')}</section>` : '';
  return `<div class="social-result">${button('news', '← 궁합 소식으로')}<p class="social-eyebrow">${esc(RELATION_KINDS[request.kind])} · 두 사람만의 해석</p><h3 class="social-pair-names">${esc(names)}</h3><div class="social-score" style="--score:${r.totalScore}"><strong>${r.totalScore < 10 ? '측정 어려움' : `${r.totalScore}<small>점</small>`}</strong></div><h4 class="social-verdict">${text(r.verdict)}</h4><p class="social-result-note">${r.confidence === null ? '' : `분석 신뢰도 ${r.confidence}% · `}삼라 궁합 엔진으로 계산했어요.${r.unknownTimeA || r.unknownTimeB ? ' 시간 미상이 포함되어 시주 풀이는 제외했어요.' : ''}</p><div class="social-subs">${Object.entries({ bond: '결속력', stability: '안정성', growth: '성장성', consumption: '소모도' }).filter(([key]) => r.subScores[key] !== null).map(([key, label]) => `<div><span>${label}</span><strong>${r.subScores[key]}</strong></div>`).join('')}</div>${section('두 사람을 관통하는 이야기', r.narrative, row => `<article><h4>${esc(row.icon)} ${esc(row.label)}</h4><p>${text(row.text)}</p></article>`)}${section('함께 살릴 강점', r.strengths, row => `<article><h4>${esc(row.emoji)} ${esc(row.label)}</h4><p>${text(row.sub)}</p></article>`)}${section('서로 알아둘 조율점', r.cautions, row => `<article><h4>${esc(row.emoji)} ${esc(row.label)}</h4><p>${text(row.sub)}</p></article>`)}${r.iljuPair ? `<section class="social-result-section"><h3>일주가 만나는 결</h3><article><h4>${text(r.iljuPair.headline)}</h4><p>${text(r.iljuPair.detail)}</p><p>${text(r.iljuPair.advice)}</p></article></section>` : ''}${section('관계의 바탕', r.axes, row => `<article><span class="social-axis-tone">${esc(row.name)} · ${esc(row.tone)}</span><h4>${text(row.headline)}</h4><p>${text(row.detail)}</p></article>`)}<p class="social-result-note">점수는 서로의 방식을 이해하는 참고예요. 출생 원문은 상대에게 공개하지 않아요. 한 사람이 철회하면 이 화면을 다시 열 수 없어요.</p>${button('revoke', '이 궁합의 공유 철회', `data-request-id="${request.id}"`)}</div>`;
}
function deleteButton() { return button('delete', state.deleteArmed ? '한 번 더 눌러 내 정보와 모든 공유 지우기' : '서버의 내 정보와 공유 지우기', state.deleteArmed ? 'class="social-delete-confirm"' : ''); }
function consentMarkup() {
  const own = profile();
  return `<div class="social-welcome"><span class="social-knot" aria-hidden="true">∞</span><p class="social-eyebrow">AN ENCOUNTER IN THE GARDEN</p><h3>같은 마당에서,<br>서로의 결을 알아가요.</h3><p>이곳에 실제로 머무는 사람에게 궁합을 청하고, 두 사람의 승인이 모이면 같은 해석을 함께 볼 수 있어요.</p><ol><li>내 출생 정보를 먼저 준비해요.</li><li>닉네임과 캐릭터 모습·현재 위치가 마당에 보여요.</li><li>출생 정보는 계산을 위해 서버에 보관하며 상대에게 원문을 보여주지 않아요.</li><li>보낸 사람의 동의와 받은 사람의 승인이 모이면 두 참여자만 사주 특성이 담긴 궁합 해석을 열 수 있어요. 언제든 공유를 철회할 수 있어요.</li></ol><p class="social-retention">만남 연결과 서버의 정보는 최대 24시간 동안 유효해요. 이 탭에서 다시 참여해 승인한 궁합을 이어 볼 수 있고, ‘서버의 내 정보와 공유 지우기’로 먼저 지울 수도 있어요. 내 캐릭터의 기기 기억 설정은 별도로 유지돼요.</p>${own ? `<p class="social-own-name">오늘 만날 이름 <strong>${esc(own.nickname || '나그네')}</strong> ${button('profile', '내 정보 수정')}</p><label class="social-consent"><input type="checkbox" data-social-consent>위 공개·보관 범위를 확인했고, 만남에 참여할게요.</label>${button('join', state.joining ? '만남을 준비하고 있어요…' : '동의하고 마당에서 만나기', `class="social-primary" ${state.joining ? 'disabled' : ''}`)}` : `<p class="social-empty">태어난 날짜·시간과 성별을 저장하면 준비가 끝나요.</p>${button('profile', '내 캐릭터 정보 준비하기', 'class="social-primary"')}`}</div>`;
}
function confirmMarkup() {
  const confirmation = state.confirm;
  if (!confirmation) return '';
  const request = state.requests.find(item => item.id === confirmation.id);
  if (!request) return '';
  const approve = confirmation.action === 'approve';
  return `<section class="social-confirm" role="region" aria-label="${approve ? '궁합 승인 확인' : '공유 철회 확인'}"><p class="social-eyebrow">${approve ? 'TWO YESSES, ONE READING' : 'YOUR CHOICE, ALWAYS'}</p><h3>${approve ? `${esc(request.peer.nickname)}와 궁합을 함께 볼까요?` : '이 궁합의 공유를 철회할까요?'}</h3><p>${approve ? `${esc(RELATION_KINDS[request.kind])} 관계로 계산해요. 승인하면 두 사람이 사주 특성이 담긴 같은 궁합 해석을 볼 수 있어요. 출생 원문은 서로에게 공개되지 않아요.` : '두 사람 모두 이 결과를 다시 열 수 없게 돼요. 이미 본 내용을 되돌리거나 별도로 저장한 화면까지 지울 수는 없어요.'}</p><div>${button('confirm', approve ? '승인하고 우리 궁합 보기' : '공유 철회하기', `class="social-primary" data-request-id="${request.id}" data-decision="${confirmation.action}"`)}${button('dismiss-confirm', '돌아가기')}</div></section>`;
}
function render() {
  if (!dialog.open) return;
  const focusAction = document.activeElement?.dataset?.socialAction;
  const focusRequest = document.activeElement?.dataset?.requestId;
  const count = state.requests.filter(r => r.direction === 'incoming' && r.status === 'pending').length;
  dialog.innerHTML = `<header class="social-header"><div><p>MEET A FELLOW TRAVELER</p><h2 id="socialTitle">마당의 인연</h2></div>${button('close', '×', 'class="social-close" aria-label="마당의 인연 닫기"')}</header><div class="social-body">${state.error ? `<p class="social-error" role="alert">${esc(state.error)}</p>` : ''}${state.status ? `<p class="social-status" role="status">${esc(state.status)}</p>` : ''}${state.joined ? `<div class="social-connected"><span class="social-live-dot ${state.stale ? 'social-disconnected' : ''}" aria-hidden="true"></span><span>${state.stale ? '다시 연결하고 있어요' : '실제 나그네와 연결되어 있어요'}</span>${button('refresh', '새로고침', state.busy ? 'disabled' : '')}</div><nav class="social-tabs" aria-label="만남과 궁합"><button type="button" data-social-action="visitors" aria-pressed="${state.tab === 'visitors'}">만난 나그네 <span>${state.visitors.length}</span></button><button type="button" data-social-action="news" aria-pressed="${state.tab === 'news'}">궁합 소식 ${count ? `<span class="social-count">${count}</span>` : ''}</button></nav>${state.confirm ? confirmMarkup() : state.result ? resultMarkup() : state.tab === 'visitors' ? `<p class="social-lead">${state.stale ? '연결이 회복되면 다시 현재 나그네를 보여드려요.' : '캐릭터를 누르거나 이 목록에서 인연을 청해 보세요.'}</p><div class="social-people">${!state.stale && state.visitors.length ? state.visitors.map(visitorCard).join('') : `<p class="social-empty">${state.stale ? '아직 만남 정보를 확인하지 못했어요.' : '아직 다른 나그네가 없어요. 마당을 산책하며 기다려 보세요.'}</p>`}</div>` : `<p class="social-lead">승인 전에는 결과가 열리지 않아요. 서로의 동의는 언제든 거둘 수 있어요.</p><div class="social-requests">${state.requests.length ? state.requests.map(requestCard).join('') : '<p class="social-empty">아직 주고받은 궁합 요청이 없어요.</p>'}</div>`}<footer class="social-session-actions">${button('leave', '마당의 만남 잠시 끄기')}${deleteButton()}</footer>` : `${consentMarkup()}${client.hasSession() ? `<footer class="social-session-actions">${deleteButton()}</footer>` : ''}`}</div><footer class="social-footer">닉네임·캐릭터·위치만 공개 · 출생 원문은 나만 확인</footer>`;
  dialog.querySelectorAll('button').forEach(node => { if (state.busy && !['close'].includes(node.dataset.socialAction)) node.disabled = true; });
  if (focusAction) {
    const match = [...dialog.querySelectorAll('[data-social-action]')].find(node => node.dataset.socialAction === focusAction && (!focusRequest || node.dataset.requestId === focusRequest));
    match?.focus({ preventScroll: true });
  }
}
function stopPolling() { clearTimeout(timer); timer = null; }
function schedule() { stopPolling(); if (state.joined && !document.hidden) timer = setTimeout(() => refresh(), 10000); }
async function api(action, params = {}) {
  const abort = new AbortController(); controllers.add(abort);
  const timeout = setTimeout(() => abort.abort(), 18000);
  try { return await client.call(action, params, { signal: abort.signal }); }
  finally { clearTimeout(timeout); controllers.delete(abort); }
}
function adopt(data) {
  state.selfId = cleanText(data.self_id, 80) || state.selfId;
  state.visitors = safeVisitors(data.visitors, state.selfId);
  state.requests = safeRequests(data.requests);
  state.stale = false;
  if (state.resultId && !state.requests.some(item => item.id === state.resultId && item.status === 'approved')) {
    resetResult(); state.status = '공유 상태가 바뀌었어요. 궁합 소식에서 확인해 주세요.';
  }
  if (state.confirm && !state.requests.some(item => item.id === state.confirm.id && availableActions(item).includes(state.confirm.action))) state.confirm = null;
  emitPresence(); render();
}
async function refresh() {
  if (!state.joined || refreshPromise) return refreshPromise;
  const version = operation;
  const task = (async () => {
    try { const data = await api('presence', snapshot()); if (state.joined && version === operation && !document.hidden) adopt(data); }
    catch (error) {
      if (!state.joined || version !== operation) return;
      state.stale = true; state.visitors = []; resetResult(); state.error = socialError(error); emitPresence(); render();
      if (['invalid_session', 'session_expired'].includes(error?.code)) { state.joined = false; stopPolling(); client.clear(); emitPresence(); render(); }
    } finally { if (refreshPromise === task) refreshPromise = null; if (version === operation) schedule(); }
  })(); refreshPromise = task; return task;
}
async function join() {
  if (state.joining || !dialog.querySelector('[data-social-consent]')?.checked) { state.error = '공개·보관 범위를 확인하고 참여 동의를 체크해 주세요.'; render(); return; }
  const own = serverProfile(profile());
  if (!own) { state.error = '내 출생 정보를 먼저 준비해 주세요.'; render(); return; }
  const version = ++operation; state.joining = true; state.error = ''; state.status = ''; render();
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 18000); controllers.add(abort);
  try {
    await client.start(abort.signal);
    if (version !== operation) return;
    const existing = await api('profile_get');
    if (version !== operation) return;
    if (!sameServerProfile(existing.profile, own)) await api('profile_save', own);
    if (version !== operation) return;
    state.joined = true; lastProfile = JSON.stringify(own); if (document.hidden) { state.stale = true; emitPresence(); } else await refresh();
  } catch (error) { if (version === operation) { state.joined = false; if (['invalid_session', 'session_expired'].includes(error?.code)) client.clear(); state.error = socialError(error); } }
  finally { clearTimeout(timeout); controllers.delete(abort); if (version === operation) { state.joining = false; render(); } }
}
async function mutate(action, params, message) {
  if (state.busy || !state.joined) return;
  const version = operation; state.busy = true; state.error = ''; state.status = ''; render();
  try {
    const data = await api(action, params);
    if (version !== operation) return;
    resetTransient(); state.status = message; if (refreshPromise) await refreshPromise; if (version !== operation) return; await refresh();
    if (params.decision === 'approve' && data.request?.status === 'approved') await showResult(params.request_id);
  } catch (error) { if (version === operation) state.error = socialError(error); }
  finally { if (version === operation) { state.busy = false; render(); } }
}
async function showResult(id) {
  const request = state.requests.find(item => item.id === id && item.status === 'approved');
  if (!request) return;
  const version = operation, resultRequestVersion = ++resultVersion; state.error = ''; state.status = '';
  try {
    const data = await api('result', { request_id: id });
    if (version !== operation || resultRequestVersion !== resultVersion || !state.joined || state.stale || document.hidden || !state.requests.some(item => item.id === id && item.status === 'approved')) return;
    if (data.request?.status !== 'approved' || data.request.id !== id) throw Object.assign(new Error('result_revoked'), { code: 'result_revoked' });
    const result = safeResult(data.result);
    if (!result) throw new Error('bad_result');
    state.result = result; state.resultId = id; state.confirm = null; state.tab = 'news'; render(); dialog.querySelector('.social-body')?.scrollTo({ top: 0 });
  } catch (error) { if (version === operation) { state.error = socialError(error); state.result = null; state.resultId = null; await refresh(); render(); } }
}
async function leave({ remove = false } = {}) {
  ++operation; ++resultVersion; stopPolling(); for (const abort of controllers) abort.abort(); refreshPromise = null; state.joined = false; state.joining = false; state.busy = false; state.visitors = []; state.requests = []; state.selfId = ''; resetTransient(); emitPresence();
  state.error = '';
  state.status = remove ? '서버의 내 정보와 공유를 지우고 있어요…' : '마당의 만남을 잠시 껐어요. 이미 승인한 궁합은 다음 참여 때 이어 볼 수 있어요.'; render();
  try { if (client.hasSession()) await api(remove ? 'profile_delete' : 'leave'); if (remove) { client.clear(); state.status = '서버의 내 출생 정보와 공유를 지웠어요.'; } }
  catch (error) { state.error = remove ? '서버 삭제를 확인하지 못했어요. 연결을 확인하고 다시 지워 주세요.' : socialError(error); }
  render();
}
function open(visitorId) {
  if (dialog.open) { if (visitorId) { state.tab = 'visitors'; state.selected = visitorId; resetResult(); render(); } return; }
  if (document.querySelector('dialog[open]')) return;
  opener = document.activeElement; if (visitorId) { state.tab = 'visitors'; state.selected = visitorId; }
  dialog.showModal(); document.body.classList.add('dialog-open'); render();
  if (state.joined) refresh();
}
function resetResult() { ++resultVersion; state.result = null; state.resultId = null; state.confirm = null; }
function close() { state.deleteArmed = false; dialog.close(); }
dialog.addEventListener('click', async event => {
  const target = event.target.closest('[data-social-action]'); if (!target) return;
  const action = target.dataset.socialAction, id = target.dataset.requestId;
  if (!['delete', 'refresh'].includes(action)) state.deleteArmed = false;
  if (action === 'close') return close();
  if (action === 'profile') { close(); document.dispatchEvent(new CustomEvent('sowon:profile-open')); return; }
  if (state.busy) return;
  if (action === 'join') return join();
  if (action === 'refresh') { state.error = ''; return refresh(); }
  if (action === 'visitors' || action === 'news') { state.tab = action; resetResult(); render(); return; }
  if (action === 'approach') { const visitorId = target.dataset.visitorId; if (!state.visitors.some(v => v.id === visitorId)) return; close(); document.dispatchEvent(new CustomEvent('sowon:social-walk', { detail: { visitorId } })); return; }
  if (action === 'choose') { state.selected = state.selected === target.dataset.visitorId ? null : target.dataset.visitorId; render(); return; }
  if (action === 'request') {
    const kind = target.closest('.social-request-compose')?.querySelector('[data-social-kind]')?.value;
    if (!Object.hasOwn(RELATION_KINDS, kind) || !state.visitors.some(v => v.id === target.dataset.visitorId)) return;
    state.tab = 'news'; return mutate('request', { target_id: target.dataset.visitorId, kind }, '궁합 요청을 보냈어요. 상대의 승인을 기다려 주세요.');
  }
  const request = state.requests.find(item => item.id === id);
  if (action === 'approve' || action === 'revoke') { if (!request || !availableActions(request).includes(action)) return; resetResult(); state.confirm = { action, id }; render(); return; }
  if (action === 'dismiss-confirm') { state.confirm = null; render(); return; }
  if (action === 'confirm') {
    const decision = target.dataset.decision;
    if (!request || !availableActions(request).includes(decision) || state.confirm?.id !== id) return;
    return mutate('respond', { request_id: id, decision }, decision === 'approve' ? '두 사람의 승인이 모였어요.' : '이 궁합의 공유를 철회했어요.');
  }
  if (action === 'decline' || action === 'cancel') { if (!request || !availableActions(request).includes(action)) return; return mutate('respond', { request_id: id, decision: action }, action === 'decline' ? '이번 초대는 사양했어요.' : '보낸 요청을 취소했어요.'); }
  if (action === 'result') return showResult(id);
  if (action === 'leave') return leave();
  if (action === 'delete') {
    if (state.deleteArmed) return leave({ remove: true });
    state.deleteArmed = true; render();
  }
});
dialog.addEventListener('change', event => { if (event.target.matches('[data-social-kind]') && Object.hasOwn(RELATION_KINDS, event.target.value)) state.kind = event.target.value; });
dialog.addEventListener('close', () => { state.deleteArmed = false; resetResult(); if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); if (opener?.isConnected) opener.focus({ preventScroll: true }); } });
document.addEventListener('click', event => { if (event.target.closest?.('[data-open-social]')) { event.preventDefault(); open(); } });
document.addEventListener('sowon:social-open', event => open(event.detail?.visitorId));
document.addEventListener('sowon:profile-change', async () => {
  if (!state.joined && !state.joining && !client.hasSession()) { if (dialog.open) render(); return; }
  const next = serverProfile(profile()); if (next && JSON.stringify(next) === lastProfile) return;
  await leave({ remove: true }); if (!state.error) state.status = '내 정보가 바뀌어 이전 공유를 지웠어요. 공개 범위를 확인한 뒤 다시 참여해 주세요.'; render();
});
document.addEventListener('visibilitychange', async () => {
  const version = ++visibilityVersion;
  if (!state.joined) return;
  if (document.hidden) {
    stopPolling(); state.deleteArmed = false; resetResult(); state.visitors = []; state.stale = true; emitPresence(); render();
    if (refreshPromise) await refreshPromise;
    if (state.joined && document.hidden && version === visibilityVersion) client.call('leave').catch(() => {});
  } else {
    state.error = '';
    if (refreshPromise) await refreshPromise;
    if (state.joined && !document.hidden && version === visibilityVersion) refresh();
  }
});
window.addEventListener('pagehide', () => { stopPolling(); if (state.joined) client.call('leave', {}, { keepalive: true }).catch(() => {}); });

window.addEventListener('pageshow', event => { if (event.persisted && state.joined && !document.hidden) refresh(); });

updateLauncher();
