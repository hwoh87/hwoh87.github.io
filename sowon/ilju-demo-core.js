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
  },
  {
    id: 'demo-traveler-soha', nickname: '소하', outfit: 'plum',
    x: 2.65, z: 3.8, heading: -Math.PI * .8,
    birth: { y: 1991, mo: 9, d: 21, h: 15, mi: 30, g: 'M' },
  },
  {
    id: 'demo-traveler-yunseul', nickname: '윤슬', outfit: 'dawn',
    x: -5.2, z: -2.95, heading: Math.PI * .65,
    birth: { y: 1996, mo: 2, d: 3, h: 18, mi: 0, g: 'F' },
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
