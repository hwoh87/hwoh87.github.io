import { createDialogueSession, getNpcPersona } from './dialogue-core.js?v=20261101-flashlite1';
import { createShrineChatClient } from './chat-client.js?v=20261101-flashlite1';
import { loadReadingEngine } from './readings.js?v=20261101-editorial1';
import { buildReadingInsight } from './reading-insight-core.js';

const mounts = new WeakMap();
let sequence = 0;
const koreanYear = () => Number(new Intl.DateTimeFormat('en', { year: 'numeric', timeZone: 'Asia/Seoul' }).format(new Date()));

/** Local topic questions and choices read only the owner's existing chart. */
export function mountNpcDialogue(container, npcId, options = {}) {
  const npc = getNpcPersona(npcId);
  if (!npc) throw new TypeError('이 술사와의 대화를 준비하지 못했어요.');
  mounts.get(container)?.();
  const document = container.ownerDocument, lifetime = new AbortController(), id = `npc-talk-${++sequence}`;
  const profile = options.profile, hasProfile = Boolean(profile?.solar);
  const withNpc = npc.name + (npcId === 'luna' ? '와' : '과');
  const session = options.session?.view?.().npc?.id === npcId ? options.session : createDialogueSession(npcId, { nickname: profile?.nickname, hasProfile });
  const loadEngine = options.loadEngine || loadReadingEngine, buildInsight = options.buildInsight || buildReadingInsight;
  const chatClient = options.chatClient === false ? null : options.chatClient || createShrineChatClient();
  let disposed = false, choicesAbort, messageIds = [], messageNodes = new Map(), engineTicket = 0, composing = false;
  let activeRequest = null, preparation, feedbackError = '', readingStatus = hasProfile ? '내 기본 해석을 준비하고 있어요' : '내 정보 없이도 궁금한 이야기를 물어보세요';
  const compactQuestions = document.defaultView?.matchMedia?.('(max-height: 500px)');
  let expandedChoices = false, visibleChoiceCount = compactQuestions?.matches ? 0 : 2;
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
  stage.append(make('p', 'npc-stage-brand', '소원당 · 이야기'), portrait, identity, make('p', 'npc-stage-line', npc.line), make('p', 'npc-stage-meta', hasProfile ? '나의 정보로 읽는 대화' : '처음 만나는 대화'), button(hasProfile ? '내 정보 수정' : '내 정보 준비', 'npc-profile-action', () => leave(options.onProfile)));

  const conversation = make('div', 'npc-conversation'), header = make('header', 'npc-dialog-header');
  const heading = make('div', ''), title = make('h1', 'npc-dialog-title', npc.openerTitle || '오늘은 어떤 이야기를 나눌까요?'); title.id = `${id}-title`;
  const status = make('p', 'npc-status', readingStatus); status.setAttribute('role', 'status');
  heading.append(make('p', 'npc-eyebrow', `${withNpc}의 대화`), title, status);
  const close = button('×', 'npc-close', () => leave(options.onClose)); close.setAttribute('aria-label', `${withNpc}의 대화 닫기`); header.append(heading, close);
  const toolbar = make('nav', 'npc-toolbar'); toolbar.setAttribute('aria-label', '대화와 함께 보기');
  toolbar.append(button(hasProfile ? '전체 해석' : '내 정보 입력', '', () => leave(() => hasProfile ? options.onReading?.(npc.readingKind) : options.onProfile?.())), button('나그네와 궁합', '', () => leave(options.onSocial)), button('공간 둘러보기', '', () => leave(() => options.onHall?.(npcId === 'tojeong' ? 'myeongri' : npcId === 'seol' ? 'inyeon' : 'readers'))));
  const messages = make('ol', 'npc-messages'); messages.setAttribute('role', 'log'); messages.setAttribute('aria-label', `${withNpc} 나눈 이야기`); messages.setAttribute('aria-live', 'polite'); messages.setAttribute('aria-relevant', 'additions'); messages.tabIndex = 0;
  const composer = make('div', 'npc-composer'), prompt = make('p', 'npc-prompt', '이렇게 물어봐도 좋아요'), choices = make('div', 'npc-choices'); choices.id = `${id}-choices`; choices.setAttribute('role', 'group'); choices.setAttribute('aria-label', '이어서 물어볼 질문');
  const more = button('질문 더 보기', 'npc-more-questions', () => { expandedChoices = !expandedChoices; showChoices(); }); more.setAttribute('aria-controls', choices.id); more.setAttribute('aria-expanded', 'false');
  const form = make('form', 'npc-question-form'); form.setAttribute('aria-label', `${withNpc} 직접 이야기하기`);
  const inputLabel = make('label', 'npc-input-label', '궁금한 주제를 직접 적어 주세요'); inputLabel.htmlFor = `${id}-input`;
  const inputRow = make('div', 'npc-input-row'), input = make('input', 'npc-question-input'); input.id = `${id}-input`; input.type = 'text'; input.maxLength = 320; input.autocomplete = 'off'; input.enterKeyHint = 'send';
  input.placeholder = npcId === 'tojeong' ? '예: 요즘 흐름은 어떤가요?' : npcId === 'seol' ? '예: 나는 관계에서 어떤 편인가요?' : '예: 내 마음은 어떻게 쉬나요?';
  const send = make('button', 'npc-send', '보내기'); send.type = 'submit'; send.disabled = true;
  const inputNotice = chatClient ? '질문·최근 대화·풀이 요약을 Google Gemini로 전송해요.' : '성향·관계·흐름처럼 궁금한 주제를 적어보세요.';
  const feedback = make('p', 'npc-input-feedback', inputNotice); feedback.id = `${id}-feedback`; feedback.setAttribute('role', 'status'); input.setAttribute('aria-describedby', feedback.id);
  inputRow.append(input, send); form.append(inputLabel, inputRow, feedback);
  listen(input, 'compositionstart', () => { composing = true; }); listen(input, 'compositionend', () => { composing = false; updateDraft(); });
  function updateDraft() {
    const length = Array.from(input.value || '').length; send.disabled = Boolean(activeRequest) || !String(input.value || '').trim() || length > 160;
    input.disabled = Boolean(activeRequest); send.textContent = activeRequest ? '답변 중' : '보내기';
    input.setAttribute('aria-invalid', String(length > 160));
    const message = length > 160 ? '질문은 160자 안으로 적어 주세요.' : activeRequest ? `${npc.name}${npcId === 'luna' ? '가' : '이'} 답변을 준비하고 있어요.` : feedbackError || inputNotice;
    feedback.classList.toggle('is-error', Boolean(feedbackError));
    if (feedback.textContent !== message) feedback.textContent = message;
  }
  listen(input, 'input', () => { feedbackError = ''; updateDraft(); });
  listen(form, 'submit', event => {
    event.preventDefault(); if (disposed || composing || activeRequest) return;
    const text = String(input.value || '').trim();
    if (!text || Array.from(text).length > 160) { updateDraft(); return; }
    if (chatClient) { void askAi(text); return; }
    const result = session.ask(text); if (!result.accepted) return;
    input.value = ''; updateDraft(); render(true); input.focus({ preventScroll: true });
  });
  const footer = make('div', 'npc-dialog-footer'), back = button('이전 질문', 'npc-back', () => { if (session.back()) render(true); });
  const restart = button('처음부터', 'npc-back', () => { abortPending(); session.reset(); feedbackError = ''; input.value = ''; render(true); });
  const cancel = button('응답 취소', 'npc-back npc-cancel', () => { abortPending(true); feedbackError = '응답을 취소했어요. 질문을 고쳐 다시 보낼 수 있어요.'; render(); input.focus({preventScroll:true}); }); cancel.hidden = true;
  const historyActions = make('div','npc-history-actions'); historyActions.append(back,restart,cancel);
  const disclosure = make('small', 'npc-disclosure', chatClient ? 'Gemini Flash Lite · 출생정보 원문·닉네임은 보내지 않아요. ' : '주제에 맞는 준비된 안내와 내 계산 해석을 들려줘요. 이 페이지에서만 이어져요.');
  if (chatClient) { const privacy=make('a','','정보 처리 안내'); privacy.href='/legal/privacy/#sowon-ai'; privacy.target='_blank'; privacy.rel='noopener noreferrer'; disclosure.append(privacy); }
  footer.append(historyActions,disclosure);
  composer.append(prompt, choices, more, form, footer); conversation.append(header, toolbar, messages, composer); container.replaceChildren(stage, conversation);
  listen(container,'cancel',()=>abortPending());

  function abortPending(restoreDraft = false) {
    if (!activeRequest) return;
    const request = activeRequest; activeRequest = null; request.controller.abort(); session.rejectAiQuestion(request.ticket);
    if (restoreDraft && !input.value) input.value = request.text;
  }
  function leave(callback) { abortPending(); callback?.(); }
  async function askAi(text, choiceId) {
    if (disposed || activeRequest) return;
    const started = session.beginAiQuestion(text, {choiceId});
    if (!started.accepted) return;
    feedbackError = ''; input.value = '';
    if (!started.ticket) { render(true); updateDraft(); return; }
    const request = {ticket:started.ticket,controller:new AbortController(),text}; activeRequest = request; render(true);
    try {
      await preparation;
      if (disposed || activeRequest !== request) return;
      const context = session.getAiContext();
      const result = await chatClient.request({...context,npc:npcId,question:started.question},{signal:request.controller.signal});
      if (disposed || activeRequest !== request) return;
      activeRequest = null;
      const completed = session.resolveAiQuestion(request.ticket,result.answer,{model:result.model});
      if (completed.accepted) render(true);
      else { session.rejectAiQuestion(request.ticket); input.value = text; feedbackError = '답변을 읽지 못했어요. 질문을 다시 보내 주세요.'; render(); }
    } catch (error) {
      if (disposed || activeRequest !== request) return;
      activeRequest = null; session.rejectAiQuestion(request.ticket);
      input.value = text;
      const messages = {rate_limited:'질문이 잠시 몰렸어요. 잠시 후 다시 보내 주세요.',timeout:'답변 시간이 길어졌어요. 질문을 다시 보내 주세요.',private_content:'개인정보 대신 궁금한 주제만 적어 주세요.',aborted:'응답을 취소했어요.',invalid_request:'질문을 확인한 뒤 다시 보내 주세요.'};
      const retry = Number(error?.retryAfter);
      feedbackError = error?.code === 'rate_limited' && Number.isFinite(retry) && retry > 0
        ? `현재 연결의 대화 이용 한도에 도달했어요. 약 ${retry >= 3600 ? Math.ceil(retry/3600)+'시간' : retry >= 60 ? Math.ceil(retry/60)+'분' : Math.ceil(retry)+'초'} 뒤에 다시 보내 주세요.`
        : messages[error?.code] || '답변을 받지 못했어요. 질문은 남겨 두었으니 다시 보내 주세요.';
      render(); input.focus({preventScroll:true});
    }
  }

  function showChoices() {
    Array.from(choices.children).forEach((node, index) => { node.hidden = !expandedChoices && index >= visibleChoiceCount; });
    more.hidden = choices.children.length <= visibleChoiceCount;
    more.textContent = expandedChoices ? '질문 접기' : visibleChoiceCount === 0 ? `추천 질문 ${choices.children.length}개 보기` : `다른 질문 ${Math.max(0, choices.children.length - visibleChoiceCount)}개`;
    more.setAttribute('aria-expanded', String(expandedChoices));
  }
  if (compactQuestions) listen(compactQuestions,'change',()=>{ visibleChoiceCount = compactQuestions.matches ? 0 : 2; expandedChoices = false; showChoices(); });

  function route(action) {
    if (!action || disposed) return;
    if (action.type === 'profile') options.onProfile?.();
    else if (action.type === 'reading') options.onReading?.(action.id || npc.readingKind);
    else if (action.type === 'social') options.onSocial?.();
    else if (action.type === 'feature') options.onFeature?.(action.id);
  }
  function render(focus = false) {
    if (disposed) return;
    const focusedChoice = Array.from(choices.children).find(node => node === document.activeElement)?.dataset.dialogueChoice;
    const view = session.view(), nextIds = view.messages.map(message => message.id);
    const prefix = messageIds.every((value, index) => nextIds[index] === value);
    const wasAtEnd = messages.scrollHeight - messages.scrollTop - messages.clientHeight < 100;
    if (!prefix) { messages.replaceChildren(); messageIds = []; messageNodes.clear(); }
    const added = [];
    view.messages.slice(messageIds.length).forEach(message => {
      const item = make('li', `npc-message npc-message--${message.role === 'user' ? 'user' : 'npc'}`); item.tabIndex = -1;
      item.append(make('span', 'npc-speaker', message.role === 'user' ? '나' : npc.name + (message.source === 'gemini' ? ' · AI' : '')));
      const body = make('div', 'npc-message-body');
      if (message.chapter) body.append(make('h3', 'npc-message-chapter', message.chapter));
      String(message.text || '').split(/\n\s*\n/).filter(Boolean).forEach(text => body.append(make('p', 'npc-message-text', text)));
      if (message.signals?.length) { const facts = make('dl', 'npc-message-signals'); message.signals.forEach(fact => { const row = make('div', ''); row.append(make('dt', '', fact.label), make('dd', '', fact.value)); facts.append(row); }); body.append(facts); }
      item.append(body); messages.append(item); messageNodes.set(message.id, item); added.push(item);
    });
    messageIds = nextIds; choicesAbort?.abort(); choicesAbort = new AbortController(); choices.replaceChildren();
    view.choices.forEach(choice => { const item = button(choice.label, 'npc-choice', () => {
      if (activeRequest) return;
      if (chatClient && !choice.id.startsWith('action:')) { void askAi(choice.label,choice.id); return; }
      const result = session.choose(choice.id); if (!result.accepted) return; render(true); route(result.action);
    }, choicesAbort.signal); item.dataset.dialogueChoice = choice.id; item.disabled = Boolean(activeRequest); choices.append(item); });
    visibleChoiceCount = compactQuestions?.matches ? 0 : 2; expandedChoices = false; showChoices();
    back.hidden = Boolean(activeRequest) || !view.canBack; back.disabled = Boolean(activeRequest); more.disabled = Boolean(activeRequest); cancel.hidden = !activeRequest;
    composer.setAttribute('aria-busy',String(Boolean(activeRequest)));
    status.textContent = activeRequest ? 'Gemini Flash Lite가 답변을 준비하고 있어요' : readingStatus;
    prompt.textContent = view.stage === 'clarify' ? '어느 이야기에 가까운가요?' : ['reading','followup','ai'].includes(view.stage) ? '이어서 이렇게 물어봐도 좋아요' : '이야기를 시작해 볼까요?';
    updateDraft();
    const latest = added.at(-1);
    if (focus && latest) { latest.focus({ preventScroll: true }); (added.find(node => node.classList.contains('npc-message--user')) || latest).scrollIntoView({ block: 'start', behavior: 'auto' }); }
    else {
      if (focusedChoice) (Array.from(choices.children).find(node => !node.hidden && node.dataset.dialogueChoice === focusedChoice) || Array.from(choices.children).find(node => !node.hidden) || more).focus({ preventScroll: true });
      if (wasAtEnd && latest && messageIds.length > 1) latest.scrollIntoView({ block: 'nearest', behavior: 'auto' });
    }
  }
  async function prepareInsight() {
    if (!hasProfile || disposed) return;
    const ticket = ++engineTicket;
    try {
      const engine = await loadEngine(); if (disposed || ticket !== engineTicket) return;
      const insight = buildInsight(npc.readingKind, { ...profile.solar }, { engine, year: options.year || koreanYear() });
      session.setInsight(insight); readingStatus = `${npc.readingKind === 'star' ? '서울 기준 · ' : ''}${profile.solar.unk ? '출생시간 미상 · ' : ''}내 정보로 준비한 기본 해석`; render();
    } catch (_) {
      if (disposed || ticket !== engineTicket) return;
      readingStatus = '기본 해석을 준비하지 못했어요. 전체 해석에서 정보를 확인해 주세요.'; status.className = 'npc-status npc-error'; render();
    }
  }
  function dispose() {
    if (disposed) return; abortPending(); disposed = true; engineTicket++; lifetime.abort(); choicesAbort?.abort(); messageNodes.clear();
    container.replaceChildren(); container.classList.remove('npc-dialog'); container.style.removeProperty('--npc-accent'); container.removeAttribute('aria-labelledby'); container.setAttribute('aria-label', '술사와 이야기 나누기');
    if (mounts.get(container) === dispose) mounts.delete(container);
  }
  dispose.session = session; dispose.dispose = dispose; mounts.set(container, dispose);
  render(); preparation = prepareInsight(); return dispose;
}
