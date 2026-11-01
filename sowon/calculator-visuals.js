import { buildSajuVisuals, buildStarVisuals, buildJamiVisuals } from './reading-visual-data.js?v=20261101-report-visual3';
import { buildCompatibilityVisuals } from './compatibility-visual-data.js?v=20261101-report-visual3';
import { renderReadingVisuals } from './reading-visuals.js?v=20261101-report-visual3';

const NAMES = Object.freeze({saju:'사주',gunghap:'궁합',jami:'자미두수',star:'별자리'});
const yearInKorea = () => Number(new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Seoul'}).format(new Date()));

/** The same successful, calendar-converted input as the canonical form. */
export function calculatorVisualData(kind, input, {engine, year=yearInKorea()}={}) {
  if (!Object.hasOwn(NAMES,kind) || !input || !engine) return [];
  const api=engine?.com?.samramanshang?.manseryeok?.orrery?.js || engine;
  const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
  if (kind === 'gunghap') {
    if (!input.a || !input.b || !['COUPLE','FRIEND','FAMILY','BUSINESS'].includes(input.kind)) return [];
    const a=input.a,b=input.b;
    if (input.kind === 'COUPLE' && (year-a.y<19 || year-b.y<19)) return [];
    const analysis=api.GunghapCalc.analyze(a.y,a.mo,a.d,a.unk?-1:a.h,a.unk?0:a.mi,a.g,b.y,b.mo,b.d,b.unk?-1:b.h,b.unk?0:b.mi,b.g,input.kind,year);
    return buildCompatibilityVisuals(parse(analysis));
  }
  // Calculator date ranges can extend beyond the personal-profile date range.
  // Project the canonical data directly, without adopting it as an own profile.
  const unknown=input.unk===true || input.h===-1;
  const h=unknown?-1:input.h,mi=unknown?0:input.mi;
  const lon=Number.isFinite(input.lon)?input.lon:126.978;
  if (kind === 'saju') {
    const args=[input.y,input.mo,input.d,h,mi,input.g,input.tst===true,lon];
    return buildSajuVisuals(parse(api.SajuCalc.calculate(...args)),parse(api.SajuCalc.interpret(...args)),{unknown,year});
  }
  if (kind === 'star') {
    const args=[input.y,input.mo,input.d,h,mi,Number.isFinite(input.lat)?input.lat:37.5665,lon,input.hs||'P'];
    return buildStarVisuals(parse(api.NatalCalc.calculate(...args)),parse(api.NatalCalc.interpret(...args)),{unknown,year});
  }
  if (unknown) return [];
  return buildJamiVisuals(parse(api.ZiweiCalc.interpret(input.y,input.mo,input.d,h,mi,input.g==='M',lon,year)),{unknown,year});
}

/** Owned by this calculator's result node; nothing is published or persisted. */
export function refreshCalculatorVisuals(root, kind, input, options={}) {
  const result=root.getElementById('result');
  if (!result) return null;
  const prior=result.querySelector('[data-calculator-visuals]');
  prior?.remove();
  const doc=result.ownerDocument || options.document;
  if (!doc) return null;
  let visualizations;
  try { visualizations=calculatorVisualData(kind,input,options); }
  catch (_) { return null; }
  if (!visualizations.length) return null;
  const section=doc.createElement('section'); section.className='shrine-data-overview'; section.setAttribute('data-calculator-visuals',kind);
  const header=doc.createElement('header'); header.className='shrine-data-header';
  const title=doc.createElement('h2'); title.textContent=`한눈에 보는 ${NAMES[kind]} 분석`;
  const note=doc.createElement('p'); note.textContent='삼라 앱과 같은 계산 엔진 · 아래 그래프와 상세 해석은 무료예요.';
  header.append(title,note);
  section.append(header,renderReadingVisuals(visualizations,{document:doc}));
  result.insertBefore(section,result.firstChild);
  return section;
}
