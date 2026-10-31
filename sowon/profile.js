import { PROFILE_KEY, createProfile, readProfile, writeProfile, clearStoredProfile, setActiveProfile, getActiveProfile, getActiveBirth, profileSearch } from './profile-core.js';
import { loadReadingEngine, clearOwnPersonMemory } from './readings.js?v=20261101-editorial1';

export { profileSearch };
export const getOwnProfile = getActiveProfile;
export const getOwnBirth = getActiveBirth;
let storage;
try { storage = localStorage; } catch (_) {}
setActiveProfile(readProfile(storage));

const dialog = document.createElement('dialog');
dialog.id = 'ownProfileDialog';
dialog.className = 'profile-dialog';
dialog.setAttribute('aria-labelledby', 'ownProfileTitle');
dialog.innerHTML = `<header class="profile-header"><div><p>MY STORY IN SAMRA</p><h2 id="ownProfileTitle">나를 알아보는 신당</h2></div><button class="profile-close" type="button" aria-label="출생정보 설정 닫기">×</button></header>
<form class="profile-form" novalidate><p class="profile-lead">출생정보를 한 번 준비하면, 술사를 만날 때 내 무료 해석이 바로 펼쳐져요.</p>
<label class="profile-field">마당에서 쓸 이름 <small>선택 · 다른 나그네에게 보여요</small><input id="ownNickname" name="nickname" type="text" maxlength="12" autocomplete="off" placeholder="나그네" /></label>
<fieldset class="profile-gender"><legend>풀이에 사용할 성별</legend><label><input type="radio" name="gender" value="M" required /><span>남성</span></label><label><input type="radio" name="gender" value="F" required /><span>여성</span></label></fieldset>
<div class="profile-date"><label class="profile-field">달력<select id="ownCalendar" name="calendar"><option value="S">양력</option><option value="L">음력 평달</option><option value="LL">음력 윤달</option></select></label><label class="profile-field">생년월일<input id="ownBirthday" name="birthday" type="text" inputmode="numeric" autocomplete="bday" maxlength="10" placeholder="예: 19950302" aria-describedby="ownDateHelp" required /></label></div><p class="profile-help" id="ownDateHelp">1940년 이후 생년월일을 8자리로 입력해 주세요.</p>
<fieldset class="profile-time"><legend>태어난 시간</legend><div><label class="profile-field">시<select id="ownHour" name="hour"><option value="">선택</option>${Array.from({length:24},(_,h)=>`<option value="${h}">${String(h).padStart(2,'0')}시</option>`).join('')}</select></label><label class="profile-field">분<input id="ownMinute" name="minute" type="number" inputmode="numeric" min="0" max="59" value="0" /></label></div><label class="profile-check"><input id="ownUnknown" name="unknown" type="checkbox" /> 태어난 시간을 몰라요</label></fieldset>
<label class="profile-check profile-remember"><input id="ownRemember" name="remember" type="checkbox" /><span>이 브라우저에 출생정보 기억하기<small>선택하지 않으면 새로고침할 때 사라져요. 공용 기기에서는 선택하지 마세요.</small></span></label>
<p class="profile-privacy">출생정보는 이 브라우저에서 관리해요. 다른 나그네와의 궁합은 별도 요청과 승인 후에만 열려요.</p><p class="profile-status" role="status" aria-live="polite"></p><button class="profile-save" type="submit">내 정보로 풀이 준비하기 ↗</button><button class="profile-delete" type="button" hidden>내 출생정보 지우기</button></form>`;
document.body.appendChild(dialog);
const form = dialog.querySelector('form'), status = dialog.querySelector('.profile-status');
let opener = null, returnToNpc = null, saving = false, reopenNpc = null;
const npcs = new Set(['tojeong', 'seol', 'luna']);

function announceProfile() {
  const profile = getOwnProfile();
  document.dispatchEvent(new CustomEvent('sowon:profile-change', { detail: { hasProfile: Boolean(profile), gender: profile?.birth.g || null, persisted: profile?.persisted === true } }));
  document.querySelectorAll('[data-open-profile]').forEach(button => {
    button.setAttribute('aria-label', profile ? '내 캐릭터 출생정보 수정' : '내 캐릭터 출생정보 입력');
    button.classList.toggle('has-profile', Boolean(profile));
  });
}
function updateUnknown() {
  const unknown = form.elements.unknown.checked;
  form.elements.hour.disabled = unknown; form.elements.minute.disabled = unknown;
}
function populate() {
  const profile = getOwnProfile(), birth = profile?.birth;
  form.reset(); status.textContent = ''; status.classList.remove('is-error');
  form.elements.nickname.value = profile?.nickname || '';
  form.querySelectorAll('[name="gender"]').forEach(input => { input.checked = input.value === birth?.g; });
  form.elements.calendar.value = birth?.calendar || 'S';
  form.elements.birthday.value = birth ? `${birth.y}${String(birth.mo).padStart(2,'0')}${String(birth.d).padStart(2,'0')}` : '';
  form.elements.hour.value = birth && !birth.unk ? String(birth.h) : '';
  form.elements.minute.value = birth && !birth.unk ? String(birth.mi) : '0';
  form.elements.unknown.checked = birth?.unk === true;
  form.elements.remember.checked = profile?.persisted === true;
  dialog.querySelector('.profile-delete').hidden = !profile;
  updateUnknown();
}
export function openProfile({ returnToNpc: requestedNpc } = {}) {
  if (dialog.open || document.querySelector('dialog[open]')) return false;
  returnToNpc = npcs.has(requestedNpc) ? requestedNpc : null;
  opener = document.activeElement; populate(); dialog.showModal(); document.body.classList.add('dialog-open');
  return true;
}
function closeProfile() { if (!saving && dialog.open) dialog.close(); }
function readDraft() {
  const digits = form.elements.birthday.value.replace(/[^0-9]/g, '');
  if (digits.length !== 8) throw new Error('생년월일을 8자리로 입력해 주세요. 예: 19950302');
  if (!form.elements.gender.value) throw new Error('풀이에 사용할 성별을 선택해 주세요.');
  const unk = form.elements.unknown.checked;
  if (!unk && form.elements.hour.value === '') throw new Error('태어난 시를 선택하거나 ‘태어난 시간을 몰라요’를 골라주세요.');
  if (!unk && form.elements.minute.value.trim() === '') throw new Error('태어난 분을 입력해 주세요. 분을 모르면 0분으로 준비할 수 있어요.');
  return { nickname: form.elements.nickname.value, birth: { y: +digits.slice(0,4), mo: +digits.slice(4,6), d: +digits.slice(6,8), g: form.elements.gender.value, calendar: form.elements.calendar.value, unk, h: unk ? -1 : +form.elements.hour.value, mi: unk ? 0 : +form.elements.minute.value } };
}
form.addEventListener('submit', async event => {
  event.preventDefault(); if (saving) return;
  saving = true; const button = dialog.querySelector('.profile-save'); button.disabled = true;
  status.classList.remove('is-error'); status.textContent = '내 풀이를 준비하고 있어요…';
  try {
    const input = readDraft();
    let adapters = {};
    if (input.birth.calendar !== 'S') {
      const bundle = await loadReadingEngine();
      const engine = bundle.com.samramanshang.manseryeok.orrery.js.SajuCalc;
      adapters = { lunarToSolar: (...args) => JSON.parse(engine.lunarToSolar(...args)), solarToLunar: (...args) => JSON.parse(engine.solarToLunar(...args)) };
    }
    const profile = createProfile(input, adapters), previous = getOwnProfile();
    let persisted = false;
    if (form.elements.remember.checked) {
      persisted = writeProfile(storage, profile);
      if (!persisted && previous?.persisted && !clearStoredProfile(storage)) throw new Error('브라우저에 기억한 정보를 바꾸지 못했어요. 저장소 설정을 확인해 주세요.');
    }
    else if (!clearStoredProfile(storage) && previous?.persisted) throw new Error('기억한 출생정보를 지우지 못했어요. 브라우저 저장소 설정을 확인해 주세요.');
    setActiveProfile({ ...profile, persisted }); announceProfile();
    if (form.elements.remember.checked && !persisted) {
      status.textContent = '브라우저 저장소를 사용할 수 없어 이 탭에서만 준비했어요. 아래 버튼을 누르면 계속할 수 있어요.';
      form.elements.remember.checked = false;
      // Keep the successfully prepared profile visible and require an explicit
      // second submit so a blocked store is never presented as remembered.
      return;
    }
    reopenNpc = returnToNpc; dialog.close();
  } catch (error) { status.classList.add('is-error'); status.textContent = error.message || '출생정보를 확인한 뒤 다시 시도해 주세요.'; }
  finally { saving = false; button.disabled = false; }
});
form.elements.unknown.addEventListener('change', updateUnknown);
dialog.querySelector('.profile-close').addEventListener('click', closeProfile);
dialog.addEventListener('cancel', event => { if (saving) event.preventDefault(); });
dialog.querySelector('.profile-delete').addEventListener('click', () => {
  if (saving) return;
  const removed = clearStoredProfile(storage); setActiveProfile(null); clearOwnPersonMemory(); announceProfile(); populate();
  status.textContent = removed ? '내 출생정보를 지웠어요. 다시 입력하기 전에는 자동 풀이를 열지 않아요.' : '이 탭의 출생정보는 지웠어요. 브라우저에 기억한 정보는 저장소 설정에서 지워주세요.';
});
dialog.addEventListener('close', () => {
  const npc = reopenNpc; reopenNpc = null; returnToNpc = null;
  if (!document.querySelector('dialog[open]')) { document.body.classList.remove('dialog-open'); if (opener?.isConnected) opener.focus({ preventScroll: true }); }
  if (npc) queueMicrotask(() => document.dispatchEvent(new CustomEvent('sowon:encounter', { detail: { npc } })));
});
document.addEventListener('click', event => {
  if (event.target.closest?.('[data-open-profile]')) { event.preventDefault(); openProfile(); }
});
document.addEventListener('sowon:profile-open', event => openProfile(event.detail || {}));
document.addEventListener('sowon:profile-request', announceProfile);
window.addEventListener('storage', event => {
  if (event.key !== PROFILE_KEY && event.key !== null) return;
  setActiveProfile(readProfile(storage)); clearOwnPersonMemory(); announceProfile();
  if (dialog.open && !saving) populate();
});
announceProfile();
