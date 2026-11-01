import { findPath, isWalkable, segmentClear, stepWithCollisions } from './locomotion.js?v=20261101-templeroom1';
import { publicVisitor } from './visitors.js?v=20261101-demo-walk4';

const SPEED = 1.08;
const REQUEST_AFTER = 5;
const APPROVAL_DELAY = 2.5;
const NEAR = 1.95;
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = value => value && Number.isFinite(value.x) && Number.isFinite(value.z);
const copyPoint = value => value ? { x: value.x, z: value.z } : null;
const patrols = [
  [{ x: -4.5, z: 3.8 }, { x: -4.5, z: -.5 }, { x: -2.5, z: 6 }],
  [{ x: 4.5, z: 1.6 }, { x: 4.5, z: 5.5 }, { x: 2.5, z: -.5 }],
  [{ x: -3.8, z: -4.7 }, { x: -4.5, z: 1.6 }, { x: -2.5, z: 3.7 }],
];

/** Local fictional walkers. No presence connection, timers or DOM input is created. */
export function createDemoWalk({ world, visitors = [] } = {}) {
  if (!world || !Array.isArray(world.colliders)) throw new TypeError('A walkable room is required.');
  const originals = visitors.map(publicVisitor).filter(value => value && isWalkable(value, world)).slice(0, 3);
  let actors, elapsed, requestSent, eventCount, disposed = false;

  function initialize() {
    elapsed = 0; requestSent = false; eventCount = 0;
    actors = originals.map((visitor, index) => ({
      ...visitor, index, mode: 'resting', moving: false, route: [], target: null,
      patrolIndex: 0, restUntil: .7 + index * .55, replanAt: 0,
      phase: 'idle', revision: 0, outgoingRevision: null, emittedRevision: null,
      nearbySeconds: 0, playerAtPlan: null,
    }));
  }
  initialize();

  // Give other people a small personal space. These temporary obstacles are
  // used by the same planner as the real avatar, without altering the room.
  function navigationWorld(actor, player) {
    const colliders = [...world.colliders];
    for (const other of actors) if (other !== actor && distance(actor, other) > .62) {
      colliders.push({ minX: other.x - .24, maxX: other.x + .24, minZ: other.z - .24, maxZ: other.z + .24 });
    }
    if (point(player) && distance(actor, player) > .86) {
      colliders.push({ minX: player.x - .48, maxX: player.x + .48, minZ: player.z - .48, maxZ: player.z + .48 });
    }
    return { bounds: world.bounds, colliders };
  }

  function plan(actor, target, player) {
    const route = findPath(actor, target, navigationWorld(actor, player));
    if (!route) return false;
    actor.route = route; actor.target = copyPoint(target);
    actor.playerAtPlan = copyPoint(player); actor.replanAt = elapsed + .8;
    return true;
  }

  function approach(actor, player) {
    if (!point(player)) return;
    const gap = distance(actor, player);
    if (gap >= 1.35 && gap <= NEAR) {
      actor.route = []; actor.target = null; actor.moving = false;
      actor.heading = Math.atan2(player.x - actor.x, player.z - actor.z);
      actor.mode = 'waiting';
      return;
    }
    actor.mode = 'approaching';
    const changed = !actor.playerAtPlan || distance(player, actor.playerAtPlan) > .6;
    if (elapsed < actor.replanAt && (!changed || actor.route.length)) return;
    actor.route = []; actor.target = null; actor.replanAt = elapsed + .8;
    const bearing = Math.atan2(actor.x - player.x, actor.z - player.z);
    const candidates = [];
    for (const radius of [1.75, 1.9]) for (let index = 0; index < 12; index++) {
      const angle = bearing + index * Math.PI / 6;
      const target = { x: player.x + Math.sin(angle) * radius, z: player.z + Math.cos(angle) * radius };
      if (isWalkable(target, world) && actors.every(other => other === actor || distance(target, other) > .9)) candidates.push(target);
    }
    candidates.sort((a, b) => distance(actor, a) - distance(actor, b));
    for (const target of candidates) if (plan(actor, target, player)) break;
  }

  function stroll(actor, player) {
    actor.mode = actor.route.length ? 'strolling' : 'resting';
    if (actor.route.length || elapsed < actor.restUntil) return;
    const locations = patrols[actor.index % patrols.length];
    for (let tries = 0; tries < locations.length; tries++) {
      const target = locations[actor.patrolIndex++ % locations.length];
      if (point(player) && distance(target, player) < 1) continue;
      if (plan(actor, target, player)) { actor.mode = 'strolling'; return; }
    }
    actor.restUntil = elapsed + 1;
  }

  function move(actor, dt, player) {
    actor.moving = false;
    let remaining = SPEED * dt;
    while (remaining > .00001 && actor.route.length) {
      const next = actor.route[0], gap = distance(actor, next);
      if (gap < .005) { actor.route.shift(); continue; }
      const step = Math.min(gap, remaining);
      const dx = (next.x - actor.x) / gap * step, dz = (next.z - actor.z) / gap * step;
      const candidate = stepWithCollisions(actor, { x: dx, z: dz }, world);
      const closest = actors.filter(other => other !== actor);
      const crowdsPeer = closest.some(other => distance(candidate, other) < .58 && distance(candidate, other) < distance(actor, other));
      const crowdsPlayer = point(player) && distance(candidate, player) < .78 && distance(candidate, player) < distance(actor, player);
      if (distance(actor, candidate) < .00001 || crowdsPeer || crowdsPlayer || !segmentClear(actor, candidate, world)) {
        actor.route = []; actor.target = null; actor.replanAt = elapsed + .4; actor.restUntil = elapsed + .4; break;
      }
      actor.heading = Math.atan2(candidate.x - actor.x, candidate.z - actor.z);
      actor.x = candidate.x; actor.z = candidate.z; actor.moving = true;
      remaining -= step;
      if (gap <= step + .005) actor.route.shift();
    }
    if (!actor.route.length && actor.mode === 'strolling') {
      actor.mode = 'resting'; actor.target = null; actor.restUntil = elapsed + 1.2 + actor.index * .25;
    }
  }

  function getState() {
    return {
      elapsed, requestSent, eventCount,
      peers: actors.map(actor => ({
        id: actor.id, mode: actor.mode, moving: actor.moving, x: actor.x, z: actor.z,
        target: copyPoint(actor.target), phase: actor.phase, revision: actor.revision,
        nearbySeconds: actor.nearbySeconds,
      })),
    };
  }

  function result(events = []) {
    return { visitors: actors.map(publicVisitor), events, state: getState() };
  }

  function update(delta, { position, blocked = false, phases = {} } = {}) {
    if (disposed || blocked || !point(position)) return result();
    const dt = Number.isFinite(delta) ? Math.max(0, Math.min(delta, .1)) : 0;
    if (!dt) return result();
    elapsed += dt;
    const events = [];
    const snapshots = Array.isArray(phases) ? new Map(phases.map(snapshot => [snapshot?.peerId || snapshot?.id, snapshot])) : phases;
    for (const actor of actors) {
      const snapshot = snapshots instanceof Map ? snapshots.get(actor.id) : snapshots?.[actor.id];
      const phase = typeof snapshot?.phase === 'string' ? snapshot.phase : 'idle';
      const revision = Number.isSafeInteger(snapshot?.revision) && snapshot.revision >= 0 ? snapshot.revision : 0;
      if (phase !== actor.phase || revision !== actor.revision) {
        actor.route = []; actor.target = null; actor.nearbySeconds = 0; actor.playerAtPlan = null; actor.replanAt = 0;
      }
      actor.phase = phase; actor.revision = revision;
      if (phase !== 'pending-outgoing') actor.outgoingRevision = null;
      else if (actor.outgoingRevision !== revision) { actor.outgoingRevision = revision; actor.nearbySeconds = 0; }

      const autoRequest = actor.index === 0 && !requestSent && phase === 'idle' && elapsed >= REQUEST_AFTER;
      const autoApprove = phase === 'pending-outgoing' && actor.emittedRevision !== revision;
      if (autoRequest || autoApprove || phase === 'pending-incoming') approach(actor, position);
      else stroll(actor, position);
      move(actor, dt, position);
      const nearby = distance(actor, position) >= 1.3 && distance(actor, position) <= NEAR + .02 && !actor.route.length;
      if (nearby && (autoRequest || autoApprove)) {
        actor.mode = 'waiting'; actor.heading = Math.atan2(position.x - actor.x, position.z - actor.z);
        actor.nearbySeconds += dt;
        if (autoRequest) {
          requestSent = true;
          events.push({ type: 'request', peerId: actor.id, revision });
        } else if (actor.nearbySeconds + 1e-8 >= APPROVAL_DELAY) {
          actor.emittedRevision = revision;
          events.push({ type: 'approve', peerId: actor.id, revision });
        }
      } else actor.nearbySeconds = 0;
    }
    eventCount += events.length;
    return result(events);
  }

  return Object.freeze({
    update, getState,
    reset() { if (!disposed) initialize(); return result(); },
    dispose() { if (disposed) return; disposed = true; for (const actor of actors) { actor.route = []; actor.target = null; actor.moving = false; } },
  });
}
