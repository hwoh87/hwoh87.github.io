/** Personal birth data never belongs in shrine URLs, journeys or analytics. */
export const PROFILE_KEY = 'samra.sowon.profile.v1';
const KINDS = new Set(['saju', 'gunghap', 'jami', 'star']);
const CALENDARS = new Set(['S', 'L', 'LL']);
let activeProfile = null;

function copy(value) { return value && { ...value, birth: { ...value.birth }, solar: { ...value.solar } }; }
function validDay(y, mo, d, today) {
  if (![y, mo, d].every(Number.isInteger) || y < 1940 || y > today.getFullYear() || mo < 1 || mo > 12 || d < 1 || d > 31) return false;
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d && date <= today;
}
function birthShape(input, today) {
  if (!input || typeof input !== 'object' || !CALENDARS.has(input.calendar) || !['M', 'F'].includes(input.g)) return null;
  const { y, mo, d, g, calendar } = input;
  if (![y, mo, d].every(Number.isInteger) || y < 1940 || y > today.getFullYear() || mo < 1 || mo > 12 || d < 1 || d > (calendar === 'S' ? 31 : 30)) return null;
  if (calendar === 'S' && !validDay(y, mo, d, today)) return null;
  const unk = input.unk === true || input.h === -1;
  const h = unk ? -1 : input.h, mi = unk ? 0 : input.mi;
  if (!unk && (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(mi) || mi < 0 || mi > 59)) return null;
  return { y, mo, d, h, mi, g, unk, calendar };
}
export function publicNickname(value) {
  return Array.from((typeof value === 'string' ? value : '').normalize('NFKC').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g, '').trim()).slice(0, 12).join('');
}

/** The converter is the same KMP engine used by the canonical calculators. */
export function createProfile(input, { lunarToSolar, solarToLunar, today = new Date() } = {}) {
  const birth = birthShape(input?.birth || input, today);
  if (!birth) throw new Error('성별과 생년월일·시간을 확인해 주세요. 1940년 이후의 실제 날짜를 입력해 주세요.');
  let solar = { ...birth };
  if (birth.calendar !== 'S') {
    if (typeof lunarToSolar !== 'function' || typeof solarToLunar !== 'function') throw new Error('음력 달력을 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
    const converted = lunarToSolar(birth.y, birth.mo, birth.d, birth.calendar === 'LL');
    if (!converted) throw new Error('음력 날짜를 변환하지 못했어요.');
    const actual = solarToLunar(converted.year, converted.month, converted.day);
    // The engine can repair invalid lunar days/leap months. A personal profile
    // must ask for correction rather than silently remembering a different date.
    if (!actual || actual.year !== birth.y || actual.month !== birth.mo || actual.day !== birth.d || actual.isLeap !== (birth.calendar === 'LL')) throw new Error('입력한 음력 날짜나 윤달이 실제 달력과 달라요. 달력과 날짜를 다시 확인해 주세요.');
    solar = { ...solar, y: converted.year, mo: converted.month, d: converted.day };
  }
  if (!validDay(solar.y, solar.mo, solar.d, today)) throw new Error('태어난 날짜는 오늘 이전의 실제 날짜여야 해요.');
  delete solar.calendar;
  return { version: 1, nickname: publicNickname(input.nickname), birth, solar, persisted: false };
}

/** Revalidate storage and retain only the explicit personal-profile schema. */
export function normalizeProfile(input, { today = new Date() } = {}) {
  if (!input || input.version !== 1) return null;
  const birth = birthShape(input.birth, today), s = input.solar;
  if (!birth || !s || !validDay(s.y, s.mo, s.d, today)) return null;
  const solar = { y: s.y, mo: s.mo, d: s.d, h: birth.h, mi: birth.mi, g: birth.g, unk: birth.unk };
  if (s.h !== solar.h || s.mi !== solar.mi || s.g !== solar.g || s.unk !== solar.unk) return null;
  if (birth.calendar === 'S' && (birth.y !== s.y || birth.mo !== s.mo || birth.d !== s.d)) return null;
  return { version: 1, nickname: publicNickname(input.nickname), birth, solar, persisted: input.persisted === true };
}
export function readProfile(storage) {
  try { const value = normalizeProfile(JSON.parse(storage?.getItem(PROFILE_KEY) || 'null')); return value && { ...value, persisted: true }; }
  catch (_) { return null; }
}
export function writeProfile(storage, profile) {
  const value = normalizeProfile(profile);
  if (!value) return false;
  try {
    if (!storage) return false;
    const { version, nickname, birth, solar } = value;
    storage.setItem(PROFILE_KEY, JSON.stringify({ version, nickname, birth, solar }));
    return true;
  } catch (_) { return false; }
}
export function clearStoredProfile(storage) {
  try { storage?.removeItem(PROFILE_KEY); return true; } catch (_) { return false; }
}
export function setActiveProfile(profile) { activeProfile = normalizeProfile(profile); return copy(activeProfile); }
export function getActiveProfile() { return copy(activeProfile); }
export function getActiveBirth() { return activeProfile && { ...activeProfile.solar }; }

/** Only virtual calculator URLs receive these values; never the shrine URL. */
export function profileSearch(kind, profile = activeProfile) {
  if (!KINDS.has(kind)) return '';
  const person = normalizeProfile(profile)?.solar;
  if (!person) return '';
  const prefix = kind === 'gunghap' ? 'a' : '', query = new URLSearchParams();
  for (const key of ['y', 'mo', 'd', 'g']) query.set(prefix + key, String(person[key]));
  if (person.unk) query.set(prefix + 'unk', '1');
  else { query.set(prefix + 'h', String(person.h)); query.set(prefix + 'mi', String(person.mi)); }
  return '?' + query.toString();
}
