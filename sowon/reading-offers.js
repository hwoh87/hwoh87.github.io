// A view-only continuation of a free reading. Product facts belong to the existing store catalog.
const mounts = new WeakMap();
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.samramanshang.manseryeok';
const TOPICS = Object.freeze([
  Object.freeze({ id: 'flow', label: '앞으로의 흐름', slug: 'three-months' }),
  Object.freeze({ id: 'self', label: '나의 성향', slug: 'midnight-self' }),
  Object.freeze({ id: 'money', label: '재물', slug: 'money-bowl' }),
]);

function currentCatalog() {
  if (typeof PRODUCTS === 'undefined' || typeof priceOf !== 'function') return null;
  return {
    products: PRODUCTS,
    price: priceOf,
    won: typeof won === 'function' ? won : null,
    readers: typeof READERS === 'undefined' ? null : READERS,
    available: typeof storeAvailable === 'function' ? storeAvailable : null,
  };
}

async function ensureStoreCatalog() {
  if (currentCatalog()) return currentCatalog();
  const { loadCatalog } = await import('./readings.js?v=20261101-sanctuary2');
  if (typeof loadCatalog !== 'function') throw new Error('catalog_unavailable');
  await loadCatalog();
  return currentCatalog();
}

function offersFrom(data) {
  if (!data || !Array.isArray(data.products) || typeof data.price !== 'function') return [];
  return TOPICS.flatMap(topic => {
    const product = data.products.find(item => item?.slug === topic.slug);
    if (!product || typeof product.title !== 'string' || !product.title.trim() ||
      !Number.isInteger(product.chaptersN) || product.chaptersN < 1 ||
      !Array.isArray(product.chapters) || !product.chapters.some(chapter => typeof chapter === 'string' && chapter.trim())) return [];
    try {
      if (typeof data.available === 'function' && !data.available(product)) return [];
      const price = data.price(product.slug);
      if (!Number.isFinite(price) || price <= 0) return [];
      const amount = typeof data.won === 'function' ? data.won(price) : new Intl.NumberFormat('ko-KR').format(price) + '원';
      if (typeof amount !== 'string' || !amount.trim()) return [];
      return [{ topic, product, amount }];
    } catch (_) { return []; }
  });
}

/**
 * Renders at most three real catalog choices after a free personal reading.
 * Owns no order/payment/profile state. The parent owns internal navigation.
 * ensureCatalog may supply a catalog adapter in tests; production shares loadCatalog().
 */
export function mountReadingOffers(container, { npc, kind, onNavigate, signal, ensureCatalog = ensureStoreCatalog } = {}) {
  if (!container || typeof container.replaceChildren !== 'function') throw new TypeError('리포트를 안내할 공간이 없어요.');
  mounts.get(container)?.();
  const document = container.ownerDocument;
  let disposed = false;
  const listeners = [], detailListeners = [];
  const wrapper = document.createElement('section');
  wrapper.className = 'report-offers';
  wrapper.setAttribute('aria-label', '무료 풀이 다음에 더 읽기');
  wrapper.setAttribute('aria-busy', 'true');
  const element = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const listen = (node, callback, bucket = listeners) => {
    node.addEventListener('click', callback);
    bucket.push(() => node.removeEventListener('click', callback));
  };
  const clear = bucket => bucket.splice(0).forEach(remove => remove());
  const internalLink = (href, text, metadata, bucket = listeners) => {
    const link = element('a', 'report-offer-link', text);
    link.href = href;
    listen(link, event => {
      if (disposed || event.defaultPrevented || event.button > 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || typeof onNavigate !== 'function') return;
      event.preventDefault();
      onNavigate(href, metadata);
    }, bucket);
    return link;
  };
  wrapper.append(
    element('h3', '', '조금 더 깊게 읽고 싶다면'),
    element('p', 'report-offer-note', '지금 읽은 기본 풀이는 무료예요. 아래는 별도로 구매하는 주제 리포트예요.'),
  );
  const content = element('div', 'report-offer-content');
  content.append(element('p', 'report-offer-note', '더 읽을 리포트를 준비하고 있어요.'));
  const appNote = element('p', 'report-offer-note', '앱의 18장 융합 리포트는 사주·자미두수·별자리를 엮는 별도 상품이에요. 웹에서는 선택한 주제의 리포트를 읽을 수 있어요.');
  const appLink = element('a', 'report-app-link', '삼라 앱에서 융합 리포트 알아보기');
  appLink.href = PLAY_URL;
  appLink.target = '_blank';
  appLink.rel = 'noopener noreferrer';
  appLink.referrerPolicy = 'no-referrer';
  wrapper.append(content, appNote, appLink);
  container.replaceChildren(wrapper);

  function cleanup() {
    if (disposed) return;
    disposed = true;
    clear(detailListeners); clear(listeners);
    signal?.removeEventListener('abort', cleanup);
    if (mounts.get(container) === cleanup) {
      mounts.delete(container);
      container.replaceChildren();
    }
  }
  cleanup.dispose = cleanup;
  mounts.set(container, cleanup);
  signal?.addEventListener('abort', cleanup, { once: true });
  if (signal?.aborted) cleanup();

  function fallback() {
    content.replaceChildren(
      element('p', 'report-offer-note', '리포트 목록을 지금 불러오지 못했어요. 기존 서가에서 목차와 가격을 확인해 주세요.'),
      internalLink('/store/', '리포트 서가에서 살펴보기', { kind: 'fallback' }),
    );
  }

  cleanup.ready = Promise.resolve().then(() => disposed ? null : ensureCatalog()).then(data => {
    if (disposed) return;
    const offers = offersFrom(data || currentCatalog());
    wrapper.removeAttribute('aria-busy');
    if (!offers.length) { fallback(); return; }
    content.replaceChildren();
    const tabs = element('div', 'report-offer-tabs');
    tabs.setAttribute('role', 'group');
    tabs.setAttribute('aria-label', '더 읽고 싶은 주제');
    const detail = element('div', 'report-offer-detail');
    detail.setAttribute('aria-live', 'polite');
    const buttons = [];
    function select(offer) {
      if (disposed) return;
      clear(detailListeners);
      for (const { button, slug } of buttons) button.setAttribute('aria-pressed', String(slug === offer.product.slug));
      const { product, amount } = offer;
      const chapters = element('ol', 'report-offer-chapters');
      for (const title of product.chapters.filter(value => typeof value === 'string' && value.trim()).slice(0, 3)) chapters.appendChild(element('li', '', title));
      detail.replaceChildren(
        element('p', 'report-offer-title', product.title),
        element('p', 'report-offer-facts', `${amount} · ${product.chaptersN}장 · 단건 유료 리포트`),
        chapters,
        internalLink('/store/product.html?id=' + encodeURIComponent(product.slug), '목차와 가격 살펴보기', { kind: 'product', slug: product.slug }, detailListeners),
      );
    }
    for (const offer of offers) {
      const button = element('button', '', offer.topic.label);
      button.type = 'button';
      button.setAttribute('aria-pressed', 'false');
      listen(button, () => select(offer));
      buttons.push({ button, slug: offer.product.slug });
      tabs.appendChild(button);
    }
    content.append(tabs, detail, element('p', 'report-offer-note', '목차와 가격을 살펴본 뒤, 기존 주문서에서 출생 정보와 결제 가능 여부를 다시 확인해 주세요.'));
    select(offers[0]);
  }).catch(() => {
    if (!disposed) { wrapper.removeAttribute('aria-busy'); fallback(); }
  });
  return cleanup;
}
