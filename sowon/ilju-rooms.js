import { ILJU_ROOMS, COURTYARD, roomForIlju, roomForKey, safeIlju } from './ilju-room-core.js?v=20261101-sanctuary2';
import { enterSocialRoom, getSocialRoomState } from './social.js?v=20261101-sanctuary2';

const dialog = document.createElement('dialog');
dialog.id = 'iljuRoomsDialog'; dialog.className = 'ilju-rooms-dialog'; dialog.setAttribute('aria-labelledby', 'iljuRoomsTitle');
document.body.appendChild(dialog);
let ownIlju = null, selectedElement = '', search = '', error = '', opener = null, entering = false;
let social = getSocialRoomState();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const identity = () => safeIlju(social.ownIlju) || ownIlju;
const occupancy = key => social.connected ? `${social.roomCounts[key] || 0}명 머무는 중` : '참여하면 현재 인원을 확인해요';
function roomCard(room) {
  const mine = room.ilju === identity(), current = social.joined && room.key === social.roomKey;
  return `<button class="ilju-room-card${mine ? ' is-mine' : ''}${current ? ' is-current' : ''}" type="button" data-enter-room="${room.key}" ${entering || social.busy ? 'disabled' : ''} aria-label="${esc(room.label)}${mine ? ', 내 일주방' : ', 손님으로 방문'}${current ? ', 현재 공간' : ''}"><span class="ilju-room-hanja" aria-hidden="true">${room.ganzi}</span><span class="ilju-room-name">${esc(room.ilju)} <small>일주방</small></span><span class="ilju-room-count">${esc(occupancy(room.key))}</span><span class="ilju-room-invitation">${current ? '지금 이곳에 있어요' : mine ? '나와 같은 일주 만나기 ↗' : '손님으로 방문 ↗'}</span></button>`;
}
function render() {
  if (!dialog.open) return;
  const own = roomForIlju(identity());
  const list = ILJU_ROOMS.filter(room => (!selectedElement || room.element === selectedElement) && (!search || room.ilju.includes(search) || room.ganzi.includes(search)));
  const active = roomForKey(social.roomKey) || COURTYARD;
  const focused = document.activeElement?.dataset?.enterRoom;
  const wasSearch = document.activeElement?.id === 'iljuRoomSearch';
  const cursor = wasSearch ? document.activeElement.selectionStart : null;
  dialog.innerHTML = `<header class="ilju-rooms-header"><div><p>같은 결을 가진 사람들의 정원</p><h2 id="iljuRoomsTitle">일주방</h2></div><button class="ilju-rooms-close" type="button" data-rooms-close aria-label="일주방 닫기">×</button></header><div class="ilju-rooms-body">${error ? `<p class="ilju-rooms-error" role="alert">${esc(error)}</p>` : ''}<p class="ilju-rooms-intro">나와 같은 일주끼리 모여 쉬는 작은 정원이에요.<br>다른 일주방에는 손님으로 다녀올 수 있어요.</p>${own ? `<section class="ilju-room-personal" aria-label="내 일주방"><div><span>나의 일주</span><h3>${own.ilju} <small>${own.ganzi}</small></h3><p>${social.joined && social.roomKey === own.key ? '지금 내 일주방에 머무르고 있어요.' : '같은 일주를 가진 나그네와 인연을 나눠보세요.'}</p></div><button type="button" data-enter-room="${own.key}" ${entering || social.busy ? 'disabled' : ''}>${social.joined && social.roomKey === own.key ? '현재 공간' : '내 일주방으로 ↗'}</button></section>` : `<section class="ilju-room-prepare"><h3>내 일주방부터 찾아볼까요?</h3><p>출생정보로 한 번 분석하면 나의 일주가 여기에 표시돼요.</p><button type="button" data-rooms-profile>내 정보 준비하기 ↗</button></section>`}<div class="ilju-room-current"><span>${social.joined ? `현재 공간 · ${esc(active.label)}` : '방에 들어갈 때 공개 범위를 확인하고 참여해요.'}</span>${social.joined && active.key !== 'courtyard' ? '<button type="button" data-enter-room="courtyard">신당 마당으로 돌아가기</button>' : ''}</div><div class="ilju-room-tools"><label for="iljuRoomSearch">60일주 찾아보기</label><input id="iljuRoomSearch" type="search" placeholder="일주 검색 · 예: 갑자" maxlength="8" value="${esc(search)}" autocomplete="off"><div class="ilju-room-filters" role="group" aria-label="일간 오행으로 찾기">${['','목','화','토','금','수'].map(element => `<button type="button" data-room-element="${element}" aria-pressed="${element === selectedElement}">${element || '전체'}</button>`).join('')}</div></div><div class="ilju-room-grid">${list.length ? list.map(roomCard).join('') : '<p class="ilju-room-no-results">찾는 일주가 없어요. 두 글자로 검색해 주세요.</p>'}</div><p class="ilju-room-note">방에는 실제 참여자만 보여요. 같은 방에서 가까이 있는 사람에게만 궁합을 청할 수 있고, 상대가 승인해야 결과가 열려요.</p></div><footer class="ilju-rooms-footer">참여 시 닉네임·캐릭터·위치·일주 공개 · 생년월일·시간·성별 원문 비공개</footer>`;
  if (wasSearch) { const input = dialog.querySelector('#iljuRoomSearch'); input.focus({ preventScroll: true }); if (typeof cursor === 'number') input.setSelectionRange(cursor, cursor); }
  else if (focused) [...dialog.querySelectorAll('[data-enter-room]')].find(node => node.dataset.enterRoom === focused)?.focus({ preventScroll: true });
}
export function openIljuRooms() {
  if (dialog.open || document.querySelector('dialog[open]')) return false;
  social = getSocialRoomState(); opener = document.activeElement; error = ''; search = ''; selectedElement = '';
  dialog.showModal(); document.body.classList.add('dialog-open'); render();
  document.dispatchEvent(new CustomEvent('sowon:identity-request'));
  return true;
}
dialog.addEventListener('click', async event => {
  if (event.target.closest('[data-rooms-close]')) { dialog.close(); return; }
  if (event.target.closest('[data-rooms-profile]')) { dialog.close(); document.dispatchEvent(new CustomEvent('sowon:profile-open')); return; }
  const filter = event.target.closest('[data-room-element]');
  if (filter) { selectedElement = filter.dataset.roomElement; render(); dialog.querySelector(`[data-room-element="${selectedElement}"]`)?.focus({ preventScroll: true }); return; }
  const target = event.target.closest('[data-enter-room]');
  if (!target || entering || social.busy || !roomForKey(target.dataset.enterRoom)) return;
  const key = target.dataset.enterRoom;
  if (!social.joined) { dialog.close(); await enterSocialRoom(key); return; }
  entering = true; error = ''; render();
  try { if (await enterSocialRoom(key)) dialog.close(); }
  finally { entering = false; social = getSocialRoomState(); render(); }
});
dialog.addEventListener('input', event => { if (event.target.id === 'iljuRoomSearch') { search = event.target.value.trim().slice(0, 8); render(); } });
dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); if (opener?.isConnected) opener.focus({ preventScroll: true }); } });
document.addEventListener('sowon:identity-change', event => { ownIlju = safeIlju(event.detail?.ilju); render(); });
document.addEventListener('sowon:social-state', () => { social = getSocialRoomState(); render(); });
document.addEventListener('sowon:room-error', event => { error = typeof event.detail?.message === 'string' ? event.detail.message : '방에 연결하지 못했어요. 현재 공간에 계속 머물러요.'; render(); });
document.addEventListener('sowon:rooms-open', openIljuRooms);
document.addEventListener('click', event => { if (event.target.closest?.('[data-open-ilju-rooms]')) { event.preventDefault(); openIljuRooms(); } });
document.dispatchEvent(new CustomEvent('sowon:identity-request'));
