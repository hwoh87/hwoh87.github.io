/** Read the already published three-pillar chart; never guess an unavailable birth hour. */
const ELEMENTS = Object.freeze({ 木: '木', 목: '木', 火: '火', 화: '火', 土: '土', 토: '土', 金: '金', 금: '金', 水: '水', 수: '水' });
const trim = node => typeof node?.textContent === 'string' ? node.textContent.trim() : '';
const cells = row => [...(row?.querySelectorAll('td') || [])];
const element = value => ELEMENTS[value] || '';

export function buildCelebrityVisuals(parsed, person = {}) {
  const chart = parsed?.querySelector?.('table.myeongsik');
  if (!chart) return [];
  const rows = [...chart.querySelectorAll('tbody tr')];
  const row = name => rows.find(entry => trim(entry.querySelector('th')) === name);
  const stems = cells(row('천간')), branches = cells(row('지지')), gods = cells(row('십신'));
  const headers = [...chart.querySelectorAll('thead th')].slice(1).map(trim);
  const pillars = headers.flatMap((label, index) => {
    if (!['년주', '월주', '일주'].includes(label)) return [];
    const stem = trim(stems[index]?.querySelector('.hj')), branch = trim(branches[index]?.querySelector('.hj'));
    if (!/^[甲乙丙丁戊己庚辛壬癸]$/.test(stem) || !/^[子丑寅卯辰巳午未申酉戌亥]$/.test(branch)) return [];
    return [{ label, stem, branch, stemElement: element(trim(stems[index]?.querySelector('.elx'))), branchElement: element(trim(branches[index]?.querySelector('.elx'))), subtitle: trim(gods[index]).slice(0, 30) }];
  });
  const name = typeof person.name === 'string' ? person.name.slice(0, 40) : '인물';
  const visuals = [];
  if (pillars.length === 3) visuals.push({ id: 'public-person-pillars', type: 'pillars', title: name + '의 세 기둥', kicker: 'PUBLIC CHART',
    description: '공개된 생일로 계산한 년주·월주·일주예요.', note: '출생 시각을 추정하지 않았어요. 시주와 시간에 따른 해석은 포함하지 않아요.', items: pillars });
  const seen = new Set();
  const counts = [...(parsed.querySelectorAll?.('.bars .row2') || [])].flatMap(entry => {
    const key = trim(entry.querySelector('.nm')).match(/^[木火土金水]/)?.[0], raw = trim(entry.querySelector('.pc'));
    if (!key || seen.has(key) || !/^\d+$/.test(raw)) return [];
    const value = Number(raw); if (!Number.isSafeInteger(value) || value > 6) return [];
    seen.add(key);
    return [{ key, label: ({ 木: '목', 火: '화', 土: '토', 金: '금', 水: '수' })[key] + ' ' + key, value }];
  });
  if (pillars.length === 3 && counts.length === 5 && counts.reduce((sum, entry) => sum + entry.value, 0) === 6) visuals.push({ id: 'public-person-elements', type: 'distribution', variant: 'elements', title: '공개 명식의 오행 구성', kicker: 'FIVE ELEMENTS', unit: '개',
    description: '세 기둥의 여섯 글자에 어떤 오행이 놓였는지 살펴보세요.',
    note: '천간·지지 여섯 글자를 단순 집계한 개수예요. 지장간이나 월주 가중치는 넣지 않았고, 강약·재능·운의 점수와는 달라요.', items: counts });
  return visuals;
}
