// The spatial home stores only navigation and camera state. Birth details,
// personal report tokens and wishes belong to their existing separate stores.
export const JOURNEY_KEY = 'samra.sowon.journey.v1';
export const JOURNEY_TTL = 4 * 60 * 60 * 1000;
export const HALLS = Object.freeze({
  rooms: {name:'일주마당',english:'THE SIXTY GARDENS',icon:'heart',reader:'seol',guide:'설월',line:'같은 일주, 서로 다른 이야기',description:'내 일주방에서 나그네를 만나고 다른 일주방에도 잠시 들러보세요.',features:['ilju-rooms']},
  celeb: {name:'연예인 사주관',english:'THE PORTRAIT GALLERY',icon:'stars',reader:'luna',guide:'루나',line:'익숙한 얼굴에서 발견하는 새로운 결',description:'공개된 생일로 살펴보는 명식과 일주. 나와 같은 일주의 인물도 찾아보세요.',features:['celeb']},
  myeongri: { name: '명리전', english: 'THE FOUR PILLARS', icon: 'scroll', reader: 'tojeong', guide: '토정', line: '여덟 글자에서 나의 결을 읽는 곳', description: '타고난 기운부터 지금의 흐름까지, 하나씩 펼쳐보세요.', features: ['saju', 'time', 'ilju', 'terms'] },
  inyeon: { name: '인연정', english: 'THE GARDEN OF RELATIONS', icon: 'heart', reader: 'seol', guide: '설월', line: '나와 당신, 사이의 온도를 읽는 곳', description: '두 사람이 만날 때 생기는 결을 차분하게 살펴봐요.', features: ['gunghap', 'relations', 'zodiac'] },
  stars: { name: '별마루', english: 'THE CELESTIAL PAVILION', icon: 'stars', reader: 'vera', guide: '베라', line: '태어난 순간의 하늘을 펼치는 곳', description: '자미두수의 열두 궁과 서양 점성술의 출생 차트를 함께 만나요.', features: ['jami', 'star', 'jami-guide', 'star-guide'] },
  readers: { name: '술사각', english: 'THE HOUSE OF READERS', icon: 'moon', reader: 'luna', guide: '루나', line: '오늘의 질문을 맡길 술사를 만나는 곳', description: '서로 다른 목소리의 술사들과, 고민 하나를 깊이 읽는 리포트.', features: ['readers', 'catalog'] },
  archive: { name: '매거진 서고', english: 'THE QUIET ARCHIVE', icon: 'book', reader: 'seon', guide: '일묵', line: '낯선 말들이 내 이야기가 되는 곳', description: '처음 배우는 사주부터 일주 도감, 삼라 매거진과 명리 도감을 천천히 둘러보세요.', features: ['magazine', 'archive', 'learn', 'stems', 'branches', 'years'] },
});
// Each hall starts with something the visitor can actually use for free.
// These are navigation descriptors, never a promise of a paid personal result.
export const HALL_JOURNEYS = Object.freeze({
  myeongri: {
    title:'나를 읽는 첫 장부터',
    description:'내 일주와 기운의 균형부터 관계·대운까지, 기본 풀이를 읽어요.',
    includes:['일주와 기질','오행과 십신','대운의 큰 흐름'],
    actions:[{label:'내 사주 무료 풀이',type:'reading',kind:'saju',npc:'tojeong'},{label:'직접 입력해 명식 보기',type:'feature',id:'saju'}],
    continuation:'기본 풀이를 읽은 뒤 더 궁금한 주제가 생기면, 풀이 아래에서 상세 리포트의 목차와 가격을 살펴볼 수 있어요.',
  },
  inyeon: {
    title:'어떤 인연을 살펴볼까요?',
    description:'신당에서 만난 나그네와 함께 보거나, 두 사람의 정보를 직접 입력해 궁합을 읽어보세요.',
    includes:['두 명식의 관계','관계의 강점과 조율점','서로 승인하는 나그네 궁합'],
    actions:[
      {label:'만난 나그네와 궁합',type:'social',hint:'같은 공간의 나그네에게 요청하고, 서로 승인한 뒤 함께 읽어요.',step:'나그네 선택 → 요청 → 승인'},
      {label:'직접 입력해 궁합 보기',type:'feature',id:'gunghap',hint:'알고 있는 두 사람의 출생정보를 입력해 바로 비교해요.',step:'출생정보 입력 → 기본 궁합'},
    ],
    continuation:'두 방식 모두 기본 궁합을 무료로 볼 수 있어요. 더 자세한 리포트는 입력 조건·목차·가격을 확인한 뒤 선택해요.',
  },
  stars: {
    title:'태어난 하늘을 차근차근',
    description:'내 별자리·자미두수의 핵심과 생활 속 의미를 무료로 읽어요.',
    includes:['태양·달과 기질','행성의 관계','자미두수의 주요 궁'],
    actions:[{label:'내 별자리 무료 풀이',type:'reading',kind:'star',npc:'luna'},{label:'내 자미두수 무료 풀이',type:'reading',kind:'jami',npc:'luna'}],
    continuation:'자미두수는 태어난 시간이 필요해요. 별자리에서 시간을 모르면 정오 기준으로 읽고 상승궁·하우스는 표시하지 않아요.',
  },
  readers: {
    title:'궁금한 것부터 물어봐요',
    description:'루나와 무료로 대화하고, 내 기본 풀이도 읽어보세요.',
    includes:['루나와의 대화','나의 기본 해석','열두 술사의 소개'],
    actions:[{label:'루나와 무료 대화',type:'encounter',npc:'luna'},{label:'내 기본 풀이 먼저 읽기',type:'reading',kind:'saju',npc:'tojeong'}],
    continuation:'웹 상세 리포트는 구독 없이 한 권씩 구매해요. 결제 전 목차·가격·필요한 정보를 먼저 확인할 수 있어요.',
  },
});
export const FEATURES = Object.freeze({
  'ilju-rooms': {title:'60일주방',text:'내 일주방에서 만나고, 다른 일주방에도 들러요',kind:'rooms',hall:'rooms',badge:'나그네 모임'},
  magazine: {title:'삼라 매거진',text:'성향·관계·일과 삶을 읽는 깊이 있는 이야기',kind:'culture',value:'magazine',hall:'archive',badge:'무료 읽기'},
  saju: { title: '나의 사주', text: '원국 · 오행 · 용신 · 대운과 세운', kind: 'reading', value: 'saju', hall: 'myeongri', badge: '무료 계산' },
  time: { title: '태어난 시간 비교', text: '시간이 모호할 때, 분 단위로 비교', kind: 'reading', value: 'saju', anchor: 'timeCompare', hall: 'myeongri', badge: '무료 계산' },
  gunghap: { title: '우리의 궁합', text: '두 사람의 관계를 여러 방향에서', kind: 'reading', value: 'gunghap', hall: 'inyeon', badge: '무료 계산' },
  relations: { title: '나그네와 함께 보는 궁합', text: '가까이 있는 사람에게 요청하고 승인 후 함께 읽어요', kind: 'invite', hall: 'inyeon', badge: '서로 승인' },
  jami: { title: '자미두수', text: '열두 궁 · 주성 · 사화 · 대한', kind: 'reading', value: 'jami', hall: 'stars', badge: '무료 계산' },
  star: { title: '별자리 출생 차트', text: '태양 · 달 · 상승궁 · 행성과 하우스', kind: 'reading', value: 'star', hall: 'stars', badge: '무료 계산' },
  readers: { title: '열두 술사의 소개', text: '말투와 전문 주제, 담당 리포트를 살펴보세요', kind: 'collection', value: 'readers', hall: 'readers', badge: '무료 소개' },
  catalog: { title: '질문으로 리포트 찾기', text: '연애 · 돈 · 일 · 인연 · 단건 가격과 목차 먼저 확인', kind: 'collection', value: 'catalog', hall: 'readers', badge: '유료 상세 리포트' },
  library: { title: '내 서재', text: '구매한 리포트 이어 읽기 · PDF · 개인 복구', kind: 'collection', value: 'library', badge: '나의 리포트' },
  archive: { title: '자료실 둘러보기', text: '주제별로 찾는 삼라의 모든 읽을거리', kind: 'collection', value: 'archive', hall: 'archive', badge: '무료 읽기' },
  learn: { title: '처음 배우는 사주', text: '처음 시작하는 분을 위한 안내서', kind: 'link', url: '/learn/', hall: 'archive', badge: '무료 읽기' },
  ilju: { title: '60일주 도감', text: '나를 이루는 하루의 기둥', kind: 'link', url: '/ilju/', hall: 'myeongri', badge: '도감' },
  terms: { title: '명리 용어사전', text: '십신 · 합충형해 · 신살과 운성', kind: 'link', url: '/term/', hall: 'myeongri', badge: '사전' },
  zodiac: { title: '띠와 인연', text: '열두 띠의 성향과 띠별 궁합', kind: 'link', url: '/tti/', hall: 'inyeon', badge: '도감' },
  'jami-guide': { title: '자미두수 길잡이', text: '열두 궁과 별들의 의미', kind: 'link', url: '/jami/', hall: 'stars', badge: '무료 읽기' },
  'star-guide': { title: '점성술 길잡이', text: '행성 · 별자리 · 하우스 읽기', kind: 'link', url: '/star/', hall: 'stars', badge: '무료 읽기' },
  celeb: { title: '연예인 사주관', text: '익숙한 얼굴의 사주, 나와 같은 일주 찾기', kind: 'culture', value: 'celeb', hall: 'celeb', badge: '인물 검색' },
  stems: { title: '천간 도감', text: '갑목부터 계수까지 열 가지 기운', kind: 'link', url: '/cheongan/', hall: 'archive', badge: '도감' },
  branches: { title: '지지 도감', text: '자수부터 해수까지 열두 자리', kind: 'link', url: '/jiji/', hall: 'archive', badge: '도감' },
  years: { title: '태어난 해 살펴보기', text: '출생 연도로 찾는 기운과 띠', kind: 'link', url: '/year/', hall: 'archive', badge: '도감' },
});
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
export function getFeature(id) { return own(FEATURES, id) ? FEATURES[id] : null; }
export function getHall(id) { return own(HALLS, id) ? HALLS[id] : null; }
export function parseView(hash = '') {
  const match = /^#(hall|feature|view)=([a-z-]+)$/.exec(hash);
  if (!match) return null;
  const [, type, id] = match;
  if (type === 'hall' && getHall(id) || type === 'feature' && getFeature(id) || type === 'view' && ['map', 'all'].includes(id)) return { type, id };
  return null;
}
export const viewHash = view => view && parseView(`#${view.type}=${view.id}`) ? `#${view.type}=${view.id}` : '';

const publicRoots = new Set(['calc', 'learn', 'ilju', 'term', 'tti', 'jami', 'star', 'celeb', 'm', 'cheongan', 'jiji', 'year', 'legal', 'invite']);
const storePaths = new Set(['/store/', '/store/index.html', '/store/product.html', '/store/checkout.html', '/store/report.html', '/store/library.html', '/store/recover/', '/store/recover/index.html']);
export function internalDestination(raw, origin = 'https://samra.cc') {
  if (typeof raw !== 'string' || !raw || /[\x00-\x1f\\]/.test(raw)) return null;
  try {
    const url = new URL(raw, origin + '/sowon/');
    if (url.origin !== origin || url.username || url.password) return null;
    const first = url.pathname.split('/')[1];
    if (!(publicRoots.has(first) || storePaths.has(url.pathname) || url.pathname === '/')) return null;
    return url.pathname + url.search + url.hash;
  } catch (_) { return null; }
}
const vec = (value, max = 120) => Array.isArray(value) && value.length === 3 && value.every(n => typeof n === 'number' && Number.isFinite(n) && Math.abs(n) <= max) ? value.slice() : null;
export function normalizeJourney(raw, now = Date.now()) {
  if (!raw || typeof raw !== 'object' || typeof raw.at !== 'number' || raw.at > now + 60000 || now - raw.at > JOURNEY_TTL) return null;
  const position = vec(raw.position, 45), camera = vec(raw.camera), target = vec(raw.target);
  if (!position || !camera || !target || position[1] < -2 || position[1] > 8) return null;
  const view = raw.view && viewHash(raw.view) ? { type: raw.view.type, id: raw.view.id } : null;
  return { at: raw.at, position, camera, target, rotation: Number.isFinite(raw.rotation) ? raw.rotation % (2 * Math.PI) : Math.PI, entered: Boolean(raw.entered), view, pending: raw.pending === true };
}
export function readJourney(storage, now = Date.now()) {
  try { return normalizeJourney(JSON.parse(storage?.getItem(JOURNEY_KEY) || 'null'), now); } catch (_) { return null; }
}
export function writeJourney(storage, data, now = Date.now()) {
  const safe = normalizeJourney({ ...data, at: now }, now);
  if (!safe) return false;
  try { storage?.setItem(JOURNEY_KEY, JSON.stringify(safe)); return Boolean(storage); } catch (_) { return false; }
}
