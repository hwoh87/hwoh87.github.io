// A view-only continuation of a free reading. Product facts belong to the existing store catalog.
const mounts = new WeakMap();
const PLAY_URL = 'https://play.google.com/store/apps/details?id=com.samramanshang.manseryeok';
const PERSONAL_TOPICS = Object.freeze([
  Object.freeze({ id: 'flow', label: '앞으로의 흐름', slug: 'three-months' }),
  Object.freeze({ id: 'self', label: '나의 성향', slug: 'midnight-self' }),
  Object.freeze({ id: 'money', label: '재물', slug: 'money-bowl' }),
]);
const RELATIONSHIP_TOPICS = Object.freeze([
  Object.freeze({ id: 'compatibility', label: '두 사람의 궁합', slug: 'gunghap' }),
  Object.freeze({ id: 'daily-life', label: '함께하는 생활', slug: 'marriage' }),
  Object.freeze({ id: 'expression', label: '관계의 표현 방식', slug: 'love-mind' }),
]);

// The subject just read decides the continuation. A saju product does not extend
// a star/jami chart, and a persona's usual subject must not override the active tab.
function continuationFor(npc, kind) {
  if (kind === 'star' || kind === 'jami') return {
    topics: [],
    title: '다른 관점도 함께 읽고 싶다면',
    note: `${kind === 'star' ? '별자리' : '자미두수'} 기본 풀이는 여기서 무료로 읽을 수 있어요. 현재 웹 서가에는 이 관점만 다루는 유료 리포트가 없어요.`,
  };
  if (kind === 'gunghap' || npc === 'seol') return {
    topics: RELATIONSHIP_TOPICS,
    title: '관계를 조금 더 깊게 읽고 싶다면',
    note: '지금 읽은 기본 풀이는 무료예요. 아래는 두 사람의 사주를 함께 읽는 별도 유료 리포트예요.',
  };
  return {
    topics: PERSONAL_TOPICS,
    title: '궁금한 주제를 더 읽고 싶다면',
    note: '지금 읽은 기본 풀이는 무료예요. 아래는 별도로 구매하는 사주 주제 리포트예요.',
  };
}

function currentCatalog() {
  if (typeof PRODUCTS === 'undefined' || typeof priceOf !== 'function') return null;
  return {
    products: PRODUCTS,
    price: priceOf,
    won: typeof won === 'function' ? won : null,
    readers: typeof READERS === 'undefined' ? null : READERS,
    inputs: typeof STORE_INPUT === 'undefined' ? null : STORE_INPUT,
    available: typeof storeAvailable === 'function' ? storeAvailable : null,
  };
}

async function ensureStoreCatalog() {
  if (currentCatalog()) return currentCatalog();
  const { loadCatalog } = await import('./readings.js?v=20261103-hour2');
  if (typeof loadCatalog !== 'function') throw new Error('catalog_unavailable');
  await loadCatalog();
  return currentCatalog();
}

function offersFrom(data, topics) {
  if (!data || !Array.isArray(data.products) || typeof data.price !== 'function') return [];
  return topics.flatMap(topic => {
    const product = data.products.find(item => item?.slug === topic.slug);
    if (!product || typeof product.title !== 'string' || !product.title.trim() ||
      !Number.isInteger(product.chaptersN) || product.chaptersN < 1 ||
      !Array.isArray(product.chapters) || product.chapters.length !== product.chaptersN ||
      !product.chapters.every(chapter => typeof chapter === 'string' && chapter.trim())) return [];
    try {
      if (typeof data.available === 'function' && !data.available(product)) return [];
      const price = data.price(product.slug);
      if (!Number.isSafeInteger(price) || price <= 0) return [];
      const amount = typeof data.won === 'function' ? data.won(price) : new Intl.NumberFormat('ko-KR').format(price) + '원';
      if (typeof amount !== 'string' || !amount.trim()) return [];
      const input = data.inputs?.[product.slug];
      const inputs = input === 'pair' ? '두 사람의 출생정보 필요' : input === 'solo' ? '나의 출생정보 필요' : '';
      const reader = data.readers?.[product.reader]?.name;
      return [{ topic, product, amount, inputs, reader: typeof reader === 'string' ? reader : '' }];
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
  const continuation = continuationFor(npc, kind);
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
    element('h3', '', continuation.title),
    element('p', 'report-offer-note', continuation.note),
  );
  const content = element('div', 'report-offer-content');
  content.append(element('p', 'report-offer-note', '더 읽을 리포트를 준비하고 있어요.'));
  const appNote = element('p', 'report-offer-note', '앱의 18장 융합 리포트는 사주·자미두수·별자리를 엮는 별도 상품이에요. 지금 본 무료 풀이를 잠금 해제하는 상품은 아니에요. 구성과 가격은 앱에서 확인할 수 있어요.');
  const appLink = element('a', 'report-app-link', '삼라 앱 살펴보기');
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

  cleanup.ready = Promise.resolve().then(() => disposed || !continuation.topics.length ? null : ensureCatalog()).then(data => {
    if (disposed) return;
    wrapper.removeAttribute('aria-busy');
    if (!continuation.topics.length) { content.replaceChildren(); return; }
    const offers = offersFrom(data || currentCatalog(), continuation.topics);
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
      const { product, amount, inputs, reader } = offer;
      const chapters = element('ol', 'report-offer-chapters');
      for (const title of product.chapters.filter(value => typeof value === 'string' && value.trim()).slice(0, 3)) chapters.appendChild(element('li', '', title));
      detail.replaceChildren(
        element('p', 'report-offer-title', product.title),
        element('p', 'report-offer-context', [reader ? `${reader}의 사주 리포트` : '사주 리포트', inputs].filter(Boolean).join(' · ')),
        element('p', 'report-offer-facts', `${amount} · ${product.chaptersN}장 · 단건 유료 리포트`),
        element('p', 'report-offer-note', '전체 목차 중 먼저 살펴볼 내용'),
        chapters,
        internalLink('/store/product.html?id=' + encodeURIComponent(product.slug), '상품 구성과 전체 목차 보기', { kind: 'product', slug: product.slug }, detailListeners),
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
    content.append(tabs, detail, element('p', 'report-offer-note', '상품 소개에서 구성과 가격을 먼저 살펴보세요. 구매를 선택하면 기존 주문서에서 출생 정보와 결제 가능 여부를 다시 확인해 주세요. 신당의 무료 풀이는 계속 읽을 수 있어요.'));
    select(offers[0]);
  }).catch(() => {
    if (!disposed) { wrapper.removeAttribute('aria-busy'); fallback(); }
  });
  return cleanup;
}
