import { getFeature, getHall } from './hub-core.js';

export const ENCOUNTER_FEATURE_IDS = Object.freeze(['saju', 'time', 'learn', 'terms', 'gunghap', 'relations', 'zodiac', 'readers', 'catalog', 'library', 'jami', 'star']);
export const ENCOUNTER_HALL_IDS = Object.freeze(['myeongri', 'inyeon', 'stars', 'readers', 'archive']);
const feature = (id, label) => ({ type: 'feature', id, label });
const hall = (id, label) => ({ type: 'hall', id, label });
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

/** Authored navigation dialogue. No birth data, account state, AI calls or chat history. */
export const ENCOUNTERS = freeze({
  tojeong: {
    id: 'tojeong', name: '토정', title: '산신 노도사', accent: '#76856b',
    greeting: '먼 길 오셨군요. 여덟 글자는 나를 살펴보는 출발점이지요. 오늘은 무엇부터 펼쳐볼까요?',
    topics: [
      { id: 'first', label: '사주를 처음 봐요', hint: '명식과 읽는 순서부터',
        answer: '태어난 해·달·날·시간을 네 기둥으로 세운 것이 명식이에요. 처음에는 일간과 오행의 균형부터 천천히 보세요. 한 글자만으로 사람을 단정할 필요는 없지요.',
        replies: [
          { id: 'chart', label: '내 명식을 직접 보고 싶어요', text: '나의 사주에서 생년월일과 시간을 넣어보세요. 원국 표 아래에 오행·십신·용신의 근거와 대운·세운이 이어집니다. 양력과 음력 중 알고 있는 달력으로 입력하면 돼요.', actions: [feature('saju', '나의 사주 펼치기'), hall('myeongri', '명리전 둘러보기')] },
          { id: 'words', label: '낯선 말부터 알고 싶어요', text: '처음 배우는 사주에서는 읽는 순서를, 용어사전에서는 십신·신살·합과 충의 뜻을 찾아볼 수 있어요. 마음에 걸리는 말 하나부터 알아가도 충분해요.', actions: [feature('learn', '처음 배우는 사주'), feature('terms', '명리 용어사전')] },
        ] },
      { id: 'time', label: '태어난 시간이 정확하지 않아요', hint: '모르는 시간도 그대로',
        answer: '확실하지 않은 시간은 모른다고 두어도 괜찮아요. 가능한 시간대가 있다면 그 범위에서 명식의 어느 글자가 달라지는지 비교할 수 있지요. 비교 결과가 실제 출생시간을 찾아주는 것은 아니에요.',
        replies: [
          { id: 'range', label: '대략적인 시간대는 알아요', text: '태어난 시간 비교에서 생일과 시작·끝 시각을 골라보세요. 1분 단위로 계산해 같은 글자와 달라지는 글자를 나눠 보여줘요. 날짜를 넘는 범위는 하루씩 나누어 비교해 주세요.', actions: [feature('time', '시간대 비교해 보기')] },
          { id: 'unknown', label: '시간을 전혀 몰라요', text: '나의 사주에서 ‘태어난 시간을 몰라요’를 선택하세요. 시간에 따라 달라질 수 있는 풀이의 한계도 함께 살펴보세요. 나중에 시간을 알게 되면 같은 화면에서 다시 계산할 수 있어요.', actions: [feature('saju', '나의 사주 열기'), feature('time', '시간 비교 설명 보기')] },
        ] },
      { id: 'flow', label: '대운과 세운이 궁금해요', hint: '긴 흐름과 한 해의 흐름',
        answer: '대운은 긴 시간의 흐름, 세운은 한 해의 흐름을 읽을 때 살펴보는 항목이에요. 원국과 함께 놓고 보아야 하니, 결과의 좋고 나쁨 한 줄만 떼어 읽지는 마세요.',
        replies: [
          { id: 'cycles', label: '내 흐름을 먼저 보고 싶어요', text: '나의 사주를 계산한 뒤 ‘대운 흐름’과 ‘해마다의 흐름’으로 내려가 보세요. 각 시기의 간지와 원국을 함께 살피는 자리예요. 오늘 할 일을 정할 때 참고하는 정도로 천천히 읽어보세요.', actions: [feature('saju', '내 명식과 흐름 보기')] },
          { id: 'meaning', label: '개념을 먼저 읽고 싶어요', text: '명리 용어사전에서 대운·세운과 함께 십신, 합과 충을 찾아보세요. 낯선 말의 뜻을 알고 결과로 돌아오면, 같은 표에서도 더 많은 맥락을 읽을 수 있어요.', actions: [feature('terms', '용어사전 펼치기'), hall('archive', '서고에 들르기')] },
        ] },
    ],
  },
  seol: {
    id: 'seol', name: '설월', title: '얼음 현자', accent: '#7497aa',
    greeting: '어서 오세요. 관계의 강점과 조율할 점을 같은 무게로 살펴볼게요. 무엇이 궁금한가요?',
    topics: [
      { id: 'pair', label: '궁합에서는 무엇을 보나요?', hint: '두 사람의 차이와 관계의 결',
        answer: '우리의 궁합은 두 사람의 명식과 관계 종류를 바탕으로 여러 축을 살펴봐요. 총점뿐 아니라 결속력·안정성·성장성·소모도와 설명을 함께 읽는 편이 좋아요.',
        replies: [
          { id: 'compare', label: '두 사람을 직접 비교하고 싶어요', text: '두 사람의 출생정보를 넣고 연인·친구·가족·동료 중 실제 관계에 맞게 선택하세요. 결과에서 잘 맞는 부분과 조율할 부분을 나란히 살펴볼 수 있어요.', actions: [feature('gunghap', '우리의 궁합 열기'), hall('inyeon', '인연정 둘러보기')] },
          { id: 'score', label: '점수를 어떻게 읽으면 좋을까요?', text: '점수는 계산된 여러 항목을 요약한 표시예요. 사람의 가치나 관계의 결말로 읽기보다, 세부 항목의 설명과 행동 제안을 함께 보세요. 서로의 경험과 대화가 기준이 되어야 해요.', actions: [feature('gunghap', '세부 설명과 함께 보기')] },
        ] },
      { id: 'privacy', label: '상대의 생일을 모를 때는요?', hint: '각자 알고 있는 정보로',
        answer: '모르는 생일을 짐작해서 넣지 않아도 돼요. 상대가 직접 입력하는 초대 방식도 있지만, 현재 초대를 만들고 결과를 확인하는 시작점은 삼라 앱이에요.',
        replies: [
          { id: 'invite', label: '각자 직접 입력하고 싶어요', text: '인연 초대 안내에서 전체 흐름을 확인하세요. 앱에서 초대를 보내면 상대는 웹에서 정보 전달에 동의하고 직접 입력할 수 있어요. 공유된 관계 요약도 같은 초대에서 확인합니다.', actions: [feature('relations', '인연 초대 흐름 보기')] },
          { id: 'self', label: '우선 나부터 알아보고 싶어요', text: '나의 사주로 돌아가 자신의 명식과 기운의 균형을 먼저 살펴보세요. 상대의 정보 없이도 시작할 수 있어요. 관계를 돌아볼 때 내 반응을 아는 것도 좋은 출발점이에요.', actions: [feature('saju', '나의 사주부터 보기')] },
        ] },
      { id: 'approach', label: '관계를 천천히 돌아보고 싶어요', hint: '가볍게 보기와 깊게 읽기',
        answer: '지금 필요한 깊이에 맞춰 고르세요. 무료 궁합으로 계산 근거를 살피거나, 고민별 리포트의 목차와 가격을 먼저 둘러볼 수 있어요.',
        replies: [
          { id: 'free', label: '무료 계산부터 볼게요', text: '우리의 궁합에서 결과와 근거를 차분히 읽어보세요. 띠와 인연 도감은 열두 띠의 성향을 가볍게 읽는 자료예요. 실제 명식 전체를 계산하는 궁합과는 읽는 범위가 달라요.', actions: [feature('gunghap', '무료 궁합 계산하기'), feature('zodiac', '띠와 인연 읽기')] },
          { id: 'report', label: '고민에 맞는 긴 글을 찾고 싶어요', text: '질문으로 리포트 찾기에서 관심 주제와 질문을 고르면 관련 유료 리포트를 소개해요. 선택한 질문에 따른 안내이며, 구매 전에 목차·술사·입력정보·가격을 확인할 수 있어요.', actions: [feature('catalog', '유료 리포트 목차 둘러보기')] },
        ] },
    ],
  },
  luna: {
    id: 'luna', name: '루나', title: '달빛 무녀', accent: '#8f819d',
    greeting: '달빛 아래 잘 오셨어요. 오늘의 질문에 어울리는 자리를 함께 찾아볼까요?',
    topics: [
      { id: 'readers', label: '술사와 리포트는 어떻게 고르나요?', hint: '목소리와 질문으로 고르기',
        answer: '삼라의 술사들은 저마다 다른 목소리와 설명의 결을 가지고 있어요. 먼저 마음에 드는 목소리를 만나거나, 지금 궁금한 질문으로 리포트를 찾을 수 있어요.',
        replies: [
          { id: 'voice', label: '술사들의 목소리를 만나고 싶어요', text: '열두 술사 만나기에서 소개와 어울리는 리포트를 읽어보세요. 어떤 말투가 나에게 편안한지 살펴보는 시간이에요. 이곳의 술사 대화는 소원당을 안내하는 준비된 이야기예요.', actions: [feature('readers', '열두 술사 만나기'), hall('readers', '술사각 둘러보기')] },
          { id: 'question', label: '지금 고민으로 찾아볼게요', text: '질문으로 리포트 찾기는 생년월일 없이 주제와 질문을 고르는 안내예요. 관련 유료 리포트의 목차와 가격을 먼저 확인한 뒤, 필요할 때 구매를 이어가세요.', actions: [feature('catalog', '질문으로 리포트 찾기')] },
        ] },
      { id: 'library', label: '내 리포트는 어디서 보나요?', hint: '이어 읽기와 개인 복구',
        answer: '내 서재에서 이 브라우저에 보관된 리포트를 찾을 수 있어요. 미결제·생성 중·완성 같은 상태도 함께 보여줘요. 앱과 웹의 목록이 자동으로 합쳐지는 방식은 아니에요.',
        replies: [
          { id: 'continue', label: '읽던 리포트를 이어보고 싶어요', text: '내 서재에서 리포트를 열면 현재 상태를 확인하고 이어 읽을 수 있어요. 완성된 리포트에서는 PDF 저장도 제공해요. 예전에 만든 주문은 새 주문을 만들기보다 기존 주문으로 다시 열어보세요.', actions: [feature('library', '내 서재 열기')] },
          { id: 'recover', label: '기기를 바꿨는데 목록이 없어요', text: '보관한 개인 복구 링크가 있다면 내 서재에서 불러올 수 있어요. 링크를 가진 사람은 전체 리포트를 열 수 있으니 본인만 보관해 주세요. 다른 브라우저의 목록은 자동으로 나타나지 않아요.', actions: [feature('library', '개인 복구 안내 보기')] },
        ] },
      { id: 'sky', label: '다른 방식의 하늘도 보고 싶어요', hint: '자미두수와 출생 차트',
        answer: '별마루에서는 자미두수 명반과 서양 점성술의 출생 차트를 펼칠 수 있어요. 서로 다른 체계의 계산과 해석이니, 각각의 근거를 살펴보며 읽어보세요.',
        replies: [
          { id: 'jami', label: '열두 궁과 별이 궁금해요', text: '자미두수는 출생 시간이 필요해요. 명반의 궁을 누르면 그 자리에 놓인 별과 풀이를 살펴볼 수 있어요. 주성·사화·대한을 차근차근 확인해 보세요.', actions: [feature('jami', '자미두수 명반 펼치기'), hall('stars', '별마루 둘러보기')] },
          { id: 'star', label: '태양·달·상승궁이 궁금해요', text: '별자리 출생 차트에서 행성과 하우스, 주요 각과 기질 해석을 볼 수 있어요. 출생시간을 모를 때는 상승궁·하우스처럼 시간이 필요한 부분이 제한된다는 안내도 함께 읽어주세요.', actions: [feature('star', '별자리 출생 차트 열기'), hall('stars', '별마루 둘러보기')] },
        ] },
    ],
  },
});

export function getEncounter(id) {
  return typeof id === 'string' && Object.prototype.hasOwnProperty.call(ENCOUNTERS, id) ? ENCOUNTERS[id] : null;
}

export function isEncounterAction(action) {
  if (!action || typeof action !== 'object' || Array.isArray(action) || typeof action.id !== 'string' || action.url !== undefined) return false;
  return action.type === 'feature' && ENCOUNTER_FEATURE_IDS.includes(action.id) && Boolean(getFeature(action.id)) ||
    action.type === 'hall' && ENCOUNTER_HALL_IDS.includes(action.id) && Boolean(getHall(action.id));
}

export function createEncounterSession(npcId) {
  const npc = getEncounter(npcId);
  if (!npc) throw new TypeError('이 술사의 안내는 준비되지 않았어요.');
  let topic = null;
  let reply = null;
  const state = () => ({ npcId, step: reply ? 'reply' : topic ? 'topic' : 'intro', topic: topic?.id || null, reply: reply?.id || null });
  return {
    getState: state,
    view: () => ({ npc, topic, reply }),
    choose(id) {
      if (typeof id !== 'string' || reply) return false;
      const next = topic ? topic.replies.find(item => item.id === id) : npc.topics.find(item => item.id === id);
      if (!next) return false;
      if (topic) reply = next; else topic = next;
      return true;
    },
    back() { if (reply) reply = null; else if (topic) topic = null; else return false; return true; },
    reset() { topic = null; reply = null; return state(); },
  };
}
