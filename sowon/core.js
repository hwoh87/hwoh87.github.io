(function (root, factory) {
  'use strict';
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.SowonCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var STORAGE_KEY = 'samra.sowon.v1';
  var MAX_WISHES = 50;
  var KST_OFFSET = 9 * 60 * 60 * 1000;
  var CATEGORIES = [
    {
      id: 'peace', label: '마음의 평안',
      intentSuggestions: ['잠들기 전 휴대폰 내려놓기', '나에게 괜찮다고 말해주기', '햇빛 아래 10분 걷기'],
      guidance: '마음이 고요해지는 데에도 시간이 필요해요. 오늘은 나를 조금 느슨하게 안아주세요.'
    },
    {
      id: 'work', label: '일과 배움',
      intentSuggestions: ['미뤄둔 일 하나 시작하기', '집중하는 20분 만들기', '도움이 필요한 곳에 질문하기'],
      guidance: '오늘의 작은 한 걸음이 내일의 길을 만들어요. 해낼 수 있는 만큼부터 시작해요.'
    },
    {
      id: 'love', label: '사랑과 인연',
      intentSuggestions: ['고마운 사람에게 안부 전하기', '내 마음을 솔직하게 적기', '상대의 이야기 끝까지 듣기'],
      guidance: '좋은 인연을 바라는 마음에 나를 향한 다정함도 보태주세요. 서로의 속도를 존중하면서요.'
    },
    {
      id: 'health', label: '몸과 일상',
      intentSuggestions: ['물 한 잔 천천히 마시기', '가볍게 몸을 풀어주기', '오늘은 조금 일찍 눕기'],
      guidance: '내 몸이 보내는 작은 신호에 귀 기울여주세요. 편안한 일상은 작은 돌봄에서 자라나요.'
    },
    {
      id: 'start', label: '새로운 시작',
      intentSuggestions: ['첫 단계를 종이에 적기', '필요한 정보 하나 찾아보기', '완벽하지 않아도 시작하기'],
      guidance: '아직 길이 다 보이지 않아도 괜찮아요. 오늘 내딛는 작은 걸음 하나를 응원할게요.'
    }
  ];

  var BLESSINGS = [
    { id: 'courage', label: '용기가 필요한 날', message: '떨리는 마음도 함께 데려가요. 오늘 당신의 한 걸음을 조용히 응원하고 있어요.' },
    { id: 'start', label: '새로운 출발 앞에서', message: '새로운 길 위에 따뜻한 빛이 머물기를. 당신의 시작을 진심으로 응원해요.' },
    { id: 'peace', label: '잠시 쉬어가기를', message: '오늘만큼은 마음의 짐을 조금 내려놓아요. 당신에게 고요하고 편안한 밤이 찾아오기를.' },
    { id: 'love', label: '고마운 당신에게', message: '곁에 있어 주어 고마워요. 당신의 하루에도 다정한 마음과 작은 기쁨이 가득하기를.' }
  ];

  var SEASONS = [
    { label: '새해의 첫 마음', eyebrow: '일월의 소원당', message: '서두르지 않아도 괜찮아요. 새해의 바람을 천천히 밝혀보세요.' },
    { label: '봄을 기다리는 마음', eyebrow: '이월의 소원당', message: '아직 차가운 바람 속에서도, 새로운 시작은 조금씩 자라고 있어요.' },
    { label: '처음 피어나는 계절', eyebrow: '삼월의 소원당', message: '작게 움트는 마음에도 빛을 건네주세요. 당신의 시작을 응원해요.' },
    { label: '꽃이 머무는 자리', eyebrow: '사월의 소원당', message: '피어나는 계절에, 당신의 바람도 제 속도로 자라나기를.' },
    { label: '푸르게 자라는 마음', eyebrow: '오월의 소원당', message: '소중한 사람과 나 자신에게 다정한 마음을 보내보세요.' },
    { label: '빛이 길어지는 날들', eyebrow: '유월의 소원당', message: '하루가 길어진 만큼, 내 마음을 돌보는 시간도 조금 남겨두어요.' },
    { label: '여름밤의 작은 쉼', eyebrow: '칠월의 소원당', message: '바삐 달려온 마음이 잠시 쉬어갈 수 있도록, 작은 불을 켜두었어요.' },
    { label: '여름 끝의 숨 고르기', eyebrow: '팔월의 소원당', message: '뜨거웠던 하루를 내려놓고, 나에게 편안한 숨 한 번을 선물해요.' },
    { label: '바람이 바뀌는 계절', eyebrow: '구월의 소원당', message: '변해가는 계절처럼, 내 마음에도 새로운 자리가 생겨나기를.' },
    { label: '깊어지는 가을', eyebrow: '시월의 소원당', message: '마음에 오래 품어온 바람 하나, 오늘 이곳에 조용히 밝혀두세요.' },
    { label: '온기를 모으는 계절', eyebrow: '십일월의 소원당', message: '찬 바람이 불어도 마음의 작은 온기는 오래 머물 수 있어요.' },
    { label: '한 해를 안아주는 밤', eyebrow: '십이월의 소원당', message: '애쓴 마음에 수고했다고 말해주어요. 다음 계절에도 빛이 함께하기를.' }
  ];

  function toDate(input) {
    var date = input instanceof Date ? new Date(input.getTime()) : new Date(input === undefined ? Date.now() : input);
    return Number.isNaN(date.getTime()) ? new Date(0) : date;
  }

  function dateKey(input) {
    return new Date(toDate(input).getTime() + KST_OFFSET).toISOString().slice(0, 10);
  }

  function getSeason(input) {
    var month = new Date(toDate(input).getTime() + KST_OFFSET).getUTCMonth();
    return Object.assign({}, SEASONS[month]);
  }

  function getCategory(id) {
    return CATEGORIES.find(function (item) { return item.id === id; }) || null;
  }

  function getBlessing(id) {
    return BLESSINGS.find(function (item) { return item.id === id; }) || null;
  }

  function codePointLength(text) {
    return Array.from(text).length;
  }

  function parseBlessingHash(hash) {
    if (typeof hash !== 'string' || !/^#blessing=(courage|start|peace|love)$/.test(hash)) return null;
    return getBlessing(hash.slice('#blessing='.length));
  }

  function createBlessingUrl(baseUrl, blessingId) {
    if (!getBlessing(blessingId)) throw new Error('응원 문구를 다시 선택해주세요.');
    var url;
    try { url = new URL(baseUrl); } catch (_) { throw new Error('공유 주소를 만들 수 없어요.'); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') throw new Error('공유 주소를 만들 수 없어요.');
    url.username = '';
    url.password = '';
    url.search = '';
    url.hash = 'blessing=' + blessingId;
    return url.toString();
  }

  function blankState() {
    return { version: 1, wishes: [], visits: [], sound: false };
  }

  function isRecord(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
  }

  function validTimestamp(value) {
    if (typeof value !== 'string' || value.length > 40) return null;
    var millis = Date.parse(value);
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
  }

  function validDateKey(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    var date = new Date(value + 'T00:00:00.000Z');
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
  }

  function normalizeState(payload) {
    if (!isRecord(payload) || payload.version !== 1) return blankState();
    var seen = new Set();
    var wishes = (Array.isArray(payload.wishes) ? payload.wishes : []).filter(function (wish) {
      if (!isRecord(wish) || typeof wish.id !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(wish.id) || seen.has(wish.id)) return false;
      if (typeof wish.text !== 'string' || !wish.text.trim() || codePointLength(wish.text.trim()) > 120) return false;
      if (!getCategory(wish.category) || typeof wish.intention !== 'string' || codePointLength(wish.intention.trim()) > 80) return false;
      if (!validTimestamp(wish.createdAt)) return false;
      seen.add(wish.id);
      return true;
    }).map(function (wish) {
      return {
        id: wish.id, text: wish.text.trim(), category: wish.category,
        intention: wish.intention.trim(), createdAt: validTimestamp(wish.createdAt),
        completedAt: validTimestamp(wish.completedAt)
      };
    }).sort(function (a, b) { return b.createdAt.localeCompare(a.createdAt); }).slice(0, MAX_WISHES);
    var visits = Array.from(new Set((Array.isArray(payload.visits) ? payload.visits : []).filter(validDateKey))).sort().slice(-366);
    return { version: 1, wishes: wishes, visits: visits, sound: payload.sound === true };
  }

  function createStore(storage, nowFn) {
    var state = null;
    var persistent = Boolean(storage && typeof storage.getItem === 'function' && typeof storage.setItem === 'function');
    var now = typeof nowFn === 'function' ? nowFn : Date.now;
    var sequence = 0;

    function snapshot() {
      return {
        version: 1,
        wishes: state.wishes.map(function (wish) { return Object.assign({}, wish); }),
        visits: state.visits.slice(), sound: state.sound, persistent: persistent
      };
    }

    function refresh() {
      if (state === null) state = blankState();
      if (persistent) {
        try {
          var saved = storage.getItem(STORAGE_KEY);
          if (saved === null) state = blankState();
          else {
            try { state = normalizeState(JSON.parse(saved)); } catch (_) { state = blankState(); }
          }
        } catch (_) {
          // A failed read must not discard wishes already kept in this tab.
          persistent = false;
        }
      }
      return snapshot();
    }

    function load(forceRefresh) {
      return state === null || forceRefresh === true ? refresh() : snapshot();
    }

    function persist() {
      if (persistent) {
        try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) { persistent = false; }
      }
      return snapshot();
    }

    function addWish(input) {
      refresh();
      if (!isRecord(input) || typeof input.text !== 'string') throw new Error('불빛에 담을 바람을 적어주세요.');
      var text = input.text.trim();
      var intention = input.intention === undefined ? '' : input.intention;
      var category = input.category === undefined ? 'peace' : input.category;
      if (!text) throw new Error('불빛에 담을 바람을 적어주세요.');
      if (codePointLength(text) > 120) throw new Error('소원은 120자 안으로 적어주세요.');
      if (!getCategory(category)) throw new Error('바람의 종류를 다시 선택해주세요.');
      if (typeof intention !== 'string' || codePointLength(intention.trim()) > 80) throw new Error('오늘의 작은 실천은 80자 안으로 적어주세요.');
      var timestamp = toDate(now()).toISOString();
      var randomId = typeof globalThis !== 'undefined' && globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function'
        ? globalThis.crypto.randomUUID() : toDate(timestamp).getTime().toString(36) + '-' + (++sequence).toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      state.wishes.unshift({ id: randomId, text: text, category: category, intention: intention.trim(), createdAt: timestamp, completedAt: null });
      state.wishes = state.wishes.slice(0, MAX_WISHES);
      return persist();
    }

    function toggleWish(id) {
      refresh();
      var wish = state.wishes.find(function (item) { return item.id === id; });
      if (!wish) return snapshot();
      wish.completedAt = wish.completedAt ? null : toDate(now()).toISOString();
      return persist();
    }

    function removeWish(id) {
      refresh();
      if (!state.wishes.some(function (wish) { return wish.id === id; })) return snapshot();
      state.wishes = state.wishes.filter(function (wish) { return wish.id !== id; });
      return persist();
    }

    function setSound(enabled) {
      refresh();
      state.sound = enabled === true;
      return persist();
    }

    function visit() {
      refresh();
      var day = dateKey(now());
      if (state.visits.indexOf(day) !== -1) return snapshot();
      state.visits.push(day);
      state.visits = state.visits.sort().slice(-366);
      return persist();
    }

    return { load: load, refresh: refresh, addWish: addWish, toggleWish: toggleWish, removeWish: removeWish, setSound: setSound, visit: visit };
  }

  return {
    STORAGE_KEY: STORAGE_KEY, MAX_WISHES: MAX_WISHES,
    CATEGORIES: CATEGORIES, BLESSINGS: BLESSINGS,
    dateKey: dateKey, getSeason: getSeason,
    getCategory: getCategory, getBlessing: getBlessing,
    codePointLength: codePointLength,
    parseBlessingHash: parseBlessingHash, createBlessingUrl: createBlessingUrl,
    createStore: createStore
  };
});
