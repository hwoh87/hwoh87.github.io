const mounts = new WeakMap();
const HOSTS = Object.freeze([
  { npc: 'tojeong', hall: 'myeongri', name: '토정', withName: '토정과', objectName: '토정을', hint: '사주' },
  { npc: 'seol', hall: 'inyeon', name: '설월', withName: '설월과', objectName: '설월을', hint: '관계' },
  { npc: 'luna', hall: 'readers', name: '루나', withName: '루나와', objectName: '루나를', hint: '하늘' },
]);
const MENUS = Object.freeze([
  ['#soundToggle', '소리', '풍경 소리 켜고 끄기'],
  ['[data-hub-view="map"]', '지도', '신당 지도'],
  ['[data-hub-view="all"]', '전체 기능', '삼라 전체 기능'],
  ['[data-hub-feature="library"]', '내 서재', '내 서재 열기'],
  ['[data-open-profile]', '내 정보', '내 캐릭터와 출생 정보'],
  ['[data-open-social]', '함께 걷기', '함께 있는 나그네와 궁합'],
]);

/** Presentation-only shell: original actions, IDs, birth data and world movement stay with their owners. */
export function mountShrineInterface(document) {
  const shell = document.querySelector('.sanctuary');
  if (!shell) return () => {};
  if (mounts.has(shell)) return mounts.get(shell);
  const controller = new AbortController(), owned = [], attributes = [], relocated = [], restoredText = [];
  let disposed = false, overviewObserver;
  const listen = (node, name, fn) => node?.addEventListener(name, fn, { signal: controller.signal });
  const make = (tag, className, text) => { const node = document.createElement(tag); node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const rememberAttribute = (node, name, value) => { if (!attributes.some(entry => entry[0] === node && entry[1] === name)) attributes.push([node, name, node.getAttribute(name)]); node.setAttribute(name, value); };
  const move = (node, parent) => { if (!node || !parent) return; relocated.push([node, node.parentElement, node.nextSibling]); parent.append(node); };
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
  if (nav) {
    const original = [...nav.children], primary = make('div', 'interface-primary'), secondary = make('div', 'interface-secondary');
    secondary.id = 'shrineSecondaryTools'; secondary.hidden = true; secondary.setAttribute('role', 'group'); secondary.setAttribute('aria-label', '지도와 소리, 내 서재');
    const more = make('button', 'interface-more'); more.type = 'button'; more.setAttribute('aria-controls', secondary.id); more.setAttribute('aria-expanded', 'false'); more.setAttribute('aria-label', '지도, 소리, 내 서재 더보기');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('class', 'icon'); icon.setAttribute('viewBox', '0 0 24 24'); icon.setAttribute('aria-hidden', 'true');
    const dots = document.createElementNS('http://www.w3.org/2000/svg', 'path'); dots.setAttribute('d', 'M4 12h.01M12 12h.01M20 12h.01'); dots.setAttribute('stroke-width', '3'); dots.setAttribute('stroke-linecap', 'round'); icon.append(dots); more.append(icon, make('span', 'interface-menu-label', '더보기'));
    // Capture original sibling order before relocating the live action buttons.
    for (const node of original) relocated.push([node, nav, node.nextSibling]);
    for (const selector of ['[data-open-profile]', '[data-open-social]', '[data-hub-view="all"]']) { const node = nav.querySelector(selector); if (node) primary.append(node); }
    for (const selector of ['[data-hub-view="map"]', '#soundToggle', '[data-hub-feature="library"]']) { const node = nav.querySelector(selector); if (node) secondary.append(node); }
    nav.append(primary, more, secondary); owned.push(primary, more, secondary);
    function setMoreOpen(open, focus = false) { secondary.hidden = !open; more.setAttribute('aria-expanded', String(Boolean(open))); if (focus) more.focus({ preventScroll: true }); }
    listen(more, 'click', () => setMoreOpen(more.getAttribute('aria-expanded') !== 'true'));
    listen(secondary, 'click', () => setMoreOpen(false));
    listen(primary, 'click', () => setMoreOpen(false));
    listen(document, 'click', event => { if (!nav.contains(event.target)) setMoreOpen(false); });
    listen(document, 'focusin', event => { if (!nav.contains(event.target)) setMoreOpen(false); });
    listen(document, 'keydown', event => { if (event.key === 'Escape' && !secondary.hidden && !document.querySelector('dialog[open]')) { event.preventDefault(); setMoreOpen(false, true); } });
  }
  for (const [selector, text] of [['#overviewWorld', '전체 보기'], ['[data-open-traveler]', '풍경'], ['#returnToGate', '처음 자리'], ['#greetTraveler', '인사']]) {
    const button = shell.querySelector(selector); if (!button) continue;
    const label = make('span', 'interface-tool-label', text); button.append(label); owned.push(label);
    if (!button.getAttribute('aria-label')) rememberAttribute(button, 'aria-label', text === '인사' ? '함께 있는 나그네에게 인사하기' : text);
    if (!button.getAttribute('title')) rememberAttribute(button, 'title', text);
  }
  const tools = shell.querySelector('.experience-tools');
  if (tools) for (const selector of ['#greetTraveler', '#returnToGate']) move(shell.querySelector(selector), tools);
  const overview = shell.querySelector('#overviewWorld');
  function syncOverview() {
    const far = overview?.getAttribute('aria-pressed') === 'true'; shell.classList.toggle('interface-overview', far);
    const label = overview?.querySelector('.interface-tool-label'); if (label) label.textContent = far ? '가까이' : '전체 보기';
    if (overview) overview.setAttribute('title', far ? '나그네 가까이 보기' : '신당 전체 보기');
  }
  syncOverview();
  const Observer = document.defaultView?.MutationObserver || globalThis.MutationObserver;
  if (overview && typeof Observer === 'function') { overviewObserver = new Observer(syncOverview); overviewObserver.observe(overview, { attributes: true, attributeFilter: ['aria-pressed'] }); }
  const greet = shell.querySelector('#greetTraveler');
  if (greet) {
    rememberAttribute(greet, 'aria-label', '인사하기');
    for (const node of greet.childNodes || []) if (node.nodeType === 3 && node.textContent.trim()) { restoredText.push([node, node.textContent]); node.textContent = ''; }
    const label = greet.querySelector('.interface-tool-label'); if (label) label.setAttribute('aria-hidden', 'true');
  }
  const greetMark = shell.querySelector('#greetTraveler > span');
  if (greetMark) {
    rememberAttribute(greetMark, 'aria-hidden', 'true');
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); icon.setAttribute('class', 'icon interface-greet-icon'); icon.setAttribute('aria-hidden', 'true');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use'); use.setAttribute('href', '#i-stars'); icon.append(use);
    shell.querySelector('#greetTraveler').append(icon); owned.push(icon);
  }
  const hosts = make('nav', 'interface-hosts'); hosts.setAttribute('aria-label', '술사와 이야기하러 가기');
  hosts.append(make('span', 'interface-hosts-label', '술사'));
  for (const host of HOSTS) {
    const button = make('button', 'interface-host', host.name); button.type = 'button'; button.dataset.npc = host.npc;
    const hint = make('small', 'interface-host-hint', host.hint); hint.setAttribute('aria-hidden', 'true'); button.append(hint);
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
    if (disposed) return; disposed = true; controller.abort(); overviewObserver?.disconnect(); owned.forEach(node => node.remove());
    for (const [node, parent, next] of relocated.slice().reverse()) parent.insertBefore(node, next?.parentElement === parent ? next : null);
    for (const [node, text] of restoredText) node.textContent = text;
    for (const [node, name, value] of attributes) { if (value === null) node.removeAttribute(name); else node.setAttribute(name, value); }
    shell.classList.remove('interface-shell', 'interface-help-open', 'interface-overview'); document.body.classList.remove('interface-active'); mounts.delete(shell);
  };
  mounts.set(shell, dispose); return dispose;
}
if (typeof document !== 'undefined') mountShrineInterface(document);
