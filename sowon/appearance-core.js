/** Public cosmetic choices only. No birth information or calculation gender. */
export const APPEARANCE_SLOTS = Object.freeze({ skin: 6, hair: 5, ink: 6, hat: 5, cut: 3, prop: 4 });
export const APPEARANCE_LIMIT = Object.values(APPEARANCE_SLOTS).reduce((a, b) => a * b, 1);
export const SKIN_COLORS = Object.freeze(['#f2d8bb', '#f9e4ce', '#dfb58c', '#be906d', '#956c50', '#694d3b']);
export const HAIR_COLORS = Object.freeze(['#302c32', '#694d3c', '#a77a4b', '#b8b1a4', '#80677f', '#b45f4f']);
export function validAppearance(value) {
  if (typeof value !== 'string') return false;
  const match = /^(sage|moon|dawn|plum)(?::(0|[1-9a-z][0-9a-z]{0,2}))?$/.exec(value);
  return Boolean(match && (match[2] === undefined || parseInt(match[2], 36) < APPEARANCE_LIMIT));
}
export function decodeAppearance(value) {
  const safe = validAppearance(value) ? value : 'sage';
  const [palette, code] = safe.split(':');
  let packed = code === undefined ? 0 : parseInt(code, 36);
  const result = { palette, customized: code !== undefined };
  for (const [key, length] of Object.entries(APPEARANCE_SLOTS)) { result[key] = packed % length; packed = Math.floor(packed / length); }
  return result;
}
export function encodeAppearance(raw = {}) {
  const palette = ['sage', 'moon', 'dawn', 'plum'].includes(raw.palette) ? raw.palette : 'sage';
  let packed = 0, multiplier = 1;
  for (const [key, length] of Object.entries(APPEARANCE_SLOTS)) {
    const value = Number.isInteger(raw[key]) && raw[key] >= 0 && raw[key] < length ? raw[key] : 0;
    packed += value * multiplier; multiplier *= length;
  }
  return `${palette}:${packed.toString(36)}`;
}
export function randomAppearance(random = Math.random) {
  const next = length => Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
  return encodeAppearance({ palette: ['sage', 'moon', 'dawn', 'plum'][next(4)], ...Object.fromEntries(Object.entries(APPEARANCE_SLOTS).map(([key, length]) => [key, next(length)])) });
}
