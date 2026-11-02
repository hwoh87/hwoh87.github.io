import { ENGINE_URL } from '../calc/panels/manifest.js';
import { mountBirth, mountTimeCompare, mountJourney } from '../calc/panels/helpers.js';
import { profileSearch } from './profile-core.js?v=20261101-freepath4';
import { refreshCalculatorVisuals } from './calculator-visuals.js?v=20261101-report-visual3';
import { createAnalysisTask } from './analysis-loading.js?v=20261102-loading1';

const modules = {
  saju: () => import('../calc/panels/saju.js?v=20261102-loading1'),
  gunghap: () => import('../calc/panels/gunghap.js?v=20261102-loading1'),
  jami: () => import('../calc/panels/jami.js?v=20261102-loading1'),
  star: () => import('../calc/panels/star.js?v=20261102-loading1'),
};
const paths = { saju: '/calc/', gunghap: '/calc/gunghap/', jami: '/calc/jami/', star: '/calc/star/' };
const scriptLoads = new Map();
const activeMounts = new WeakMap();
let enginePromise;

/** Tab-visit memory only: never persists a profile or adopts a shared person's data. */
export function createOwnPersonMemory() {
  let person = null, revision = 0;
  return {
    remember(kind, input, { userEdited = false, ownsBirth = false, expectedRevision = revision } = {}) {
      if (expectedRevision !== revision || !userEdited || !ownsBirth || !Object.prototype.hasOwnProperty.call(paths, kind)) return false;
      const candidate = kind === 'gunghap' ? input?.a : input;
      if (!candidate) return false;
      const { y, mo, d, g } = candidate;
      if (![y, mo, d].every(Number.isInteger) || y < 1900 || y > new Date().getFullYear() || !['M', 'F'].includes(g)) return false;
      const date = new Date(Date.UTC(y, mo - 1, d));
      if (date.getUTCFullYear() !== y || date.getUTCMonth() !== mo - 1 || date.getUTCDate() !== d) return false;
      const unk = candidate.unk === true || candidate.h === -1;
      const h = unk ? -1 : candidate.h;
      const mi = unk ? 0 : candidate.mi;
      if (!unk && (!Number.isInteger(h) || h < 0 || h > 23 || !Number.isInteger(mi) || mi < 0 || mi > 59)) return false;
      person = { y, mo, d, h, mi, g, unk };
      return true;
    },
    searchFor(kind) {
      if (!person || !Object.prototype.hasOwnProperty.call(paths, kind)) return '';
      const prefix = kind === 'gunghap' ? 'a' : '';
      const search = new URLSearchParams();
      for (const key of ['y', 'mo', 'd', 'g']) search.set(prefix + key, String(person[key]));
      if (person.unk) search.set(prefix + 'unk', '1');
      else { search.set(prefix + 'h', String(person.h)); search.set(prefix + 'mi', String(person.mi)); }
      return '?' + search.toString();
    },
    get() { return person && { ...person }; },
    revision() { return revision; },
    clear() { person = null; revision++; },
  };
}

const ownPersonMemory = createOwnPersonMemory();
export function clearOwnPersonMemory() { ownPersonMemory.clear(); }

function explicitFormOptions(options) {
  return Object.prototype.hasOwnProperty.call(options, 'search') || Object.prototype.hasOwnProperty.call(options, 'url');
}

export function readingFormOptions(options = {}, kind, memory = ownPersonMemory) {
  return explicitFormOptions(options) ? options : { ...options, search: profileSearch(kind) || memory.searchFor(kind) };
}

/** Canonical helper birth carry stays inside its mount, with no hidden save. */
export function createReadingStorage(backing) {
  const personal = new Map();
  return {
    getItem(key) { if (key === 'samra.birth.v1') return personal.get(key) ?? null; try { return backing?.getItem(key) ?? null; } catch (_) { return null; } },
    setItem(key, value) { if (key === 'samra.birth.v1') personal.set(key, String(value)); else { try { backing?.setItem(key, value); } catch (_) {} } },
    removeItem(key) { if (key === 'samra.birth.v1') personal.delete(key); else { try { backing?.removeItem(key); } catch (_) {} } },
    clearPersonal() { personal.clear(); },
  };
}

function loadScript(url, ready) {
  if (ready()) return Promise.resolve();
  const absolute = new URL(url, document.baseURI).href;
  if (scriptLoads.has(absolute)) return scriptLoads.get(absolute);
  const promise = new Promise((resolve, reject) => {
    const existing = Array.from(document.scripts).find(script => script.src === absolute);
    const script = existing || document.createElement('script');
    let timeout;
    const done = () => {
      clearTimeout(timeout);
      script.removeEventListener('load', loaded);
      script.removeEventListener('error', failed);
    };
    const loaded = () => { done(); ready() ? resolve() : reject(new Error('계산 도구를 준비하지 못했어요.')); };
    const failed = () => { done(); if (!existing) script.remove(); reject(new Error('계산 도구를 불러오지 못했어요. 다시 시도해 주세요.')); };
    script.addEventListener('load', loaded, { once: true });
    script.addEventListener('error', failed, { once: true });
    timeout = setTimeout(failed, 30000);
    if (!existing) { script.src = absolute; document.head.appendChild(script); }
  });
  scriptLoads.set(absolute, promise);
  promise.catch(() => scriptLoads.delete(absolute));
  return promise;
}

export function loadReadingEngine() {
  if (window['engine-core']) return Promise.resolve(window['engine-core']);
  if (!enginePromise) {
    enginePromise = loadScript(ENGINE_URL, () => Boolean(window['engine-core'])).then(() => window['engine-core']);
    enginePromise.catch(() => { enginePromise = null; });
  }
  return enginePromise;
}

export function loadCatalog() {
  if (typeof PRODUCT_BY_SLUG !== 'undefined') return Promise.resolve();
  if (!window.__samraCatalogReady) {
    window.__samraCatalogReady = loadScript('/store/catalog.js', () => typeof PRODUCT_BY_SLUG !== 'undefined');
    window.__samraCatalogReady.catch(() => { window.__samraCatalogReady = null; });
  }
  return window.__samraCatalogReady;
}

function sharedAssets() {
  // Editorial recommendations and illustrations must not block a free calculation.
  // The canonical runtime already handles their absence and retries catalog loading.
  return Promise.allSettled([
    loadCatalog(),
    loadScript('/assets/art/ilju-index.js', () => Boolean(window.ILJU_ART)),
    loadScript('/store/reading-summary.js', () => Boolean(window.SamraReading)),
  ]);
}

function createEnvironment(root, kind, options) {
  const realDocument = document;
  const realWindow = window;
  const local = new Map();
  const pendingReady = [];
  const timers = new Set();
  const frames = new Set();
  const idles = new Set();
  const observers = new Set();
  const objectUrls = new Set();
  const listeners = [];
  let disposed = false;
  let ready = false;
  const analysis = createAnalysisTask({ document: realDocument, kind, loadEngine: loadReadingEngine,
    isDisposed: () => disposed,
    onBusy(busy) { root.getElementById('result')?.setAttribute('aria-busy', String(busy)); },
    onError() {
      const error = root.getElementById('err');
      if (error) { error.textContent = '분석을 준비하지 못했어요. 연결과 입력 정보를 확인한 뒤 다시 시도해 주세요.'; error.style.display = 'block'; }
    },
  });
  let current = new URL(paths[kind], 'https://samra.cc');
  if (options.url) {
    const requested = new URL(options.url, current);
    if (requested.pathname === paths[kind] || requested.pathname === paths[kind] + 'index.html') current.search = requested.search;
  } else if (options.search) current.search = String(options.search);

  const virtualLocation = new Proxy({}, {
    get(_, key) { if (key === 'toString') return () => current.href; return current[key]; },
    set(_, key, value) { if (key === 'search' || key === 'hash') current[key] = value; return true; },
  });
  const virtualHistory = {
    replaceState(_state, _title, value) {
      if (disposed || !value) return;
      const next = new URL(value, current);
      if (next.origin === current.origin && next.pathname === current.pathname) current = next;
    },
  };
  virtualHistory.pushState = virtualHistory.replaceState;

  function timeout(callback, delay, ...args) {
    if (disposed) return 0;
    const id = realWindow.setTimeout(() => { timers.delete(id); if (!disposed) callback(...args); }, delay);
    timers.add(id); return id;
  }
  function clearTimer(id) { timers.delete(id); realWindow.clearTimeout(id); }
  function animationFrame(callback) {
    if (disposed) return 0;
    const id = realWindow.requestAnimationFrame(time => { frames.delete(id); if (!disposed) callback(time); });
    frames.add(id); return id;
  }
  function idle(callback, settings) {
    if (!realWindow.requestIdleCallback) return timeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 30);
    if (disposed) return 0;
    const id = realWindow.requestIdleCallback(deadline => { idles.delete(id); if (!disposed) callback(deadline); }, settings);
    idles.add(id); return id;
  }
  function TrackedIntersectionObserver(callback, settings) {
    const observer = new realWindow.IntersectionObserver((entries, self) => { if (!disposed) callback(entries, self); }, settings);
    observers.add(observer); return observer;
  }
  function addListener(target, name, callback, settings) {
    target.addEventListener(name, callback, settings);
    listeners.push(() => target.removeEventListener(name, callback, settings));
  }
  const scopedDocument = new Proxy({}, {
    get(_, key) {
      if (key === 'getElementById') return id => root.getElementById(String(id));
      if (key === 'querySelector') return selector => root.querySelector(selector);
      if (key === 'querySelectorAll') return selector => root.querySelectorAll(selector);
      if (key === 'head' || key === 'body') return root;
      if (key === 'activeElement') return root.activeElement || realDocument.activeElement;
      if (key === 'readyState') return ready ? 'complete' : 'loading';
      if (key === 'addEventListener') return (name, callback, settings) => {
        if (name === 'DOMContentLoaded') { if (ready) callback(); else pendingReady.push(callback); }
        else addListener(root, name, callback, settings);
      };
      if (key === 'removeEventListener') return root.removeEventListener.bind(root);
      const value = realDocument[key];
      return typeof value === 'function' ? value.bind(realDocument) : value;
    },
  });
  let backingStorage;
  try { backingStorage = realWindow.sessionStorage; } catch (_) {}
  const storage = createReadingStorage(backingStorage);
  class ScopedURL extends URL {
    static createObjectURL(blob) { const url = URL.createObjectURL(blob); objectUrls.add(url); return url; }
    static revokeObjectURL(url) { objectUrls.delete(url); URL.revokeObjectURL(url); }
  }
  const scopedWindow = new Proxy({}, {
    get(_, key) {
      if (local.has(key)) return local.get(key);
      if (key === 'document') return scopedDocument;
      if (key === 'location') return virtualLocation;
      if (key === 'history') return virtualHistory;
      if (key === 'sessionStorage') return storage;
      if (key === 'setTimeout') return timeout;
      if (key === 'clearTimeout') return clearTimer;
      if (key === 'requestAnimationFrame') return animationFrame;
      if (key === 'requestIdleCallback') return idle;
      if (key === 'IntersectionObserver') return realWindow.IntersectionObserver ? TrackedIntersectionObserver : undefined;
      if (key === 'addEventListener') return (name, callback, settings) => addListener(realWindow, name, callback, settings);
      if (key === '__track') return (event, label) => {
        if(disposed)return;
        // An internal callback keeps the report summary in sync with a successful
        // canonical calculation. Personal input is never put in a public event.
        if(event==='calc_done'&&typeof options.onCalculated==='function'){
          try{options.onCalculated(local.get('readForm')?.(),{root});}catch(_){}
        }
        if(typeof realWindow.__track==='function')realWindow.__track(event,label);
      };
      const value = realWindow[key];
      return typeof value === 'function' ? value.bind(realWindow) : value;
    },
    set(_, key, value) { local.set(key, value); return true; },
  });
  return {
    document: scopedDocument, window: scopedWindow, location: virtualLocation, history: virtualHistory,
    setTimeout: timeout, clearTimeout: clearTimer, requestAnimationFrame: animationFrame, requestIdleCallback: idle,
    IntersectionObserver: realWindow.IntersectionObserver ? TrackedIntersectionObserver : undefined,
    matchMedia: realWindow.matchMedia.bind(realWindow), getComputedStyle: realWindow.getComputedStyle.bind(realWindow),
    sessionStorage: storage, URL: ScopedURL, loadEngine: loadReadingEngine, loadCatalog,
    runAnalysis(fn, buttonId) {
      if (disposed) return Promise.resolve();
      const button = root.getElementById(buttonId);
      if (button && !analysis.node.isConnected) button.after(analysis.node);
      return analysis.run(fn, button);
    },
    get disposed() { return disposed; },
    fireReady() { if (disposed) return; ready = true; pendingReady.splice(0).forEach(callback => callback()); },
    dispose() {
      if (disposed) return;
      disposed = true; pendingReady.length = 0;
      analysis.dispose();
      timers.forEach(id => realWindow.clearTimeout(id)); timers.clear();
      frames.forEach(id => realWindow.cancelAnimationFrame(id)); frames.clear();
      idles.forEach(id => realWindow.cancelIdleCallback(id)); idles.clear();
      observers.forEach(observer => observer.disconnect()); observers.clear();
      listeners.splice(0).forEach(remove => remove());
      objectUrls.forEach(url => URL.revokeObjectURL(url)); objectUrls.clear();
      storage.clearPersonal();
      local.clear();
    },
  };
}

/**
 * Mount a canonical calculator inside a shrine panel without a document/iframe.
 * Returned dispose removes this mount's DOM, timers, observers and listeners.
 * navigate receives a local path; search/url restore only this calculator's form.
 */
export async function mountReading(container, kind, options = {}) {
  if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('계산 화면을 표시할 공간이 없어요.');
  if (!Object.prototype.hasOwnProperty.call(modules, kind)) throw new TypeError('지원하지 않는 계산 도구예요.');
  activeMounts.get(container)?.dispose();
  const host = document.createElement('div');
  host.className = 'reading-panel';
  host.setAttribute('data-reading-kind', kind);
  const root = host.attachShadow({ mode: 'open' });
  const loading = document.createElement('p');
  loading.textContent = '계산 화면을 준비하고 있어요…';
  loading.setAttribute('role', 'status');
  loading.style.cssText = 'padding:24px;color:#69746b;font-size:14px';
  root.appendChild(loading);
  container.replaceChildren(host);
  let env;
  let disposed = false;
  let removeLinks = () => {};
  let removePersonTracking = () => {};
  let captureOwnPerson = () => {};
  const personRevision = ownPersonMemory.revision();
  const abort = () => dispose();
  function dispose() {
    if (disposed) return;
    captureOwnPerson();
    disposed = true; env?.dispose(); removeLinks(); removePersonTracking(); host.remove();
    options.signal?.removeEventListener('abort', abort);
    if (activeMounts.get(container)?.dispose === dispose) activeMounts.delete(container);
  }
  activeMounts.set(container, { dispose });
  options.signal?.addEventListener('abort', abort, { once: true });
  if (options.signal?.aborted) dispose();
  try {
    const [view] = await Promise.all([modules[kind](), sharedAssets()]);
    if (disposed) return { kind, root, dispose };
    root.replaceChildren();
    for (const href of [...new Set(view.stylesheets)]) {
      const link = document.createElement('link');
      link.rel = 'stylesheet'; link.href = href; root.appendChild(link);
    }
    const style = document.createElement('style'); style.textContent = view.styles; root.appendChild(style);
    const polish = document.createElement('link'); polish.rel = 'stylesheet'; polish.href = '/sowon/readings.css?v=20261101-freepath4'; root.appendChild(polish);
    const theme = document.createElement('link'); theme.rel='stylesheet';theme.href='/sowon/reading-theme.css?v=20261103-hour2';root.appendChild(theme);
    const charts = document.createElement('link'); charts.rel='stylesheet';charts.href='/sowon/reading-visuals.css?v=20261101-report-visual3';root.appendChild(charts);
    const analysisStyle = document.createElement('link'); analysisStyle.rel='stylesheet';analysisStyle.href='/sowon/analysis-loading.css?v=20261102-loading1';root.appendChild(analysisStyle);
    const template = document.createElement('template');
    template.innerHTML = view.markup;
    root.appendChild(template.content.cloneNode(true));
    if (kind === 'gunghap') {
      // The shared calculator keeps its engine and result visibility. In the
      // shrine, let visitors read the free relationship before the paid shelf.
      const result = root.getElementById('result'), offers = root.getElementById('xsell');
      if (result && offers) result.insertBefore(offers, result.querySelector('.cta-box'));
      const hero = result?.querySelector('.verdict-hero');
      if (hero) {
        const scope = document.createElement('nav'); scope.className = 'shrine-free-reading'; scope.setAttribute('aria-label','무료 궁합 읽는 순서');
        const note = document.createElement('p'); note.textContent = '아래 원국·관계 풀이와 올해 흐름은 무료예요. 점수보다 강점과 조율점을 함께 읽어보세요.';
        const read = document.createElement('a'); read.href = '#pairkw'; read.textContent = '강점과 조율점부터 읽기 ↓';
        const more = document.createElement('a'); more.href = '#xsell'; more.textContent = '유료 상세 구성 살펴보기';
        scope.append(note, read, more); hero.after(scope);
      }
    }
    if(options.autoScroll===false){const result=root.getElementById('result');if(result)result.scrollIntoView=()=>{};}
    root.querySelectorAll('form').forEach(form => form.addEventListener('submit', event => event.preventDefault()));
    const formOptions = readingFormOptions(options, kind);
    env = createEnvironment(root, kind, {...formOptions, onCalculated(input, context) {
      if (disposed) return;
      if (options.visuals !== false) refreshCalculatorVisuals(root,kind,input,{engine:window['engine-core']});
      if (options.autoScroll !== false && document.activeElement === document.body) {
        const result = root.getElementById('result'), heading = result?.querySelector('h2,h3') || result;
        if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
      }
      options.onCalculated?.(input,context);
    }});
    mountBirth(env);
    const runtime = view.mountRuntime(env);
    Object.assign(env.window, { loadEngine: runtime.loadEngine, SajuCalc: runtime.SajuCalc, readForm: runtime.readForm });
    if (kind === 'saju') { mountTimeCompare(env); mountJourney(env); }
    const links = event => {
      const anchor = event.target.closest?.('a[href]');
      if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const raw = anchor.getAttribute('href');
      if (raw?.startsWith('#')) {
        const target = root.getElementById(raw.slice(1));
        if (target) {
          event.preventDefault();
          const heading = raw === '#pairkw' && /^H[1-6]$/.test(target.previousElementSibling?.tagName || '') ? target.previousElementSibling : target;
          heading.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' });
          if (!heading.hasAttribute('tabindex')) heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
        }
        return;
      }
      const url = new URL(anchor.href, env.location.href);
      if (!['https:', 'http:'].includes(url.protocol) || ![location.origin, 'https://samra.cc'].includes(url.origin)) return;
      event.preventDefault();
      if (anchor.dataset.cta && typeof window.__track === 'function') window.__track('cta', anchor.dataset.cta);
      const path = url.pathname + url.search + url.hash;
      if (typeof options.navigate === 'function') options.navigate(path);
      else host.dispatchEvent(new CustomEvent('sowon:navigate', { detail: { url: path }, bubbles: true, composed: true }));
    };
    root.addEventListener('click', links);
    removeLinks = () => root.removeEventListener('click', links);
    env.fireReady();
    const initial = new URL(env.location.href);
    const selfPrefix = kind === 'gunghap' ? 'a' : '';
    const hasExternalBirth = explicitFormOptions(options) && ['y', 'mo', 'd', 'py'].some(key => initial.searchParams.has(selfPrefix + key));
    let ownsBirth = !hasExternalBirth;
    let userEdited = false;
    let captureTicket = 0;
    const birthIds = [selfPrefix + 'birth', selfPrefix + 'y', selfPrefix + 'mo', selfPrefix + 'd'];
    const ownIds = new Set([...birthIds, ...['h', 'mi', 'g', 'cal', 'unk'].map(key => selfPrefix + key)]);
    captureOwnPerson = () => {
      if (disposed || !ownsBirth || !userEdited || !window['engine-core']) return;
      // A missing Ziwei time is an explicit unresolved state, not midnight.
      if (kind === 'jami' && root.getElementById('h')?.value === '') return;
      try { ownPersonMemory.remember(kind, runtime.readForm(), { userEdited, ownsBirth, expectedRevision: personRevision }); }
      catch (_) { /* An incomplete or unconverted date never replaces the last confirmed person. */ }
    };
    const trackPersonInput = event => {
      if (!event.isTrusted || disposed) return;
      const target = event.target;
      const id = target.id || '';
      const segmentId = event.type === 'click' ? target.closest?.('button[data-for]')?.dataset.for : null;
      const ownInput = ownIds.has(id) || ownIds.has(segmentId);
      const calculateOwn = event.type === 'click' && target.closest?.('#go');
      if (!ownInput && !calculateOwn) return;
      // Editing the partner or a URL-loaded person's time cannot claim their birthday.
      if (birthIds.includes(id) && ['input', 'change'].includes(event.type)) ownsBirth = true;
      userEdited = true;
      captureOwnPerson();
      const ticket = ++captureTicket;
      if (!window['engine-core']) loadReadingEngine().then(() => { if (ticket === captureTicket) captureOwnPerson(); }, () => {});
    };
    for (const name of ['input', 'change', 'click']) root.addEventListener(name, trackPersonInput);
    removePersonTracking = () => { for (const name of ['input', 'change', 'click']) root.removeEventListener(name, trackPersonInput); };
    return {
      kind, root, dispose,
      async run() { if (!disposed) await runtime.run(); },
      getShareUrl() { return env.location.href; },
      getInput() { return runtime.readForm(); },
    };
  } catch (error) {
    if (!disposed) {
      env?.dispose();
      loading.textContent = '계산 화면을 불러오지 못했어요. 잠시 후 다시 열어주세요.';
      root.replaceChildren(loading);
    }
    throw error;
  }
}
