import { renderReadingVisuals } from './reading-visuals.js?v=20261101-report-visual3';
import { buildCompatibilityVisuals } from './compatibility-visual-data.js?v=20261101-report-visual3';
import { getOwnProfile } from './profile.js?v=20261101-report-visual3';
import { RELATION_KINDS, safePosition, serverProfile, safeVisitors, safeRequests, availableActions, safeResult, socialError, cleanText, createSocialClient, safeIlju, roomForKey, safeRoomCounts, validId } from './social-core.js?v=20261101-realtime3';
import { createRealtimeClient } from './realtime-client.js?v=20261101-realtime3';

let storage;
try { storage = sessionStorage; } catch (_) {}
const client = createSocialClient({ storage });
const dialog = document.createElement('dialog');
dialog.id = 'socialDialog'; dialog.className = 'social-dialog'; dialog.setAttribute('aria-labelledby', 'socialTitle');
document.body.appendChild(dialog);
const state = { joined: false, joining: false, busy: false, stale: false, realtime: false, selfId: '', visitors: [], requests: [], tab: 'visitors', selected: null, kind: 'FRIEND', deleteArmed: false, confirm: null, result: null, resultId: null, error: '', status: '', roomKey: 'courtyard', ownIlju: null, presenceEpoch: null, roomCounts: {}, switchingRoom: false, deletionPending: false };
let opener, timer, refreshPromise, operation = 0, resultVersion = 0, visibilityVersion = 0, lastProfile = '';
let config = {}, pendingRoom = null, leavePromise = null, leaveRemoves = false;
let realtime = null, realtimeGeneration = 0, socialRefreshQueued = false, heartbeatPromise = null, lastRequestStamp;
// Clicking an avatar keeps this dialog scoped to that one public identity.
let focusedPeerId = null, focusedPeer = null, focusedRoom = null, encounterVersion = 0;
const isPeerFocus = () => focusedPeerId !== null;
const focusedVisitor = () => state.joined && !state.stale && state.roomKey === focusedRoom ? state.visitors.find(visitor => visitor.id === focusedPeerId) : null;
const peerRequest = () => state.requests.find(request => request.peer.id === focusedPeerId && ['pending', 'approved'].includes(request.status)) || state.requests.find(request => request.peer.id === focusedPeerId);
export function getSocialRoomState() { return { joined: state.joined, connected: state.joined && !state.stale, realtime: state.joined && !state.stale && state.realtime, busy: state.busy || state.switchingRoom || state.joining || state.deletionPending || Boolean(leavePromise), roomKey: state.roomKey, ownIlju: state.ownIlju, roomCounts: { ...state.roomCounts } }; }
const controllers = new Set();
const announcedRequests = new Set();
const seenApprovals = new Set();
const liveAnnouncement = document.createElement('p');
liveAnnouncement.className = 'social-live-announcement'; liveAnnouncement.setAttribute('role', 'status'); liveAnnouncement.setAttribute('aria-live', 'polite'); liveAnnouncement.setAttribute('aria-atomic', 'true'); document.body.appendChild(liveAnnouncement);
const requestNotice = document.createElement('aside');
requestNotice.className = 'social-request-notice'; requestNotice.hidden = true; requestNotice.setAttribute('aria-label', '내 궁합 소식'); document.body.appendChild(requestNotice);
requestNotice.addEventListener('click', event => {
  const id = event.target.closest?.('[data-notice-peer]')?.dataset.noticePeer;
  if (!id || !state.joined || state.stale) return;
  const request = state.requests.find(item => item.peer.id === id && ['pending', 'approved'].includes(item.status));
  if (!request) return;
  if (request.status === 'approved') seenApprovals.add(request.id);
  open(id); updateLauncher();
});
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
function presencePayload(position, roomKey = state.roomKey) {
  return { ...position, room_key: roomKey, ...(Number.isInteger(state.presenceEpoch) ? { presence_epoch: state.presenceEpoch } : {}) };
}
function updateLauncher() {
  const pending = state.requests.filter(request => request.direction === 'incoming' && request.status === 'pending');
  const visible = state.joined && !state.stale;
  const approved = state.requests.filter(request => request.status === 'approved' && !seenApprovals.has(request.id));
  const notice = visible ? pending[0] || approved[0] : null;
  requestNotice.hidden = !notice;
  if (notice) {
    const incoming = notice.status === 'pending';
    requestNotice.innerHTML = `<span class="social-notice-mark" aria-hidden="true">${incoming ? '♡' : '✓'}</span><div><strong>${esc(notice.peer.nickname)}님${incoming ? '에게서 궁합 요청이 왔어요' : '과 궁합이 열렸어요'}</strong><p>${incoming ? '서로 승인한 뒤 두 사람만 볼 수 있어요.' : '상대가 승인했어요. 두 사람의 해석을 확인해 보세요.'}${pending.length > 1 ? ` · 받은 요청 ${pending.length}개` : ''}</p></div><button type="button" data-notice-peer="${esc(notice.peer.id)}">${incoming ? '요청 확인' : '궁합 보기'}</button>`;
  }
  document.dispatchEvent(new CustomEvent('sowon:social-requests', {detail: {states: visible ? state.requests.filter(request => ['pending', 'approved'].includes(request.status)).map(request => ({peerId:request.peer.id,phase:request.status === 'approved' ? 'approved' : `pending-${request.direction}`})) : []}}));
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
    const message = fresh.length === 1 ? `${fresh[0].peer.nickname}님에게서 새 궁합 요청이 왔어요. 요청 확인을 눌러 주세요.` : `새 궁합 요청 ${fresh.length}개가 왔어요. 요청 확인을 눌러 주세요.`;
    liveAnnouncement.replaceChildren(document.createTextNode(message));
  }
}
function emitPresence({ motionOnly = false } = {}) {
  if (!motionOnly) updateLauncher();
  document.dispatchEvent(new CustomEvent('sowon:social-presence', { detail: { selfId: state.selfId, roomKey: state.roomKey, ownIlju: state.ownIlju, motionOnly, visitors: state.joined && !state.stale ? state.visitors.map(v => ({ ...v })) : [] } }));
  if (motionOnly) return;
  const incoming = state.requests.filter(r => r.direction === 'incoming' && r.status === 'pending').length;
  document.dispatchEvent(new CustomEvent('sowon:social-state', { detail: { ...getSocialRoomState(), count: state.visitors.length, incoming } }));
}
function resetTransient() { ++resultVersion; state.result = null; state.resultId = null; state.confirm = null; state.selected = null; state.deleteArmed = false; }
function statusText(status) { return ({ pending: '승인을 기다려요', approved: '함께 볼 수 있어요', declined: '이번에는 사양했어요', cancelled: '요청을 취소했어요', revoked: '공유가 철회됐어요', expired: '시간이 지났어요' })[status] || ''; }
function requestActions(request) {
  const labels = { approve: '승인하고 궁합 보기', decline: '사양하기', cancel: '요청 취소', result: '궁합 보기', revoke: '공유 철회' };
  return availableActions(request).map(action => button(action, !isPeerFocus() && action === 'approve' ? '승인하고 함께 보기' : !isPeerFocus() && action === 'result' ? '궁합 다시 보기' : labels[action], `data-request-id="${request.id}" ${action === 'approve' || action === 'result' ? 'class="social-primary"' : ''}`)).join('');
}
function visitorCard(visitor) {
  const active = state.requests.find(r => r.peer.id === visitor.id && ['pending', 'approved'].includes(r.status));
  const selected = state.selected === visitor.id;
  const here = snapshot(), distance = Math.hypot(here.x - visitor.x, here.z - visitor.z), nearby = distance <= 8;
  return `<article class="social-person"><div class="social-avatar social-cloth-${visitor.outfit}" aria-hidden="true">人</div><div class="social-person-main"><h3>${esc(visitor.nickname)}${visitor.ilju ? ` <span class="social-ilju-tag">${esc(visitor.ilju)} 일주</span>` : ''}</h3><p>${active ? statusText(active.status) : (nearby ? '가까이에 머무는 나그네' : '마당을 산책하는 나그네')}</p></div>${button('choose', selected ? '접기' : '궁합 나누기', `data-visitor-id="${visitor.id}" aria-expanded="${selected}"`)}${selected ? `<div class="social-request-compose"><label>어떤 인연으로 만날까요?<select data-social-kind>${Object.entries(RELATION_KINDS).map(([key, label]) => `<option value="${key}" ${key === state.kind ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p>요청을 보내는 것은 내 결과 공유에 동의하는 뜻이에요. 상대도 승인해야 두 사람이 같은 결과를 볼 수 있어요.</p>${!nearby ? `<p>서로 가까이 있어야 인연을 청할 수 있어요.</p>${button('approach', '이 나그네에게 다가가기', `class="social-primary" data-visitor-id="${visitor.id}"`)}` : active ? `<p>이미 나누고 있는 소식이 있어요. ‘궁합 소식’에서 이어 보세요.</p>${button('news', '궁합 소식 열기')}` : button('request', '이 관계로 궁합 요청', `class="social-primary" data-visitor-id="${visitor.id}"`)}</div>` : ''}</article>`;
}
function requestCard(request) {
  return `<article class="social-request"><div class="social-request-label"><span>${request.direction === 'incoming' ? '받은 요청' : '보낸 요청'}</span><small>${esc(RELATION_KINDS[request.kind])}</small></div><h3>${esc(request.peer.nickname)}${request.direction === 'incoming' ? '에게서 온 궁합 초대' : '에게 보낸 궁합 초대'}</h3><p>${statusText(request.status)}</p><div class="social-request-actions">${requestActions(request)}</div></article>`;
}
function resultMarkup() {
  const r = state.result, request = state.requests.find(item => item.id === state.resultId);
  if (!r || !request || request.status !== 'approved' || (isPeerFocus() && request.peer.id !== focusedPeerId)) return '';
  const names = r.names.a && r.names.b ? `${r.names.a} · ${r.names.b}` : `${profile()?.nickname || '나'} · ${request.peer.nickname}`;
  const text = value => esc(value).replace(/(^|[^A-Za-z])([AB])(?![A-Za-z])/g, (_m, pre, who) => pre + esc(who === 'A' ? r.names.a || '첫 번째 나그네' : r.names.b || '두 번째 나그네'));
  const section = (title, values, content) => values.length ? `<section class="social-result-section"><h3>${title}</h3>${values.map(content).join('')}</section>` : '';
  return `<div class="social-result">${button('news', isPeerFocus() ? '← 돌아가기' : '← 궁합 소식으로')}<p class="social-eyebrow">${esc(RELATION_KINDS[request.kind])} · 두 사람만의 해석</p><h3 class="social-pair-names">${esc(names)}</h3><div class="social-score" style="--score:${r.totalScore}" role="img" aria-label="관계 종합 ${r.totalScore}점"><strong>${r.totalScore < 10 ? '측정 어려움' : `${r.totalScore}<small>점</small>`}</strong></div><h4 class="social-verdict">${text(r.verdict)}</h4><p class="social-result-note">${r.confidence === null ? '' : `분석 신뢰도 ${r.confidence}% · `}삼라 궁합 엔진으로 계산했어요.${r.unknownTimeA || r.unknownTimeB ? ' 시간 미상이 포함되어 시주 풀이는 제외했어요.' : ''}</p><div class="social-result-visuals" data-social-result-visuals></div>${section('두 사람을 관통하는 이야기', r.narrative, row => `<article><h4>${esc(row.icon)} ${esc(row.label)}</h4><p>${text(row.text)}</p></article>`)}${section('함께 살릴 강점', r.strengths, row => `<article><h4>${esc(row.emoji)} ${esc(row.label)}</h4><p>${text(row.sub)}</p></article>`)}${section('서로 알아둘 조율점', r.cautions, row => `<article><h4>${esc(row.emoji)} ${esc(row.label)}</h4><p>${text(row.sub)}</p></article>`)}${r.iljuPair ? `<section class="social-result-section"><h3>일주가 만나는 결</h3><article><h4>${text(r.iljuPair.headline)}</h4><p>${text(r.iljuPair.detail)}</p><p>${text(r.iljuPair.advice)}</p></article></section>` : ''}${section('관계의 바탕', r.axes, row => `<article><span class="social-axis-tone">${esc(row.name)} · ${esc(row.tone)}</span><h4>${text(row.headline)}</h4><p>${text(row.detail)}</p></article>`)}<p class="social-result-note">점수는 서로의 방식을 이해하는 참고예요. 출생 원문은 상대에게 공개하지 않아요. 한 사람이 철회하면 이 화면을 다시 열 수 없어요.</p>${button('revoke', '이 궁합의 공유 철회', `data-request-id="${request.id}"`)}</div>`;
}
function deleteButton() { return button('delete', state.deleteArmed ? '한 번 더 눌러 내 정보와 모든 공유 지우기' : '서버의 내 정보와 공유 지우기', state.deleteArmed ? 'class="social-delete-confirm"' : ''); }
function peerMarkup() {
  const visitor = focusedVisitor(), request = peerRequest();
  const peer = visitor || focusedPeer || request?.peer;
  const nearby = visitor && Math.hypot(snapshot().x - visitor.x, snapshot().z - visitor.z) <= 8;
  const name = peer?.nickname || '이 나그네';
  return `<section class="social-peer" aria-label="${esc(name)}와 궁합"><div class="social-peer-identity"><div class="social-avatar social-cloth-${esc(peer?.outfit || 'sage')}" aria-hidden="true">人</div><div><h3>${esc(name)}</h3>${peer?.ilju ? `<p class="social-peer-ilju">${esc(peer.ilju)} 일주</p>` : ''}</div></div>${!visitor ? `<p class="social-peer-away">${!state.joined ? '이 나그네와 궁합을 보려면 먼저 만남에 참여해 주세요.' : state.stale ? '연결을 확인하고 있어요. 잠시 후 다시 만나 주세요.' : '이 나그네가 잠시 자리를 비웠어요. 다시 만나면 궁합을 청할 수 있어요.'}</p>${state.joined ? button('refresh', '다시 확인', state.busy ? 'disabled' : '') : ''}` : ''}${request && ['pending', 'approved'].includes(request.status) ? `<div class="social-peer-request"><p class="social-peer-state">${request.direction === 'incoming' && request.status === 'pending' ? '궁합 요청이 도착했어요' : statusText(request.status)}</p><p>${esc(RELATION_KINDS[request.kind])} 관계 · ${request.status === 'approved' ? '두 사람 모두 승인한 궁합이에요.' : request.direction === 'incoming' ? '승인하면 두 사람이 같은 해석을 볼 수 있어요.' : '상대가 승인하면 함께 볼 수 있어요.'}</p><div class="social-request-actions">${requestActions(request)}</div></div>` : visitor ? `<div class="social-request-compose"><label for="socialPeerKind">어떤 관계로 볼까요?<select id="socialPeerKind" data-social-kind>${Object.entries(RELATION_KINDS).map(([key, label]) => `<option value="${key}" ${key === state.kind ? 'selected' : ''}>${label}</option>`).join('')}</select></label><p>상대가 승인하면 두 사람만 궁합을 볼 수 있어요. 출생 정보 원문은 공개되지 않아요.</p>${nearby ? button('request', '궁합 보기 요청', `class="social-primary" data-visitor-id="${visitor.id}"`) : `<p>조금 더 가까이 다가가서 궁합을 청해 보세요.</p>${button('approach', '다가가기', `class="social-primary" data-visitor-id="${visitor.id}"`)}`}</div>` : ''}</section>`;
}
function consentMarkup() {
  const own = profile(), destination = roomForKey(pendingRoom)?.label || roomForKey(state.roomKey)?.label || '신당 마당';
  return `<div class="social-welcome"><span class="social-knot" aria-hidden="true">∞</span><p class="social-eyebrow">AN ENCOUNTER IN THE GARDEN</p><h3>같은 마당에서,<br>서로의 결을 알아가요.</h3><p>이곳에 실제로 머무는 사람에게 궁합을 청하고, 두 사람의 승인이 모이면 같은 해석을 함께 볼 수 있어요.</p><ol><li>내 출생 정보를 먼저 준비해요.</li><li>닉네임·캐릭터·현재 위치와 계산한 일주가 같은 공간의 나그네에게 보여요. 생년월일·시간·성별 원문은 공개하지 않아요.</li><li>출생 정보는 계산을 위해 서버에 보관하며 상대에게 원문을 보여주지 않아요.</li><li>보낸 사람의 동의와 받은 사람의 승인이 모이면 두 참여자만 사주 특성이 담긴 궁합 해석을 열 수 있어요. 언제든 공유를 철회할 수 있어요.</li></ol><p class="social-retention">만남 연결과 서버의 정보는 최대 24시간 동안 유효해요. 이 탭에서 다시 참여해 승인한 궁합을 이어 볼 수 있고, ${isPeerFocus() ? '만남 관리 화면에서 내 정보와 공유를 먼저 지울 수도 있어요.' : '‘서버의 내 정보와 공유 지우기’로 먼저 지울 수도 있어요.'} 내 캐릭터의 기기 기억 설정은 별도로 유지돼요.</p>${own ? `<p class="social-own-name">오늘 만날 이름 <strong>${esc(own.nickname || '나그네')}</strong> ${button('profile', '내 정보 수정')}</p><p class="social-destination">참여할 공간 <strong>${esc(destination)}</strong></p><label class="social-consent"><input type="checkbox" data-social-consent>위 공개·보관 범위를 확인했고, 만남에 참여할게요.</label>${button('join', state.deletionPending ? '이전 서버 정보 삭제를 먼저 확인해 주세요' : state.joining ? '만남을 준비하고 있어요…' : `동의하고 ${destination}에 들어가기`, `class="social-primary" ${state.joining ? 'disabled' : ''}`)}` : `<p class="social-empty">태어난 날짜·시간과 성별을 저장하면 준비가 끝나요.</p>${button('profile', '내 캐릭터 정보 준비하기', 'class="social-primary"')}`}</div>`;
}
function confirmMarkup() {
  const confirmation = state.confirm;
  if (!confirmation) return '';
  const request = state.requests.find(item => item.id === confirmation.id);
  if (!request || (isPeerFocus() && request.peer.id !== focusedPeerId)) return '';
  const approve = confirmation.action === 'approve';
  return `<section class="social-confirm" role="region" aria-label="${approve ? '궁합 승인 확인' : '공유 철회 확인'}"><p class="social-eyebrow">${approve ? 'TWO YESSES, ONE READING' : 'YOUR CHOICE, ALWAYS'}</p><h3>${approve ? `${esc(request.peer.nickname)}와 궁합을 함께 볼까요?` : '이 궁합의 공유를 철회할까요?'}</h3><p>${approve ? `${esc(RELATION_KINDS[request.kind])} 관계로 계산해요. 승인하면 두 사람이 사주 특성이 담긴 같은 궁합 해석을 볼 수 있어요. 출생 원문은 서로에게 공개되지 않아요.` : '두 사람 모두 이 결과를 다시 열 수 없게 돼요. 이미 본 내용을 되돌리거나 별도로 저장한 화면까지 지울 수는 없어요.'}</p><div>${button('confirm', approve ? '승인하고 우리 궁합 보기' : '공유 철회하기', `class="social-primary" data-request-id="${request.id}" data-decision="${confirmation.action}"`)}${button('dismiss-confirm', '돌아가기')}</div></section>`;
}
function render() {
  if (!dialog.open) return;
  const scrollTop = dialog.querySelector('.social-body')?.scrollTop || 0;
  const focusKind = document.activeElement?.matches?.('[data-social-kind]') === true;
  const focusAction = document.activeElement?.dataset?.socialAction;
  const focusRequest = document.activeElement?.dataset?.requestId;
  const count = state.requests.filter(r => r.direction === 'incoming' && r.status === 'pending').length;
  const focused = isPeerFocus();
  if (focused) dialog.classList.add('social-peer-dialog'); else dialog.classList.remove('social-peer-dialog');
  if (focused && state.result) dialog.classList.add('social-peer-result'); else dialog.classList.remove('social-peer-result');
  const content = focused ? (state.joined ? state.confirm ? confirmMarkup() : state.result ? resultMarkup() : peerMarkup() : `${peerMarkup()}${consentMarkup()}`) : state.joined ? `<div class="social-connected"><span class="social-live-dot ${state.stale ? 'social-disconnected' : ''}" aria-hidden="true"></span><span>${state.stale ? '다시 연결하고 있어요' : state.realtime ? '실시간으로 함께 걷고 있어요' : '나그네와 함께 머물고 있어요 · 위치를 주기적으로 확인해요'}</span>${button('refresh', '새로고침', state.busy ? 'disabled' : '')}</div><div class="social-current-room"><strong>${esc(roomForKey(state.roomKey)?.label || '신당 마당')}</strong>${state.ownIlju ? `<span>내 일주 ${esc(state.ownIlju)}</span>` : ''}${button('rooms', '일주방 둘러보기')}</div><nav class="social-tabs" aria-label="만남과 궁합"><button type="button" data-social-action="visitors" aria-pressed="${state.tab === 'visitors'}">만난 나그네 <span>${state.visitors.length}</span></button><button type="button" data-social-action="news" aria-pressed="${state.tab === 'news'}">궁합 소식 ${count ? `<span class="social-count">${count}</span>` : ''}</button></nav>${state.confirm ? confirmMarkup() : state.result ? resultMarkup() : state.tab === 'visitors' ? `<p class="social-lead">${state.stale ? '연결이 회복되면 다시 현재 나그네를 보여드려요.' : '캐릭터를 누르거나 이 목록에서 인연을 청해 보세요.'}</p><div class="social-people">${!state.stale && state.visitors.length ? state.visitors.map(visitorCard).join('') : `<p class="social-empty">${state.stale ? '아직 만남 정보를 확인하지 못했어요.' : '아직 다른 나그네가 없어요. 마당을 산책하며 기다려 보세요.'}</p>`}</div>` : `<p class="social-lead">승인 전에는 결과가 열리지 않아요. 서로의 동의는 언제든 거둘 수 있어요.</p><div class="social-requests">${state.requests.length ? state.requests.map(requestCard).join('') : '<p class="social-empty">아직 주고받은 궁합 요청이 없어요.</p>'}</div>`}<footer class="social-session-actions">${button('leave', '마당의 만남 잠시 끄기')}${deleteButton()}</footer>` : `${consentMarkup()}${client.hasSession() ? `<footer class="social-session-actions">${deleteButton()}</footer>` : ''}`;
  dialog.innerHTML = `<header class="social-header"><div><p>${focused ? 'FELLOW TRAVELER' : 'MEET A FELLOW TRAVELER'}</p><h2 id="socialTitle">${focused ? '궁합 보기' : '마당의 인연'}</h2></div>${button('close', '×', 'class="social-close" aria-label="마당의 인연 닫기"')}</header><div class="social-body">${state.error ? `<p class="social-error" role="alert">${esc(state.error)}</p>` : ''}${state.status ? `<p class="social-status" role="status">${esc(state.status)}</p>` : ''}${content}</div><footer class="social-footer">${focused ? '<span>서로 승인한 궁합만 함께 볼 수 있어요.</span>' : `<div>${button('direct', '직접 입력해 궁합 보기')}</div><span>닉네임·캐릭터·위치·일주 공개 · 출생 원문은 비공개</span>`}</footer>`;
  const visualHost = dialog.querySelector('[data-social-result-visuals]');
  if (visualHost && state.result) visualHost.replaceChildren(renderReadingVisuals(buildCompatibilityVisuals(state.result), { document, compact: true }));
  const body = dialog.querySelector('.social-body'); if (body) body.scrollTop = scrollTop;
  dialog.querySelectorAll('button').forEach(node => { if ((state.busy && !['close', 'direct'].includes(node.dataset.socialAction)) || (state.deletionPending && node.dataset.socialAction === 'join')) node.disabled = true; });
  if (focusKind) dialog.querySelector('[data-social-kind]')?.focus({ preventScroll: true });
  else if (focusAction) {
    const match = [...dialog.querySelectorAll('[data-social-action]')].find(node => node.dataset.socialAction === focusAction && (!focusRequest || node.dataset.requestId === focusRequest));
    (match || dialog.querySelector('.social-primary:not(:disabled)') || dialog.querySelector('[data-social-action="close"]'))?.focus({ preventScroll: true });
  }
}
function stopPolling() { clearTimeout(timer); timer = null; }
function schedule() { stopPolling(); if (state.joined && !document.hidden) timer = setTimeout(() => state.realtime ? heartbeat() : refresh(), state.realtime ? 20000 : 10000); }
function stopRealtime() {
  ++realtimeGeneration; const old = realtime; realtime = null; state.realtime = false; socialRefreshQueued = false; lastRequestStamp = undefined;
  old?.dispose();
}
function queueSocialRefresh() {
  socialRefreshQueued = true;
  if (!refreshPromise) queueMicrotask(() => {
    if (!socialRefreshQueued || !state.joined || document.hidden || state.switchingRoom || state.joining) return;
    socialRefreshQueued = false; void refresh();
  });
}
function startRealtime() {
  if (realtime || !state.joined || state.stale || state.switchingRoom || document.hidden || !Number.isInteger(state.presenceEpoch)) return;
  if (!config.createRealtimeClient && typeof window.WebSocket !== 'function') return;
  const generation = ++realtimeGeneration, version = operation, visibility = visibilityVersion;
  const identity = {selfId:state.selfId,roomKey:state.roomKey,presenceEpoch:state.presenceEpoch};
  const valid = () => generation === realtimeGeneration && version === operation && visibility === visibilityVersion && state.joined && !document.hidden && !state.switchingRoom && state.roomKey === identity.roomKey && state.presenceEpoch === identity.presenceEpoch;
  const factory = config.createRealtimeClient || createRealtimeClient;
  const transport = factory({
    WebSocket:window.WebSocket,
    getTicket:() => api('realtime_ticket'), getPosition:snapshot,
    onReady() { if (!valid()) return; state.realtime = true; state.stale = false; emitPresence(); render(); schedule(); },
    onFrame(frame) {
      if (!valid() || !state.realtime || frame.roomKey !== state.roomKey) return;
      state.visitors = safeVisitors(frame.visitors,state.selfId);
      const oldCount = state.roomCounts[state.roomKey];
      if (Number.isInteger(frame.onlineCount) && frame.onlineCount >= 0) state.roomCounts[state.roomKey] = frame.onlineCount;
      emitPresence({motionOnly:oldCount === state.roomCounts[state.roomKey]});
    },
    onNotify(event) {
      if (!valid()) return;
      // Never use a socket hint as authority to show an approved result.
      if (event.invalidateResult && state.result && (!event.requestId || event.requestId === state.resultId)) { resetResult(); render(); }
      queueSocialRefresh();
    },
    onStatus(status) {
      if (!valid() || status === 'ready') return;
      const wasLive = state.realtime; state.realtime = false; lastRequestStamp = undefined; if (wasLive || !timer) schedule();
      if (wasLive) { emitPresence(); render(); }
      if (status === 'reconnecting' && wasLive) queueSocialRefresh();
    },
    onFatal(error) {
      if (!valid()) return;
      stopRealtime(); stopPolling(); state.joined = false; state.stale = true; state.visitors = []; resetResult();
      if (['session_expired','invalid_session'].includes(error?.code)) client.clear();
      state.error = socialError(error); emitPresence(); render();
    },
  });
  realtime = transport;
  if (!transport.start(identity)) { realtime = null; transport.dispose(); }
}
function heartbeat() {
  if (!state.joined || !state.realtime || state.joining || state.switchingRoom || document.hidden) return;
  if (heartbeatPromise) return heartbeatPromise;
  if (refreshPromise) { schedule(); return; }
  const version = operation, visibleVersion = visibilityVersion;
  const task = (async () => {
  try {
    const ack = await api('heartbeat',presencePayload(snapshot()));
    if (version !== operation || visibleVersion !== visibilityVersion || !state.joined || document.hidden) return;
    if (ack?.ok !== true || ack.self_id !== state.selfId || ack.room_key !== state.roomKey || ack.presence_epoch !== state.presenceEpoch) throw Object.assign(new Error('presence_changed'),{code:'presence_changed'});
    if (typeof ack.requests_stamp === 'string' && ack.requests_stamp.length <= 1024) {
      if (ack.requests_stamp !== lastRequestStamp) {
        // A missed socket hint must not leave a private result shared forever.
        if (lastRequestStamp !== undefined && state.result) { resetResult(); render(); }
        lastRequestStamp = ack.requests_stamp; queueSocialRefresh();
      }
    } else queueSocialRefresh();
  } catch(error) {
    if (version !== operation || visibleVersion !== visibilityVersion || !state.joined || document.hidden) return;
    stopRealtime(); state.stale = true; state.visitors = []; resetResult(); state.error = socialError(error);
    if (['invalid_session','session_expired','presence_changed'].includes(error?.code)) { state.joined = false; stopPolling(); if (error.code !== 'presence_changed') client.clear(); }
    emitPresence(); render();
  } finally { if (heartbeatPromise === task) heartbeatPromise = null; if (version === operation && state.joined) schedule(); }
  })(); heartbeatPromise = task; return task;
}
async function api(action, params = {}) {
  const abort = new AbortController(); controllers.add(abort);
  const timeout = setTimeout(() => abort.abort(), 18000);
  const body = state.realtime && (action === 'request' || (action === 'respond' && params.decision === 'approve')) ? {...params,realtime:true} : params;
  try { return await client.call(action, body, { signal: abort.signal }); }
  finally { clearTimeout(timeout); controllers.delete(abort); }
}
function adopt(data) {
  const previousRoom = state.roomKey;
  const keepLiveMovement = state.realtime && data.room_key === state.roomKey;
  if (state.realtime && data.room_key !== state.roomKey) stopRealtime();
  state.roomKey = roomForKey(data.room_key)?.key || 'courtyard';
  state.ownIlju = safeIlju(data.own_ilju) || state.ownIlju;
  state.roomCounts = safeRoomCounts(data.room_counts);
  state.selfId = cleanText(data.self_id, 80) || state.selfId;
  if (!keepLiveMovement) state.visitors = safeVisitors(data.visitors, state.selfId);
  if (isPeerFocus() && focusedVisitor()) focusedPeer = { ...focusedVisitor() };
  state.requests = safeRequests(data.requests);
  state.stale = false;
  if (state.resultId && !state.requests.some(item => item.id === state.resultId && item.status === 'approved')) {
    resetResult(); state.status = isPeerFocus() ? '공유 상태가 바뀌었어요. 이 나그네와의 요청을 다시 확인해 주세요.' : '공유 상태가 바뀌었어요. 궁합 소식에서 확인해 주세요.';
  }
  if (state.confirm && !state.requests.some(item => item.id === state.confirm.id && availableActions(item).includes(state.confirm.action))) state.confirm = null;
  if (previousRoom !== state.roomKey) document.dispatchEvent(new CustomEvent('sowon:room-change', { detail: { roomKey: state.roomKey, previousRoom, previousRoomKey: previousRoom, room: roomForKey(state.roomKey), joined: state.joined, ownIlju: state.ownIlju } }));
  emitPresence(); render();
}
async function refresh() {
  if (!state.joined || state.joining || state.switchingRoom || refreshPromise) return refreshPromise;
  const version = operation;
  const task = (async () => {
    try { const data = await api(state.realtime ? 'poll' : 'presence', state.realtime ? {} : presencePayload(snapshot())); if (state.joined && version === operation && !document.hidden) adopt(data); }
    catch (error) {
      if (!state.joined || version !== operation) return;
      if (state.realtime) stopRealtime();
      state.stale = true; state.visitors = []; resetResult(); state.error = socialError(error); emitPresence(); render();
      if (['invalid_session', 'session_expired'].includes(error?.code)) { state.joined = false; stopPolling(); client.clear(); emitPresence(); render(); }
      if (error?.code === 'presence_changed') { state.joined = false; state.presenceEpoch = null; stopPolling(); emitPresence(); render(); }
    } finally { if (refreshPromise === task) refreshPromise = null; if (version === operation) { schedule(); startRealtime(); if (socialRefreshQueued) queueSocialRefresh(); } }
  })(); refreshPromise = task; return task;
}
async function join() {
  if (state.busy || leavePromise || state.deletionPending) return false;
  if (state.joining || !dialog.querySelector('[data-social-consent]')?.checked) { state.error = '공개·보관 범위를 확인하고 참여 동의를 체크해 주세요.'; render(); return; }
  const own = serverProfile(profile());
  if (!own) { state.error = '내 출생 정보를 먼저 준비해 주세요.'; render(); return; }
  const version = ++operation, visibleVersion = visibilityVersion; let visibilityInterrupted = false; state.joining = true; state.error = ''; state.status = ''; render();
  const abort = new AbortController(), timeout = setTimeout(() => abort.abort(), 18000); controllers.add(abort);
  try {
    await client.start(abort.signal);
    if (version !== operation) return;
    // Idempotent save also hydrates the canonical public ilju for sessions created before rooms.
    const saved = await api('profile_save', { ...own, share_ilju: true });
    if (version !== operation) return;
    state.ownIlju = safeIlju(saved.profile?.ilju);
    state.presenceEpoch = Number.isInteger(saved.profile?.presence_epoch) && saved.profile.presence_epoch >= 0 ? saved.profile.presence_epoch : null;
    state.joined = true; lastProfile = JSON.stringify(own); if (document.hidden) { state.stale = true; emitPresence(); } else {
      const wanted = roomForKey(pendingRoom)?.key || state.roomKey;
      const position = pendingRoom && config.getRoomPosition ? safePosition({ ...snapshot(), ...config.getRoomPosition(wanted) }) : snapshot();
      const data = await api('presence', presencePayload(position, wanted));
      if (version !== operation) return;
      if (document.hidden || visibleVersion !== visibilityVersion) {
        visibilityInterrupted = true; state.stale = true; state.visitors = [];
        await client.call('leave', { temporary: true }).catch(() => {}); emitPresence(); return;
      }
      if (wanted !== 'courtyard' && data.room_key !== wanted) throw Object.assign(new Error('room_unavailable'), { code: 'room_unavailable' });
      pendingRoom = null; adopt(data); schedule();
    }
  } catch (error) { if (version === operation) { state.joined = false; if (['invalid_session', 'session_expired'].includes(error?.code)) client.clear(); state.error = socialError(error); } }
  finally { clearTimeout(timeout); controllers.delete(abort); if (version === operation) { state.joining = false; render(); if (visibilityInterrupted && state.joined && !document.hidden) refresh(); else startRealtime(); } }
}
async function mutate(action, params, message) {
  if (state.busy || !state.joined) return;
  const version = operation, encounter = encounterVersion; state.busy = true; state.error = ''; state.status = ''; render();
  try {
    const data = await api(action, params);
    if (version !== operation) return;
    if (encounter === encounterVersion) { resetTransient(); state.status = message; } if (refreshPromise) await refreshPromise; if (version !== operation) return; await refresh();
    if (encounter === encounterVersion && params.decision === 'approve' && data.request?.status === 'approved') await showResult(params.request_id);
  } catch (error) { if (version === operation && encounter === encounterVersion) state.error = socialError(error); }
  finally { if (version === operation) { state.busy = false; render(); } }
}
async function showResult(id) {
  const request = state.requests.find(item => item.id === id && item.status === 'approved');
  if (!request || (isPeerFocus() && request.peer.id !== focusedPeerId)) return;
  const version = operation, resultRequestVersion = ++resultVersion; state.error = ''; state.status = '';
  try {
    const data = await api('result', { request_id: id });
    if (version !== operation || resultRequestVersion !== resultVersion || (isPeerFocus() && request.peer.id !== focusedPeerId) || !state.joined || state.stale || document.hidden || !state.requests.some(item => item.id === id && item.status === 'approved')) return;
    if (data.request?.status !== 'approved' || data.request.id !== id) throw Object.assign(new Error('result_revoked'), { code: 'result_revoked' });
    const result = safeResult(data.result);
    if (!result) throw new Error('bad_result');
    state.result = result; state.resultId = id; state.confirm = null; state.tab = 'news'; seenApprovals.add(id); updateLauncher(); render(); dialog.querySelector('.social-body')?.scrollTo({ top: 0 });
  } catch (error) { if (version === operation && resultRequestVersion === resultVersion && (!isPeerFocus() || request.peer.id === focusedPeerId)) { state.error = socialError(error); state.result = null; state.resultId = null; await refresh(); render(); } }
}
async function leave({ remove = false } = {}) {
  // Keep every caller on the same departure. A profile change during an ordinary
  // leave upgrades it to deletion after the first request finishes.
  if (leavePromise) {
    const pending = leavePromise;
    if (remove && !leaveRemoves) { await pending; return leave({ remove: true }); }
    return pending;
  }
  remove = remove || state.deletionPending;
  const version = ++operation; ++resultVersion; stopRealtime(); stopPolling(); for (const abort of controllers) abort.abort(); refreshPromise = null;
  state.joined = false; state.joining = false; state.busy = true; state.visitors = []; state.requests = []; state.selfId = ''; state.ownIlju = null; state.presenceEpoch = null; state.roomCounts = {}; state.switchingRoom = false; pendingRoom = null;
  if (remove) state.deletionPending = true;
  resetTransient(); emitPresence(); state.error = '';
  state.status = remove ? '서버의 내 정보와 공유를 지우고 있어요…' : '마당의 만남을 잠시 껐어요. 이미 승인한 궁합은 다음 참여 때 이어 볼 수 있어요.'; render();
  const task = (async () => {
    try {
      if (client.hasSession()) await api(remove ? 'profile_delete' : 'leave');
      if (version !== operation) return;
      if (remove) { client.clear(); state.deletionPending = false; state.status = '서버의 내 출생 정보와 공유를 지웠어요.'; }
    } catch (error) {
      if (version !== operation) return;
      if (remove && ['session_expired', 'invalid_session'].includes(error?.code)) {
        client.clear(); state.deletionPending = false; state.status = '이전 만남 세션이 끝났어요. 새롭게 참여할 수 있어요.';
      } else {
        // An uncertain deletion may still commit later. Keep its capability for
        // retry, and do not save a new profile into that same session meanwhile.
        state.error = remove ? '서버 삭제를 확인하지 못했어요. 연결을 확인하고 다시 지워 주세요. 삭제를 확인한 뒤 새로 참여할 수 있어요.' : socialError(error);
      }
    }
  })();
  leavePromise = task; leaveRemoves = remove;
  try { await task; }
  finally {
    if (leavePromise === task) { leavePromise = null; leaveRemoves = false; }
    if (version === operation) { state.busy = false; emitPresence(); render(); }
  }
}
/** Select a public room only after an acknowledged presence update. No local ghost members. */
export async function enterSocialRoom(key) {
  const room = roomForKey(key);
  if (!room || state.busy || leavePromise || state.deletionPending || state.switchingRoom || state.joining || document.hidden) return false;
  if (!state.joined) { pendingRoom = room.key; open(); return false; }
  if (room.key === state.roomKey && !state.stale) return true;
  const version = ++operation, visibleVersion = visibilityVersion;
  let visibilityInterrupted = false;
  state.switchingRoom = true; state.busy = true; state.error = ''; stopRealtime(); stopPolling(); emitPresence(); render();
  try {
    // The old heartbeat must finish writing before the new room can be committed.
    if (refreshPromise) await refreshPromise;
    if (heartbeatPromise) await heartbeatPromise;
    if (version !== operation || !state.joined) return false;
    const position = config.getRoomPosition ? safePosition({ ...snapshot(), ...config.getRoomPosition(room.key) }) : snapshot();
    const data = await api('presence', presencePayload(position, room.key));
    if (version !== operation || !state.joined) return false;
    if (document.hidden || visibleVersion !== visibilityVersion) {
      // A background leave may have raced this write. Clear it after acknowledgment,
      // then the visible heartbeat can safely restore the previous space.
      visibilityInterrupted = true; state.stale = true; state.visitors = [];
      await client.call('leave', { temporary: true }).catch(() => {}); return false;
    }
    if (data.room_key !== room.key) throw Object.assign(new Error('room_unavailable'), { code: 'room_unavailable' });
    resetTransient(); state.status = `${room.label}에 들어왔어요.`; adopt(data); return true;
  } catch (error) {
    if (version === operation) { state.error = socialError(error); document.dispatchEvent(new CustomEvent('sowon:room-error', { detail: { message: state.error } })); }
    return false;
  } finally {
    if (version === operation) { state.switchingRoom = false; state.busy = false; emitPresence(); render(); schedule(); if (visibilityInterrupted && !document.hidden) refresh(); else startRealtime(); }
  }
}
function open(visitorId) {
  if (!dialog.open && document.querySelector('dialog[open]')) return;
  ++encounterVersion;
  focusedPeerId = visitorId === undefined || visitorId === null ? null : validId(visitorId) ? visitorId : '';
  focusedRoom = isPeerFocus() ? state.roomKey : null;
  const peer = isPeerFocus() ? state.visitors.find(visitor => visitor.id === focusedPeerId) || state.requests.find(request => request.peer.id === focusedPeerId)?.peer : null;
  focusedPeer = peer ? { ...peer } : null;
  state.deleteArmed = false; state.selected = null; state.error = ''; state.status = ''; resetResult();
  if (isPeerFocus()) state.tab = 'visitors';
  if (dialog.open) { render(); dialog.querySelector('.social-body')?.scrollTo({ top: 0 }); return; }
  opener = document.activeElement;
  dialog.showModal(); document.body.classList.add('dialog-open'); render();
  if (state.joined) refresh();
}
function resetResult() { ++resultVersion; state.result = null; state.resultId = null; state.confirm = null; }
function close() { ++encounterVersion; state.deleteArmed = false; resetResult(); dialog.close(); }
dialog.addEventListener('click', async event => {
  const target = event.target.closest('[data-social-action]'); if (!target) return;
  const action = target.dataset.socialAction, id = target.dataset.requestId;
  if (isPeerFocus() && ['direct', 'rooms', 'visitors', 'choose', 'leave', 'delete'].includes(action)) return;
  if (isPeerFocus() && ['request', 'approach'].includes(action) && target.dataset.visitorId !== focusedPeerId) return;
  if (!['delete', 'refresh'].includes(action)) state.deleteArmed = false;
  if (action === 'close') return close();
  if (action === 'direct') { close(); document.dispatchEvent(new CustomEvent('sowon:feature', { detail: { id: 'gunghap' } })); return; }
  if (action === 'rooms') { close(); document.dispatchEvent(new CustomEvent('sowon:rooms-open')); return; }
  if (action === 'profile') { close(); document.dispatchEvent(new CustomEvent('sowon:profile-open')); return; }
  if (state.busy) return;
  if (action === 'join') return join();
  if (action === 'refresh') { state.error = ''; if (!state.realtime) stopRealtime(); return refresh(); }
  if (action === 'visitors' || action === 'news') { state.tab = action; resetResult(); render(); dialog.querySelector('.social-body')?.scrollTo({ top: 0 }); return; }
  if (action === 'approach') { const visitorId = target.dataset.visitorId; if (!state.visitors.some(v => v.id === visitorId) || (isPeerFocus() && !focusedVisitor())) return; close(); document.dispatchEvent(new CustomEvent('sowon:social-walk', { detail: { visitorId } })); return; }
  if (action === 'choose') { if (state.visitors.some(visitor => visitor.id === target.dataset.visitorId)) open(target.dataset.visitorId); return; }
  if (action === 'request') {
    const kind = target.closest('.social-request-compose')?.querySelector('[data-social-kind]')?.value;
    if (!Object.hasOwn(RELATION_KINDS, kind) || !state.visitors.some(v => v.id === target.dataset.visitorId) || (isPeerFocus() && !focusedVisitor())) return;
    state.tab = 'news'; return mutate('request', { target_id: target.dataset.visitorId, kind }, '궁합 요청을 보냈어요. 상대의 승인을 기다려 주세요.');
  }
  const request = state.requests.find(item => item.id === id);
  if (isPeerFocus() && request && request.peer.id !== focusedPeerId) return;
  if (action === 'approve' || action === 'revoke') { if (!request || !availableActions(request).includes(action)) return; resetResult(); state.confirm = { action, id }; render(); dialog.querySelector('.social-body')?.scrollTo({ top: 0 }); return; }
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
dialog.addEventListener('close', () => { if (dialog.open) return; ++encounterVersion; state.deleteArmed = false; resetResult(); if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); if (opener?.isConnected) opener.focus({ preventScroll: true }); } });
document.addEventListener('click', event => { if (event.target.closest?.('[data-open-social]')) { event.preventDefault(); pendingRoom = null; open(); } });
document.addEventListener('sowon:social-state-request', emitPresence);
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
    stopRealtime(); stopPolling(); state.deleteArmed = false; resetResult(); state.visitors = []; state.stale = true; emitPresence(); render();
    if (refreshPromise) await refreshPromise;
    if (state.joined && document.hidden && version === visibilityVersion) client.call('leave', { temporary: true }).catch(() => {});
  } else {
    state.error = '';
    if (refreshPromise) await refreshPromise;
    if (state.joined && !document.hidden && version === visibilityVersion) refresh();
  }
});
window.addEventListener('pagehide', () => {
  stopRealtime(); stopPolling();
  if (state.joined) {
    state.deleteArmed = false; resetResult(); state.visitors = []; state.stale = true; emitPresence(); render();
    client.call('leave', { temporary: true }, { keepalive: true }).catch(() => {});
  }
});

window.addEventListener('pageshow', event => { if (event.persisted && state.joined && !document.hidden) refresh(); });

updateLauncher();
