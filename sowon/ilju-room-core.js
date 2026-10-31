// Only the 60 legitimate stem/branch pairs can become a public room or identity.
const STEM_KR = ['갑','을','병','정','무','기','경','신','임','계'];
const STEM_HJ = ['甲','乙','丙','丁','戊','己','庚','辛','壬','癸'];
const BRANCH_KR = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const BRANCH_HJ = ['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥'];
const ELEMENTS = ['목','목','화','화','토','토','금','금','수','수'];
export const ILJU_ROOMS = Object.freeze(Array.from({ length: 60 }, (_, index) => Object.freeze({
  key: `ilju:${STEM_KR[index % 10]}${BRANCH_KR[index % 12]}`,
  ilju: STEM_KR[index % 10] + BRANCH_KR[index % 12],
  ganzi: STEM_HJ[index % 10] + BRANCH_HJ[index % 12],
  element: ELEMENTS[index % 10],
  label: `${STEM_KR[index % 10]}${BRANCH_KR[index % 12]} 일주방`,
})));
const byIlju = new Map(ILJU_ROOMS.map(room => [room.ilju, room]));
const byKey = new Map(ILJU_ROOMS.map(room => [room.key, room]));
export const COURTYARD = Object.freeze({ key: 'courtyard', ilju: null, ganzi: '', element: null, label: '신당 마당' });
export const safeIlju = value => typeof value === 'string' && byIlju.has(value) ? value : null;
export const roomForIlju = value => byIlju.get(safeIlju(value)) || null;
export const roomForKey = value => value === 'courtyard' ? COURTYARD : byKey.get(value) || null;
export function safeRoomCounts(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([key, count]) => roomForKey(key) && Number.isInteger(count) && count >= 0 && count <= 10000));
}
export function ownIljuFromAnalysis(analysis) {
  const day = analysis?.pillars?.day;
  return safeIlju(day && `${day.stemKr || ''}${day.branchKr || ''}`);
}
