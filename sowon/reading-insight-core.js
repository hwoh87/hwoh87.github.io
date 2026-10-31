/**
 * A short, local reading from the same deterministic engine as /calc/.
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
function section(id, title, paragraphs, signals = []) {
  return { id, title, paragraphs: [...new Set(paragraphs.map(text).filter(Boolean))].slice(0, 2), signals: signals.filter(Boolean).slice(0, 5) };
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
  const sections = [
    section('nature','나를 이루는 기본 결',[
      `${text(c.iljuKr)}일주로, 나를 뜻하는 일간은 ${element(t.dayElement)} 기운이에요.${text(gg.hangul) ? ` 명식의 큰 틀은 ${text(gg.hangul)}으로 계산됐어요.` : ''}`,
      GODS[monthGod] ? `월간에는 ${monthGod} 신호도 있어요. ${GODS[monthGod]}` : '일주와 격국은 나의 성향을 읽는 출발점이에요. 한 가지 이름만으로 성격이나 살아갈 모습을 정하지 않고, 다른 글자와의 관계를 함께 읽어요.',
    ],[signal('일주',text(c.iljuKr)+'일주'),signal('일간',element(t.dayElement)),signal('격국',gg.hangul)]),
    section('balance','힘을 쓰고 회복하는 방식',[total > 0 ? `월주의 비중을 더해 읽으면, 나를 돕는 힘은 ${Math.round(st.help*100/total)}%, 밖으로 쓰거나 나를 제어하는 힘은 ${Math.round(st.weaken*100/total)}%로 계산돼요. 성취나 능력의 점수가 아니라 기운의 관계를 비교한 비율이에요.` : describeStrength(st),t.hint],[
      signal('기운의 균형',st.label),total > 0 ? signal('돕는 힘',Math.round(st.help*100/total)+'%') : null,total > 0 ? signal('밖으로 쓰는 힘',Math.round(st.weaken*100/total)+'%') : null,
    ]),
    section('direction','균형을 만드는 방향',[
      yong.length ? `일간을 기준으로 균형을 돕는 방향은 ${yong.join(' · ')} 기운이에요.${st.neutral ? ' 다만 중화에 가까워 한쪽 기운을 늘리기보다 전체 관계를 먼저 보는 보조 참고예요.' : ' 어떤 기운을 더 쓰거나 받쳐줄 때 균형이 생기는지 읽는 참고로 보세요.'}` : '이번 명식에서는 한 가지 오행을 균형의 답으로 단정하지 않아요. 전체 글자와 기운의 관계를 먼저 살펴봐요.',
      t.johu && element(t.johu.element) ? `태어난 계절의 한열을 보는 조후에서는 ${element(t.johu.element)} 기운을 살펴요. ${text(t.johu.reason)}.${yong.includes(element(t.johu.element)) ? ' 일간의 균형을 보는 방향과 계절의 보완 방향이 겹쳐 있어요.' : ' 이는 계절을 보완하는 기준으로, 앞의 일간 균형과는 구분해서 읽어요.'}` : '이 방향은 좋은 색이나 직업을 하나로 정해 주는 처방이 아니에요. 이미 쓰고 있는 힘과 필요한 쉼의 균형을 살피는 기준으로 읽어요.',
    ],[signal(st.neutral ? '보조 참고' : '균형을 돕는 기운',yong.join(' · ')),signal('과해지지 않게 볼 기운',gi.join(' · '))]),
  ];
  const year = options.year;
  if (Number.isInteger(year) && year >= 1900 && year <= 2199) {
    const periods = list(c.daewoon).filter(row => Number.isInteger(row.startYear)).sort((a,b)=>a.startYear-b.startYear);
    const index = periods.findLastIndex(row => row.startYear <= year), current = periods[index], next = periods[index+1];
    if (current && year < (next?.startYear ?? current.startYear+10)) sections.push(section('flow','큰 흐름에서 보는 지금',[
      `${year}년은 ${text(current.ganzi)} 대운 안에 있어요. ${current.startYear}년에 시작한 흐름${next ? `으로, 다음 대운은 ${next.startYear}년에 이어져요.` : '을 기준으로 지금의 변화를 살펴볼 수 있어요.'}`,
      current.stemSipsin === monthGod ? `월간에서 본 ${monthGod} 주제가 현재 대운에서도 겹쳐요. 기본 성향이 지금의 환경에서 어떤 방식으로 드러나는지, 익숙한 선택을 반복하고 있는지 살펴보세요.` : GODS[current.stemSipsin] || '대운은 긴 시간 동안 바뀌는 기운을 읽는 틀이에요. 한 해의 사건이나 성과를 확정하는 예고로 보지 않고, 반복되는 선택의 주제를 살펴보세요.',
    ],[signal('현재 대운',current.ganzi),signal('흐름의 주제',current.stemSipsin)]));
  }
  const notes=unknown ? ['출생시간 미상으로 시주를 제외한 세 기둥을 읽었어요. 정오를 대신 사용하므로 날짜 경계와 대운 시작 시점은 실제 출생시간에 따라 달라질 수 있어요.'] : [];
  if(options.trueSolarTime === true)notes.push(`${geo.name}의 경도로 진태양시를 보정했어요. 태어난 도시가 다르면 시간 경계의 명식을 다시 확인해 주세요.`);
  return { kind:'saju',title:'내 사주를 읽는 첫 장',headline:text(c.iljuKr)+'일주, '+element(t.dayElement)+'의 결',summary:describeStrength(st),sections,notes,requiresTime:false,source:'samra-engine' };
}

function starReading(v, options) {
  const e = options.chart && options.interpretation ? null : engineRoot(options.engine), geo = place(options.location), args = [v.y,v.mo,v.d,v.h,v.mi,geo.lat,geo.lon,geo.houseSystem];
  const c = options.chart ? json(options.chart) : calculate(e,'NatalCalc','calculate',args);
  const t = options.interpretation ? json(options.interpretation) : calculate(e,'NatalCalc','interpret',args);
  const unknown = v.unk || c.unknownTime === true || t.unknownTime === true;
  if(v.unk && (c.unknownTime !== true || t.unknownTime !== true)) fail('invalid_engine_result','시간 모름 기준의 별자리 결과를 다시 계산해 주세요.');
  const cards = list(t.coreCards), sun = cards.find(row=>row.planetLabel==='태양'), moon = cards.find(row=>row.planetLabel==='달'), rising = !unknown && cards.find(row=>row.planetLabel==='상승궁');
  if (!text(t.headline) || !text(sun?.summary) || !text(sun?.signKo)) fail('invalid_engine_result','별자리 해석의 근거를 확인하지 못했어요.');
  const sections = [section('nature','나의 기본 기질',[sun.summary,rising?.summary || t.headlineBody],[signal('태양',sun.signKo),rising ? signal('상승궁',rising.signKo) : null])];
  if (!unknown && text(moon?.summary)) sections.push(section('emotion','마음이 쉬는 방식',[moon.summary,t.moonPhase?.emotionalPattern || t.moonPhase?.summary],[signal('달',moon.signKo),signal('마음의 리듬',t.moonPhase?.phaseName)]));
  else {
    const balances = list(t.elementBalance).filter(row=>number(row.count)!==null).sort((a,b)=>b.count-a.count);
    const modality=list(t.modalityBalance).slice().sort((a,b)=>(number(b.count)||0)-(number(a.count)||0))[0];
    sections.push(section('balance','나에게 두드러지는 기질',[balances[0] ? `${text(balances[0].label)} 기질이 상대적으로 두드러져요. ${text(balances[0].description)}` : '',modality?.description],[...balances.slice(0,3).map(row=>signal(row.label,String(row.count)+'개')),signal('움직임의 방식',modality?.label)]));
  }
  const top = list(t.planetTop), venus = top.find(row=>row.planetKo==='금성'), mercury = top.find(row=>row.planetKo==='수성');
  const stories=list(t.aspectStories).filter(row=>!unknown || row.p1!=='달'&&row.p2!=='달');
  const story = stories.find(row=>row.p1==='금성'||row.p2==='금성'||row.p1==='수성'||row.p2==='수성') || stories[0];
  sections.push(section('relationship','관계와 표현에서 보이는 결',[venus?.sentence || mercury?.sentence || story?.summary,story ? [text(story.summary),text(story.advice)||text(story.note)].filter(Boolean).join(' ') : mercury?.sentence],[venus ? signal('관계의 키워드',list(venus.keywords).map(text).filter(Boolean).join(' · ')) : null,signal('행성의 연결',story ? [text(story.p1),text(story.typeKo),text(story.p2)].filter(Boolean).join(' · ') : '')]));
  sections.push(section('practice','일상에서 살려 볼 방향',[t.growthTheme?.description,t.growthTheme?.advice || t.overview?.focus],[signal('성장의 방향',t.growthTheme?.title),signal('작은 실천',list(t.growthTheme?.keywords).map(text).filter(Boolean).join(' · '))]));
  const notes = [`출생지는 ${geo.name} 기준, 입력 시각은 한국 표준시로 읽었어요.${unknown ? '' : ' 태어난 도시나 시간대가 다르면 상승궁과 하우스 등 시간·장소에 민감한 결과를 다시 확인해 주세요.'}`];
  if (unknown) notes.unshift('출생시간 미상으로 정오의 행성 배치를 참고했어요. 달처럼 빠르게 움직이는 천체는 실제 시간에 따라 달라질 수 있어요. 상승궁·하우스·차트 룰러 풀이는 제외했어요.');
  return { kind:'star',title:'태어난 하늘을 읽는 첫 장',headline:text(t.headline),summary:unknown ? '정오를 대신 사용한 행성 배치로 기본 기질을 읽었어요. 출생 시간이 필요한 상승궁과 하우스는 제외했어요.' : text(t.headlineBody),sections:sections.filter(row=>row.paragraphs.length),notes,requiresTime:false,source:'samra-engine' };
}

function jamiReading(v, options) {
  if (v.unk) return {kind:'jami',title:'내 자미두수를 읽는 첫 장',headline:'태어난 시간을 알면 펼칠 수 있어요',summary:'자미두수는 출생 시간이 있어야 명궁과 별의 자리를 정할 수 있어요.',sections:[],notes:['시간 모름을 임의의 시로 바꾸지 않았어요. 태어난 시간을 확인한 뒤 명반을 열어 주세요.'],requiresTime:true,source:'samra-engine'};
  if (!Number.isInteger(options.year) || options.year < 1900 || options.year > 2199) fail('year_required','자미두수 해석의 기준 연도를 확인해 주세요.');
  const e=options.interpretation ? null : engineRoot(options.engine),geo=place(options.location),args=[v.y,v.mo,v.d,v.h,v.mi,v.g==='M',geo.lon,options.year];
  const t=options.interpretation ? json(options.interpretation) : calculate(e,'ZiweiCalc','interpret',args);
  const palaces=list(t.palaces),ming=palaces.find(row=>row.name==='命宮');
  if (!text(t.lead)||!ming||!t.starDict) fail('invalid_engine_result','자미두수 해석의 근거를 확인하지 못했어요.');
  const sections=[];
  for(const [id,title,name] of [['nature','나의 기본 성향','命宮'],['work','일과 역할의 방향','官祿'],['relationship','관계에서 살펴볼 점','夫妻']]){
    const palace=palaces.find(row=>row.name===name);if(!palace)continue;
    const stars=list(palace.mainStars),meanings=stars.map(star=>t.starDict[star.name]).filter(Boolean);
    const meaning=meanings.length>1 ? meanings.slice(0,2).map(row=>`${text(row.kr)}: ${firstSentences(row.body)}`).join(' ') : meanings[0]?.body;
    sections.push(section(id,title,[meaning || palace.role,list(palace.actions).map(text).filter(Boolean).slice(0,2).join(' ') || palace.hint],[signal('살펴본 자리',/궁$/.test(palace.kr) ? palace.kr : text(palace.kr)+'궁'),signal('중심 별',stars.map(star=>text(t.starDict[star.name]?.kr)||text(star.name)).filter(Boolean).join(' · '))]));
  }
  return {kind:'jami',title:'내 자미두수를 읽는 첫 장',headline:text(t.lead),summary:text(ming.hint),sections,notes:[`${options.year}년을 기준으로 별의 자리와 기본 행동 안내를 읽었어요. 실제 사건이나 성과를 확정하는 예고는 아니에요.`,`출생지는 ${geo.name} 기준이에요. 태어난 도시가 다르면 시간 경계의 명반을 다시 확인해 주세요.`],requiresTime:false,source:'samra-engine'};
}

/** `solar` is owned, already calendar-converted birth data. Never a remote peer. */
export function buildReadingInsight(kind, solar, options = {}) {
  const v=ownBirth(solar);
  if(kind==='saju')return sajuReading(v,options);
  if(kind==='star')return starReading(v,options);
  if(kind==='jami')return jamiReading(v,options);
  fail('unsupported_reading','이 해석은 아직 준비하지 않았어요.');
}
