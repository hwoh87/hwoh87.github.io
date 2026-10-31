import { createEncounterSession, isEncounterAction } from './encounter-core.js?v=20261101-sanctuary2';

const mounts = new WeakMap();

function ensureStyles(document, root) {
  const styleRoot = root?.host ? root : document.head;
  if (styleRoot.querySelector('link[data-sowon-encounters]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet'; link.href = '/sowon/encounters.css?v=20261101-sanctuary2';
  link.setAttribute('data-sowon-encounters', '');
  styleRoot.appendChild(link);
}

/**
 * Prepared, two-choice-stage guidance. Parent owns modal presentation/proximity.
 * Returns a cleanup function; cleanup.dispose is an alias for standard mounts.
 */
export function mountEncounter(container, npcId, { onFeature, onHall, onClose, onPersonal } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('술사와 만날 공간이 없어요.');
  const session = createEncounterSession(npcId);
  mounts.get(container)?.();
  const document = container.ownerDocument;
  ensureStyles(document, container.getRootNode?.());
  const wrapper = document.createElement('section');
  wrapper.className = 'encounter';
  wrapper.setAttribute('aria-label', session.view().npc.name + '의 소원당 길잡이');
  wrapper.dataset.encounter = npcId;
  wrapper.style.setProperty('--encounter-accent', session.view().npc.accent);
  container.replaceChildren(wrapper);
  let disposed = false;
  const listeners = [];

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function button(text, className, callback) {
    const node = element('button', className, text);
    node.type = 'button';
    node.addEventListener('click', callback);
    listeners.push(() => node.removeEventListener('click', callback));
    return node;
  }
  function close() {
    if (disposed) return;
    if (typeof onClose === 'function') onClose();
    else {
      container.closest?.('dialog')?.close();
      container.dispatchEvent(new CustomEvent('sowon:encounter-close', { detail: { id: npcId }, bubbles: true, composed: true }));
    }
  }
  function openAction(action) {
    if (disposed || !isEncounterAction(action)) return;
    const callback = action.type === 'feature' ? onFeature : onHall;
    if (typeof callback === 'function') callback(action.id);
    else {
      close();
      document.dispatchEvent(new CustomEvent(action.type === 'feature' ? 'sowon:feature' : 'sowon:hall', { detail: { id: action.id } }));
    }
  }
  function render(focus = false) {
    if (disposed) return;
    listeners.splice(0).forEach(remove => remove());
    wrapper.replaceChildren();
    const { npc, topic, reply } = session.view();
    const header = element('header', 'encounter-header');
    const portrait = element('img', 'encounter-portrait');
    portrait.src = '/store/art/readers/' + npc.id + '.webp';
    portrait.alt = ''; portrait.width = 68; portrait.height = 68;
    const identity = element('div', 'encounter-identity');
    identity.append(element('span', 'encounter-eyebrow', '소원당 길잡이'), element('h3', 'encounter-name', npc.name), element('p', 'encounter-role', npc.title));
    header.append(portrait, identity); wrapper.appendChild(header);
    if(typeof onPersonal==='function'){
      const personal=element('div','encounter-personal-cta');
      personal.append(element('p','','성별과 생년월일시를 한 번 입력하면, 술사를 만날 때 나의 무료 해석이 바로 펼쳐져요.'),button('내 정보로 해석 받기','',onPersonal));
      wrapper.append(personal);
    }

    const progress = element('ol', 'encounter-progress');
    progress.setAttribute('aria-label', '대화 순서');
    ['주제 고르기', '한 가지 더', '다음 걸음'].forEach((text, index) => {
      const item = element('li', '', text);
      if (index === (reply ? 2 : topic ? 1 : 0)) item.setAttribute('aria-current', 'step');
      progress.appendChild(item);
    });
    wrapper.appendChild(progress);
    const heading = element('h4', 'encounter-question', reply ? reply.label : topic ? topic.label : '오늘은 무엇이 궁금한가요?');
    heading.tabIndex = -1;
    const answer = element('p', 'encounter-answer', reply ? reply.text : topic ? topic.answer : npc.greeting);
    wrapper.append(heading, answer);

    if (!reply) {
      const choices = element('div', 'encounter-choices');
      choices.setAttribute('role', 'group');
      choices.setAttribute('aria-label', topic ? '더 알고 싶은 내용' : '궁금한 주제');
      (topic ? topic.replies : npc.topics).forEach(choice => {
        const item = button('', 'encounter-choice', () => { if (session.choose(choice.id)) render(true); });
        item.dataset.encounterChoice = choice.id;
        item.append(element('span', 'encounter-choice-label', choice.label));
        if (choice.hint) item.append(element('small', 'encounter-choice-hint', choice.hint));
        item.append(element('span', 'encounter-choice-arrow', '↗'));
        item.lastChild.setAttribute('aria-hidden', 'true');
        choices.appendChild(item);
      });
      wrapper.appendChild(choices);
    } else {
      const actions = element('div', 'encounter-actions');
      actions.setAttribute('role', 'group'); actions.setAttribute('aria-label', '이어서 할 수 있는 일');
      reply.actions.filter(isEncounterAction).forEach((action, index) => {
        const item = button(action.label + ' ↗', 'encounter-action' + (index ? ' encounter-action--secondary' : ''), () => openAction(action));
        item.dataset.encounterAction = action.type + ':' + action.id;
        actions.appendChild(item);
      });
      wrapper.appendChild(actions);
    }

    const footer = element('footer', 'encounter-footer');
    const navigation = element('div', 'encounter-navigation');
    if (topic) navigation.append(button('← 앞 이야기', 'encounter-back', () => { if (session.back()) render(true); }));
    if (reply) navigation.append(button('다른 주제 고르기', 'encounter-back', () => { session.reset(); render(true); }));
    navigation.append(button('마당으로 돌아가기', 'encounter-close', close));
    footer.append(navigation, element('p', 'encounter-prepared', '고른 질문에 따라 미리 준비한 소원당 안내를 들려드려요.'));
    wrapper.appendChild(footer);
    if (focus) heading.focus({ preventScroll: true });
  }

  function dispose() {
    if (disposed) return;
    disposed = true; listeners.splice(0).forEach(remove => remove()); wrapper.remove();
    if (mounts.get(container) === dispose) mounts.delete(container);
  }
  dispose.dispose = dispose;
  dispose.reset = () => { if (!disposed) { session.reset(); render(true); } };
  mounts.set(container, dispose);
  render();
  return dispose;
}
