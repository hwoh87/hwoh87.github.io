import { getEncounter } from './encounter-core.js';
import { getFeature } from './hub-core.js';

export const MAX_DIALOGUE_MESSAGES = 20;
export const MAX_DIALOGUE_QUESTION_LENGTH = 160;
export const MAX_DIALOGUE_ANSWER_LENGTH = 1600;
const MAX_BACK_STEPS = 12;
const FEATURES = new Set(['saju','time','learn','terms','gunghap','zodiac','readers','catalog','library','jami','star']);
const READING_KINDS = new Set(['saju','jami','star']);
const PERSONAL_IDS = { saju:['nature','balance','direction','flow'], star:['nature','emotion','balance','relationship','practice'] };
const clean = (value,limit=1200) => typeof value === 'string' ? value.normalize('NFC').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g,'').replace(/\bhttps?:\/\/\S+|\b(?:javascript|data):\S+/gi,'').trim().slice(0,limit) : '';
const copy = value => JSON.parse(JSON.stringify(value));
const sentence = value => clean(value).split(/(?<=[.!?])\s+/).find(Boolean) || '';
function freeze(value){if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const action = (type,label,id) => ({type,label,...(id?{id}:{})});
const profileAction = () => action('profile','내 정보 준비하기');
const feature = (id,label) => action('feature',label,id);
const reading = (id,label='전체 기본 해석 펼치기') => action('reading',label,id);
const social = () => action('social','마당에서 인연 만나기');
const canonical = (npc,topic) => getEncounter(npc)?.topics.find(row=>row.id===topic)?.answer || '';

const PERSONAS = freeze({
  tojeong:{id:'tojeong',name:'토정',role:'사주의 길을 짚는 도사',title:'산신 노도사',readingKind:'saju',openerTitle:'차 한 잔, 이야기 한 자락',line:'명식의 큰 결부터 차근차근 살펴보죠.',style:'차분한 존대. 살펴보죠·하지요를 짧게 사용한다.',greeting:'잘 오셨습니다. 오늘은 무엇이 마음에 걸리나요?',ready:'준비해 둔 명식의 기본 풀이를 살펴봤지요.',topicPrompt:'기본 결, 기운의 균형, 긴 흐름 중 어디부터 살펴볼까요?',after:'이름에 나를 맞추기보다, 일상에서 닮은 부분을 찾아보지요.',shortLead:'짧게 짚으면 이 문장이에요.',basisLead:'이번 계산에서 확인한 표시는 이렇지요.',practiceLead:'오늘은 크게 바꾸려 하지 말고, 이 한 가지를 살펴보지요.',guidePrompt:'서두르지 않아도 됩니다. 어느 길이 궁금한가요?'},
  seol:{id:'seol',name:'설월',role:'관계의 온도를 읽는 안내자',title:'얼음 현자',readingKind:'star',openerTitle:'서로를 알아가는 시간',line:'상대 정보 없이, 먼저 나의 관계 반응을 읽어요.',style:'명료하고 차분한 존대. 강점과 조율점을 같은 무게로 말한다.',greeting:'반가워요. 관계에서 궁금했던 장면이 있나요?',ready:'상대 정보 없이, 내 관계 반응의 기본 풀이를 준비했어요.',topicPrompt:'어떤 관계 반응부터 살펴볼까요?',after:'맞는 부분은 실제 대화에서 확인해 보세요. 상대의 마음을 대신 정하는 풀이는 아니에요.',shortLead:'핵심만 남기면 이 문장이에요.',basisLead:'이 답을 읽을 때 함께 본 신호예요.',practiceLead:'실제 대화에 옮겨 볼 작은 단서를 골라볼게요.',guidePrompt:'내 반응을 읽는 것과 두 사람의 궁합은 나눠서 볼게요. 무엇이 궁금한가요?'},
  luna:{id:'luna',name:'루나',role:'태어난 하늘을 풀어 주는 안내자',title:'달빛 무녀',readingKind:'star',openerTitle:'하늘에서 시작하는 이야기',line:'기질과 마음의 리듬을 편하게 이야기해요.',style:'친근한 해요체. 부드럽되 과한 비유나 예언은 쓰지 않는다.',greeting:'어서 와요. 나에 대해 어떤 이야기를 나눠볼까요?',ready:'태어난 하늘의 기본 풀이를 준비했어요.',topicPrompt:'지금 가장 궁금한 이야기를 골라봐요.',after:'내 경험과 닮은 부분부터 가볍게 대조해 봐요.',shortLead:'한 문장으로 이야기하면 이래요.',basisLead:'이 이야기는 이런 배치를 보고 읽었어요.',practiceLead:'일상에 옮긴다면, 이 문장부터 살펴봐요.',guidePrompt:'풀이가 처음이어도 괜찮아요. 궁금한 것부터 물어봐요.'},
});

// Three stages for guests: choose a topic → ask a narrower question → choose a
// real next step. These are authored guidance, never a guessed personal reading.
const GUIDES = freeze({
  tojeong:[
    {id:'first',label:'사주가 처음인데, 어디부터 볼까요?',answer:canonical('tojeong','first'),replies:[
      {id:'my-chart',label:'내 명식에서 무엇부터 읽나요?',text:'나를 뜻하는 일간과 오행의 균형부터 보죠. 이곳에서는 내 정보를 준비하면 기본 성향과 힘의 균형, 대운의 흐름을 읽을 수 있어요. 자세한 계산표를 보고 싶다면 전체 기본 해석을 펼쳐도 됩니다.',actions:[profileAction(),reading('saju','사주 계산표 펼치기')]},
      {id:'words',label:'십신이나 격국이라는 말이 낯설어요.',text:'십신은 나와 다른 글자의 관계를, 격국은 명식의 큰 틀을 읽는 말이지요. 이름을 외우기보다 풀이에서 만난 말 하나씩 알아가면 됩니다. 읽는 순서와 용어사전부터 둘러보세요.',actions:[feature('learn','사주 읽는 순서 보기'),feature('terms','명리 용어 찾아보기')]},
    ]},
    {id:'time',label:'태어난 시간이 정확하지 않아도 괜찮나요?',answer:canonical('tojeong','time'),replies:[
      {id:'unknown',label:'시간을 전혀 몰라요.',text:'내 정보에서 시간을 모른다고 선택해 두세요. 사주는 시주를 제외한 세 기둥을 읽고, 정오를 대신 쓴 계산의 한계도 알려드려요. 자미두수는 출생 시간이 필요하니, 임의의 시각으로 명반을 만들지는 않습니다.',actions:[profileAction(),reading('saju','시간 모름으로 사주 살펴보기')]},
      {id:'range',label:'오전인지 오후인지는 알아요.',text:'가능한 시간 범위가 있다면 시간 비교에서 어떤 글자가 달라지는지 살펴보죠. 1분 단위로 비교하지만, 결과가 진짜 출생시간을 찾아주는 것은 아니에요. 날짜를 넘는 범위는 하루씩 나누어 비교하면 됩니다.',actions:[feature('time','태어난 시간대 비교하기')]},
    ]},
    {id:'flow',label:'대운과 세운은 어떻게 읽으면 좋을까요?',answer:canonical('tojeong','flow'),replies:[
      {id:'long',label:'요즘의 큰 흐름부터 보고 싶어요.',text:'기본 풀이에서는 계산된 현재 대운이 있을 때 그 주제를 짚어드려요. 전체 계산표에서는 대운과 해마다의 흐름을 원국과 나란히 살펴볼 수 있지요. 실제 사건을 정해 두는 예고가 아니라, 변화를 돌아보는 참고로 읽어보세요.',actions:[reading('saju','내 명식과 대운 펼치기')]},
      {id:'meaning',label:'좋고 나쁨 한 줄만 보면 안 되나요?',text:'같은 기운도 명식과 상황에 따라 쓰이는 모습이 달라지지요. 대운·세운의 이름이나 점수만 떼어 읽기보다, 일간과 어떤 관계인지 먼저 보세요. 낯선 이름은 용어사전에서 함께 확인할 수 있어요.',actions:[feature('terms','대운·세운 용어 알아보기')]},
    ]},
    {id:'depth',label:'여기서는 어디까지 무료로 볼 수 있나요?',answer:'출생정보로 계산하는 기본 성향과 기운의 균형은 이곳에서 무료로 살펴볼 수 있지요. 긴 글의 상세 리포트는 기본 풀이와 범위가 달라요. 목차와 가격을 먼저 확인하고 필요한 만큼 골라보세요.',replies:[
      {id:'free',label:'우선 기본 풀이를 충분히 읽을게요.',text:'좋습니다. 기본 해석과 계산표를 차례로 보고, 내 경험과 닮은 부분을 골라보죠. 지금 읽은 내용을 모두 사실처럼 받아들일 필요는 없어요. 다음 질문도 준비되어 있습니다.',actions:[reading('saju','무료 기본 해석 더 보기')]},
      {id:'detail',label:'고민에 맞는 긴 리포트를 찾고 싶어요.',text:'질문으로 리포트 찾기에서 관심 주제와 질문을 골라보세요. 관련 상품의 목차·술사·가격을 먼저 살필 수 있어요. 구매는 상품 화면에서 내용을 확인한 뒤 별도로 이어집니다.',actions:[feature('catalog','상세 리포트 목차 둘러보기')]},
    ]},
  ],
  seol:[
    {id:'self',label:'상대 생일을 몰라도 내 관계 반응을 읽나요?',answer:'네. 지금의 개인 풀이는 내 출생정보로 계산한 기질과 관계 반응을 읽어요. 상대 정보가 없으니 두 사람의 점수나 상대의 마음은 추측하지 않아요. 실제 궁합은 두 사람의 정보와 동의가 갖춰졌을 때 따로 살펴봐요.',replies:[
      {id:'prepare',label:'내 반응부터 알아보고 싶어요.',text:'내 정보를 준비하면 별자리 기본 풀이 중 관계와 표현의 결부터 이야기할 수 있어요. 관계에서 어떤 부분이 편하고 어떤 부분을 조율할지, 실제 경험과 나란히 읽어보세요.',actions:[profileAction(),reading('star','내 관계 반응의 기본 해석 보기')]},
      {id:'two',label:'두 사람이 같이 보려면 어떻게 하나요?',text:'각자 내 출생정보를 준비한 뒤 마당의 만남에 참여해요. 가까운 나그네에게 관계 종류를 골라 궁합을 요청하면 됩니다. 상대가 승인한 뒤 두 사람이 같은 결과를 볼 수 있어요.',actions:[social()]},
    ]},
    {id:'consent',label:'마당에서 궁합을 청하는 순서가 궁금해요.',answer:'각자 공개 범위를 확인하고 만남에 참여한 뒤, 가까운 나그네에게 요청해요. 요청을 보내는 것이 보낸 사람의 동의이고, 받은 사람이 승인해야 두 사람의 결과가 열려요. 사양하거나 요청을 취소해도 괜찮아요.',replies:[
      {id:'meet',label:'지금 같은 마당에서 만나고 싶어요.',text:'마당의 만남에서 닉네임과 캐릭터·위치를 공개할 범위를 먼저 확인하세요. 참여한 사람끼리 가까이 다가가 요청을 보낼 수 있어요. 관계 종류도 실제 인연에 맞춰 골라주세요.',actions:[social()]},
      {id:'birth',label:'상대가 내 생년월일도 보게 되나요?',text:'상대에게 출생정보 원문을 보여주는 방식은 아니에요. 만남에 참여할 때 계산을 위해 서버에 보관하며, 승인 후 두 참여자에게 계산된 결과를 보여줘요. 서버 정보와 공유를 지우는 기능도 마당의 만남 안에 있어요.',actions:[social()]},
    ]},
    {id:'score',label:'궁합 점수는 어떻게 받아들이면 좋을까요?',answer:canonical('seol','pair'),replies:[
      {id:'low',label:'점수가 낮으면 나쁜 인연인가요?',text:'점수가 관계의 결말은 아니에요. 잘 맞는 부분과 조율할 부분을 나누어 보고, 서로의 경험과 대화가 맞는지 확인해 보세요. 관계 종류에 따라서도 읽는 기준이 달라져요.',actions:[feature('gunghap','궁합 항목과 설명 살펴보기')]},
      {id:'known',label:'서로 알고 있는 정보로 직접 계산할게요.',text:'두 사람의 동의를 받은 출생정보와 실제 관계 종류를 입력해 주세요. 전체 무료 계산표에서 각 항목을 나란히 볼 수 있어요. 이 직접 입력 화면과 마당의 승인 요청은 별개의 이용 방식이에요.',actions:[feature('gunghap','두 사람 직접 입력하기')]},
    ]},
    {id:'revoke',label:'승인한 뒤 마음이 바뀌면 어떻게 하나요?',answer:'공유를 철회할 수 있어요. 한 사람이 철회하면 두 사람 모두 그 결과를 다시 열 수 없게 돼요. 다만 이미 읽은 내용이나 별도로 저장한 화면까지 되돌리는 기능은 아니에요.',replies:[
      {id:'one',label:'특정 궁합의 공유만 거두고 싶어요.',text:'마당의 만남에서 궁합 소식을 열고 해당 요청의 공유 철회를 선택하세요. 철회는 두 사람 모두에게 적용돼요. 필요하다면 나중에 다시 만나 새로운 요청으로 동의를 나눌 수 있어요.',actions:[social()]},
      {id:'all',label:'만남에 올린 내 정보를 전부 지우고 싶어요.',text:'마당의 만남에서 서버의 내 정보와 공유 지우기를 선택하세요. 마당에서 잠시 나가는 것과 서버 정보를 지우는 것은 달라요. 이 브라우저에 기억한 출생정보도 지우려면 내 정보에서 따로 삭제해 주세요.',actions:[social(),action('profile','브라우저의 내 정보 확인')]},
    ]},
  ],
  luna:[
    {id:'sky',label:'태양·달·상승궁은 무엇이 다른가요?',answer:'태양은 기본 성향, 달은 마음이 반응하고 회복하는 방식, 상승궁은 처음 보이는 태도를 읽는 출발점이에요. 세 가지를 하나로 뭉뚱그리기보다 각각의 배치와 설명을 함께 살펴봐요.',replies:[
      {id:'start',label:'내 태어난 하늘을 보고 싶어요.',text:'내 정보를 준비하면 태어난 하늘의 기본 기질부터 이야기할 수 있어요. 전체 출생 차트에서는 행성·하우스·주요 각도 함께 볼 수 있어요. 태어난 도시가 다르면 전체 계산에서 출생지를 확인해 주세요.',actions:[profileAction(),reading('star','내 출생 차트 펼치기')]},
      {id:'unknown',label:'시간을 몰라도 별자리를 볼 수 있나요?',text:'정오를 대신 쓴 행성 배치로 기본 기질을 참고할 수 있어요. 실제 시각에 따라 달처럼 빠른 천체는 달라질 수 있어요. 상승궁·하우스·차트 룰러처럼 시간이 필요한 풀이는 제외해요.',actions:[profileAction(),reading('star','시간 모름으로 하늘 살펴보기')]},
    ]},
    {id:'practice',label:'풀이를 일상에서는 어떻게 써볼까요?',answer:'닮은 말 하나를 골라 실제 경험과 대조해 봐요. 모두 나를 설명해야 하는 것은 아니에요. 편안했던 순간과 잘 맞지 않았던 순간을 같이 떠올리면, 나에게 쓸모 있는 질문이 남아요.',replies:[
      {id:'small',label:'작은 실천 하나만 골라보고 싶어요.',text:'내 기본 풀이가 준비되어 있다면 ‘일상에서 살려 볼 방향’을 골라봐요. 계산된 성장 방향과 행동 안내를 읽고, 지금 해볼 수 있는 크기로 정하면 돼요. 아직 풀이가 없다면 내 정보부터 준비해 주세요.',actions:[profileAction(),reading('star','기본 해석의 실천 방향 보기')]},
      {id:'different',label:'나와 다르게 느껴지는 말도 있어요.',text:'그 부분은 억지로 맞추지 않아도 괜찮아요. 출생정보와 시간·도시 기준을 먼저 확인하고, 실제 경험과 다른 부분은 다르다고 남겨두세요. 이 해석을 내 선택을 대신하는 정답으로 쓰지는 말아요.',actions:[action('profile','내 출생정보 확인'),reading('star','출생 차트와 설정 확인')]},
    ]},
    {id:'jami',label:'자미두수는 별자리와 어떻게 다른가요?',answer:'자미두수는 열두 궁과 그 자리에 놓인 별을 읽는 별도의 체계예요. 서양 별자리의 행성과 하우스와는 계산 기준이 달라요. 각각 어떤 배치에서 나온 말인지 확인하며 읽어봐요.',replies:[
      {id:'palace',label:'내 열두 궁도 살펴보고 싶어요.',text:'자미두수는 태어난 시간이 있어야 명궁과 별의 자리를 정할 수 있어요. 시간을 알고 있다면 명반에서 궁을 눌러 별과 기본 풀이를 확인해 보세요. 시간을 모르면 임의의 시각을 넣지는 않아요.',actions:[reading('jami','자미두수 명반 펼치기')]},
      {id:'compare',label:'서로 다른 풀이를 어떻게 비교하나요?',text:'같은 체계 안의 근거부터 확인해 봐요. 별자리는 행성과 각, 자미두수는 궁과 별처럼 출발점이 달라요. 마음에 드는 말만 섞기보다 내 경험에서 어느 질문이 유용한지 살펴보면 좋아요.',actions:[reading('star','별자리의 계산 근거 보기'),reading('jami','자미두수의 계산 근거 보기')]},
    ]},
    {id:'reading',label:'조금 더 긴 이야기나 내 리포트를 찾고 싶어요.',answer:'기본 풀이는 이곳에서 읽고, 더 긴 상세 리포트는 목차와 가격을 먼저 둘러볼 수 있어요. 이미 만든 웹 리포트라면 내 서재에서 이어 읽어봐요.',replies:[
      {id:'question',label:'지금 고민에 맞는 리포트를 찾을게요.',text:'질문으로 리포트 찾기에서 주제와 질문을 골라봐요. 관련 유료 상품을 안내하는 기능이고, 그 선택만으로 내 성향을 분석하거나 구매하지는 않아요. 목차와 가격을 확인한 뒤 결정할 수 있어요.',actions:[feature('catalog','리포트 목차 둘러보기'),feature('readers','다른 술사의 목소리 만나기')]},
      {id:'library',label:'전에 만든 리포트를 이어 읽고 싶어요.',text:'내 서재에서 이 브라우저에 보관된 웹 리포트를 찾아봐요. 기기를 바꿨다면 보관한 개인 복구 링크로 불러올 수 있어요. 링크를 가진 사람은 리포트를 볼 수 있으니 본인만 보관해 주세요. 앱과 웹의 목록은 자동으로 합쳐지지 않아요.',actions:[feature('library','내 서재 열기')]},
    ]},
  ],
});

const QUESTIONS = freeze({
  tojeong:{nature:'나는 어떤 기본 결을 지녔나요?',balance:'힘을 쓰고 회복하는 방식이 궁금해요.',direction:'어떤 방향으로 균형을 잡으면 좋을까요?',flow:'지금의 큰 흐름을 짚어주세요.'},
  seol:{relationship:'나는 관계에서 어떻게 반응하나요?',nature:'관계에서 드러나는 내 기본 기질은요?',emotion:'마음이 다쳤을 때 무엇을 살펴볼까요?',balance:'내게 두드러지는 기질은 무엇인가요?',practice:'관계에서 작게 연습할 방향이 있나요?'},
  luna:{nature:'태어난 하늘은 내 기질을 어떻게 읽나요?',emotion:'내 마음이 쉬는 방식이 궁금해요.',balance:'내게 두드러지는 기질이 궁금해요.',relationship:'관계와 표현에서는 어떤 결이 보이나요?',practice:'일상에서 살려 볼 방향을 골라주세요.'},
});
const ORDER = {tojeong:['nature','balance','direction','flow'],seol:['relationship','nature','emotion','balance','practice'],luna:['nature','emotion','balance','relationship','practice']};
const FOLLOWUPS = freeze({short:'핵심만 짧게 말해 주세요.',practice:'일상에서는 어떻게 살펴볼까요?',basis:'어떤 근거를 보고 한 이야기인가요?',next:'다음 이야기도 들려주세요.'});
const CLOSINGS = freeze({
  tojeong:{nature:'평소 모습과 닮은 대목이 있는지 천천히 떠올려보지요.',balance:'힘을 쓸 때와 쉴 때를 함께 떠올려보죠.',direction:'지금 내게 필요한 균형을 생각하며 읽어보지요.',flow:'요즘 반복되는 선택과 나란히 놓고 살펴보죠.'},
  seol:{relationship:'이것은 내 반응을 읽는 이야기예요. 상대의 마음을 대신 정하지는 않아요.',nature:'함께 있을 때 더 드러나는 모습이 있는지 떠올려보세요.',emotion:'마음이 편해지는 조건을 천천히 짚어봐도 좋아요.',balance:'어떤 상황에서 이 기질이 드러났는지 살펴볼까요?',practice:'지금 가능한 작은 행동 하나만 골라도 충분해요.'},
  luna:{nature:'내 경험과 닮은 대목이 있는지 편하게 떠올려봐요.',emotion:'마음이 쉬었던 순간과 나란히 읽어봐요.',balance:'내가 편하게 쓰는 기질부터 알아봐도 좋아요.',relationship:'가까운 사람과 이야기할 때의 모습을 떠올려봐요.',practice:'부담 없이 해볼 수 있는 것부터 골라봐요.'},
});

// A written question only selects one of these prepared subjects. It never
// supplies a new interpretation, a command, a URL or an action to execute.
const ASK_TOPICS = freeze({nature:'내 기본 성향이 궁금해요.',relationship:'관계와 표현을 살펴볼게요.',flow:'큰 흐름을 어떻게 읽나요?',recovery:'마음과 회복을 살펴볼게요.',practice:'일상에서 해볼 방향이 궁금해요.'});
const ASK_DEFAULTS = freeze({tojeong:['nature','recovery','practice','flow'],seol:['relationship','nature','recovery','practice'],luna:['nature','recovery','relationship','practice']});
const ASK_CLARIFY = freeze({tojeong:'어느 대목이 궁금한지 한 가지만 더 짚어보죠. 아래 이야기 중 가까운 것을 골라주세요.',seol:'궁금한 장면에 맞춰 이야기하고 싶어요. 어느 쪽부터 살펴볼까요?',luna:'조금만 좁혀서 이야기해 봐요. 지금 궁금한 쪽을 골라줘요.'});
const ASK_LIMIT = freeze({tojeong:'결혼 날짜나 당첨, 특정 결과를 이 계산으로 확정할 수는 없지요. 지금 읽을 수 있는 범위에서 살펴보죠.',seol:'결혼 날짜나 상대의 선택, 당첨 같은 결과를 확정하는 풀이는 아니에요. 준비된 기본 풀이의 범위에서 이야기할게요.',luna:'특정 날짜나 당첨, 앞으로의 결과를 확정해 주는 계산은 아니에요. 지금 준비된 기본 이야기로 살펴봐요.'});
const PRIVATE_QUESTION = /(?:(?<!\d)(?:18|19|20)\d{2}\s*(?:[-./]|\s)\s*\d{1,2}\s*(?:[-./]|\s)\s*\d{1,2}(?!\d)|(?:18|19|20)\d{2}\s*년\s*\d{1,2}\s*월\s*\d{1,2}\s*일|(?<!\d)(?:18|19|20)\d{6}(?!\d)|\b(?:access[_-]?token|refresh[_-]?token|token|paymentKey|authorization|password|secret|rid)["']?\s*[=:]\s*\S+|(?:토큰|비밀번호|복구\s*키)\s*[=:]\s*\S+|\bBearer\s+\S+|\bAIza[\w-]{20,}|\bsb_secret_[\w-]+|\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{8,}|\b[0-9a-f]{64}\b)/i;
function privateText(value){const text=value.normalize('NFKC');return PRIVATE_QUESTION.test(text)||PRIVATE_QUESTION.test(text.replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u2069]/g,''));}
const CERTAIN_QUESTION = /언제.{0,16}(?:결혼|취업|이직|합격|만나)|(?:결혼|취업|이직|합격).{0,16}언제|복권|로또|당첨|무조건|확정|확답|100\s*%|정확한\s*(?:날짜|시점)/;
function questionTopics(text){
  const topics=[];
  if(/성격|성향|기질|본질|장단점|어떤\s*사람|나\s*자신/.test(text))topics.push('nature');
  if(/연애|사랑|친구|관계|갈등|궁합|결혼|배우자|이별|호감|상대|소통/.test(text))topics.push('relationship');
  if(/직장|직업|회사|커리어|이직|취업|업무|재물|돈|금전|미래|대운|세운|올해|내년|흐름|진로|운세|행운|일운|복권|로또|당첨/.test(text)||/(?:^|[\s,?!])일(?:은|이|을|도|에서|과|에|로)?(?=$|[\s,?!.]|안|잘|힘들|어렵|궁금)/.test(text)||/(?:^|[\s,?!])운(?:은|이|을|도|에|의)?(?=$|[\s,?!.]|좋|나쁘|궁금|어떻)/.test(text))topics.push('flow');
  if(/지침|지쳤|지쳐|피곤|회복|휴식|마음|불안|감정|스트레스|쉬고/.test(text))topics.push('recovery');
  if(/실천|방향|습관|행동|연습|일상|해볼\s*일|할\s*일/.test(text))topics.push('practice');
  // Single syllables are words here, not substrings of 만나요/생일/내일/운동.
  if(!topics.length&&/(?:^|\s)(?:나|저)(?:는|를|의|에\s*대해)?(?=$|[\s,?!.])/.test(text))topics.push('nature');
  return topics;
}
function questionGuide(text,npcId){
  if(/철회|(?:공유|승인|요청|만남).{0,12}(?:취소|삭제|지우|중단)/.test(text))return {source:'seol',topic:'revoke'};
  if(/궁합.{0,12}(?:요청|승인|동의|공개)|(?:요청|승인|동의).{0,12}궁합|출생정보.{0,12}(?:공개|상대|서버)/.test(text))return {source:'seol',topic:'consent'};
  if(/궁합.{0,8}점수|점수.{0,8}궁합/.test(text))return {source:'seol',topic:'score'};
  if(/태어난\s*시간|출생\s*시간|시간.{0,8}(?:모르|몰라|모름|정확)/.test(text))return {source:'tojeong',topic:'time'};
  if(/자미두수|명반|명궁|열두\s*궁/.test(text))return {source:'luna',topic:'jami'};
  if(/서재|리포트.{0,10}(?:가격|목차|구매|상세)|유료|무료.{0,10}(?:범위|어디까지|어디)/.test(text))return {source:npcId==='tojeong'?'tojeong':'luna',topic:npcId==='tojeong'?'depth':'reading'};
  return null;
}
function prepareQuestion(value){
  if(typeof value!=='string')return null;
  const trimmed=value.trim();
  if(!trimmed||Array.from(trimmed).length>MAX_DIALOGUE_QUESTION_LENGTH)return null;
  const normalized=trimmed.normalize('NFC');
  if(privateText(normalized))return {private:true};
  const text=Array.from(clean(normalized,640)).filter(c=>{const n=c.codePointAt(0);return n<0xd800||n>0xdfff;}).join('').replace(/\s+/g,' ').trim();
  return text?{text}:null;
}
export function prepareDialogueQuestion(value){return prepareQuestion(value);}
export function normalizeDialogueAnswer(value){
  if(typeof value!=='string'||!value.trim()||Array.from(value.trim()).length>MAX_DIALOGUE_ANSWER_LENGTH)return null;
  const text=Array.from(clean(value,6400)).filter(c=>{const n=c.codePointAt(0);return n<0xd800||n>0xdfff;}).join('').trim();
  if(!text||privateText(text))return null;
  return text;
}

function normalizeInsight(raw,kind){
  if(!raw||raw.source!=='samra-engine'||raw.kind!==kind||raw.requiresTime===true||!Array.isArray(raw.sections))return null;
  const seen=new Set(),sections=[];
  for(const row of raw.sections){
    if(!row||!PERSONAL_IDS[kind]?.includes(row.id)||seen.has(row.id))continue;
    const paragraphs=(Array.isArray(row.paragraphs)?row.paragraphs:[]).map(value=>clean(value,1500)).filter(Boolean).slice(0,2);
    const title=clean(row.title,100);if(!title||!paragraphs.length)continue;
    seen.add(row.id);sections.push({id:row.id,title,paragraphs,signals:(Array.isArray(row.signals)?row.signals:[]).map(s=>({label:clean(s?.label,60),value:clean(s?.value,160)})).filter(s=>s.label&&s.value).slice(0,5)});
  }
  if(!sections.length)return null;
  return {kind,headline:clean(raw.headline,180),summary:clean(raw.summary,700),sections,notes:(Array.isArray(raw.notes)?raw.notes:[]).map(value=>clean(value,700)).filter(Boolean).slice(0,4)};
}
/** Only this projection may leave the page; raw chart/profile fields are absent. */
export function projectDialogueReading(raw,kind){
  const value=normalizeInsight(raw,kind);if(!value)return null;
  const texts=[value.headline,value.summary,...value.notes,...value.sections.flatMap(s=>[s.title,...s.paragraphs,...s.signals.flatMap(row=>[row.label,row.value])])];
  if(texts.some(privateText))return null;
  return {source:'samra-engine',...value,requiresTime:false};
}
export function projectDialogueHistory(rows){
  if(!Array.isArray(rows))return [];
  return rows.slice(-6).flatMap(row=>{
    const question=prepareQuestion(row?.question),answer=normalizeDialogueAnswer(row?.answer);
    return question?.text&&answer?[{question:question.text,answer}]:[];
  });
}
export function getNpcPersona(id){return typeof id==='string'&&Object.hasOwn(PERSONAS,id)?copy(PERSONAS[id]):null;}
export function isDialogueAction(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(key=>!['type','id','label'].includes(key)))return false;
  if(!Object.hasOwn(value,'type')||value.label!==undefined&&typeof value.label!=='string')return false;
  if(['profile','social','reset'].includes(value.type))return value.id===undefined;
  if(value.type==='reading')return READING_KINDS.has(value.id);
  return value.type==='feature'&&FEATURES.has(value.id)&&Boolean(getFeature(value.id));
}
function actionChoice(value){return {id:'action:'+value.type+(value.id?':'+value.id:''),label:value.label,action:{type:value.type,...(value.id?{id:value.id}:{})}};}

/** Prepared dialogue + local topic routing. Written text cannot execute actions. */
export function createDialogueSession(npcId,options={}){
  const npc=getNpcPersona(npcId);if(!npc)throw new TypeError('이 술사의 대화는 아직 준비되지 않았어요.');
  const nickname=Array.from(clean(options.nickname,80).replace(/\s+/g,' ')).slice(0,12).join('');
  let insight=normalizeInsight(options.insight,npc.readingKind);
  let hasProfile=options.hasProfile===true || options.hasProfile===undefined&&Boolean(insight);
  if(!hasProfile)insight=null;
  let stage='welcome',activeSection=null,guideTopic=null,guideReply=null,guideSource=npcId,clarifying=[],asked=[],messages=[],history=[],serial=0,pending=null,aiSerial=0;
  function add(role,value,extras={}){
    const {context=false,...rest}=extras,previous=messages.at(-1),replyTo=role==='npc'&&!context&&previous?.role==='user'?previous.id:null;
    const row={id:npcId+'-'+(++serial),role,text:clean(value,6400),...(replyTo?{replyTo}:{}),...rest};
    messages.push(row);messages=messages.slice(-MAX_DIALOGUE_MESSAGES);return row;
  }
  function greeting(){return(nickname?nickname+'님, ':'')+npc.greeting;}
  function orderedSections(){return ORDER[npcId].map(id=>insight?.sections.find(row=>row.id===id)).filter(Boolean).slice(0,4);}
  function readyText(){const focus=npcId==='seol'?insight.sections.find(row=>row.id==='relationship'):null;return [npc.ready,insight.headline,sentence(focus?.paragraphs[0]||insight.summary)].filter(Boolean).join('\n\n');}
  function snapshot(){return copy({stage,activeSection,guideTopic,guideReply,guideSource,clarifying,asked,messages});}
  function remember(){history.push(snapshot());history=history.slice(-MAX_BACK_STEPS);}
  function choiceRows(){
    if(pending)return [];
    const rows=[];
    if(stage==='ai'){
      for(const id of ['short','practice','basis','next'])rows.push({id:'followup:'+id,label:FOLLOWUPS[id]});
      rows.push({id:'topics',label:'다른 주제로 물어볼게요.'});
      rows.push(actionChoice(insight?reading(npc.readingKind):profileAction()));
    }else if(stage==='clarify'){
      for(const id of clarifying)rows.push({id:'ask-topic:'+id,label:ASK_TOPICS[id]});
    }else if(stage==='reading'||stage==='followup'){
      for(const id of ['short','practice','basis','next'])if(!asked.includes(id))rows.push({id:'followup:'+id,label:FOLLOWUPS[id]});
      rows.push({id:'topics',label:'다른 주제로 물어볼게요.'});
      rows.push(actionChoice(reading(npc.readingKind)));
    }else if(stage==='guide'){
      const topic=GUIDES[guideSource].find(row=>row.id===guideTopic),reply=topic?.replies.find(row=>row.id===guideReply);
      if(reply){for(const a of reply.actions.filter(isDialogueAction))rows.push(actionChoice(a));rows.push({id:'guide',label:'다른 안내도 궁금해요.'});}
      else if(topic){for(const reply of topic.replies)rows.push({id:'guide-reply:'+reply.id,label:reply.label});rows.push({id:'guide',label:'다른 안내부터 볼게요.'});}
      else for(const topic of GUIDES[npcId])rows.push({id:'guide-topic:'+topic.id,label:topic.label});
      if(insight)rows.push({id:'topics',label:'내 이야기로 돌아갈게요.'});
      else if(!hasProfile&&!reply)rows.push(actionChoice(profileAction()));
    }else if(insight){
      for(const row of orderedSections())rows.push({id:'section:'+row.id,label:QUESTIONS[npcId][row.id]||row.title});
      rows.push({id:'guide',label:'이곳을 이용하는 방법도 물어볼게요.'});
      if(npcId==='seol')rows.push(actionChoice(social()));
    }else{
      for(const topic of GUIDES[npcId])rows.push({id:'guide-topic:'+topic.id,label:topic.label});
      rows.push(actionChoice(hasProfile?reading(npc.readingKind,'전체 기본 해석부터 볼게요.'):profileAction()));
      if(npcId==='seol')rows.push(actionChoice(social()));
    }
    return rows.slice(0,6);
  }
  function view(){return {npc:copy(npc),stage,hasProfile,insightReady:Boolean(insight),prepared:true,pending:Boolean(pending),messages:copy(messages),choices:choiceRows().map(({action,...value})=>copy(value)),canBack:history.length>0,activeSection};}
  function restore(state){({stage,activeSection,guideTopic,guideReply,guideSource,clarifying,asked,messages}=copy(state));}
  function cancelPending(){if(!pending)return false;const current=pending;pending=null;restore(current.prior);history=current.priorHistory;return true;}
  function start(){pending=null;stage=insight?'topic':'welcome';activeSection=guideTopic=guideReply=null;guideSource=npcId;clarifying=[];asked=[];messages=[];history=[];add('npc',greeting());if(insight)add('npc',readyText(),{context:true});return view();}
  function answerSection(id,prefix=''){
    const row=insight?.sections.find(row=>row.id===id);if(!row)return false;
    activeSection=id;guideTopic=guideReply=null;guideSource=npcId;clarifying=[];asked=[];stage='reading';
    add('npc',[prefix,...row.paragraphs,CLOSINGS[npcId][row.id]||npc.after].filter(Boolean).join('\n\n'),{chapter:row.title,signals:copy(row.signals)});return true;
  }
  function answerGuide(source,topic,prefix=''){
    const row=GUIDES[source]?.find(row=>row.id===topic);if(!row)return false;
    stage='guide';activeSection=guideReply=null;guideSource=source;guideTopic=topic;clarifying=[];asked=[];
    const invite=!insight?'아직 개인 풀이가 준비되지 않아 이용 안내부터 드릴게요. 내 정보를 준비하면 계산된 기본 풀이로 이야기할 수 있어요.':'';
    add('npc',[prefix,invite,row.answer].filter(Boolean).join('\n\n'));return true;
  }
  function clarify(topics,prefix=''){
    stage='clarify';activeSection=guideTopic=guideReply=null;guideSource=npcId;asked=[];
    clarifying=[...new Set(topics.length?topics:ASK_DEFAULTS[npcId])].filter(id=>Object.hasOwn(ASK_TOPICS,id)).slice(0,4);
    const invite=!insight?'아직 내 기본 풀이가 없으니, 지금은 이용 방법을 이야기할게요. 내 정보에서 출생정보를 준비할 수 있어요.':'';
    add('npc',[prefix,ASK_CLARIFY[npcId],invite].filter(Boolean).join('\n\n'));
  }
  function answerTopic(category,text='',prefix=''){
    const ids={nature:['nature'],relationship:['relationship'],flow:['flow'],recovery:['emotion','balance'],practice:npc.readingKind==='saju'?['direction']:['practice']}[category]||[];
    const row=ids.map(id=>insight?.sections.find(s=>s.id===id)).find(Boolean);
    if(row){
      let scope='';
      if(category==='relationship')scope='상대의 마음이나 두 사람의 점수 대신, 내 쪽의 관계 반응을 살펴볼게요.';
      else if(category==='recovery'&&row.id==='balance'&&npc.readingKind==='star')scope='준비된 풀이에는 정확한 달의 반응 해석이 없어, 대신 계산된 기질의 균형을 살펴볼게요.';
      else if(category==='flow'&&/(?:\d{4}\s*년|올해|내년|직장|직업|이직|취업|돈|금전|재물|복권|로또|당첨)/.test(text))scope='아래는 현재 준비된 대운의 큰 흐름이에요. 질문하신 해의 사건이나 직장·수입의 결과를 따로 예측한 답은 아니에요.';
      return answerSection(row.id,[prefix,scope].filter(Boolean).join('\n\n'));
    }
    let source=npcId,topic='',scope='';
    if(category==='relationship'){source='seol';topic='self';if(insight)scope='지금 준비된 사주에는 관계 반응을 따로 읽은 항목이 없어요. 두 사람의 궁합을 추측하지 않고, 관계 풀이를 시작하는 방법부터 안내할게요.';}
    else if(category==='flow'){source='tojeong';topic='flow';if(insight)scope='현재 별자리 기본 풀이는 기질과 관계를 읽는 범위예요. 특정 해의 흐름을 따로 계산한 답이 없어, 흐름 풀이를 읽는 방법부터 안내할게요.';}
    else if(category==='nature'){source=npcId;topic=npcId==='tojeong'?'first':npcId==='seol'?'self':'sky';}
    else {source='luna';topic='practice';if(insight)scope='이 주제의 개인 해석 항목은 아직 없어요. 내 성향을 덧붙여 추측하지 않고, 풀이를 일상에 대조하는 방법부터 이야기할게요.';}
    return answerGuide(source,topic,[prefix,scope].filter(Boolean).join('\n\n'));
  }
  function followup(id){
    const row=insight?.sections.find(row=>row.id===activeSection);if(!row)return false;
    asked.push(id);stage='followup';
    if(id==='short')add('npc',npc.shortLead+'\n\n'+sentence(row.paragraphs[0]),{chapter:row.title});
    else if(id==='basis'){
      const evidence=row.signals.map(s=>s.label+': '+s.value).join('\n');
      add('npc',[npc.basisLead,evidence||'이 주제에 대해 계산된 기본 풀이의 문장을 읽었어요.',...insight.notes].filter(Boolean).join('\n\n'),{chapter:row.title,signals:copy(row.signals)});
    }else if(id==='practice'){
      const usable=row.paragraphs.find(p=>/보세요|해보|좋아요|루틴|정돈|연습|실행/.test(p)) || insight.sections.find(s=>s.id==='practice')?.paragraphs.at(-1);
      const quote=usable||sentence(row.paragraphs.at(-1));
      add('npc',[npc.practiceLead,quote,usable?'이 중 지금 해볼 수 있는 한 가지를 골라보세요.':'이 말과 닮았던 장면 하나, 다르게 느껴진 장면 하나를 떠올려보세요. 풀이를 내 경험과 대조하는 작은 연습이에요.'].filter(Boolean).join('\n\n'),{chapter:row.title});
    }else if(id==='next'){
      const rows=orderedSections(),index=rows.findIndex(s=>s.id===activeSection),next=rows[(index+1)%rows.length];
      if(!next||next.id===activeSection)add('npc',npc.topicPrompt);
      else answerSection(next.id);
    }else return false;
    return true;
  }
  start();
  return {
    view,
    getAiContext(){
      const answers=messages.filter(row=>row.role==='npc'&&row.replyTo),pairs=[];
      for(const row of answers){
        const user=messages.find(item=>item.id===row.replyTo&&item.role==='user');
        if(!user||user.id===pending?.userId||user.text==='[개인정보가 포함된 질문]')continue;
        const answer=Array.from(row.text).slice(0,MAX_DIALOGUE_ANSWER_LENGTH).join('');pairs.push({question:user.text,answer});
      }
      const reading=insight?projectDialogueReading({source:'samra-engine',...insight,requiresTime:false},npc.readingKind):null;
      return {npc:npcId,history:projectDialogueHistory(pairs),reading};
    },
    beginAiQuestion(value,metadata={}){
      if(pending)return {accepted:false,view:view()};
      const question=prepareQuestion(value);if(!question)return {accepted:false,view:view()};
      if(question.private){
        remember();add('user','[개인정보가 포함된 질문]');
        clarify([],'개인정보 원문은 대화에 남기지 않을게요. 출생정보는 내 정보에서 준비하고, 여기에는 궁금한 주제만 적어주세요.');
        return {accepted:true,view:view()};
      }
      const prior=snapshot(),priorHistory=history.slice(),choice=choiceRows().find(row=>row.id===metadata?.choiceId&&!row.action&&row.label===question.text);
      remember();const user=add('user',question.text),ticket=Object.freeze({id:npcId+'-ai-'+(++aiSerial)});
      pending={ticket,question:question.text,userId:user.id,prior,priorHistory,choiceId:choice?.id};
      return {accepted:true,question:question.text,ticket,view:view()};
    },
    resolveAiQuestion(ticket,value,metadata={}){
      if(!pending||pending.ticket!==ticket)return {accepted:false,view:view()};
      const answer=normalizeDialogueAnswer(value);if(!answer)return {accepted:false,view:view()};
      const current=pending;pending=null;
      stage='ai';guideTopic=guideReply=null;guideSource=npcId;clarifying=[];asked=[];
      if(current.choiceId?.startsWith('section:'))activeSection=current.choiceId.slice(8);
      add('npc',answer,{replyTo:current.userId,source:'gemini',...(metadata?.model==='gemini-3.5-flash-lite'?{model:metadata.model}:{})});
      return {accepted:true,view:view()};
    },
    rejectAiQuestion(ticket){
      if(!pending||pending.ticket!==ticket)return {accepted:false,view:view()};
      cancelPending();return {accepted:true,view:view()};
    },
    ask(value){
      if(pending)return {accepted:false,view:view()};
      const question=prepareQuestion(value);if(!question)return {accepted:false,view:view()};
      remember();
      if(question.private){
        add('user','[개인정보가 포함된 질문]');
        clarify([],'개인정보 원문은 대화에 남기지 않을게요. 출생정보는 내 정보에서 준비하고, 여기에는 궁금한 주제만 적어주세요.');
      }else{
        const text=question.text;add('user',text);
        const prefix=CERTAIN_QUESTION.test(text)?ASK_LIMIT[npcId]:'',guide=questionGuide(text,npcId),topics=questionTopics(text);
        if(guide)answerGuide(guide.source,guide.topic,prefix);
        else if(topics.length===1)answerTopic(topics[0],text,prefix);
        else clarify(topics,prefix);
      }
      return {accepted:true,view:view()};
    },
    choose(id){
      if(pending||typeof id!=='string')return {accepted:false,view:view()};
      const choice=choiceRows().find(row=>row.id===id);if(!choice)return {accepted:false,view:view()};
      remember();add('user',choice.label);
      if(choice.action){
        if(!isDialogueAction(choice.action))return {accepted:false,view:view()};
        return {accepted:true,action:copy(choice.action),view:view()};
      }
      if(id==='guide'){stage='guide';guideTopic=guideReply=null;guideSource=npcId;clarifying=[];add('npc',npc.guidePrompt);}
      else if(id==='topics'){stage=insight?'topic':'welcome';activeSection=guideTopic=guideReply=null;guideSource=npcId;clarifying=[];asked=[];add('npc',insight?npc.topicPrompt:npc.guidePrompt);}
      else if(id.startsWith('ask-topic:'))answerTopic(id.slice(10));
      else if(id.startsWith('section:'))answerSection(id.slice(8));
      else if(id.startsWith('followup:')){if(!followup(id.slice(9)))clarify([],'내 기본 풀이가 준비되면 해당 내용을 더 짚어볼 수 있어요. 지금은 궁금한 주제부터 골라주세요.');}
      else if(id.startsWith('guide-topic:')){guideTopic=id.slice(12);guideReply=null;guideSource=npcId;clarifying=[];stage='guide';add('npc',GUIDES[npcId].find(row=>row.id===guideTopic).answer);}
      else if(id.startsWith('guide-reply:')){guideReply=id.slice(12);const row=GUIDES[guideSource].find(row=>row.id===guideTopic).replies.find(row=>row.id===guideReply);add('npc',row.text);}
      return {accepted:true,view:view()};
    },
    setInsight(value){
      const next=normalizeInsight(value,npc.readingKind);
      if(JSON.stringify(next)===JSON.stringify(insight))return view();
      const replacing=Boolean(insight);insight=next;if(replacing||!next)history=[];
      if(!next){start();return view();}
      hasProfile=true;
      if(replacing){start();return view();}
      if(stage==='welcome')stage='topic';const ready=add('npc',readyText(),{context:true});
      if(pending){
        if(pending.prior.stage==='welcome')pending.prior.stage='topic';
        pending.prior.messages=[...pending.prior.messages,copy(ready)].slice(-MAX_DIALOGUE_MESSAGES);
        history[history.length-1]=copy(pending.prior);
      }
      return view();
    },
    reset(){return start();},
    back(){if(cancelPending())return true;const prior=history.pop();if(!prior)return false;restore(prior);return true;},
  };
}
