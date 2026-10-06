/** Explicit host contract: never infer ad eligibility from a mobile user agent. */
export function monetizationPolicy(platform = 'web') {
  if (!['web', 'android'].includes(platform)) throw new Error('Unknown platform');
  return Object.freeze({platform, rewarded: platform === 'android', interstitial: platform === 'android',
    minInstallMs: 86400000, minSessionMs: 180000, minReadings: 3, cooldownMs: 300000,
    sessionCap: 1, dailyCap: 2, rewardCredit: 1});
}
export function mayShowInterstitial(p, s) {
  return p.interstitial && !s.paid && s.consent === true && s.installAgeMs >= p.minInstallMs &&
    s.sessionAgeMs >= p.minSessionMs && s.completedReadings >= p.minReadings &&
    s.sessionImpressions < p.sessionCap && s.dailyImpressions < p.dailyCap &&
    s.sinceFullscreenMs >= p.cooldownMs;
}
export function revenueModel({monthlyImpressions = 797, monthlyUsd = 1.97, fx = 1400, targetKrw = 100000, impressionsPerDau = 3} = {}) {
  if (![monthlyImpressions, monthlyUsd, fx, targetKrw, impressionsPerDau].every(v => Number.isFinite(v) && v > 0)) throw new Error('Positive inputs required');
  const ecpm = monthlyUsd / monthlyImpressions * 1000;
  const dailyImpressions = targetKrw / fx / ecpm * 1000;
  return {ecpm, dailyImpressions, requiredDau: dailyImpressions / impressionsPerDau};
}
