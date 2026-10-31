import { createDialogueSession, getNpcPersona } from './dialogue-core.js?v=20261101-dialogue1';
import { loadReadingEngine } from './readings.js?v=20261101-editorial1';
import { buildReadingInsight } from './reading-insight-core.js';

const mounts = new WeakMap();
let sequence = 0;
const koreanYear = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()));

/** A choice-driven conversation. Only the owner's existing local chart is read. */
export function mountNpcDialogue(container, npcId, options = {}) {
  const npc = getNpcPersona(npcId);
  if (!npc) throw new TypeError('이 술사와의 대화를 준비하지 못했어요.');
  mounts.get(container)?.();
  const document = container.ownerDocument, lifetime = new AbortController(), id = `npc-talk-${++sequence}`;
  const profile = options.profile, hasProfile = Boolean(profile?.solar);
  const withNpc = npc.name + (npcId === 'luna' ? '와' : '과');
  const session = options.session?.view?.().npc?.id === npcId ? options.session : createDialogueSession(npcId, { nickname: profile?.nickname, hasProfile });
  const loadEngine = options.loadEngine || loadReadingEngine, buildInsight = options.buildInsight || buildReadingInsight;
  let disposed = false, choicesAbort, messageIds = [], messageNodes = new Map(), engineTicket = 0;
  const make = (tag, className, text) => { const element = document.createElement(tag); if (className) element.className = className; if (text != null) element.textContent = text; return element; };
  const listen = (node, type, callback, signal = lifetime.signal) => node.addEventListener(type, callback, { signal });
  const button = (text, className, callback, signal) => { const node = make('button', className, text); node.type = 'button'; listen(node, 'click', callback, signal); return node; };
  container.classList.add('npc-dialog'); container.classList.remove('xp-personal-dialog');
  container.style.setProperty('--npc-accent', npc.accent || '#526b55');
  container.setAttribute('aria-labelledby', `${id}-title`); container.removeAttribute('aria-label');

  const stage = make('aside', 'npc-stage'); stage.setAttribute('aria-label', `${npc.name} 소개`);
  const portrait = make('img', 'npc-portrait'); portrait.src = `/store/art/readers/${npcId}.webp`; portrait.alt = ''; portrait.width = 168; portrait.height = 168;
  const identity = make('div', 'npc-identity');
  identity.append(make('h2', 'npc-name', npc.name), make('p', 'npc-role', npc.role || npc.title));
  stage.append(make('p', 'npc-stage-brand', '소원당 · 이야기'), portrait, identity, make('p', 'npc-stage-line', npc.line), make('p', 'npc-stage-meta', hasProfile ? '나의 정보로 읽는 대화' : '처음 만나는 대화'), button(hasProfile ? '내 정보 수정' : '내 정보 준비', 'npc-profile-action', () => options.onProfile?.()));

  const conversation = make('div', 'npc-conversation'), header = make('header', 'npc-dialog-header');
  const heading = make('div', ''), title = make('h1', 'npc-dialog-title', npc.openerTitle || '오늘은 어떤 이야기를 나눌까요?'); title.id = `${id}-title`;
  const status = make('p', 'npc-status', hasProfile ? '내 기본 해석을 준비하고 있어요' : '질문을 골라 이야기를 시작하세요'); status.setAttribute('role', 'status');
  heading.append(make('p', 'npc-eyebrow', `${withNpc}의 대화`), title, status);
  const close = button('×', 'npc-close', () => options.onClose?.()); close.setAttribute('aria-label', `${withNpc}의 대화 닫기`); header.append(heading, close);
  const toolbar = make('nav', 'npc-toolbar'); toolbar.setAttribute('aria-label', '대화와 함께 보기');
  toolbar.append(button(hasProfile ? '전체 해석' : '내 정보 입력', '', () => hasProfile ? options.onReading?.(npc.readingKind) : options.onProfile?.()), button('나그네와 궁합', '', () => options.onSocial?.()), button('공간 둘러보기', '', () => options.onHall?.(npcId === 'tojeong' ? 'myeongri' : npcId === 'seol' ? 'inyeon' : 'readers')));
  const messages = make('ol', 'npc-messages'); messages.setAttribute('role', 'log'); messages.setAttribute('aria-label', `${withNpc} 나눈 이야기`); messages.setAttribute('aria-live', 'polite'); messages.setAttribute('aria-relevant', 'additions'); messages.tabIndex = 0;
  const composer = make('div', 'npc-composer'), prompt = make('p', 'npc-prompt', '어떤 이야기를 이어볼까요?'), choices = make('div', 'npc-choices'); choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', '이어서 물어볼 질문');
  const footer = make('div', 'npc-dialog-footer'), back = button('이전 질문', 'npc-back', () => { if (session.back()) render(true); });
  const restart = button('처음부터', 'npc-back', () => { session.reset(); render(true); });
  footer.append(back, restart, make('small', 'npc-disclosure', '준비된 안내와 내 해석으로 대화해요. 이 페이지에서만 이어져요.'));
  composer.append(prompt, choices, footer); conversation.append(header, toolbar, messages, composer); container.replaceChildren(stage, conversation);

  function route(action) {
    if (!action || disposed) return;
    if (action.type === 'profile') options.onProfile?.();
    else if (action.type === 'reading') options.onReading?.(action.id || npc.readingKind);
    else if (action.type === 'social') options.onSocial?.();
    else if (action.type === 'feature') options.onFeature?.(action.id);
  }
  function render(focus = false) {
    if (disposed) return;
    const view = session.view(), nextIds = view.messages.map(message => message.id);
    const prefix = messageIds.every((value, index) => nextIds[index] === value);
    const wasAtEnd = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
    if (!prefix) { messages.replaceChildren(); messageIds = []; messageNodes.clear(); }
    const added = [];
    view.messages.slice(messageIds.length).forEach(message => {
      const item = make('li', `npc-message npc-message--${message.role === 'user' ? 'user' : 'npc'}`); item.tabIndex = -1;
      item.append(make('span', 'npc-speaker', message.role === 'user' ? '나' : npc.name));
      const body = make('div', 'npc-message-body');
      if (message.chapter) body.append(make('h3', 'npc-message-chapter', message.chapter));
      String(message.text || '').split(/\n\s*\n/).filter(Boolean).forEach(text => body.append(make('p', 'npc-message-text', text)));
      if (message.signals?.length) { const facts = make('dl', 'npc-message-signals'); message.signals.forEach(fact => { const row = make('div', ''); row.append(make('dt', '', fact.label), make('dd', '', fact.value)); facts.append(row); }); body.append(facts); }
      item.append(body); messages.append(item); messageNodes.set(message.id, item); added.push(item);
    });
    messageIds = nextIds; choicesAbort?.abort(); choicesAbort = new AbortController(); choices.replaceChildren();
    view.choices.forEach(choice => { const item = button(choice.label, 'npc-choice', () => { const result = session.choose(choice.id); if (!result.accepted) return; render(true); route(result.action); }, choicesAbort.signal); item.dataset.dialogueChoice = choice.id; choices.append(item); });
    back.hidden = !view.canBack; prompt.textContent = view.stage === 'reading' || view.stage === 'followup' ? '이 대목에서 더 궁금한 건 무엇인가요?' : '궁금한 이야기를 골라 주세요';
    const latest = added.at(-1);
    if (focus && latest) { latest.focus({ preventScroll: true }); (added.find(node => node.classList.contains('npc-message--user')) || latest).scrollIntoView({ block: 'start', behavior: 'auto' }); }
    else if (wasAtEnd && latest && messageIds.length > 1) latest.scrollIntoView({ block: 'nearest', behavior: 'auto' });
  }
  async function prepareInsight() {
    if (!hasProfile || disposed) return;
    const ticket = ++engineTicket;
    try {
      const engine = await loadEngine(); if (disposed || ticket !== engineTicket) return;
      const insight = buildInsight(npc.readingKind, { ...profile.solar }, { engine, year: options.year || koreanYear() });
      session.setInsight(insight); status.textContent = `${npc.readingKind === 'star' ? '서울 기준 · ' : ''}${profile.solar.unk ? '출생시간 미상 · ' : ''}내 정보로 준비한 기본 해석`; render();
    } catch (_) {
      if (disposed || ticket !== engineTicket) return;
      status.textContent = '기본 해석을 준비하지 못했어요. 전체 해석에서 정보를 확인해 주세요.'; status.className = 'npc-status npc-error';
    }
  }
  function dispose() {
    if (disposed) return; disposed = true; engineTicket++; lifetime.abort(); choicesAbort?.abort(); messageNodes.clear();
    container.replaceChildren(); container.classList.remove('npc-dialog'); container.style.removeProperty('--npc-accent'); container.removeAttribute('aria-labelledby'); container.setAttribute('aria-label', '술사와 이야기 나누기');
    if (mounts.get(container) === dispose) mounts.delete(container);
  }
  dispose.session = session; dispose.dispose = dispose; mounts.set(container, dispose);
  render(); void prepareInsight(); return dispose;
}
