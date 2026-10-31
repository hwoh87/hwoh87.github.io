const mounts = new WeakMap();
const HOSTS = Object.freeze([
  { npc: 'tojeong', hall: 'myeongri', name: '토정', withName: '토정과', objectName: '토정을' },
  { npc: 'seol', hall: 'inyeon', name: '설월', withName: '설월과', objectName: '설월을' },
  { npc: 'luna', hall: 'readers', name: '루나', withName: '루나와', objectName: '루나를' },
]);
const MENUS = Object.freeze([
  ['#soundToggle', '소리', '풍경 소리 켜고 끄기'],
  ['[data-hub-view="map"]', '지도', '신당 지도'],
  ['[data-hub-view="all"]', '전체 기능', '삼라 전체 기능'],
  ['[data-hub-feature="library"]', '내 서재', '내 서재 열기'],
  ['[data-open-profile]', '내 정보', '내 캐릭터와 출생 정보'],
  ['[data-open-social]', '궁합 요청', '함께 있는 나그네와 궁합'],
]);

/** Presentation-only shell: original actions, IDs, birth data and world movement stay with their owners. */
export function mountShrineInterface(document) {
  const shell = document.querySelector('.sanctuary');
  if (!shell) return () => {};
  if (mounts.has(shell)) return mounts.get(shell);
  const controller = new AbortController(), owned = [], attributes = [], relocated = [];
  const listen = (node, name, fn) => node?.addEventListener(name, fn, { signal: controller.signal });
  const make = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const rememberAttribute = (node, name, value) => { attributes.push([node, name, node.getAttribute(name)]); node.setAttribute(name, value); };
  shell.classList.add('interface-shell'); document.body.classList.add('interface-active');
  const invitation = shell.querySelector('.invitation'), fallback = shell.querySelector('#worldFallback');
  if (invitation && fallback) { relocated.push([fallback, fallback.parentElement, fallback.nextSibling]); invitation.insertBefore(fallback, invitation.querySelector('.hub-intro-link')); }
  const nav = shell.querySelector('.shrine-nav');
  for (const [selector, text, name] of MENUS) {
    const button = nav?.querySelector(selector); if (!button) continue;
    const label = make('span', 'interface-menu-label', text); button.append(label); owned.push(label);
    if (!button.getAttribute('aria-label')) rememberAttribute(button, 'aria-label', name);
    if (!button.getAttribute('title')) rememberAttribute(button, 'title', name);
  }
  for (const [selector, text] of [['#overviewWorld', '전체 보기'], ['[data-open-traveler]', '풍경'], ['#returnToGate', '처음 자리'], ['#greetTraveler', '인사']]) {
    const button = shell.querySelector(selector); if (!button) continue;
    const label = make('span', 'interface-tool-label', text); button.append(label); owned.push(label);
    if (!button.getAttribute('aria-label')) rememberAttribute(button, 'aria-label', text === '인사' ? '함께 있는 나그네에게 인사하기' : text);
    if (!button.getAttribute('title')) rememberAttribute(button, 'title', text);
  }
  const greetMark = shell.querySelector('#greetTraveler > span');
  if (greetMark) {
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('class', 'icon interface-greet-icon'); icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-stars'); icon.append(use);
    shell.querySelector('#greetTraveler').append(icon); owned.push(icon);
  }
  const hosts = make('nav', 'interface-hosts'); hosts.setAttribute('aria-label', '술사와 이야기하러 가기');
  hosts.append(make('span', 'interface-hosts-label', '술사'));
  for (const host of HOSTS) {
    const button = make('button', 'interface-host', host.name); button.type = 'button'; button.dataset.npc = host.npc;
    button.setAttribute('aria-label', `${host.withName} 이야기하러 가기`); button.title = `${host.objectName} 만나 이야기 나누기`;
    listen(button, 'click', () => {
      if (document.querySelector('dialog[open]')) return;
      const walking = document.body.classList.contains('world-ready') && !document.body.classList.contains('world-failed');
      document.dispatchEvent(new CustomEvent(walking ? 'sowon:walk' : 'sowon:encounter', { detail: walking ? { action: host.hall } : { npc: host.npc } }));
    });
    hosts.append(button);
  }
  shell.append(hosts); owned.push(hosts);
  const controls = shell.querySelector('.move-controls'), help = shell.querySelector('#worldHelp');
  let helpButton;
  function setHelpOpen(open, focus = false) {
    shell.classList.toggle('interface-help-open', Boolean(open));
    helpButton?.setAttribute('aria-expanded', String(Boolean(open)));
    help?.setAttribute('aria-hidden', String(!open));
    if (focus) helpButton?.focus({ preventScroll: true });
  }
  if (controls && help) {
    helpButton = make('button', 'interface-help-toggle', '조작 안내'); helpButton.type = 'button'; helpButton.setAttribute('aria-controls', help.id); helpButton.setAttribute('aria-expanded', 'false');
    controls.append(helpButton); owned.push(helpButton); rememberAttribute(help, 'aria-hidden', 'true');
    listen(helpButton, 'click', () => setHelpOpen(helpButton.getAttribute('aria-expanded') !== 'true'));
    listen(document, 'click', event => { if (helpButton.getAttribute('aria-expanded') === 'true' && !help.contains(event.target) && !helpButton.contains(event.target)) setHelpOpen(false); });
    listen(document, 'keydown', event => { if (event.key === 'Escape' && helpButton.getAttribute('aria-expanded') === 'true' && !document.querySelector('dialog[open]')) { event.preventDefault(); setHelpOpen(false, true); } });
  }
  const dispose = () => {
    controller.abort(); owned.forEach(node => node.remove());
    for (const [node, parent, next] of relocated) parent.insertBefore(node, next?.parentElement === parent ? next : null);
    for (const [node, name, value] of attributes) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); }
    shell.classList.remove('interface-shell', 'interface-help-open'); document.body.classList.remove('interface-active'); mounts.delete(shell);
  };
  mounts.set(shell, dispose); return dispose;
}
if (typeof document !== 'undefined') mountShrineInterface(document);
