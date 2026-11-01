// The hall faces north. Keep the arrival camera on the courtyard side so its
// roof cannot sit between the visitor and their character.
export function portraitHallView({width = 1280, height = 720} = {}) {
  const aspect = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 16 / 9;
  const portrait = aspect < .85;
  const scale = portrait ? Math.max(1, (390 / 844) / aspect) : 1;
  return {
    cameraOffset: portrait ? [9 * scale, 10 * scale, -20 * scale] : [7, 6, -8.5],
    targetOffset: [0, 1.8, 1.4],
  };
}
