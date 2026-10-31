import * as THREE from 'three';

export const PLAYER_RADIUS = 0.30;

const validPoint = point => Boolean(point && Number.isFinite(point.x) && Number.isFinite(point.z));
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const rectangles = world => Array.isArray(world && world.colliders) ? world.colliders.filter(rect => rect && ['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(rect[key])) && rect.minX <= rect.maxX && rect.minZ <= rect.maxZ) : [];
const limits = world => world && world.bounds || { minX: -13, maxX: 13, minZ: -15, maxZ: 15 };

export function isWalkable(point, world, radius = PLAYER_RADIUS) {
  if (!validPoint(point) || !Number.isFinite(radius) || radius < 0) return false;
  const bounds = limits(world);
  if (!['minX', 'maxX', 'minZ', 'maxZ'].every(key => Number.isFinite(bounds[key]))) return false;
  if (point.x < bounds.minX + radius || point.x > bounds.maxX - radius || point.z < bounds.minZ + radius || point.z > bounds.maxZ - radius) return false;
  return !rectangles(world).some(rect => point.x >= rect.minX - radius && point.x <= rect.maxX + radius && point.z >= rect.minZ - radius && point.z <= rect.maxZ + radius);
}

function intersectsRect(from, to, rect, radius) {
  let enter = 0;
  let exit = 1;
  for (const [axis, minKey, maxKey] of [['x', 'minX', 'maxX'], ['z', 'minZ', 'maxZ']]) {
    const direction = to[axis] - from[axis];
    const low = rect[minKey] - radius;
    const high = rect[maxKey] + radius;
    if (Math.abs(direction) < 1e-10) {
      if (from[axis] < low || from[axis] > high) return false;
    } else {
      const first = (low - from[axis]) / direction;
      const second = (high - from[axis]) / direction;
      enter = Math.max(enter, Math.min(first, second));
      exit = Math.min(exit, Math.max(first, second));
      if (enter > exit) return false;
    }
  }
  return enter <= exit && exit >= 0 && enter <= 1;
}

export function segmentClear(from, to, world, radius = PLAYER_RADIUS) {
  if (!isWalkable(from, world, radius) || !isWalkable(to, world, radius)) return false;
  return !rectangles(world).some(rect => intersectsRect(from, to, rect, radius));
}

export function stepWithCollisions(position, delta, world, radius = PLAYER_RADIUS) {
  if (!validPoint(position)) return { x: 0, z: 0 };
  const result = { x: position.x, z: position.z };
  if (!validPoint(delta) || !isWalkable(result, world, radius)) return result;
  const steps = Math.min(512, Math.max(1, Math.ceil(Math.hypot(delta.x, delta.z) / 0.12)));
  const dx = delta.x / steps;
  const dz = delta.z / steps;
  for (let step = 0; step < steps; step += 1) {
    const combined = { x: result.x + dx, z: result.z + dz };
    if (segmentClear(result, combined, world, radius)) { result.x = combined.x; result.z = combined.z; continue; }
    // Move along a surface when the desired diagonal touches a wall or the pond.
    const alongX = { x: result.x + dx, z: result.z };
    if (segmentClear(result, alongX, world, radius)) result.x = alongX.x;
    const alongZ = { x: result.x, z: result.z + dz };
    if (segmentClear(result, alongZ, world, radius)) result.z = alongZ.z;
  }
  return result;
}

export function findPath(start, target, world, options = {}) {
  const radius = options.radius === undefined ? PLAYER_RADIUS : options.radius;
  const cellSize = options.cellSize === undefined ? 0.45 : options.cellSize;
  if (!Number.isFinite(cellSize) || cellSize < 0.15 || !isWalkable(start, world, radius) || !isWalkable(target, world, radius)) return null;
  if (distance(start, target) < 0.0001) return [];
  if (segmentClear(start, target, world, radius)) return [{ x: target.x, z: target.z }];
  const bounds = limits(world);
  const minX = bounds.minX + radius;
  const minZ = bounds.minZ + radius;
  const spanX = bounds.maxX - radius - minX;
  const spanZ = bounds.maxZ - radius - minZ;
  const columns = Math.ceil(spanX / cellSize) + 1;
  const rows = Math.ceil(spanZ / cellSize) + 1;
  if (columns < 2 || rows < 2 || columns * rows > 50000) return null;
  const stepX = spanX / (columns - 1);
  const stepZ = spanZ / (rows - 1);
  const pointAt = index => ({ x: minX + index % columns * stepX, z: minZ + Math.floor(index / columns) * stepZ });
  const allowed = new Int8Array(columns * rows);
  function nodeAllowed(index) {
    if (!allowed[index]) allowed[index] = isWalkable(pointAt(index), world, radius) ? 1 : -1;
    return allowed[index] === 1;
  }
  function nearestNode(point) {
    const centerX = Math.round((point.x - minX) / stepX);
    const centerZ = Math.round((point.z - minZ) / stepZ);
    let best = -1;
    let closest = Infinity;
    for (let ring = 0; ring <= 4; ring += 1) {
      for (let z = Math.max(0, centerZ - ring); z <= Math.min(rows - 1, centerZ + ring); z += 1) {
        for (let x = Math.max(0, centerX - ring); x <= Math.min(columns - 1, centerX + ring); x += 1) {
          const index = z * columns + x;
          if (!nodeAllowed(index)) continue;
          const candidate = pointAt(index);
          const candidateDistance = distance(point, candidate);
          if (candidateDistance < closest && segmentClear(point, candidate, world, radius)) { best = index; closest = candidateDistance; }
        }
      }
      if (best !== -1) return best;
    }
    return -1;
  }
  const first = nearestNode(start);
  const last = nearestNode(target);
  if (first < 0 || last < 0) return null;
  const costs = new Float64Array(columns * rows).fill(Infinity);
  const parents = new Int32Array(columns * rows).fill(-1);
  const closed = new Uint8Array(columns * rows);
  const heap = [];
  function push(index, priority) {
    const node = { index, priority };
    heap.push(node);
    let child = heap.length - 1;
    while (child > 0) {
      const parent = Math.floor((child - 1) / 2);
      if (heap[parent].priority <= node.priority) break;
      heap[child] = heap[parent]; child = parent;
    }
    heap[child] = node;
  }
  function pop() {
    const firstNode = heap[0];
    const end = heap.pop();
    if (heap.length) {
      let parent = 0;
      while (true) {
        let child = parent * 2 + 1;
        if (child >= heap.length) break;
        if (child + 1 < heap.length && heap[child + 1].priority < heap[child].priority) child += 1;
        if (heap[child].priority >= end.priority) break;
        heap[parent] = heap[child]; parent = child;
      }
      heap[parent] = end;
    }
    return firstNode.index;
  }
  costs[first] = 0;
  push(first, distance(pointAt(first), target));
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  let found = false;
  while (heap.length) {
    const current = pop();
    if (closed[current]) continue;
    if (current === last) { found = true; break; }
    closed[current] = 1;
    const x = current % columns;
    const z = Math.floor(current / columns);
    const from = pointAt(current);
    for (const [dx, dz] of directions) {
      const nx = x + dx;
      const nz = z + dz;
      if (nx < 0 || nx >= columns || nz < 0 || nz >= rows) continue;
      const next = nz * columns + nx;
      if (closed[next] || !nodeAllowed(next)) continue;
      if (dx && dz && (!nodeAllowed(z * columns + nx) || !nodeAllowed(nz * columns + x))) continue;
      const to = pointAt(next);
      if (!segmentClear(from, to, world, radius)) continue;
      const cost = costs[current] + distance(from, to);
      if (cost >= costs[next]) continue;
      costs[next] = cost; parents[next] = current;
      push(next, cost + distance(to, target));
    }
  }
  if (!found) return null;
  const route = [{ x: target.x, z: target.z }];
  let index = last;
  while (index !== first && index !== -1) { route.push(pointAt(index)); index = parents[index]; }
  route.push(pointAt(first));
  route.reverse();
  const simplified = [];
  let anchor = { x: start.x, z: start.z };
  let cursor = 0;
  while (cursor < route.length) {
    let farthest = cursor;
    for (let candidate = route.length - 1; candidate > cursor; candidate -= 1) {
      if (segmentClear(anchor, route[candidate], world, radius)) { farthest = candidate; break; }
    }
    if (distance(anchor, route[farthest]) > 0.0001) simplified.push(route[farthest]);
    anchor = route[farthest]; cursor = farthest + 1;
  }
  return simplified;
}

/** Navigation owns avatar animation. The avatar faces local +Z. */
export function createLocomotion({ camera, domElement, avatar, world, orbitControls, onMove, onArrival, onPick }) {
  const player = avatar.group;
  const initialPosition = { x: player.position.x, z: player.position.z };
  const speed = 3.2;
  const keySet = new Set();
  const heldDirections = new Set();
  const pointers = new Map();
  const joystick = { x: 0, y: 0, pointerId: null };
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const direction = new THREE.Vector3();
  const up = new THREE.Vector3(0, 1, 0);
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let enabled = true;
  let path = [];
  let target = null;
  let arrivalCallback = null;
  let moving = false;
  let mode = 'idle';
  let manualActive = false;
  let multiPointer = false;
  let disposed = false;
  const removers = [];

  const marker = new THREE.Mesh(new THREE.RingGeometry(0.21, 0.27, 36), new THREE.MeshBasicMaterial({ color: '#e4c58d', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide }));
  marker.name = 'WalkingDestination';
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  if (player.parent) player.parent.add(marker);

  const stick = document.getElementById('moveStick');
  const thumb = document.getElementById('moveThumb');
  const directionButtons = Array.from(document.querySelectorAll('[data-move]'));
  const interactive = () => Boolean(document.querySelector('dialog[open]') || document.activeElement && document.activeElement.matches('input,textarea,select,[contenteditable="true"]'));
  const canMove = () => enabled && !disposed && !document.hidden && !interactive();
  const floorHeight = (x, z) => {
    const value = typeof world.heightAt === 'function' ? world.heightAt(x, z) : 0;
    return Number.isFinite(value) ? value : 0;
  };

  function listen(element, event, handler, options) {
    if (!element) return;
    element.addEventListener(event, handler, options);
    removers.push(() => element.removeEventListener(event, handler, options));
  }

  function clearStick() {
    joystick.x = 0; joystick.y = 0; joystick.pointerId = null;
    if (thumb) thumb.style.transform = 'translate(-50%, -50%)';
    if (stick) stick.classList.remove('is-active');
    directionButtons.forEach(button => button.classList.remove('is-held'));
    heldDirections.clear();
  }

  function clearJourney() {
    path = []; target = null; arrivalCallback = null; marker.visible = false;
    mode = 'idle';
  }

  function stopInputs(clearRoute = true) {
    keySet.clear(); clearStick(); pointers.clear(); multiPointer = false;
    manualActive = false; moving = false;
    if (clearRoute) clearJourney();
  }

  function announceMove(source) {
    if (typeof onMove === 'function') onMove(source);
  }

  function planJourney(point, callback, source) {
    if (!canMove() || !validPoint(point)) return false;
    const route = findPath(player.position, point, world);
    if (route === null) return false;
    path = route;
    target = { x: point.x, z: point.z };
    arrivalCallback = typeof callback === 'function' ? callback : null;
    mode = source === 'manual' ? 'click' : 'path';
    marker.position.set(point.x, floorHeight(point.x, point.z) + 0.035, point.z);
    marker.visible = path.length > 0;
    announceMove(source);
    if (!route.length) finishJourney();
    return true;
  }

  function finishJourney() {
    const arrivedAt = target && { ...target };
    const callback = arrivalCallback;
    clearJourney();
    if (typeof avatar.setGesture === 'function') avatar.setGesture('arrival');
    if (typeof onArrival === 'function') onArrival(arrivedAt);
    if (callback) callback(arrivedAt);
  }

  function goTo(point, callback) { return planJourney(point, callback, 'path'); }

  function followPlayer(dx, dz) {
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return;
    camera.position.x += dx; camera.position.z += dz;
    if (orbitControls && orbitControls.target) { orbitControls.target.x += dx; orbitControls.target.z += dz; }
  }

  function update(delta) {
    const dt = Math.max(0, Math.min(0.05, Number.isFinite(delta) ? delta : 0));
    if (disposed) return;
    const previousX = player.position.x;
    const previousZ = player.position.z;
    moving = false;
    if (canMove() && dt > 0) {
      let inputX = joystick.x;
      let inputY = joystick.y;
      if (keySet.has('KeyW') || keySet.has('ArrowUp') || heldDirections.has('forward')) inputY += 1;
      if (keySet.has('KeyS') || keySet.has('ArrowDown') || heldDirections.has('backward')) inputY -= 1;
      if (keySet.has('KeyA') || keySet.has('ArrowLeft') || heldDirections.has('left')) inputX -= 1;
      if (keySet.has('KeyD') || keySet.has('ArrowRight') || heldDirections.has('right')) inputX += 1;
      const manual = Math.hypot(inputX, inputY) > 0.07;
      if (manual) {
        if (!manualActive || target) announceMove('manual');
        if (!manualActive || target || path.length) clearJourney();
        manualActive = true;
        mode = 'manual';
        camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.lengthSq() < 0.0001) forward.set(0, 0, -1);
        forward.normalize(); right.crossVectors(forward, up).normalize();
        direction.copy(right).multiplyScalar(inputX).addScaledVector(forward, inputY);
        const inputStrength = Math.min(1, Math.hypot(inputX, inputY));
        direction.normalize().multiplyScalar(speed * dt * inputStrength);
        const next = stepWithCollisions(player.position, { x: direction.x, z: direction.z }, world);
        player.position.x = next.x; player.position.z = next.z;
      } else {
        manualActive = false;
        if (path.length) {
          let remaining = speed * dt;
          while (path.length && remaining > 0) {
            const waypoint = path[0];
            const gap = distance(player.position, waypoint);
            if (gap < 0.005) { path.shift(); continue; }
            const step = Math.min(gap, remaining);
            const next = stepWithCollisions(player.position, { x: (waypoint.x - player.position.x) / gap * step, z: (waypoint.z - player.position.z) / gap * step }, world);
            const moved = distance(player.position, next);
            player.position.x = next.x; player.position.z = next.z;
            remaining -= step;
            if (moved < step * 0.2) { clearJourney(); break; }
            if (gap <= step + 0.005) path.shift();
          }
          if (target && !path.length) finishJourney();
        } else mode = 'idle';
      }
      const dx = player.position.x - previousX;
      const dz = player.position.z - previousZ;
      moving = Math.hypot(dx, dz) > 0.0001;
      if (moving) {
        const desired = Math.atan2(dx, dz);
        const angle = Math.atan2(Math.sin(desired - player.rotation.y), Math.cos(desired - player.rotation.y));
        player.rotation.y += angle * (1 - Math.exp(-dt * 15));
        followPlayer(dx, dz);
      }
    }
    player.position.y = THREE.MathUtils.damp(player.position.y, floorHeight(player.position.x, player.position.z), 18, dt);
    if (typeof avatar.update === 'function') avatar.update(dt, moving);
  }

  function setEnabled(value) {
    const next = Boolean(value);
    if (next === enabled) return;
    enabled = next;
    if (!enabled) stopInputs();
  }

  function reset() {
    stopInputs();
    if (!isWalkable(initialPosition, world)) return false;
    const dx = initialPosition.x - player.position.x;
    const dz = initialPosition.z - player.position.z;
    player.position.set(initialPosition.x, floorHeight(initialPosition.x, initialPosition.z), initialPosition.z);
    player.rotation.y = Math.PI;
    followPlayer(dx, dz);
    return true;
  }

  const movementKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
  listen(window, 'keydown', event => {
    if (!movementKeys.includes(event.code) || !canMove() || event.ctrlKey || event.altKey || event.metaKey) return;
    event.preventDefault(); keySet.add(event.code);
  });
  listen(window, 'keyup', event => { keySet.delete(event.code); });
  listen(window, 'blur', () => stopInputs());
  listen(document, 'visibilitychange', () => { if (document.hidden) stopInputs(); });

  listen(domElement, 'pointerdown', event => {
    if (!canMove() || event.button !== 0) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY, moved: false });
    if (pointers.size > 1) multiPointer = true;
  });
  listen(domElement, 'pointermove', event => {
    const down = pointers.get(event.pointerId);
    if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 8) down.moved = true;
  });
  listen(domElement, 'pointerup', event => {
    const down = pointers.get(event.pointerId);
    pointers.delete(event.pointerId);
    const wasMultiple = multiPointer;
    if (!pointers.size) multiPointer = false;
    if (!canMove() || !down || down.moved || wasMultiple || Math.hypot(event.clientX - down.x, event.clientY - down.y) >= 8) return;
    const rect = domElement.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    if (typeof onPick === 'function' && onPick(raycaster, event)) return;
    const hit = raycaster.intersectObjects(world.groundMeshes || [], true)[0];
    if (hit) planJourney({ x: hit.point.x, z: hit.point.z }, null, 'manual');
  });
  listen(domElement, 'pointercancel', event => { pointers.delete(event.pointerId); if (!pointers.size) multiPointer = false; });

  function moveStick(event) {
    if (joystick.pointerId !== event.pointerId || !canMove()) return;
    const rect = stick.getBoundingClientRect();
    const radius = Math.max(20, Math.min(rect.width, rect.height) * 0.32);
    let x = (event.clientX - rect.left - rect.width / 2) / radius;
    let y = (event.clientY - rect.top - rect.height / 2) / radius;
    const length = Math.hypot(x, y);
    if (length > 1) { x /= length; y /= length; }
    joystick.x = x; joystick.y = -y;
    if (thumb) thumb.style.transform = 'translate(-50%, -50%) translate(' + (x * radius).toFixed(1) + 'px, ' + (y * radius).toFixed(1) + 'px)';
  }
  listen(stick, 'pointerdown', event => {
    if (!canMove() || event.button !== 0 || joystick.pointerId !== null) return;
    event.preventDefault(); event.stopPropagation();
    joystick.pointerId = event.pointerId;
    try { stick.setPointerCapture(event.pointerId); } catch (_) {}
    stick.classList.add('is-active'); moveStick(event);
  });
  listen(stick, 'pointermove', event => { if (event.pointerId === joystick.pointerId) { event.preventDefault(); moveStick(event); } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(type => listen(stick, type, event => { if (event.pointerId === joystick.pointerId) clearStick(); }));

  directionButtons.forEach(button => {
    const directionName = button.dataset.move;
    if (!['forward', 'backward', 'left', 'right'].includes(directionName)) return;
    const press = event => {
      if (!canMove() || event.type === 'keydown' && !['Space', 'Enter'].includes(event.code)) return;
      event.preventDefault(); event.stopPropagation();
      heldDirections.add(directionName); button.classList.add('is-held');
      if (event.pointerId !== undefined) { try { button.setPointerCapture(event.pointerId); } catch (_) {} }
    };
    const release = event => {
      if (event.type === 'keyup' && !['Space', 'Enter'].includes(event.code)) return;
      heldDirections.delete(directionName); button.classList.remove('is-held');
    };
    listen(button, 'pointerdown', press); listen(button, 'keydown', press);
    ['pointerup', 'pointercancel', 'lostpointercapture', 'keyup', 'blur'].forEach(type => listen(button, type, release));
  });
  listen(document.getElementById('returnToGate'), 'click', event => {
    if (!canMove()) return;
    event.preventDefault(); reset(); announceMove('manual');
  });

  function getState() {
    return { enabled, moving, mode, position: { x: player.position.x, y: player.position.y, z: player.position.z }, target: target && { ...target }, path: path.map(point => ({ ...point })) };
  }

  function dispose() {
    if (disposed) return;
    stopInputs(); disposed = true;
    removers.splice(0).forEach(remove => remove());
    marker.removeFromParent(); marker.geometry.dispose(); marker.material.dispose();
  }

  return { update, goTo, setEnabled, reset, cancel: stopInputs, dispose, getState };
}
