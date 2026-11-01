// App-shared representative art: IljuMulsangArt.kt and scripts/generated/seo/ilju.json.
import { ILJU_ROOMS, roomForKey } from './ilju-room-core.js?v=20261101-freepath4';

// Keep these local paths aligned with the generated public art index.
const MURALS = Object.freeze({
  '甲子': ['gapja', '물 위의 큰 나무'],
  '甲寅': ['gapin', '숲 속의 큰 나무'],
  '甲辰': ['gapjin', '물기 있는 옥토의 거목'],
  '甲午': ['gapo', '한낮의 큰 나무'],
  '甲申': ['gapsin', '쇠 아래의 거목'],
  '甲戌': ['gapsul', '마른 땅의 큰 나무'],
  '乙丑': ['eulchuk', '찬 땅 위의 풀'],
  '乙卯': ['eulmyo', '봄 들판의 새순'],
  '乙巳': ['eulsa', '햇살 아래 꽃핀 풀'],
  '乙未': ['eulmi', '여름 들판의 풀'],
  '乙酉': ['eulyu', '쇠 앞의 꽃'],
  '乙亥': ['eulhae', '물가의 부드러운 풀'],
  '丙子': ['byeongja', '물 위에 비친 태양'],
  '丙寅': ['byeongin', '큰 나무를 태우는 불'],
  '丙辰': ['byeongjin', '옥토 위의 태양'],
  '丙午': ['byeongo', '한낮의 태양'],
  '丙申': ['byeongsin', '쇠를 녹이는 태양'],
  '丙戌': ['byeongsul', '산 너머로 지는 태양'],
  '丁丑': ['jeongchuk', '어두운 땅의 등불'],
  '丁卯': ['jeongmyo', '꽃 옆의 등불'],
  '丁巳': ['jeongsa', '쌍 등불'],
  '丁未': ['jeongmi', '여름밤의 등불'],
  '丁酉': ['jeongyu', '보석 위의 등불'],
  '丁亥': ['jeonghae', '물 위에 비친 등불'],
  '戊子': ['muja', '물가의 큰 산'],
  '戊寅': ['muin', '큰 나무 옆의 산'],
  '戊辰': ['mujin', '물 머금은 큰 산'],
  '戊午': ['muo', '한낮의 큰 산'],
  '戊申': ['musin', '쇠광맥 있는 산'],
  '戊戌': ['musul', '마른 큰 산'],
  '己丑': ['gichuk', '찬 들판의 옥토'],
  '己卯': ['gimyo', '꽃밭의 들판'],
  '己巳': ['gisa', '여름 들판'],
  '己未': ['gimi', '여름 옥토'],
  '己酉': ['giyu', '보석 들판'],
  '己亥': ['gihae', '물가의 들판'],
  '庚子': ['gyeongja', '물에 잠긴 도끼'],
  '庚寅': ['gyeongin', '큰 나무 가르는 도끼'],
  '庚辰': ['gyeongjin', '옥토 속의 쇠'],
  '庚午': ['gyeongo', '용광로 속의 쇠'],
  '庚申': ['gyeongsin', '쌍 도끼'],
  '庚戌': ['gyeongsul', '마른 산의 쇠'],
  '辛丑': ['sinchuk', '땅에 묻힌 보석'],
  '辛卯': ['sinmyo', '꽃 위의 보석'],
  '辛巳': ['sinsa', '햇빛의 보석'],
  '辛未': ['sinmi', '여름 땅의 보석'],
  '辛酉': ['sinyu', '쌍 보석'],
  '辛亥': ['sinhae', '물에 씻긴 보석'],
  '壬子': ['imja', '큰 바다'],
  '壬寅': ['imin', '큰 나무 적시는 강'],
  '壬辰': ['imjin', '옥토를 적시는 큰 물'],
  '壬午': ['imo', '한낮의 큰 강'],
  '壬申': ['imsin', '쇠광맥의 큰 물'],
  '壬戌': ['imsul', '마른 땅에 흐르는 강'],
  '癸丑': ['gyechuk', '찬 땅의 옹달샘'],
  '癸卯': ['gyemyo', '봄바람의 새순'],
  '癸巳': ['gyesa', '햇빛의 옹달샘'],
  '癸未': ['gyemi', '여름 옥토의 비'],
  '癸酉': ['gyeyu', '보석 위의 이슬'],
  '癸亥': ['gyehae', '큰 바다의 깊은 물'],
});

const ACCENTS = Object.freeze({ 목: '#779777', 화: '#c68d74', 토: '#b29a6c', 금: '#b7b4a6', 수: '#718e9d' });
const interiors = new Map(ILJU_ROOMS.map(room => {
  const [slug, title] = MURALS[room.ganzi];
  return [room.key, Object.freeze({
    room,
    mural: Object.freeze({
      src: `/assets/art/ilju/${slug}.webp`,
      alt: `${room.ilju}일주를 상징하는 물상 벽화`,
      title,
      width: 960,
      height: 717,
    }),
    accent: ACCENTS[room.element],
    description: `${room.ilju}의 물상을 마주하고, 같은 일주의 나그네와 쉬어 가는 방입니다.`,
  })];
}));

/** Public room keys select approved app art; user input never becomes an asset path. */
export function interiorForRoom(key) {
  const room = roomForKey(key);
  return room?.ilju ? interiors.get(room.key) || null : null;
}

export function interiorViewPose({width = 1280, height = 720, mode = 'overview'} = {}) {
  const aspect = Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0 ? width / height : 16 / 9;
  const portrait = aspect < .85, scale = portrait ? Math.max(1, (390 / 844) / aspect) : 1;
  return {
    position: mode === 'mural' ? [0, 4.15, portrait ? 6 * scale : -2.2] : [0, portrait ? 6.6 : 5.8, portrait ? 29 * scale : 20],
    target: mode === 'mural' ? [0, 4.1, -11.5] : [0, 2.2, -2.1],
    fov: portrait ? 62 : 48,
  };
}

// Arrival callbacks run before the movement controller's final avatar update.
// Apply the resting pose after that update so its last walking step cannot undo it.
export function applyInteriorSeat(avatar, seat) {
  if (!seat) return false;
  avatar.group.rotation.y = seat.heading;
  if (!avatar.getSeated?.()) avatar.setSeated?.(true, seat.surfaceY ?? .17);
  return avatar.getSeated?.() === true;
}
