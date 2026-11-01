import { DEMO_SELF, DEMO_TRAVELERS, createDemoSession } from './ilju-demo-core.js?v=20261101-demotravelers2';
import { loadReadingEngine } from './readings.js?v=20261101-freepath4';
import { safeResult } from './social-core.js?v=20261101-freepath4';

const esc = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const actionButton = (action, label, extra = '') => `<button type="button" data-demo-action="${action}" ${extra}>${esc(label)}</button>`;
const finalConsonant = name => { const code = String(name).charCodeAt(String(name).length - 1); return code >= 0xac00 && code <= 0xd7a3 ? (code - 0xac00) % 28 : 0; };
const particle = (name, withConsonant, withoutConsonant) => finalConsonant(name) ? withConsonant : withoutConsonant;

/** Private, disposable rehearsal. Real profiles, presence and consent never enter this module. */
export function createIljuDemo({ onApproach } = {}) {
  const session = createDemoSession(), histories = new Map(), results = new Map();
  const dialog = document.createElement('dialog');
  dialog.id = 'iljuDemoDialog'; dialog.className = 'ilju-demo';
  dialog.setAttribute('aria-labelledby', 'iljuDemoTitle');
  document.body.appendChild(dialog);
  let selected = '', opener = null, disposed = false, ticket = 0, busy = false, error = '';
  const peerFor = id => DEMO_TRAVELERS.find(peer => peer.id === id);
  const isDemo = id => Boolean(peerFor(id));
  const current = () => peerFor(selected);
  const history = id => histories.get(id) || [];

  function focusReturn() {
    if (opener?.isConnected && !opener.closest?.('[inert]')) opener.focus({ preventScroll: true });
    opener = null;
  }
  function invalidate() { ++ticket; busy = false; error = ''; }
  function close() {
    invalidate();
    if (dialog.open) dialog.close();
    focusReturn();
  }
  function closed() { if (!dialog.open) { invalidate(); focusReturn(); } }
  function choose(id) {
    if (!isDemo(id)) return false;
    invalidate(); selected = id; render({ resetScroll: true });
    if (session.get(id).resultAllowed) void calculate();
    return true;
  }
  function open(id = DEMO_TRAVELERS[0]?.id) {
    if (disposed || !isDemo(id)) return false;
    if (!dialog.open) {
      opener = document.activeElement;
      dialog.showModal();
    }
    choose(id);
    dialog.querySelector('[data-demo-action="close"]')?.focus({ preventScroll: true });
    return true;
  }
  function reset() {
    for (const peer of DEMO_TRAVELERS) session.act(peer.id, 'reset');
    histories.clear(); results.clear(); close();
  }
  function dispose() {
    if (disposed) return;
    reset(); disposed = true;
    dialog.removeEventListener('click', clicked);
    dialog.removeEventListener('cancel', cancelled);
    dialog.removeEventListener('close', closed);
    dialog.remove();
  }
  function resultMarkup(result) {
    const personText = value => esc(String(value ?? '').replace(/(^|[^A-Za-z])([AB])(?![A-Za-z])(으로|로|은|는|이|가|을|를|과|와)?/g, (_match, before, who, ending = '') => {
      const name = who === 'A' ? DEMO_SELF.nickname : current().nickname;
      const pairs = { 은: ['은', '는'], 는: ['은', '는'], 이: ['이', '가'], 가: ['이', '가'], 을: ['을', '를'], 를: ['을', '를'], 과: ['과', '와'], 와: ['과', '와'] };
      const suffix = pairs[ending] ? particle(name, ...pairs[ending]) : ['으로', '로'].includes(ending) ? (finalConsonant(name) && finalConsonant(name) !== 8 ? '으로' : '로') : ending;
      return before + name + suffix;
    }));
    const rows = (heading, values, label, content) => values.length ? `<section class="demo-reading-section"><h4>${heading}</h4>${values.map(row => `<article><h5>${personText(row[label])}</h5><p>${personText(row[content])}</p></article>`).join('')}</section>` : '';
    return `<section class="demo-reading" aria-label="가상 인물의 친구 궁합 결과"><p class="demo-eyebrow">삼라 궁합 엔진 · 친구</p><div class="demo-reading-heading"><div><h3>${esc(DEMO_SELF.nickname)} <span>×</span> ${esc(current().nickname)}</h3><p>고정된 가상 출생정보로 계산한 체험 결과</p></div><div class="demo-score"><strong>${result.totalScore}</strong><span>점</span></div></div><p class="demo-verdict">${personText(result.verdict)}</p><div class="demo-scores">${Object.entries({ bond: '결속력', stability: '안정성', growth: '성장성', consumption: '소모도' }).filter(([key]) => result.subScores[key] !== null).map(([key, label]) => `<div><span>${label}</span><strong>${result.subScores[key]}</strong></div>`).join('')}</div>${result.iljuPair ? `<section class="demo-reading-section"><h4>두 일주가 만나는 결</h4><article><h5>${personText(result.iljuPair.headline)}</h5><p>${personText(result.iljuPair.detail)}</p><p>${personText(result.iljuPair.advice)}</p></article></section>` : ''}${rows('함께 살릴 강점', result.strengths.slice(0, 2), 'label', 'sub')}${rows('서로 알아둘 조율점', result.cautions.slice(0, 2), 'label', 'sub')}${result.narrative.length || result.axes.length ? `<details class="demo-reading-more"><summary>관계의 이야기 더 읽기</summary>${rows('두 사람의 이야기', result.narrative, 'label', 'text')}${rows('관계의 바탕', result.axes, 'headline', 'detail')}</details>` : ''}<p class="demo-result-note">점수는 관계를 이해하는 참고예요. 이 해석은 실제 내 사주나 실제 나그네의 결과가 아니에요.</p></section>`;
  }
  function requestMarkup(peer, state) {
    if (state.phase === 'pending-outgoing') return `<section class="demo-request"><p class="demo-eyebrow">내가 보낸 요청 · 승인 대기</p><h3>${esc(peer.nickname)}에게 친구 궁합을 청했어요.</h3><p>아직 해석은 열리지 않아요. 가상 상대가 어떻게 답할지 직접 골라 보세요.</p><div class="demo-response"><span>가상 상대의 응답을 선택해요</span><div>${actionButton('peer-approve', `${peer.nickname}의 승인 체험`, 'class="demo-primary"')}${actionButton('peer-decline', `${peer.nickname}의 사양 체험`)}</div></div>${actionButton('cancel', '내 요청 취소', 'class="demo-text-button"')}</section>`;
    if (state.phase === 'pending-incoming') return `<section class="demo-request"><p class="demo-eyebrow">내가 받은 초대 · 가상 상황</p><h3>“우리 친구 궁합을 함께 볼까요?”</h3><p>${esc(peer.nickname)}에게서 초대가 온 상황이에요. 내가 승인해야 해석이 열려요.</p><div class="demo-actions">${actionButton('approve', '승인하고 궁합 보기', 'class="demo-primary"')}${actionButton('decline', '이번에는 사양')}</div></section>`;
    if (state.resultAllowed) {
      const cached = results.get(peer.id);
      const result = cached?.revision === state.revision ? cached.result : null;
      return `<section class="demo-approved"><p class="demo-consent-status"><span aria-hidden="true">✓</span> 두 사람의 동의가 모였어요 · 가상 체험</p>${busy ? '<div class="demo-engine-wait" role="status"><span aria-hidden="true"></span><p>삼라 궁합 엔진으로 두 사람의 결을 읽고 있어요.</p></div>' : error ? `<div class="demo-engine-error" role="alert"><p>${esc(error)}</p>${actionButton('retry', '해석 다시 불러오기', 'class="demo-primary"')}</div>` : result ? resultMarkup(result) : actionButton('retry', '친구 궁합 해석 보기', 'class="demo-primary"')}<div class="demo-revoke"><p>철회하면 두 사람 모두 결과를 볼 수 없어요.</p>${actionButton('revoke', '공유 철회 체험')}</div></section>`;
    }
    const notices = { declined: '이번 초대는 사양했어요. 새 요청으로 다시 연습할 수 있어요.', cancelled: '보낸 요청을 취소했어요. 해석은 열리지 않았어요.', revoked: '공유를 철회했어요. 이 결과는 더 이상 열리지 않아요.' };
    return `<section class="demo-request">${notices[state.phase] ? `<p class="demo-state-note" role="status">${notices[state.phase]}</p>` : ''}<p class="demo-eyebrow">친구 궁합 나누기</p><h3>서로의 동의가 모이면, 함께 읽어요.</h3><p>‘${esc(DEMO_SELF.nickname)}’와 ${esc(peer.nickname)}의 가상 정보로 요청부터 철회까지 연습해 보세요.</p><div class="demo-actions">${actionButton('request', '친구 궁합 요청', 'class="demo-primary"')}${actionButton('receive', '초대 받아보기')}</div></section>`;
  }
  function render({ resetScroll = false } = {}) {
    const peer = current(); if (!dialog.open || !peer) return;
    const scrollTop = resetScroll ? 0 : dialog.querySelector('.demo-body')?.scrollTop || 0;
    const focused = document.activeElement?.dataset;
    const previousAction = focused?.demoAction, previousPeer = focused?.demoPeer, previousTopic = focused?.demoTopic;
    const state = session.get(peer.id), messages = history(peer.id);
    dialog.dataset.peer = peer.id; dialog.dataset.phase = state.phase; dialog.dataset.loading = String(busy);
    dialog.innerHTML = `<header class="demo-header"><div><p>가상 나그네 · 상호작용 체험</p><h2 id="iljuDemoTitle">나그네와 인사를 나눠요</h2></div>${actionButton('close', '닫기', 'class="demo-close" aria-label="가상 나그네 체험 닫기"')}</header><div class="demo-body"><p class="demo-disclaimer">실제 접속자가 아닌 가상 인물이에요. 요청과 승인은 이 화면에서만 연습해요.</p><nav class="demo-people" aria-label="가상 나그네 선택">${DEMO_TRAVELERS.map(person => `<button type="button" data-demo-action="choose" data-demo-peer="${esc(person.id)}" aria-pressed="${person.id === selected}"><span class="demo-person-dot demo-outfit-${esc(person.outfit)}" aria-hidden="true"></span>${esc(person.nickname)}<small>가상</small></button>`).join('')}</nav><section class="demo-conversation" aria-label="${esc(peer.nickname + particle(peer.nickname, '과', '와'))} 나누는 대화"><div class="demo-person-heading"><div class="demo-portrait demo-outfit-${esc(peer.outfit)}" aria-hidden="true">${esc(peer.nickname.charAt(0))}</div><div><p>가상 나그네</p><h3>${esc(peer.nickname)}</h3></div>${actionButton('approach', '다가가기', 'class="demo-approach"')}</div><div class="demo-messages"><p class="demo-message demo-peer-message">${esc(peer.greeting)}</p>${messages.map((message, index) => `<p class="demo-message ${message.from === 'self' ? 'demo-self-message' : 'demo-peer-message'}" ${index === messages.length - 1 ? 'role="status"' : ''}>${esc(message.text)}</p>`).join('')}</div><div class="demo-topic-label">무엇을 이야기할까요?</div><div class="demo-topics">${peer.topics.map(topic => `<button type="button" data-demo-action="topic" data-demo-topic="${esc(topic.id)}">${esc(topic.label)}<span aria-hidden="true">↗</span></button>`).join('')}</div></section>${requestMarkup(peer, state)}<footer class="demo-footer"><p>실제 내 출생정보와 실제 나그네에게는 연결되지 않아요.<br>체험 기록은 현재 화면에서만 유지돼요.</p>${actionButton('reset-peer', '이 나그네와 처음부터', 'class="demo-text-button"')}</footer></div>`;
    const body = dialog.querySelector('.demo-body'); if (body) body.scrollTop = scrollTop;
    if (previousAction) {
      const match = [...dialog.querySelectorAll('[data-demo-action]')].find(node => node.dataset.demoAction === previousAction && (!previousPeer || node.dataset.demoPeer === previousPeer) && (!previousTopic || node.dataset.demoTopic === previousTopic));
      (match || dialog.querySelector('.demo-request button, .demo-approved button, [data-demo-action="close"]'))?.focus({ preventScroll: true });
    }
  }
  async function calculate() {
    const peer = current(); if (!peer || !dialog.open) return;
    const snapshot = session.get(peer.id); if (!snapshot.resultAllowed || busy) return;
    if (results.get(peer.id)?.revision === snapshot.revision) { render(); return; }
    const version = ++ticket; busy = true; error = ''; render();
    const isCurrent = () => !disposed && dialog.open && version === ticket && selected === peer.id && session.get(peer.id).resultAllowed && session.get(peer.id).revision === snapshot.revision;
    try {
      const bundle = await loadReadingEngine();
      if (!isCurrent()) return;
      const engine = bundle?.com?.samramanshang?.manseryeok?.orrery?.js?.GunghapCalc;
      if (typeof engine?.analyze !== 'function') throw new Error('engine_unavailable');
      const a = DEMO_SELF.birth, b = peer.birth;
      const year = Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()));
      const analysis = JSON.parse(engine.analyze(a.y, a.mo, a.d, a.h, a.mi, a.g, b.y, b.mo, b.d, b.h, b.mi, b.g, 'FRIEND', year));
      const result = safeResult({ analysis, names: { a: DEMO_SELF.nickname, b: peer.nickname } });
      if (!result) throw new Error('invalid_result');
      if (isCurrent()) results.set(peer.id, { revision: snapshot.revision, result });
    } catch (_) {
      if (isCurrent()) error = '궁합 엔진을 아직 불러오지 못했어요. 연결을 확인하고 다시 시도해 주세요.';
    } finally {
      if (isCurrent()) { busy = false; render(); }
    }
  }
  function clicked(event) {
    const button = event.target.closest?.('[data-demo-action]');
    if (!button || !dialog.contains(button) || button.disabled) return;
    const action = button.dataset.demoAction;
    if (action === 'close') { close(); return; }
    if (action === 'choose') { choose(button.dataset.demoPeer); return; }
    const peer = current(); if (!peer) return;
    if (action === 'approach') { const id = peer.id; close(); onApproach?.(id); return; }
    if (action === 'topic') {
      const topic = peer.topics.find(item => item.id === button.dataset.demoTopic); if (!topic) return;
      histories.set(peer.id, [...history(peer.id), { from: 'self', text: topic.label }, { from: 'peer', text: topic.reply }].slice(-8));
      render(); return;
    }
    if (action === 'retry') { void calculate(); return; }
    const transition = action === 'reset-peer' ? 'reset' : action;
    if (!['request', 'receive', 'approve', 'decline', 'peer-approve', 'peer-decline', 'cancel', 'revoke', 'reset'].includes(transition)) return;
    try {
      invalidate();
      if (transition === 'request' || transition === 'receive') session.act(peer.id, transition, 'FRIEND');
      else session.act(peer.id, transition);
      results.delete(peer.id);
      if (transition === 'reset') histories.delete(peer.id);
      render();
      if (session.get(peer.id).resultAllowed) void calculate();
    } catch (_) { render(); }
  }
  function cancelled(event) { event.preventDefault(); close(); }
  dialog.addEventListener('click', clicked);
  dialog.addEventListener('cancel', cancelled);
  dialog.addEventListener('close', closed);
  return { open, close, reset, dispose, isDemo };
}
