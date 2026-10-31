import { loadReadingEngine, mountReading } from './readings.js?v=20261101-editorial1';
import { buildReadingInsight } from './reading-insight-core.js';
import { mountReadingOffers } from './reading-offers.js?v=20261101-editorial1';
import { profileSearch } from './profile-core.js';

const HOSTS = { tojeong: { name: '토정과', kind: 'saju' }, seol: { name: '설월과', kind: 'saju' }, luna: { name: '루나와', kind: 'star' } };
const KINDS = [['saju', '사주'], ['jami', '자미두수'], ['star', '별자리']];
let reportSequence = 0;
const yearInKorea = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()));
const defaultPlace = () => ({ name: '서울', lat: 37.5665, lon: 126.978, houseSystem: 'P' });

/** Own-birth reading only. The raw calculators and external products stay opt-in. */
export function mountReadingReport(container, npc, profile, options = {}) {
  if (!Object.hasOwn(HOSTS, npc) || !profile?.solar) throw new TypeError('내 정보를 먼저 입력해 주세요.');
  const document = container.ownerDocument, lifetime = new AbortController(), id = `personal-report-${++reportSequence}`;
  const loadEngine = options.loadEngine || loadReadingEngine, interpret = options.buildInsight || buildReadingInsight;
  const mountCalculator = options.mountCalculator || mountReading, mountOffers = options.mountOffers || mountReadingOffers;
  let disposed = false, version = 0, kind = HOSTS[npc].kind, currentBirth, location, trueSolarTime;
  let raw, rawAbort, offerCleanup, enginePromise, viewAbort, outlineAbort;
  const make = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text != null) node.textContent = text; return node; };
  const listen = (node, event, callback, signal = lifetime.signal) => node.addEventListener(event, callback, { signal });
  const button = (className, text, callback, signal = lifetime.signal) => { const node = make('button', className, text); node.type = 'button'; listen(node, 'click', callback, signal); return node; };
  const navigate = href => {
    if (disposed) return;
    if (options.onNavigate) options.onNavigate(href);
    else document.dispatchEvent(new CustomEvent('sowon:navigate', { detail: { url: href } }));
  };
  const clearNested = () => { viewAbort?.abort(); outlineAbort?.abort(); rawAbort?.abort(); rawAbort = null; raw?.dispose?.(); raw = null; offerCleanup?.(); offerCleanup = null; };
  container.replaceChildren(); container.classList.add('xp-personal-dialog');
  const header = make('header', 'report-header'), brand = make('div', 'report-brand');
  brand.append(make('strong', '', '소원당'), make('span', '', '/ 나의 해석'));
  const utilities = make('nav', 'report-utilities'); utilities.setAttribute('aria-label', '신당에서 함께하기');
  utilities.append(button('', '공간 안내', () => options.onGuide?.()), button('', '궁합 요청', () => options.onSocial?.()));
  const close = button('report-close', '×', () => options.onClose?.()); close.setAttribute('aria-label', '해석을 닫고 신당으로 돌아가기');
  header.append(brand, utilities, close);
  const tabs = make('div', 'report-tabs'); tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', '해석의 관점');
  const tabNodes = KINDS.map(([value, label]) => {
    const tab = button('', label, () => select(value)); tab.id = `${id}-${value}`; tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${id}-panel`);
    listen(tab, 'keydown', event => {
      const index = KINDS.findIndex(item => item[0] === kind);
      const target = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1;
      if (target < 0) return; event.preventDefault(); select(KINDS[target][0]); tabNodes[target].focus();
    });
    tabs.append(tab); return tab;
  });
  const content = make('div', 'report-content'); content.id = `${id}-panel`; content.setAttribute('role', 'tabpanel');
  container.append(header, tabs, content);

  function profileLabel() {
    const v = currentBirth, pad = n => String(n).padStart(2, '0');
    return `양력 ${v.y}.${pad(v.mo)}.${pad(v.d)} · ${v.unk ? '시간 모름' : pad(v.h) + ':' + pad(v.mi)} · ${v.g === 'M' ? '남성' : '여성'}${kind === 'star' ? ' · ' + location.name + ' 기준' : ''}`;
  }
  function select(next) {
    if (disposed || !KINDS.some(item => item[0] === next)) return;
    const ticket = ++version; clearNested(); kind = next; currentBirth = { ...profile.solar }; location = defaultPlace(); trueSolarTime = false;
    viewAbort = new AbortController(); const viewSignal = viewAbort.signal;
    tabNodes.forEach((node, index) => { const selected = KINDS[index][0] === kind; node.setAttribute('aria-selected', String(selected)); node.tabIndex = selected ? 0 : -1; });
    content.setAttribute('aria-labelledby', `${id}-${kind}`); content.replaceChildren();
    const intro = make('div', 'report-intro');
    const title = make('h1', 'report-title', '나의 해석을 펼치고 있어요');
    const lead = make('p', 'report-lead');
    const meta = make('div', 'report-profile'), metadata = make('p', '', profileLabel());
    meta.append(metadata, button('', '내 정보 수정', () => options.onProfile?.(), viewSignal));
    const summary = make('p', 'report-summary');
    intro.append(make('p', 'report-kicker', `${HOSTS[npc].name} 함께 읽는 기본 해석`), title, lead, meta, summary);
    const pending = make('p', 'report-pending', '입력한 정보로 기본 해석을 계산하고 있어요.'); pending.setAttribute('role', 'status');
    const layout = make('div', 'report-layout'), chapters = make('div', 'report-chapters'), outline = make('nav', 'report-outline'); outline.setAttribute('aria-label', '해석 목차'); layout.append(chapters, outline);
    const notes = make('div', 'report-notes');
    const technical = make('details', 'report-technical'), technicalTitle = make('summary', '', kind === 'star' ? '차트·출생도시와 계산 조건' : '명식과 계산 조건');
    const rawBody = make('div', 'report-technical-body');
    technical.append(technicalTitle, make('p', 'report-technical-note', '조건을 바꿔 다시 계산하면 이 탭의 기본 해석에 반영돼요. 다른 탭은 캐릭터의 출생정보로 시작해요. 캐릭터 정보 자체를 바꾸려면 ‘내 정보 수정’을 눌러 주세요.'), rawBody);
    const offerHost = make('div', 'report-offer-host'); offerHost.hidden = true;
    content.append(intro, pending, layout, notes, technical, offerHost, make('p', 'report-footnote', '기본 해석은 삼라의 계산 결과를 읽기 쉽게 풀어 쓴 내용이에요. 웹의 주제 리포트와 앱의 융합 리포트는 별도로 구매하는 더 긴 해석이에요.'));
    let calculation = 0, inputCalendar = profile.birth?.calendar;
    async function refresh() {
      const revision = ++calculation;
      offerHost.hidden = true;
      outlineAbort?.abort(); outlineAbort = new AbortController(); const outlineSignal = outlineAbort.signal;
      try {
        enginePromise ||= Promise.resolve().then(loadEngine);
        const engine = await enginePromise;
        if (disposed || ticket !== version || revision !== calculation) return;
        const result = interpret(kind, currentBirth, { engine, year: options.year || yearInKorea(), location, trueSolarTime });
        title.textContent = result.title; lead.textContent = result.headline; metadata.textContent = profileLabel(); summary.textContent = result.summary;
        pending.hidden = true; pending.className = 'report-pending'; chapters.replaceChildren(); outline.replaceChildren(make('p', '', '이번 해석에서'));
        result.sections.forEach((chapter, index) => {
          const section = make('section', 'report-chapter'), heading = make('h2', '', chapter.title); section.id = `${id}-${kind}-${chapter.id}`; heading.tabIndex = -1;
          section.append(make('span', 'report-chapter-number', String(index + 1).padStart(2, '0')), heading);
          chapter.paragraphs.forEach(paragraph => section.append(make('p', '', paragraph)));
          if (chapter.signals.length) { const facts = make('dl', 'report-signals'); chapter.signals.forEach(fact => { const row = make('div', ''); row.append(make('dt', '', fact.label), make('dd', '', fact.value)); facts.append(row); }); section.append(facts); }
          chapters.append(section);
          outline.append(button('', chapter.title, () => { section.scrollIntoView({ block: 'start', behavior: 'auto' }); heading.focus({ preventScroll: true }); }, outlineSignal));
        });
        layout.hidden = result.sections.length === 0;
        offerHost.hidden = result.requiresTime || result.sections.length === 0;
        notes.replaceChildren(...result.notes.map(note => make('p', '', note)));
        if (inputCalendar && inputCalendar !== 'S') notes.append(make('p', '', '입력한 음력 생일을 양력으로 바꿔 계산했어요.'));
        if (result.requiresTime) { pending.hidden = false; pending.replaceChildren(button('report-time-button', '태어난 시간 입력하기', () => options.onProfile?.(), viewSignal)); }
      } catch (_) {
        if (disposed || ticket !== version || revision !== calculation) return;
        enginePromise = null; title.textContent = '해석을 확인해 주세요'; lead.textContent = ''; summary.textContent = ''; metadata.textContent = profileLabel();
        chapters.replaceChildren(); outline.replaceChildren(); layout.hidden = true; notes.replaceChildren(); offerHost.hidden = true;
        pending.hidden = false; pending.className = 'report-error'; pending.textContent = '기본 해석을 준비하지 못했어요. 아래에서 계산 조건을 확인하고 다시 계산해 주세요.';
      }
    }
    let rawStarted = false;
    listen(technical, 'toggle', async () => {
      if (!technical.open || rawStarted || disposed || ticket !== version) return;
      rawStarted = true; rawAbort = new AbortController();
      try {
        const mounted = await mountCalculator(rawBody, kind, {
          search: profileSearch(kind, profile), signal: rawAbort.signal, autoScroll: false, navigate,
          onCalculated(input, context) {
            if (disposed || ticket !== version || !input) return;
            currentBirth = { y: +input.y, mo: +input.mo, d: +input.d, h: input.unk || +input.h === -1 ? -1 : +input.h, mi: +input.mi || 0, g: input.g, unk: !!input.unk || +input.h === -1 };
            const root = context?.root || raw?.root, city = root?.getElementById('city');
            const name = city?.selectedOptions?.[0]?.textContent || (+input.lon === 126.978 ? '서울' : '입력한 출생지');
            inputCalendar = root?.getElementById('cal')?.value || inputCalendar;
            if (Number.isFinite(+input.lon)) location = { ...location, lon: +input.lon, name };
            if (kind === 'star') location = { ...location, lat: +input.lat, houseSystem: input.hs || 'P' };
            if (kind === 'saju') trueSolarTime = input.tst === true;
            void refresh();
          },
        });
        if (disposed || ticket !== version) mounted?.dispose?.(); else raw = mounted;
      } catch (_) { if (!disposed && ticket === version) { rawStarted = false; rawBody.textContent = '계산 화면을 불러오지 못했어요. 접었다가 다시 열어 주세요.'; } }
    }, viewSignal);
    offerCleanup = mountOffers(offerHost, { npc, kind, onNavigate: navigate, signal: lifetime.signal });
    void refresh();
  }
  const dispose = () => { if (disposed) return; disposed = true; version++; lifetime.abort(); clearNested(); container.replaceChildren(); container.classList.remove('xp-personal-dialog'); };
  select(kind); return dispose;
}
