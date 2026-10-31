export const SETTINGS_KEY = 'samra.sowon.experience.v1';
export const DEFAULT_SETTINGS = Object.freeze({ mood: 'moon', outfit: 'sage', quality: 'auto' });
const allowed = { mood: ['moon', 'dawn'], outfit: ['sage', 'moon', 'dawn', 'plum'], quality: ['auto', 'smooth', 'clear'] };
export function normalizeSettings(raw) {
  const result = { ...DEFAULT_SETTINGS };
  if (raw && typeof raw === 'object') for (const key of Object.keys(allowed)) if (allowed[key].includes(raw[key])) result[key] = raw[key];
  return result;
}
export function readSettings(storage) {
  try { return normalizeSettings(JSON.parse(storage?.getItem(SETTINGS_KEY) || 'null')); } catch (_) { return { ...DEFAULT_SETTINGS }; }
}
export function writeSettings(storage, raw) {
  const safe = normalizeSettings(raw);
  try { storage?.setItem(SETTINGS_KEY, JSON.stringify(safe)); return Boolean(storage); } catch (_) { return false; }
}
export function effectiveQuality(value, { coarse = false, memory = 8 } = {}) {
  if (value === 'smooth' || value === 'clear') return value;
  return coarse || typeof memory === 'number' && memory <= 4 ? 'smooth' : 'clear';
}
const finitePoint = point => point && Number.isFinite(point.x) && Number.isFinite(point.z);
export function interactionDistance(a, b) { return finitePoint(a) && finitePoint(b) ? Math.hypot(a.x - b.x, a.z - b.z) : Infinity; }
export function nearestInteraction(items, position, currentId = null) {
  if (!Array.isArray(items) || !finitePoint(position)) return null;
  const valid = items.filter(item => item && typeof item.id === 'string' && ['npc', 'object'].includes(item.type) && finitePoint(item.point) && Number.isFinite(item.radius) && item.radius >= .5 && item.radius <= 5);
  const current = valid.find(item => item.id === currentId);
  const ranked = valid.map(item => ({ item, distance: interactionDistance(item.point, position) })).filter(({ item, distance }) => distance <= item.radius).sort((a, b) => a.distance - b.distance || (a.item.type === 'npc' ? -1 : 1));
  if (current && interactionDistance(current.point, position) <= current.radius + .55) {
    const challenger = ranked[0];
    if (!challenger || challenger.item.id === currentId || challenger.distance + .75 >= interactionDistance(current.point, position)) return current;
  }
  return ranked[0]?.item || null;
}
export function pickedInteraction(hits, items) {
  if (!Array.isArray(hits) || !Array.isArray(items)) return null;
  // An opaque roof or wall in front of a host must block the interaction.
  const hit = hits.find(value => value?.object?.isMesh && Number.isFinite(value.distance));
  if (!hit) return null;
  for (const item of items) {
    const groups = item?.groups || (item?.group ? [item.group] : []);
    for (let node = hit.object; node; node = node.parent) if (groups.includes(node)) return item;
  }
  return null;
}
