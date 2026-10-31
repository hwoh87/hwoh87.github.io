export const SOCIAL_ENDPOINT = 'https://sidxbzpbesbaiokxrqsf.supabase.co/functions/v1/shrine-social';
export const SOCIAL_SESSION_KEY = 'samra.sowon.social.session.v1';
export const RELATION_KINDS = Object.freeze({ COUPLE: '연인·부부', FRIEND: '친구', FAMILY: '가족', BUSINESS: '동업·동료' });
const STATES = ['pending', 'approved', 'declined', 'cancelled', 'revoked', 'expired'];
const OUTFITS = ['sage', 'moon', 'dawn', 'plum'];
export const cleanText = (value, max = 120) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, max) : '';
export const validId = value => typeof value === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
export function safePosition(raw = {}) {
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));
  return { x: clamp(raw.x, -23, 23), z: clamp(raw.z, -25, 22), heading: clamp(raw.heading, -Math.PI, Math.PI), outfit: OUTFITS.includes(raw.outfit) ? raw.outfit : 'sage' };
}
export function serverProfile(profile) {
  const value = profile?.solar;
  if (!value || ![value.y, value.mo, value.d].every(Number.isInteger) || value.y < 1900 || value.y > new Date().getFullYear() || !['M', 'F'].includes(value.g)) return null;
  const date = new Date(Date.UTC(value.y, value.mo - 1, value.d));
  if (date.getUTCFullYear() !== value.y || date.getUTCMonth() !== value.mo - 1 || date.getUTCDate() !== value.d) return null;
  const unknown = value.unk === true || value.h === -1;
  if (!unknown && (!Number.isInteger(value.h) || value.h < 0 || value.h > 23 || !Number.isInteger(value.mi) || value.mi < 0 || value.mi > 59)) return null;
  return { nickname: cleanText(profile.nickname, 12) || '나그네', birth: { year: value.y, month: value.mo, day: value.d, hour: unknown ? -1 : value.h, minute: unknown ? 0 : value.mi, gender: value.g, calendar: 'S' } };
}
export function sameServerProfile(a, b) {
  if (!a || !b || cleanText(a.nickname, 12) !== cleanText(b.nickname, 12)) return false;
  return ['year', 'month', 'day', 'hour', 'minute', 'gender', 'calendar'].every(key => a.birth?.[key] === b.birth?.[key]);
}
export function safeVisitors(raw, selfId) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 60).filter(item => item && validId(item.id) && item.id !== selfId && !seen.has(item.id) && seen.add(item.id) && Number.isFinite(item.x) && Number.isFinite(item.z)).map(item => ({ id: item.id, nickname: cleanText(item.nickname, 12) || '나그네', ...safePosition(item) }));
}
export function safeRequests(raw) {
  if (!Array.isArray(raw)) return [];
  const seen = new Set();
  return raw.slice(0, 100).filter(item => item && validId(item.id) && !seen.has(item.id) && seen.add(item.id) && ['incoming', 'outgoing'].includes(item.direction) && STATES.includes(item.status) && Object.hasOwn(RELATION_KINDS, item.kind) && validId(item.peer?.id)).map(item => ({
    id: item.id, direction: item.direction, peer: { id: item.peer.id, nickname: cleanText(item.peer.nickname, 12) || '나그네' }, kind: item.kind, status: item.status,
    created_at: cleanText(item.created_at, 40), expires_at: cleanText(item.expires_at, 40),
  }));
}
export function availableActions(request) {
  if (request?.status === 'pending') return request.direction === 'incoming' ? ['approve', 'decline'] : ['cancel'];
  return request?.status === 'approved' ? ['result', 'revoke'] : [];
}
export function readSocialSession(storage, now = Date.now()) {
  try {
    const value = JSON.parse(storage?.getItem(SOCIAL_SESSION_KEY) || 'null');
    if (!value || !/^[a-f0-9]{64}$/.test(value.token) || !validId(value.sessionId) || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= now + 30000) return null;
    return { token: value.token, sessionId: value.sessionId, expires_at: value.expires_at };
  } catch (_) { return null; }
}
export function writeSocialSession(storage, value) {
  const safe = readSocialSession({ getItem: () => JSON.stringify(value) });
  if (!safe) return false;
  try { storage?.setItem(SOCIAL_SESSION_KEY, JSON.stringify(safe)); return Boolean(storage); } catch (_) { return false; }
}
const score = value => Number.isFinite(value) ? Math.max(0, Math.min(100, value)) : null;
function textRows(value, fields) {
  return Array.isArray(value) ? value.slice(0, 20).map(row => Object.fromEntries(fields.map(key => [key, cleanText(row?.[key], key === 'detail' || key === 'text' || key === 'sub' ? 1600 : 220)]))).filter(row => Object.values(row).some(Boolean)) : [];
}
/** Only the engine's public interpretation is retained. Never adopt birth/profile data from a response. */
export function safeResult(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw.analysis || raw.result || raw;
  if (score(r.totalScore) === null || typeof r.verdict !== 'string') return null;
  const subScores = Object.fromEntries(['bond', 'stability', 'growth', 'consumption'].map(key => [key, score(r.subScores?.[key])]));
  return { totalScore: score(r.totalScore), verdict: cleanText(r.verdict, 1600), confidence: score(r.confidence), unknownTimeA: r.unknownTimeA === true, unknownTimeB: r.unknownTimeB === true,
    subScores, narrative: textRows(r.narrative, ['icon', 'label', 'text']), strengths: textRows(r.strengths, ['emoji', 'label', 'sub']), cautions: textRows(r.cautions, ['emoji', 'label', 'sub']),
    axes: textRows(r.axes, ['name', 'tone', 'headline', 'detail']),
    iljuPair: r.iljuPair ? Object.fromEntries(['tone', 'headline', 'detail', 'advice'].map(key => [key, cleanText(r.iljuPair[key], 1600)])) : null,
    names: { a: cleanText(raw.names?.a || raw.nameA, 12), b: cleanText(raw.names?.b || raw.nameB, 12) },
  };
}
export function socialError(error) {
  const code = error?.code || error?.message;
  const messages = { peer_not_nearby: '서로 조금 더 가까이 다가간 뒤 요청해 주세요.', profile_changed: '내 정보가 바뀌었어요. 다시 참여해 주세요.', decision_forbidden: '이 선택은 해당 궁합의 참여자만 할 수 있어요.', consent_required: '아직 두 사람의 승인이 모이지 않았어요.', request_limit: '궁합 요청이 잠시 몰렸어요. 조금 뒤에 다시 청해 주세요.', not_found: '이 궁합 소식을 찾을 수 없어요. 만료되었거나 공유가 지워졌을 수 있어요.', relation_unavailable: '이 관계로는 궁합을 볼 수 없어요. 친구·가족 관계로 만나 주세요.', unavailable: '만남 연결을 잠시 준비하고 있어요. 조금 뒤에 다시 참여해 주세요.', profile_required: '내 출생 정보를 먼저 준비해 주세요.', target_unavailable: '그 나그네가 잠시 자리를 비웠어요. 새로고침 후 다시 만나 주세요.', target_offline: '그 나그네가 잠시 자리를 비웠어요.', too_far: '서로 조금 더 가까이 다가간 뒤 요청해 주세요.', target_too_far: '서로 조금 더 가까이 다가간 뒤 요청해 주세요.', request_exists: '이미 같은 나그네와 나누고 있는 궁합 소식이 있어요.', duplicate_request: '이미 보낸 요청이 있어요. 궁합 소식을 확인해 주세요.', request_expired: '요청의 유효 시간이 지났어요. 다시 만나 새로 요청해 주세요.', session_expired: '만남 시간이 끝났어요. 다시 참여하면 새롭게 만날 수 있어요.', invalid_session: '만남 시간이 끝났어요. 다시 참여해 주세요.', not_approved: '아직 두 사람의 승인이 모이지 않았어요.', forbidden: '이 궁합은 두 참여자만 열 수 있어요.', result_revoked: '한 참여자가 공유를 철회했어요.', minor_blocked: '미성년자가 포함된 연인·부부 궁합은 제공하지 않아요. 친구·가족 관계를 골라 주세요.', rate_limited: '요청이 잠시 몰렸어요. 조금 뒤에 다시 시도해 주세요.', bad_inputs: '입력한 정보를 다시 확인해 주세요.', service_unavailable: '만남 연결을 아직 준비하고 있어요. 내 술사 해석은 계속 이용할 수 있어요.' };
  return messages[code] || '만남 연결이 잠시 고르지 않아요. 잠시 후 새로고침해 주세요.';
}
export function createSocialClient({ endpoint = SOCIAL_ENDPOINT, fetcher = globalThis.fetch, storage, now = () => Date.now() } = {}) {
  let session = readSocialSession(storage, now());
  let bootstrapPromise;
  async function post(body, token, signal, keepalive = false) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try { response = await fetcher(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal, referrerPolicy: 'no-referrer', cache: 'no-store', keepalive }); }
    catch (error) { if (error?.name === 'AbortError') throw error; throw Object.assign(new Error('network'), { code: 'network' }); }
    let data;
    try { data = await response.json(); } catch (_) {}
    if (!response.ok || !data || data.error) { const code = (response.status === 404 && !data?.error) || data?.code === 'NOT_FOUND' || data?.error === 'NOT_FOUND' ? 'service_unavailable' : data?.error || `http_${response.status}`; throw Object.assign(new Error(code), { code }); }
    return data;
  }
  async function ensureSession(signal) {
    if (session && Date.parse(session.expires_at) > now() + 30000) return session;
    if (!bootstrapPromise) bootstrapPromise = post({ action: 'bootstrap' }, null, signal).then(value => {
      const safe = readSocialSession({ getItem: () => JSON.stringify(value) }, now());
      if (!safe) throw Object.assign(new Error('bad_session'), { code: 'service_unavailable' });
      session = safe; writeSocialSession(storage, safe); return safe;
    }).finally(() => { bootstrapPromise = null; });
    return bootstrapPromise;
  }
  return { async start(signal) { return ensureSession(signal); }, async call(action, params = {}, { signal, keepalive = false } = {}) {
    // Calling start is an explicit opt-in. Background callers cannot create an identity.
    if (!session) throw Object.assign(new Error('session_expired'), { code: 'session_expired' });
    if (Date.parse(session.expires_at) <= now()) throw Object.assign(new Error('session_expired'), { code: 'session_expired' });
    return post({ ...params, action }, session.token, signal, keepalive);
  }, clear() { session = null; try { storage?.removeItem(SOCIAL_SESSION_KEY); } catch (_) {} }, hasSession() { return Boolean(session && Date.parse(session.expires_at) > now()); } };
}
