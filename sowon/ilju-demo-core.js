/** A local interaction rehearsal. These adults are fictional and never join presence. */
function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

export const DEMO_SELF = freezeTree({
  id: 'demo-traveler-self', nickname: '체험하는 나',
  birth: { y: 1990, mo: 1, d: 1, h: 12, mi: 0, g: 'M' },
});

export const DEMO_TRAVELERS = freezeTree([
  {
    id: 'demo-traveler-daon', nickname: '다온', outfit: 'moon',
    x: -2.65, z: 6.05, heading: Math.PI,
    birth: { y: 1993, mo: 5, d: 12, h: 9, mi: 0, g: 'F' },
    greeting: '어서 와요. 저는 다온이에요. 잠깐 앉아서 이야기 나눌래요?',
    topics: [
      { id: 'room', label: '여기는 어떤 곳이야?', reply: '같은 일주를 가진 나그네가 쉬어 가는 방이에요. 벽화를 가까이 보면 방마다 다른 이야기가 보여요.' },
      { id: 'rest', label: '처음 와서 조금 어색해.', reply: '처음에는 누구나 그렇죠. 마음에 드는 방석부터 골라 봐요. 조용히 머물기만 해도 괜찮아요.' },
      { id: 'compatibility', label: '우리 궁합도 볼 수 있어?', reply: '좋아요. 먼저 친구 궁합을 요청해 주세요. 두 사람이 모두 동의한 뒤에 함께 보는 흐름을 체험할 수 있어요.' },
    ],
  },
  {
    id: 'demo-traveler-soha', nickname: '소하', outfit: 'plum',
    x: 2.65, z: 3.8, heading: -Math.PI * .8,
    birth: { y: 1991, mo: 9, d: 21, h: 15, mi: 30, g: 'M' },
    greeting: '반가워요, 소하예요. 방금 벽화를 보고 있었어요. 무엇이 궁금해요?',
    topics: [
      { id: 'room', label: '벽화에서 뭘 보고 있었어?', reply: '색과 풍경을 먼저 봐요. 같은 그림도 오늘 마음에 따라 다르게 다가오더라고요. 앞쪽에서 크게 볼 수도 있어요.' },
      { id: 'rest', label: '나그네를 만나면 뭘 할 수 있어?', reply: '가까이 다가가 이름을 눌러 보세요. 실제 나그네와는 서로 승인한 뒤 친구 궁합을 함께 볼 수 있어요.' },
      { id: 'compatibility', label: '네가 궁합을 요청해 줄래?', reply: '그럼 제가 먼저 청해 볼게요. 아래에서 받는 요청을 체험해 보세요. 원치 않으면 편하게 거절해도 돼요.' },
    ],
  },
  {
    id: 'demo-traveler-yunseul', nickname: '윤슬', outfit: 'dawn',
    x: 5.2, z: -.7, heading: -Math.PI * .65,
    birth: { y: 1996, mo: 2, d: 3, h: 18, mi: 0, g: 'F' },
    greeting: '안녕하세요. 윤슬이에요. 여기 빛이 참 편안하죠? 천천히 둘러봐요.',
    topics: [
      { id: 'room', label: '어느 자리가 좋아?', reply: '저는 가장자리의 조용한 자리가 좋아요. 가운데에서 방 전체를 보다가 마음이 가는 방석에 앉아 보세요.' },
      { id: 'rest', label: '궁합이 좋으면 잘 맞는 거야?', reply: '점수보다 서로 편한 점과 다른 점을 함께 읽어 보면 좋아요. 실제 관계는 두 사람이 나누는 대화로 알아가는 거니까요.' },
      { id: 'compatibility', label: '궁합을 본 뒤에는 어떻게 해?', reply: '승인한 뒤 풀이를 열고, 원하면 공유를 철회할 수 있어요. 철회하면 다시 승인하기 전까지 결과가 닫히는 흐름을 체험해 보세요.' },
    ],
  },
]);

const ids = new Set(DEMO_TRAVELERS.map(traveler => traveler.id));
const kinds = new Set(['FRIEND', 'COUPLE', 'FAMILY', 'BUSINESS']);
const actions = new Set(['request', 'receive', 'approve', 'decline', 'cancel', 'peer-approve', 'peer-decline', 'revoke', 'reset']);
const restartable = new Set(['idle', 'declined', 'cancelled', 'revoked']);

/** No birth information or invented day-pillar badge enters the public 3D labels. */
export function getDemoVisitors(_roomIlju) {
  return freezeTree(DEMO_TRAVELERS.map(({ id, nickname, x, z, heading, outfit }) => ({ id, nickname, x, z, heading, outfit })));
}

function requireId(id) {
  if (typeof id !== 'string') throw new TypeError('A demo traveler ID must be a string.');
  if (!ids.has(id)) throw new RangeError('Unknown demo traveler.');
}

function snapshot(id, phase = 'idle', kind = 'FRIEND', revision = 0) {
  return Object.freeze({ id, phase, kind, revision, resultAllowed: phase === 'approved' });
}

/**
 * Consent is explicit and direction-specific. The session contains no calculated
 * result: the caller may run the reading engine only while resultAllowed is true.
 * Revisions let a dialog discard a late calculation after reset or withdrawal.
 */
export function createDemoSession() {
  const states = new Map(DEMO_TRAVELERS.map(({ id }) => [id, snapshot(id)]));

  function get(id) {
    requireId(id);
    return states.get(id);
  }

  function act(id, action, kind) {
    const previous = get(id);
    if (typeof action !== 'string' || !actions.has(action)) throw new TypeError('Unknown demo action.');
    if (kind !== undefined && (typeof kind !== 'string' || !kinds.has(kind))) throw new TypeError('Unknown relationship kind.');
    if (kind !== undefined && action !== 'request' && action !== 'receive') throw new TypeError('A relationship is chosen when making a request.');

    let phase;
    if (action === 'reset') phase = 'idle';
    else if ((action === 'request' || action === 'receive') && restartable.has(previous.phase)) phase = action === 'request' ? 'pending-outgoing' : 'pending-incoming';
    else if (previous.phase === 'pending-incoming' && action === 'approve') phase = 'approved';
    else if (previous.phase === 'pending-incoming' && action === 'decline') phase = 'declined';
    else if (previous.phase === 'pending-outgoing' && action === 'peer-approve') phase = 'approved';
    else if (previous.phase === 'pending-outgoing' && action === 'peer-decline') phase = 'declined';
    else if (previous.phase === 'pending-outgoing' && action === 'cancel') phase = 'cancelled';
    else if (previous.phase === 'approved' && action === 'revoke') phase = 'revoked';
    else throw new RangeError('This action is unavailable in the current demo state.');

    const nextKind = action === 'reset' ? 'FRIEND' : (kind || previous.kind);
    const next = snapshot(id, phase, nextKind, previous.revision + 1);
    states.set(id, next);
    return next;
  }

  return Object.freeze({
    get,
    act,
    has(id) { return typeof id === 'string' && ids.has(id); },
    reset() { return Object.freeze(DEMO_TRAVELERS.map(({ id }) => act(id, 'reset'))); },
  });
}
