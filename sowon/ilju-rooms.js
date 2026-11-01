import { ILJU_ROOMS, COURTYARD, roomForIlju, roomForKey, safeIlju } from './ilju-room-core.js?v=20261101-freepath4';
import { enterSocialRoom, getSocialRoomState } from './social.js?v=20261101-peerrequest1';

const dialog = document.createElement('dialog');
dialog.id = 'iljuRoomsDialog'; dialog.className = 'ilju-rooms-dialog'; dialog.setAttribute('aria-labelledby', 'iljuRoomsTitle');
document.body.appendChild(dialog);
let ownIlju = null, selectedElement = '', search = '', error = '', opener = null, entering = false, entryVersion = 0;
let social = getSocialRoomState();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const identity = () => safeIlju(social.ownIlju) || ownIlju;
const occupancy = key => social.connected ? `${social.roomCounts[key] || 0}명 함께 머무는 중` : '출생정보 없이 입장 가능';
function roomCard(room) {
  const mine = room.ilju === identity(), current = social.joined && room.key === social.roomKey;
  return `<button class="ilju-room-card${mine ? ' is-mine' : ''}${current ? ' is-current' : ''}" type="button" data-enter-room="${room.key}" ${entering || social.busy ? 'disabled' : ''} aria-label="${esc(room.label)}${mine ? ', 내 일주방' : ''}${current ? ', 현재 공간 열기' : social.joined ? ', 방으로 이동' : ', 혼자 둘러보기'}"><span class="ilju-room-hanja" aria-hidden="true">${room.ganzi}</span><span class="ilju-room-name">${esc(room.ilju)} <small>일주방</small></span><span class="ilju-room-count">${esc(occupancy(room.key))}</span><span class="ilju-room-invitation">${current ? '현재 방으로 들어가기 ↗' : social.joined ? '방으로 이동하기 ↗' : '혼자 둘러보기 ↗'}</span></button>`;
}
function render() {
  if (!dialog.open) return;
  const own = roomForIlju(identity());
  const list = ILJU_ROOMS.filter(room => (!selectedElement || room.element === selectedElement) && (!search || room.ilju.includes(search) || room.ganzi.includes(search)));
  const active = roomForKey(social.roomKey) || COURTYARD;
  const focused = document.activeElement?.dataset?.enterRoom;
  const wasSearch = document.activeElement?.id === 'iljuRoomSearch';
  const cursor = wasSearch ? document.activeElement.selectionStart : null;
  dialog.innerHTML = `<header class="ilju-rooms-header"><div><p>산사의 고요함을 담은 예순 개의 방</p><h2 id="iljuRoomsTitle">일주방</h2></div><button class="ilju-rooms-close" type="button" data-rooms-close aria-label="일주방 닫기">×</button></header><div class="ilju-rooms-body">${error ? `<p class="ilju-rooms-error" role="alert">${esc(error)}</p>` : ''}<p class="ilju-rooms-intro">큰 목조 방에 자리를 잡고, 나의 일주를 담은 벽화를 바라보세요.<br>앞에는 빈 단상, 마루에는 여러 자리가 놓여 있어요.</p>${own ? `<section class="ilju-room-personal" aria-label="내 일주방"><div><span>나의 일주</span><h3>${own.ilju} <small>${own.ganzi}</small></h3><p>나와 같은 결을 가진 방에서 잠시 쉬어가세요.</p></div><button type="button" data-enter-room="${own.key}" ${entering || social.busy ? 'disabled' : ''}>내 일주방으로 ↗</button></section>` : `<section class="ilju-room-prepare"><div><h3>마음이 가는 방부터 둘러보세요</h3><p>일주를 몰라도 누구나 들어갈 수 있어요.</p></div><button type="button" data-rooms-profile>내 일주 알아보기 ↗</button></section>`}<div class="ilju-room-current"><span>${social.joined ? `함께 머무는 공간 · ${esc(active.label)}` : '방을 고르면 혼자 조용히 둘러볼 수 있어요.'}</span>${social.joined && active.key !== 'courtyard' ? '<button type="button" data-enter-room="courtyard">신당 마당으로 돌아가기</button>' : ''}</div><div class="ilju-room-tools"><label for="iljuRoomSearch">60일주 찾아보기</label><input id="iljuRoomSearch" type="search" placeholder="일주 검색 · 예: 갑자" maxlength="8" value="${esc(search)}" autocomplete="off"><div class="ilju-room-filters" role="group" aria-label="일간 오행으로 찾기">${['','목','화','토','금','수'].map(element => `<button type="button" data-room-element="${element}" aria-pressed="${element === selectedElement}">${element || '전체'}</button>`).join('')}</div></div><div class="ilju-room-grid">${list.length ? list.map(roomCard).join('') : '<p class="ilju-room-no-results">찾는 일주가 없어요. 두 글자로 검색해 주세요.</p>'}</div><p class="ilju-room-note">다른 일주방에도 손님으로 방문할 수 있어요. ‘함께 머물기’에서 공개 범위를 확인하면 나그네와 만날 수 있고, 궁합은 서로 승인해야 열려요.</p></div><footer class="ilju-rooms-footer"><span>혼자 둘러보기는 정보 입력 없이 · 함께 머물 때 닉네임·캐릭터·위치·일주 공개</span><span>생년월일·시간·성별 원문 비공개</span></footer>`;
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
function enterInterior(key) {
  dialog.close();
  document.dispatchEvent(new CustomEvent('sowon:ilju-interior-open', { detail: { roomKey: key } }));
}
dialog.addEventListener('click', async event => {
  if (event.target.closest('[data-rooms-close]')) { dialog.close(); return; }
  if (event.target.closest('[data-rooms-profile]')) { dialog.close(); document.dispatchEvent(new CustomEvent('sowon:profile-open')); return; }
  const filter = event.target.closest('[data-room-element]');
  if (filter) { selectedElement = filter.dataset.roomElement; render(); dialog.querySelector(`[data-room-element="${selectedElement}"]`)?.focus({ preventScroll: true }); return; }
  const target = event.target.closest('[data-enter-room]');
  social = getSocialRoomState();
  if (!target || entering || social.busy || !roomForKey(target.dataset.enterRoom)) return;
  const key = roomForKey(target.dataset.enterRoom).key;
  // Looking around alone neither creates a session nor publishes an identity.
  if (!social.joined) { enterInterior(key); return; }
  const version = ++entryVersion;
  entering = true; error = ''; render();
  try {
    const confirmed = await enterSocialRoom(key);
    social = getSocialRoomState();
    if (version !== entryVersion || !dialog.open) return;
    if (confirmed && social.joined && social.roomKey === key) enterInterior(key);
    else if (!error) error = '방에 연결하지 못했어요. 현재 공간에 계속 머물러요. 잠시 후 다시 시도해 주세요.';
  } catch {
    if (version === entryVersion && dialog.open) error = '방에 연결하지 못했어요. 현재 공간에 계속 머물러요. 잠시 후 다시 시도해 주세요.';
  }
  finally { entering = false; social = getSocialRoomState(); render(); }
});
dialog.addEventListener('input', event => { if (event.target.id === 'iljuRoomSearch') { search = event.target.value.trim().slice(0, 8); render(); } });
dialog.addEventListener('close', () => { entryVersion++; if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); if (opener?.isConnected) opener.focus({ preventScroll: true }); } });
document.addEventListener('sowon:identity-change', event => { ownIlju = safeIlju(event.detail?.ilju); render(); });
document.addEventListener('sowon:social-state', () => { social = getSocialRoomState(); render(); });
document.addEventListener('sowon:room-error', event => { error = typeof event.detail?.message === 'string' ? event.detail.message : '방에 연결하지 못했어요. 현재 공간에 계속 머물러요.'; render(); });
document.addEventListener('sowon:rooms-open', openIljuRooms);
document.addEventListener('click', event => { if (event.target.closest?.('[data-open-ilju-rooms]')) { event.preventDefault(); openIljuRooms(); } });
document.dispatchEvent(new CustomEvent('sowon:identity-request'));
