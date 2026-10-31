import { STEM_COUNSEL, GOD_GROUP, GROUP_COUNSEL, ELEMENT_PRACTICE } from './reading-counsel.js?v=20261101-sanctuary2';

/**
 * A local reading from the same deterministic engine as /calc/.
 * No network, persistence, URL building, AI generation or paid-report prose.
 * Pass `year` to include the current Saju luck period / Ziwei annual context.
 */
const ELEMENTS = Object.freeze({ '木': '목(木)', '火': '화(火)', '土': '토(土)', '金': '금(金)', '水': '수(水)' });
// Plain definitions of the canonical ten-god categories (/learn/ten-gods/ and
// /term/*). A category is explained only when it occurs in the computed chart.
const GODS = Object.freeze({
  '비견': '비견은 자기 기준과 동료 관계를 읽는 이름이에요. 스스로 결정하는 힘을 어디에 쓰는지, 다른 사람과 어떻게 나누는지 함께 살펴봐요.',
  '겁재': '겁재는 함께 움직이는 동료와 경쟁, 몫을 나누는 방식을 읽는 이름이에요. 협력할 때의 역할과 경계를 구체적으로 정하는 것이 관찰할 지점이에요.',
  '식신': '식신은 재능을 꾸준히 표현하고 결과물로 키우는 힘을 읽는 이름이에요. 일상에서 편안하게 반복할 수 있는 창작과 표현의 방식을 살펴봐요.',
  '상관': '상관은 자기 생각을 드러내고 기존 방식에 질문하는 힘을 읽는 이름이에요. 새로운 관점과 표현이 상대에게 어떻게 전달되는지 함께 살펴봐요.',
  '편재': '편재는 바깥의 기회와 자원을 넓게 다루는 방식을 읽는 이름이에요. 선택을 넓히는 힘과 이미 맡은 일을 관리하는 힘의 균형을 살펴봐요.',
  '정재': '정재는 현실의 자원과 약속을 꾸준히 관리하는 방식을 읽는 이름이에요. 반복되는 일과 작은 성과를 어떤 기준으로 쌓는지 살펴봐요.',
  '편관': '편관은 압박과 책임에 대응하고 어려운 과제를 돌파하는 힘을 읽는 이름이에요. 버티는 힘을 쓰는 상황과 부담을 나눌 필요가 있는 상황을 함께 살펴봐요.',
  '정관': '정관은 질서와 약속, 사회적인 책임을 읽는 이름이에요. 신뢰를 쌓는 기준과 그 기준이 지나친 부담이 되는 순간을 함께 살펴봐요.',
  '편인': '편인은 익숙한 답을 넘어 탐구하고 자기 방식으로 이해하는 힘을 읽는 이름이에요. 깊이 생각하는 시간과 실제로 시험해 보는 시간을 함께 살펴봐요.',
  '정인': '정인은 배우고 받아들이며 자신을 돌보는 힘을 읽는 이름이에요. 경험을 정리하는 시간과 도움을 편하게 주고받는 방식을 살펴봐요.',
});
const text = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, '').trim() : '';
const list = value => Array.isArray(value) ? value : [];
const number = value => typeof value === 'number' && Number.isFinite(value) ? value : null;
const element = value => ELEMENTS[value] || '';
const signal = (label, value) => text(value) ? { label, value: text(value) } : null;
const firstSentences = value => text(value).split(/(?<=[.!?])\s+/).slice(0,2).join(' ');
function section(id, title, paragraphs, signals = [], extras = {}) {
  return { id, title, paragraphs: [...new Set(paragraphs.map(text).filter(Boolean))].slice(0, 3), signals: signals.filter(Boolean).slice(0, 6),
    takeaway: text(extras.takeaway), actions: list(extras.actions).map(text).filter(Boolean).slice(0, 3), evidence: list(extras.evidence).map(text).filter(Boolean).slice(0, 4),
    ...(extras.visual ? { visual: extras.visual } : {}) };
}
const highlight = (label, value, detail) => ({ label, value: text(value), detail: text(detail) });
function finish(reading) {
  const sections = reading.sections.filter(row => row.paragraphs.length);
  const chars = [reading.summary, ...sections.flatMap(row => [...row.paragraphs, ...row.actions])].join('').length;
  return { ...reading, sections, highlights: list(reading.highlights).filter(row => row.value).slice(0, 3), readMinutes: Math.max(2, Math.ceil(chars / 550)) };
}
function fail(code, message) { throw Object.assign(new Error(message), { code }); }
function json(value) {
  try { const parsed = typeof value === 'string' ? JSON.parse(value) : value; if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || parsed.error) throw Error(); return parsed; }
  catch (_) { fail('invalid_engine_result', '계산 결과를 읽지 못했어요. 다시 계산해 주세요.'); }
}
function ownBirth(input) {
  if (!input || ![input.y, input.mo, input.d].every(Number.isInteger) || input.y < 1940 || input.y > 2099 || !['M', 'F'].includes(input.g)) fail('invalid_birth', '출생정보를 먼저 확인해 주세요.');
  const date = new Date(Date.UTC(input.y, input.mo - 1, input.d));
  if (date.getUTCFullYear() !== input.y || date.getUTCMonth() + 1 !== input.mo || date.getUTCDate() !== input.d) fail('invalid_birth', '실제 달력에 있는 생년월일을 넣어 주세요.');
  const unk = input.unk === true || input.h === -1;
  if (!unk && (!Number.isInteger(input.h) || input.h < 0 || input.h > 23 || !Number.isInteger(input.mi) || input.mi < 0 || input.mi > 59)) fail('invalid_birth', '태어난 시간이나 시간 모름 선택을 확인해 주세요.');
  return { y: input.y, mo: input.mo, d: input.d, h: unk ? -1 : input.h, mi: unk ? 0 : input.mi, g: input.g, unk };
}
function engineRoot(bundle) { return bundle?.com?.samramanshang?.manseryeok?.orrery?.js || bundle; }
function calculate(engine, tool, method, args) {
  if (typeof engine?.[tool]?.[method] !== 'function') fail('engine_required', '해석 도구를 준비하지 못했어요. 잠시 후 다시 시도해 주세요.');
  try { return json(engine[tool][method](...args)); }
  catch (_) { fail('invalid_engine_result', '해석을 계산하지 못했어요. 출생정보를 확인한 뒤 다시 시도해 주세요.'); }
}
function place(raw = {}) {
  const lat = raw.lat ?? 37.5665, lon = raw.lon ?? 126.978, houseSystem = raw.houseSystem ?? raw.hs ?? 'P';
  if (number(lat) === null || lat < -66 || lat > 66 || number(lon) === null || lon < -180 || lon > 180 || !['P', 'W'].includes(houseSystem)) fail('invalid_location', '출생지와 하우스 설정을 확인해 주세요.');
  return { lat, lon, houseSystem, name: text(raw.name) || (lat === 37.5665 && lon === 126.978 ? '서울' : '입력한 출생지') };
}

/** Kept in parity with /store/reading-summary.js: the balance is not a grade. */
export function describeStrength(st = {}) {
  const total = (st.help || 0) + (st.weaken || 0);
  if (!total) return '명식은 계산됐지만 기운의 균형 요약은 준비되지 않았어요. 아래 명식과 계산 근거를 확인해 주세요.';
  if (st.neutral) return '나를 돕는 힘과 밖으로 쓰는 힘이 균형에 가까워요. 강하다·약하다 한 가지로 단정하지 않고, 다른 글자와의 관계를 함께 읽는 사주예요.';
  return st.help > st.weaken
    ? '나를 돕는 힘의 비중이 더 커요. 이 힘을 어떻게 쓰는지는 다른 글자와의 관계를 함께 읽어야 해요. 좋고 나쁨을 매긴 점수는 아니에요.'
    : '밖으로 쓰거나 나를 제어하는 힘의 비중이 더 커요. 부족한 사람이라는 뜻은 아니에요. 나를 돕는 글자와의 관계를 함께 읽어 보세요.';
}

function sajuReading(v, options) {
  const e = options.chart && options.interpretation ? null : engineRoot(options.engine), geo = place(options.location), args = [v.y,v.mo,v.d,v.h,v.mi,v.g,options.trueSolarTime === true,geo.lon];
  const c = options.chart ? json(options.chart) : calculate(e,'SajuCalc','calculate',args);
  const t = options.interpretation ? json(options.interpretation) : calculate(e,'SajuCalc','interpret',args);
  if (!c.pillars?.day?.ganzi || !text(c.iljuKr) || !element(t.dayElement) || !t.strength || !t.geokguk) fail('invalid_engine_result', '사주 해석의 근거를 확인하지 못했어요.');
  const unknown = v.unk || c.unknownTime === true || t.unknownTime === true;
  if(v.unk && (c.unknownTime !== true || t.unknownTime !== true)) fail('invalid_engine_result','시간 모름 기준의 사주 결과를 다시 계산해 주세요.');
  const st = t.strength, gg = t.geokguk, monthGod = text(c.pillars.month?.stemSipsin);
  const total = (number(st.help) || 0) + (number(st.weaken) || 0);
  const yong = list(t.yongsin?.yong).map(element).filter(Boolean), gi = list(t.yongsin?.gi).map(element).filter(Boolean);
  const stem = text(c.pillars.day.ganzi).slice(0, 1), stemNote = STEM_COUNSEL[stem];
  const group = GROUP_COUNSEL[gg.major] || GROUP_COUNSEL[GOD_GROUP[monthGod]], dayGod = text(c.pillars.day.branchSipsin), relationship = GROUP_COUNSEL[GOD_GROUP[dayGod]];
  const weights = Object.keys(ELEMENTS).map(key => ({ key, label: element(key), value: Math.max(0, number(t.elements?.[key]) || 0) }));
  const weightTotal = weights.reduce((sum, row) => sum + row.value, 0), largest = weights.filter(row => row.value > 0).sort((a,b)=>b.value-a.value);
  const tied = largest.filter(row => row.value === largest[0]?.value), absent = weights.filter(row => row.value === 0);
  const elementIntro = weightTotal ? `지장간을 포함한 오행 가중치에서는 ${tied.map(row=>row.label).join(' · ')}의 비중이 가장 커요. ${absent.length ? `${absent.map(row=>row.label).join(' · ')}은 이 집계에서 드러나지 않아요.` : '다섯 오행이 모두 집계됐어요.'} 오행의 양이 많다고 무조건 좋거나, 적다고 그 능력이 없다는 뜻은 아니에요.` : '';
  const sections = [
    section('nature','나를 이루는 기본 결',[
      `${text(c.iljuKr)}일주로, 나를 뜻하는 일간은 ${element(t.dayElement)} 기운이에요.${text(gg.hangul) ? ` 명식의 큰 틀은 ${text(gg.hangul)}으로 계산됐어요.` : ''}`,
      stemNote?.[1] || '일주와 격국은 나의 성향을 읽는 출발점이에요. 한 가지 이름만으로 성격이나 살아갈 모습을 정하지 않고, 다른 글자와의 관계를 함께 읽어요.',
    ],[signal('일주',text(c.iljuKr)+'일주'),signal('일간',element(t.dayElement)),signal('격국',gg.hangul)],{ takeaway:stemNote?.[0], evidence:[`일주의 두 글자는 ${c.pillars.day.ganzi}이에요. 앞의 글자 ${stem}을 나 자신을 뜻하는 일간으로 읽어요.`, '일간의 비유는 기본 어휘 설명이에요. 같은 일주라도 나머지 글자와 출생 조건에 따라 전체 해석은 달라져요.'] }),
    section('balance','힘을 쓰고 회복하는 방식',[total > 0 ? `월주의 비중을 더해 읽으면, 나를 돕는 힘은 ${Math.round(st.help*100/total)}%, 밖으로 쓰거나 나를 제어하는 힘은 ${Math.round(st.weaken*100/total)}%로 계산돼요. 성취나 능력의 점수가 아니라 기운의 관계를 비교한 비율이에요.` : describeStrength(st),t.hint],[
      signal('기운의 균형',st.label),total > 0 ? signal('돕는 힘',Math.round(st.help*100/total)+'%') : null,total > 0 ? signal('밖으로 쓰는 힘',Math.round(st.weaken*100/total)+'%') : null,
    ],{ takeaway:st.neutral ? '한쪽으로 단정하기보다 전체 관계를 함께 읽어요' : st.help > st.weaken ? '받은 힘을 실제 표현과 결과로 이어가는 것이 관찰점이에요' : '바깥의 요구와 나를 받치는 자원을 함께 살펴요', evidence:[elementIntro,'오행 분포와 강약 비율은 계산 기준이 달라요. 분포는 지장간을 포함한 가중치, 강약은 일간을 돕거나 소모시키는 관계를 비교해요.'], visual:weightTotal ? {type:'elements',caption:'지장간을 포함한 오행 가중치 비중',rows:weights.map(row=>({...row,percent:Math.round(row.value*1000/weightTotal)/10}))} : undefined }),
    section('direction','균형을 만드는 방향',[
      yong.length ? `일간을 기준으로 균형을 돕는 방향은 ${yong.join(' · ')} 기운이에요.${st.neutral ? ' 다만 중화에 가까워 한쪽 기운을 늘리기보다 전체 관계를 먼저 보는 보조 참고예요.' : ' 어떤 기운을 더 쓰거나 받쳐줄 때 균형이 생기는지 읽는 참고로 보세요.'}` : '이번 명식에서는 한 가지 오행을 균형의 답으로 단정하지 않아요. 전체 글자와 기운의 관계를 먼저 살펴봐요.',
      t.johu && element(t.johu.element) ? `태어난 계절의 차고 더운 성질을 읽는 조후에서는 ${element(t.johu.element)} 기운을 살펴요.${yong.includes(element(t.johu.element)) ? ' 일간의 균형을 보는 방향과 계절을 보완하는 방향이 겹쳐 있어요.' : ' 이는 계절을 보완하는 기준으로, 앞의 일간 균형과는 구분해서 읽어요.'}` : '이 방향은 좋은 색이나 직업을 하나로 정해 주는 처방이 아니에요. 이미 쓰고 있는 힘과 필요한 쉼의 균형을 살피는 기준으로 읽어요.',
    ],[signal(st.neutral ? '보조 참고' : '균형을 돕는 기운',yong.join(' · ')),signal('과해지지 않게 볼 기운',gi.join(' · '))],{ takeaway:'일간의 균형과 태어난 계절을 나란히 봐요', evidence:['용신은 억부 기준으로, 조후는 태어난 월의 한열을 보완하는 기준으로 계산했어요. 두 기준이 서로 다른 오행을 가리킬 수 있어요.',text(t.johu?.reason)], actions:list(t.yongsin?.yong).slice(0,1).map(key=>ELEMENT_PRACTICE[key]) }),
    section('work','일과 보상을 만드는 방식',[
      GODS[monthGod] ? `월간에는 ${monthGod} 신호가 있어요. ${GODS[monthGod]}` : '일을 읽을 때는 월주와 격국을 함께 살펴요. 격국 하나로 특정 직업이나 성과를 정하지 않아요.',
      group?.work || '직함을 하나로 고르기보다 어떤 과정을 맡을 때 집중이 잘 되는지 살펴보세요. 스스로 결정할 범위, 협업하는 방식, 결과를 확인하는 기준을 나눠 보면 내 일의 조건이 구체적으로 보여요.',
    ],[signal('격국',gg.hangul),signal('월간의 십신',monthGod),signal('일의 관찰 주제',group?.title)],{takeaway:group?.title || '직업 이름보다 내가 힘을 쓰는 과정을 살펴요',actions:[group?.money].filter(Boolean),evidence:[`격국은 ${text(gg.category)}${text(gg.resolvedBy) ? `, ${text(gg.resolvedBy)} 기준` : ''}으로 판정했어요.${text(gg.transparentPosition) ? ` 투출을 확인한 위치는 ${text(gg.transparentPosition)}이에요.` : ''}`,'십신과 격국은 일의 성향을 읽는 분류예요. 직업 적성 검사나 수익의 예측값으로 환산하지 않았어요.']}),
    section('relationship','가까운 관계에서 나누는 것',[
      dayGod && GODS[dayGod] ? dayGod === monthGod ? `일지에서도 월간과 같은 ${dayGod} 주제가 나타나요. 일할 때 쓰는 기준이 가까운 관계에서도 편안하게 작동하는지, 서로 다른 기준이 필요한지 살펴보세요.` : `일지에서는 ${dayGod} 주제를 읽어요. ${GODS[dayGod]}` : '가까운 관계를 읽을 때는 일지와 일간의 관계를 살펴요. 한 글자만으로 상대의 성격이나 만날 사람을 정하지 않아요.',
      relationship?.relationship || '상대의 반응을 짐작하기보다 원하는 도움과 편안한 거리를 직접 물어보세요. 같은 상황에서도 서로 다른 방식으로 애정을 표현할 수 있어요.',
    ],[signal('일지',c.pillars.day.branchKr),signal('일지의 십신',dayGod)],{takeaway:relationship?.title || '서로의 기대를 말로 확인해요',evidence:['일지의 십신은 내 일간과 일지의 정기 사이의 관계예요. 실제 상대방의 사주를 계산한 궁합 결과는 아니에요.'],actions:[relationship?.action].filter(Boolean)}),
  ];
  const year = options.year;
  if (Number.isInteger(year) && year >= 1900 && year <= 2199) {
    const periods = list(c.daewoon).filter(row => Number.isInteger(row.startYear)).sort((a,b)=>a.startYear-b.startYear);
    const index = periods.findLastIndex(row => row.startYear <= year), current = periods[index], next = periods[index+1];
    if (current && year < (next?.startYear ?? current.startYear+10)) sections.push(section('flow','큰 흐름에서 보는 지금',[
      `${year}년은 ${text(current.ganzi)} 대운 안에 있어요. ${current.startYear}년에 시작한 흐름${next ? `으로, 다음 대운은 ${next.startYear}년에 이어져요.` : '을 기준으로 지금의 변화를 살펴볼 수 있어요.'}`,
      current.stemSipsin === monthGod ? `월간에서 본 ${monthGod} 주제가 현재 대운에서도 겹쳐요. 기본 성향이 지금의 환경에서 어떤 방식으로 드러나는지, 익숙한 선택을 반복하고 있는지 살펴보세요.` : GODS[current.stemSipsin] || '대운은 긴 시간 동안 바뀌는 기운을 읽는 틀이에요. 한 해의 사건이나 성과를 확정하는 예고로 보지 않고, 반복되는 선택의 주제를 살펴보세요.',
    ],[signal('현재 대운',current.ganzi),signal('흐름의 주제',current.stemSipsin)],{takeaway:`${year}년의 긴 배경을 ${current.startYear}년부터 이어진 흐름에서 읽어요`,actions:[GROUP_COUNSEL[GOD_GROUP[current.stemSipsin]]?.action].filter(Boolean),evidence:['대운은 명식에서 계산한 시작 연도와 약 10년 구간을 기준으로 골랐어요. 세운·월운·일운을 계산해 오늘의 사건을 예측한 내용은 아니에요.']}));
  }
  sections.push(section('practice','오늘 가져갈 작은 실천',[
    stemNote?.[2] || '이번 해석에서 와닿는 문장 하나를 골라, 최근의 실제 경험과 나란히 적어 보세요.',
    st.neutral ? '이미 균형 있게 하고 있는 일을 먼저 확인해 보세요. 새로운 습관을 여러 개 더하기보다 지금의 리듬을 지키는 작은 기준 하나면 충분해요.' : st.help > st.weaken ? '준비와 생각이 충분한 일 하나를 골라 작게 실행해 보세요. 반응을 확인할 수 있는 결과물을 남기면 가지고 있는 힘을 어디에 쓸지 더 분명해져요.' : '지금 맡은 일 가운데 꼭 내가 해야 하는 일 하나와 나눠도 되는 일 하나를 구분해 보세요. 도움을 청하거나 회복 시간을 확보하는 것도 일을 지속하는 방식이에요.',
  ],[],{takeaway:'맞는지 단정하기보다 내 경험으로 확인해요',evidence:['이 장의 실천은 앞에서 확인한 일간·십신·강약을 일상적인 질문으로 바꾼 안내예요. 미래의 사건을 확정하는 예언은 아니에요.']}));
  const notes=unknown ? ['출생시간 미상으로 시주를 제외한 세 기둥을 읽었어요. 정오를 대신 사용하므로 날짜 경계와 대운 시작 시점은 실제 출생시간에 따라 달라질 수 있어요.'] : [];
  if(options.trueSolarTime === true)notes.push(`${geo.name}의 경도로 진태양시를 보정했어요. 태어난 도시가 다르면 시간 경계의 명식을 다시 확인해 주세요.`);
  return finish({ kind:'saju',title:'나의 사주 리포트',headline:text(c.iljuKr)+'일주, '+(stemNote?.[0] || element(t.dayElement)+'의 결'),summary:describeStrength(st),sections,notes,requiresTime:false,source:'samra-engine',identity:{iljuKr:text(c.iljuKr),ganzi:text(c.pillars.day.ganzi),dayElement:text(t.dayElement)},highlights:[highlight('나의 출발점',text(c.iljuKr)+'일주',stemNote?.[0]),highlight('일을 읽는 틀',gg.hangul,group?.title),highlight('균형을 돕는 방향',yong.join(' · '),st.neutral ? '중화에 가까워 보조 참고로 읽어요' : '억부 기준으로 계산한 보완 방향')] });
}

function starReading(v, options) {
  const e = options.chart && options.interpretation ? null : engineRoot(options.engine), geo = place(options.location), args = [v.y,v.mo,v.d,v.h,v.mi,geo.lat,geo.lon,geo.houseSystem];
  const c = options.chart ? json(options.chart) : calculate(e,'NatalCalc','calculate',args);
  const t = options.interpretation ? json(options.interpretation) : calculate(e,'NatalCalc','interpret',args);
  const unknown = v.unk || c.unknownTime === true || t.unknownTime === true;
  if(v.unk && (c.unknownTime !== true || t.unknownTime !== true)) fail('invalid_engine_result','시간 모름 기준의 별자리 결과를 다시 계산해 주세요.');
  const cards = list(t.coreCards), sun = cards.find(row=>row.planetLabel==='태양'), moon = cards.find(row=>row.planetLabel==='달'), rising = !unknown && cards.find(row=>row.planetLabel==='상승궁');
  if (!text(t.headline) || !text(sun?.summary) || !text(sun?.signKo)) fail('invalid_engine_result','별자리 해석의 근거를 확인하지 못했어요.');
  const sections = [section('nature','나의 기본 기질',[sun.summary,rising?.summary || t.mirror?.dailyUse || t.headlineBody],[signal('태양',sun.signKo),rising ? signal('상승궁',rising.signKo) : null],{takeaway:sun.title,evidence:[`태양이 ${text(sun.signKo)}에 놓인 배치를 읽었어요.`,rising ? `상승궁 ${text(rising.signKo)}는 입력한 시각과 출생도시로 계산했어요.` : '태양의 별자리만으로 차트 전체나 성격을 단정하지 않아요.']} )];
  if (!unknown && text(moon?.summary)) sections.push(section('emotion','마음이 쉬는 방식',[moon.summary,t.moonPhase?.emotionalPattern || t.moonPhase?.summary],[signal('달',moon.signKo),signal('마음의 리듬',t.moonPhase?.phaseName)],{takeaway:moon.title,actions:[t.moonPhase?.advice],evidence:[text(t.moonPhase?.summary)]}));
  const balances = list(t.elementBalance).filter(row=>number(row.count)!==null).sort((a,b)=>b.count-a.count);
  const modalities=list(t.modalityBalance).filter(row=>number(row.count)!==null).sort((a,b)=>b.count-a.count), modality=modalities[0];
  const balanceCount=balances.reduce((sum,row)=>sum+row.count,0);
  sections.push(section('balance','나에게 두드러지는 기질',[balances[0] ? `${text(balances[0].label)} 기질에서는 ${text(balances[0].description)}` : '',modality?.description],[...balances.map(row=>signal(row.label,String(row.count)+'개')),signal('움직임의 방식',modality?.label)],{takeaway:[balances[0]?.label,modality?.label].filter(Boolean).join(' · '),evidence:['원소는 행성이 놓인 별자리의 기질, 기본궁·고정궁·변동궁은 시작·유지·적응의 방식을 분류한 것이에요. 능력이나 성공 확률의 점수는 아니에요.'],visual:balanceCount ? {type:'elements',caption:'차트에 집계된 원소 기질',rows:balances.map((row,i)=>({key:['fire','earth','air','water'][['불','흙','공기','물'].indexOf(row.label)] || String(i),label:row.label,value:row.count,percent:Math.round(row.count*1000/balanceCount)/10}))} : undefined}));
  const top = list(t.planetTop), venus = top.find(row=>row.planetKo==='금성'), mercury = top.find(row=>row.planetKo==='수성');
  const venusSign = list(c.planets).find(row=>row.ko==='금성')?.signKo;
  const stories=list(t.aspectStories).filter(row=>!unknown || row.p1!=='달'&&row.p2!=='달');
  const story = stories.find(row=>row.p1==='금성'||row.p2==='금성'||row.p1==='수성'||row.p2==='수성') || stories[0];
  sections.push(section('relationship','관계와 표현에서 보이는 결',[venus?.sentence || mercury?.sentence || story?.summary,story ? text(story.summary) : mercury?.sentence],[venus ? signal('관계의 키워드',list(venus.keywords).map(text).filter(Boolean).join(' · ')) : null,signal('행성의 연결',story ? [text(story.p1),text(story.typeKo),text(story.p2)].filter(Boolean).join(' · ') : '')],{takeaway:venus ? list(venus.keywords).map(text).filter(Boolean).join(' · ') : '서로 다른 욕구가 어떻게 만나는지 살펴요',actions:[story?.advice || story?.note],evidence:[story ? `${text(story.p1)} · ${text(story.p2)} 사이의 ${text(story.typeKo)} 각을 읽었어요. ${text(story.note)}` : '',venus ? '금성의 별자리와 행성 간 각을 바탕으로 관계를 읽었어요. 실제 두 사람의 궁합을 계산한 결과는 아니에요.' : '행성 사이 각의 해석은 서로 다른 심리 주제가 만나는 방식을 설명해요.']}));
  const expression = mercury || top.find(row=>!['달','금성','태양'].includes(row.planetKo)), expressionPlanet=list(c.planets).find(row=>row.ko===expression?.planetKo);
  if(expression && text(expression.sentence)) sections.push(section('expression','생각과 재능을 꺼내는 방식',[
    expression.sentence,
    expression.planetKo==='수성' ? '수성은 정보를 받아들이고 생각을 정리해 전달하는 방식을 읽는 행성이에요. 최근에 설명이 잘 통했던 순간을 떠올리고, 말·글·그림 중 어떤 방식이 편했는지 비교해 보세요.' : `${text(expression.planetKo)}의 신호가 차트의 주요 영향 가운데 하나로 집계됐어요. 이 설명이 최근의 공부나 작업에서 어떤 경험과 닿는지 확인해 보세요.`,
  ],[signal('살펴본 행성',expression.planetKo),signal('별자리',expressionPlanet?.signKo),signal('표현의 단서',list(expression.keywords).map(text).join(' · '))],{takeaway:list(expression.keywords).map(text).join(' · '),evidence:['앱과 같은 행성 영향도 목록에서 해당 행성의 문장을 가져왔어요. 영향도 순위를 사람의 능력이나 가치의 순위로 읽지는 않아요.']}));
  if(!unknown){
    const areas=list(t.lifeAreas).filter(row=>text(row.summary)), ruler=t.chartRuler;
    if(areas.length)sections.push(section('life','에너지가 모이는 생활의 무대',areas.slice(0,2).map(row=>`${text(row.summary)} ${text(row.advice)}`),areas.slice(0,2).map(row=>signal('두드러진 영역',row.title)),{takeaway:areas[0].title,evidence:[...areas.slice(0,2).map(row=>row.expertBasis),ruler?.expertBasis],actions:ruler?.advice ? [ruler.advice] : []}));
  }
  const patterns=list(t.patterns).filter(row=>text(row.summary)&&(!unknown || !/달|하우스|상승궁/.test([row.title,row.summary,row.expertBasis].join(' '))));
  if(patterns.length)sections.push(section('structure','반복해서 나타나는 차트의 주제',patterns.slice(0,2).map(row=>row.summary),patterns.slice(0,2).map(row=>signal('차트의 구조',row.title)),{takeaway:patterns[0].title,evidence:patterns.slice(0,2).map(row=>row.expertBasis)}));
  sections.push(section('practice','일상에서 살려 볼 방향',[t.growthTheme?.description,t.growthTheme?.advice || t.overview?.focus],[signal('성장의 방향',t.growthTheme?.title),signal('작은 실천',list(t.growthTheme?.keywords).map(text).filter(Boolean).join(' · '))],{takeaway:'익숙한 방식에서 한 걸음 넓혀 봐요',evidence:[t.growthTheme?.expertBasis],actions:[t.mirror?.dailyUse]}));
  const notes = [`출생지는 ${geo.name} 기준, 입력 시각은 한국 표준시로 읽었어요.${unknown ? '' : ' 태어난 도시나 시간대가 다르면 상승궁과 하우스 등 시간·장소에 민감한 결과를 다시 확인해 주세요.'}`];
  if (unknown) notes.unshift('출생시간 미상으로 정오의 행성 배치를 참고했어요. 달처럼 빠르게 움직이는 천체는 실제 시간에 따라 달라질 수 있어요. 상승궁·하우스·차트 룰러 풀이는 제외했어요.');
  return finish({ kind:'star',title:'나의 별자리 리포트',headline:text(t.headline),summary:unknown ? '정오를 대신 사용한 행성 배치로 기본 기질을 읽었어요. 출생 시간이 필요한 상승궁과 하우스는 제외했어요.' : text(t.headlineBody),sections,notes,requiresTime:false,source:'samra-engine',highlights:[highlight('기본 성향',sun.signKo,sun.title),unknown ? highlight('두드러진 기질',balances[0]?.label,modality?.description) : highlight('마음의 반응',moon?.signKo,moon?.title),highlight(unknown ? '관계의 단서' : '세상과 만나는 태도',unknown ? list(venus?.keywords).map(text).join(' · ') || venusSign : rising?.signKo,unknown ? venus?.sentence || '금성이 놓인 별자리도 함께 살펴요' : rising?.title)] });
}

function jamiReading(v, options) {
  if (v.unk) return finish({kind:'jami',title:'나의 자미두수 리포트',headline:'태어난 시간을 알면 펼칠 수 있어요',summary:'자미두수는 출생 시간이 있어야 명궁과 별의 자리를 정할 수 있어요.',sections:[],notes:['시간 모름을 임의의 시로 바꾸지 않았어요. 태어난 시간을 확인한 뒤 명반을 열어 주세요.'],requiresTime:true,source:'samra-engine'});
  if (!Number.isInteger(options.year) || options.year < 1900 || options.year > 2199) fail('year_required','자미두수 해석의 기준 연도를 확인해 주세요.');
  const e=options.interpretation ? null : engineRoot(options.engine),geo=place(options.location),args=[v.y,v.mo,v.d,v.h,v.mi,v.g==='M',geo.lon,options.year];
  const t=options.interpretation ? json(options.interpretation) : calculate(e,'ZiweiCalc','interpret',args);
  const palaces=list(t.palaces),ming=palaces.find(row=>row.name==='命宮');
  if (!text(t.lead)||!ming||!t.starDict) fail('invalid_engine_result','자미두수 해석의 근거를 확인하지 못했어요.');
  const sections=[];
  const palaceName = palace => /궁$/.test(palace.kr) ? text(palace.kr) : text(palace.kr)+'궁';
  const starsIn = palace => list(palace?.mainStars).map(star=>text(t.starDict[star.name]?.kr)||text(star.name)).filter(Boolean).join(' · ');
  const brightness = { '廟':'묘 · 편안하게 힘을 쓰는 자리', '旺':'왕 · 힘이 두드러지는 자리', '得':'득 · 힘을 얻는 자리', '利':'리 · 이점을 갖는 자리', '平':'평 · 중간 정도의 자리', '閑':'한 · 힘이 약해지는 자리', '陷':'함 · 힘을 쓰기 까다로운 자리' };
  for(const [id,title,name] of [['nature','나의 기본 성향','命宮'],['work','일과 역할의 방향','官祿'],['relationship','가까운 관계를 이어가는 방식','夫妻'],['resources','자원과 기반을 다루는 방식','財帛'],['recovery','마음이 회복하는 자리','福德'],['environment','새로운 환경과 만나는 방식','遷移']]){
    const palace=palaces.find(row=>row.name===name);if(!palace)continue;
    const stars=list(palace.mainStars),meanings=stars.map(star=>t.starDict[star.name]).filter(Boolean);
    const meaning=meanings.length>1 ? meanings.slice(0,2).map(row=>`${text(row.kr)}: ${firstSentences(row.body)}`).join(' ') : meanings[0]?.body;
    const actions=list(palace.actions).map(text).filter(value=>value&&!value.startsWith('올해 '));
    sections.push(section(id,title,[meaning || palace.role,palace.hint],[signal('살펴본 자리',palaceName(palace)),signal('중심 별',starsIn(palace))],{takeaway:[text(palace.theme),starsIn(palace)].filter(Boolean).join(' · '),actions:id==='resources' ? [] : actions.slice(0,2),evidence:[palace.role,stars.map(star=>`${text(t.starDict[star.name]?.kr)||text(star.name)}${brightness[star.brightness] ? `: ${brightness[star.brightness]}` : ''}${star.siHua ? ` · ${text(star.siHua)}` : ''}`).join(' / '),palace.isEmpty ? '이 궁에는 주성이 없어요. 주성이 없다고 이 영역이 비어 있다는 뜻은 아니며, 맞은편 궁과 다른 별을 함께 살펴야 해요.' : '',palace.isShenGong ? '신궁이 겹치는 자리로 계산됐어요. 기본 성향을 실제 생활에서 펼치는 영역으로 함께 읽어요.' : '']}));
  }
  const annual=palaces.map(palace=>({palace,actions:list(palace.actions).map(text).filter(value=>value.startsWith('올해 '))})).filter(row=>row.actions.length);
  if(annual.length)sections.push(section('flow',`${options.year}년, 한 번 더 살펴볼 영역`,annual.slice(0,2).map(row=>`${palaceName(row.palace)}의 ${text(row.palace.theme)} 영역이에요. ${row.actions[0]}`),annual.slice(0,2).map(row=>signal('올해의 관찰 영역',palaceName(row.palace))),{takeaway:'태어난 명반 위에 올해의 변화를 겹쳐 읽어요',evidence:['이 장은 선택한 연도의 유년 사화가 실제로 놓이는 궁에 대한 앱의 행동 안내를 가져왔어요. 출생 명반의 별과 올해 이동하는 신호를 구분해서 읽어요.','명반의 신호를 실제 사건이나 성공·실패의 확정값으로 바꾸지 않았어요.']}));
  const work=palaces.find(row=>row.name==='官祿'), shen=palaces.find(row=>row.isShenGong);
  return finish({kind:'jami',title:'나의 자미두수 리포트',headline:text(t.lead),summary:text(ming.hint),sections,notes:[`${options.year}년을 기준으로 별의 자리와 기본 행동 안내를 읽었어요. 실제 사건이나 성과를 확정하는 예고는 아니에요.`,`출생지는 ${geo.name} 기준이에요. 태어난 도시가 다르면 시간 경계의 명반을 다시 확인해 주세요.`],requiresTime:false,source:'samra-engine',highlights:[highlight('나의 중심',starsIn(ming)||'명궁에 주성 없음',ming.theme),highlight('일의 무대',starsIn(work)||'관록궁에 주성 없음',work?.theme),highlight('생활에서 펼치는 자리',shen ? palaceName(shen) : '',shen?.theme)]});
}

/** `solar` is owned, already calendar-converted birth data. Never a remote peer. */
export function buildReadingInsight(kind, solar, options = {}) {
  const v=ownBirth(solar);
  if(kind==='saju')return sajuReading(v,options);
  if(kind==='star')return starReading(v,options);
  if(kind==='jami')return jamiReading(v,options);
  fail('unsupported_reading','이 해석은 아직 준비하지 않았어요.');
}
