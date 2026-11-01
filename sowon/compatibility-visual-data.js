/** Public calculation values only. Scores stay independent, never a probability or a share. */
const METRICS = Object.freeze({ bond: '결속력', stability: '안정성', growth: '성장성', consumption: '소모도' });
const AXES = Object.freeze({
  stemRel: '일간 관계', branchRel: '일지 관계', elementBalance: '오행 보완', yinYangBalance: '음양 균형',
  geokcukHarmony: '격국 호응', daewoonAlignment: '대운 동조', sinsalHarmony: '신살 호응',
  climateHarmony: '조후 균형', napeumHarmony: '납음 호응', samhapCompletion: '결속 구조',
  nobleStarCross: '길신 교차', unseongAlignment: '운성 호응', samhyeongDetection: '형살 점검',
  hourPillarHarmony: '시주 호응', spousePillarMatch: '배우자성', saewoonResonance: '올해 세운', consumptionAxis: '소모도',
});
const CORE = ['stemRel', 'branchRel', 'geokcukHarmony', 'elementBalance', 'yinYangBalance', 'daewoonAlignment', 'sinsalHarmony'];
const validScore = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 100;
const text = (value, limit = 120) => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, limit) : '';

export function buildCompatibilityVisuals(source) {
  const result = source?.analysis || source?.result || source;
  if (!result || !validScore(result.totalScore)) return [];
  const visuals = [];
  const summary = Object.entries(METRICS).flatMap(([key, label]) => validScore(result.subScores?.[key]) ? [{ key, label, value: result.subScores[key] }] : []);
  if (summary.length) visuals.push({ id: 'compatibility-summary', type: 'balance', variant: 'scores', title: `두 사람의 관계를 이루는 ${summary.length === 4 ? '네' : summary.length} 가지 힘`, kicker: 'RELATIONSHIP PROFILE', unit: '점',
    description: `서로 다른 ${summary.length}개 지표를 0–100점으로 함께 살펴보세요.`,
    note: '각 지표는 독립적이에요. 소모도는 높을수록 감정과 에너지를 많이 쓰는 경향을 뜻해요. 총합이나 성공 확률이 아니에요.', items: summary });
  const rawAxes = Array.isArray(result.axes) ? result.axes : [];
  const seen = new Set();
  const axes = rawAxes.slice(0, 20).flatMap(row => {
    const key = Object.hasOwn(AXES, row?.key) ? row.key : Object.keys(AXES).find(id => AXES[id] === text(row?.name));
    if (!key || seen.has(key) || !validScore(row?.score)) return [];
    if ((result.unknownTimeA || result.unknownTimeB) && key === 'hourPillarHarmony') return [];
    seen.add(key);
    return [{ key, label: AXES[key], value: row.score, detail: text(row.headline, 220), tone: text(row.tone, 20) }];
  });
  const byKey = new Map(axes.map(row => [row.key, row]));
  const core = CORE.map(key => byKey.get(key));
  if (core.every(Boolean)) visuals.push({ id: 'compatibility-core', type: 'radar', title: '핵심 7축으로 보는 두 사람', kicker: 'SEVEN AXES', unit: '점',
    description: '앱과 같은 일간·일지·격국·오행·음양·운기·신살의 계산값이에요.',
    note: '바깥쪽일수록 해당 축의 계산 점수가 높아요. 넓이나 모양이 관계의 미래를 결정하지는 않아요.',
    items: core.map(row => ({ ...row, label: ({ stemRel: '일간', branchRel: '일지', geokcukHarmony: '격국', elementBalance: '오행', yinYangBalance: '음양', daewoonAlignment: '운기', sinsalHarmony: '신살' })[row.key] })) });
  if (axes.length) visuals.push({ id: 'compatibility-axes', type: 'balance', variant: 'scores', title: `관계의 ${axes.length}가지 지표를 자세히`, kicker: 'FULL ANALYSIS', unit: '점',
    description: '좋고 나쁨 한마디보다, 어느 부분을 함께 조율할지 살펴보세요.',
    note: `${result.unknownTimeA || result.unknownTimeB ? '시간 미상이 포함되어 시주 호응은 표시하지 않았어요. ' : ''}소모도는 높을수록 소모 경향이 커요. 각 축의 의미는 아래 풀이에서 함께 읽어 주세요.`,
    items: axes });
  return visuals;
}
