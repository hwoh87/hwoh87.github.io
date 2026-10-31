const STEMS='갑을병정무기경신임계',BRANCHES='자축인묘진사오미신유술해';
const HAN_STEMS='甲乙丙丁戊己庚辛壬癸',HAN_BRANCHES='子丑寅卯辰巳午未申酉戌亥';
export const CULTURE_ROLES=Object.freeze([
  {id:'all',label:'전체'}, {id:'idol',label:'아이돌'}, {id:'actor',label:'배우'},
  {id:'music',label:'가수·음악인'}, {id:'screen',label:'방송·코미디'}, {id:'creator',label:'크리에이터'},
]);
export const CULTURE_TOPICS=Object.freeze([{id:'all',label:'전체 읽기'},{id:'people',label:'인물 풀이'},{id:'guides',label:'사주 입문'}]);
const ROLE_WORDS={idol:/아이돌/,actor:/배우/,music:/가수|래퍼|음악|싱어송라이터|작곡/,screen:/방송|진행|코미디|희극/,creator:/유튜버|크리에이터|vlogger/i};
const FEATURED_IDS=[63,12,45,49,66,30];
function words(value){return String(value||'').normalize('NFKC').toLocaleLowerCase('ko-KR').trim().split(/\s+/).filter(Boolean);}
export function cultureMatches(text,query){const haystack=words(text).join(' ');return words(query).every(word=>haystack.includes(word));}
export function normalizeCultureDayPillar(value){
  if(typeof value!=='string')return null;
  const input=value.normalize('NFKC').replace(/\s|일주/g,'');
  for(let index=0;index<60;index++){
    const korean=STEMS[index%10]+BRANCHES[index%12];
    if(input===korean||input===HAN_STEMS[index%10]+HAN_BRANCHES[index%12])return korean+'일주';
  }
  return null;
}
export function culturePath(raw){
  if(typeof raw!=='string')return null;
  return /^\/m\/[1-9]\d*\/$/.test(raw)||/^\/learn\/(?:read-chart|five-elements|ten-gods|unknown-birth-time|luck-cycles|combinations|twelve-stages)\/$/.test(raw)?raw:null;
}
export function selectCulturePeople(people,{query='',role='all',element='',dayPillar='',sort='recommended'}={}){
  const day=normalizeCultureDayPillar(dayPillar);
  const result=people.filter(person=>cultureMatches([person.name,person.search,person.occupation,person.dayPillar,person.birth].join(' '),query)
    &&(!ROLE_WORDS[role]||ROLE_WORDS[role].test(person.occupation))
    &&(!element||person.element===element)&&(!day||normalizeCultureDayPillar(person.dayPillar)===day));
  return result.slice().sort((a,b)=>{
    if(sort==='name')return a.name.localeCompare(b.name,'ko-KR')||a.id-b.id;
    const ai=FEATURED_IDS.indexOf(a.id),bi=FEATURED_IDS.indexOf(b.id);
    return(ai<0?1000:ai)-(bi<0?1000:bi)||a.name.localeCompare(b.name,'ko-KR')||a.id-b.id;
  });
}
export function selectCultureArticles(data,{query='',topic='all'}={}){
  const guides=data.articles.map(article=>({...article,kind:'guide'}));
  const people=selectCulturePeople(data.people).map(person=>({...person,kind:'person',topic:'인물 풀이'}));
  return(topic==='guides'?guides:topic==='people'?people:[...guides.slice(0,3),...people,...guides.slice(3)])
    .filter(article=>cultureMatches([article.name,article.title,article.summary,article.topic,article.occupation,article.search].join(' '),query));
}
export function featuredCulturePeople(people,count=3){return FEATURED_IDS.map(id=>people.find(person=>person.id===id)).filter(Boolean).slice(0,count);}
export function validateCultureData(data){
  if(!data||data.version!==1||!Array.isArray(data.people)||!Array.isArray(data.articles)||data.people.length>10000||data.articles.length>100)return false;
  const ids=new Set(),paths=new Set();
  for(const person of data.people){
    if(!person||!Number.isSafeInteger(person.id)||person.id<=0||ids.has(person.id)||person.path!==`/m/${person.id}/`||!culturePath(person.path))return false;
    if(!['name','title','summary','birth','scope','occupation','search'].every(key=>typeof person[key]==='string'&&person[key].length<5000))return false;
    if(person.birthNote!==undefined&&(typeof person.birthNote!=='string'||person.birthNote.length>3000))return false;
    if(!normalizeCultureDayPillar(person.dayPillar)||!['木','火','土','金','水'].includes(person.element))return false;
    if(!/^\/assets\/art\/ilju\/[a-z]+@t\.webp$/.test(person.image)||!/^\/ilju\/[a-z]+\/$/.test(person.iljuPath))return false;
    if(!Array.isArray(person.sources)||person.sources.some(source=>{try{const url=new URL(source.url);return url.protocol!=='https:'||Boolean(url.username||url.password)||typeof source.label!=='string';}catch(_){return true;}}))return false;
    ids.add(person.id);paths.add(person.path);
  }
  for(const article of data.articles){
    if(!article||!culturePath(article.path)||!article.path.startsWith('/learn/')||paths.has(article.path)||!['title','summary','topic','category'].every(key=>typeof article[key]==='string'))return false;
    paths.add(article.path);
  }
  return data.people.length>0&&data.articles.length>0;
}
