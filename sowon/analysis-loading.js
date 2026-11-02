const DESCRIPTIONS = {
  saju: '명식과 오행의 균형을 살펴보고 있어요.',
  gunghap: '두 사람의 사주와 관계의 결을 살펴보고 있어요.',
  jami: '열두 궁의 별과 흐름을 살펴보고 있어요.',
  star: '태어난 순간의 별과 행성 배치를 살펴보고 있어요.',
};

/** A shared, readable status card for both the report and its scoped calculator. */
export function createAnalysisLoading(document, kind, { compact = false } = {}) {
  const make = (tag, className, text) => {
    const node = document.createElement(tag); node.className = className;
    if (text) node.textContent = text;
    return node;
  };
  const node = make('section', `analysis-loading${compact ? ' is-compact' : ''}`);
  node.setAttribute('role', 'status'); node.setAttribute('aria-live', 'polite'); node.setAttribute('aria-atomic', 'true');
  const spinner = make('span', 'analysis-loading-spinner'); spinner.setAttribute('aria-hidden', 'true');
  const copy = make('div', 'analysis-loading-copy');
  copy.append(make('strong', 'analysis-loading-title', '분석하고 있어요'), make('p', 'analysis-loading-description', DESCRIPTIONS[kind] || '입력한 정보로 해석을 준비하고 있어요.'));
  const skeleton = make('div', 'analysis-loading-skeleton'); skeleton.setAttribute('aria-hidden', 'true');
  for (let index = 0; index < 3; index++) skeleton.append(make('span', 'analysis-loading-bar'));
  node.append(spinner, copy, skeleton);
  return { node };
}

/** Yield a real paint before synchronous engine work, with a background-tab exit. */
export function waitForAnalysisPaint(document, signal) {
  if (signal?.aborted) return Promise.resolve(false);
  const view = document.defaultView || globalThis;
  if (typeof view.requestAnimationFrame !== 'function') return Promise.resolve(true);
  return new Promise(resolve => {
    let first, second, timeout, settled = false;
    const finish = painted => {
      if (settled) return; settled = true;
      view.clearTimeout(timeout);
      if (first !== undefined) view.cancelAnimationFrame?.(first);
      if (second !== undefined) view.cancelAnimationFrame?.(second);
      signal?.removeEventListener('abort', aborted);
      resolve(painted);
    };
    const aborted = () => finish(false);
    signal?.addEventListener('abort', aborted, { once: true });
    // A hidden page cannot paint. Still yield a task so abort/dispose can run.
    if (document.visibilityState === 'hidden') {
      timeout = view.setTimeout(() => finish(true), 0);
      return;
    }
    timeout = view.setTimeout(() => finish(true), 120);
    first = view.requestAnimationFrame(() => {
      second = view.requestAnimationFrame(() => finish(true));
    });
  });
}

/** Owns one calculator run, including cached-engine work and its result renderer. */
export function createAnalysisTask({ document, kind, loadEngine, isDisposed = () => false, onError = () => {}, onBusy = () => {} }) {
  const { node } = createAnalysisLoading(document, kind, { compact: true }); node.hidden = true;
  let pending = null, controller, restoreButton, disposed = false;
  const finish = () => {
    node.hidden = true;
    restoreButton?.(); restoreButton = null;
    onBusy(false);
  };
  return {
    node,
    run(fn, button) {
      if (disposed || isDisposed()) return Promise.resolve();
      if (pending) return pending;
      const label = button?.textContent, disabled = button?.disabled, busy = button?.getAttribute('aria-busy');
      if (button) {
        button.disabled = true; button.textContent = '분석 중…'; button.setAttribute('aria-busy', 'true');
        restoreButton = () => {
          button.disabled = disabled; button.textContent = label;
          if (busy === null) button.removeAttribute('aria-busy'); else button.setAttribute('aria-busy', busy);
        };
      }
      node.hidden = false; onBusy(true);
      controller = new AbortController(); const signal = controller.signal;
      const current = () => !disposed && !isDisposed() && !signal.aborted;
      pending = (async () => {
        try {
          if (!await waitForAnalysisPaint(document, signal) || !current()) return;
          await loadEngine();
          if (current()) await fn();
        } catch (error) {
          if (current()) onError(error);
        } finally {
          finish(); pending = null;
        }
      })();
      return pending;
    },
    dispose() {
      if (disposed) return;
      disposed = true; controller?.abort(); finish(); node.remove();
    },
  };
}
