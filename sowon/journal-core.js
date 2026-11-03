export const JOURNAL_KEY='samra.sowon.journal.v1';
export const PLACES=Object.freeze({breath:'마음 고르기',myeongri:'명리전',inyeon:'인연정',stars:'별마루',archive:'서고',celeb:'연예인 사주관',rooms:'일주방 앞마당',wish:'소원당'});
export const ACTIONS=Object.freeze({...Object.fromEntries(Object.entries(PLACES).map(([id,label])=>['visit:'+id,label])),wardrobe:'나그네 꾸미기',photo:'사진 카드 남기기',video:'산책 영상 남기기',breath:'네 번의 호흡',rest:'풍경과 쉬어가기',release:'가볍게 내려놓기',knowledge:'명리 한 걸음','reading:saju':'나의 사주 펼치기','reading:jami':'자미두수 펼치기','reading:star':'태어난 하늘 펼치기',article:'매거진 글 펼치기',celebrity:'인물 풀이 펼치기',room:'일주방에 머물기'});
export function koreaDay(time=Date.now()) {const n=Number(time);return Number.isFinite(n)&&n>=0&&n<=8639999967600000?new Date(n+32400000).toISOString().slice(0,10):'';}
export function normalizeJournal(value,now=Date.now()) {
  const rows={};if(value?.version!==1||!value.rows||typeof value.rows!=='object')return {version:1,rows};
  for(const id of Object.keys(ACTIONS)){const row=value.rows[id];if(!row||typeof row!=='object')continue;const first=Number(row.first),last=Number(row.last),count=Number(row.count);if(!Number.isFinite(first)||!Number.isFinite(last)||first<1||last<first||last>now+86400000||!Number.isInteger(count)||count<1)continue;rows[id]={first,last,count:Math.min(999,count)};}
  return {version:1,rows};
}
export function recordJourney(value,id,now=Date.now()) {
  const journal=normalizeJournal(value,now);if(!Object.hasOwn(ACTIONS,id)||!Number.isFinite(now)||now<1)return journal;
  const old=journal.rows[id];if(old&&koreaDay(old.last)===koreaDay(now))return journal;
  journal.rows[id]={first:old?.first||now,last:now,count:Math.min(999,(old?.count||0)+1)};return journal;
}
export function readJournal(storage,now=Date.now()){try{return normalizeJournal(JSON.parse(storage?.getItem(JOURNAL_KEY)||'null'),now);}catch{return normalizeJournal(null,now);}}
export function writeJournal(storage,value){try{storage?.setItem(JOURNAL_KEY,JSON.stringify(normalizeJournal(value)));return !!storage;}catch{return false;}}
export function journalSummary(value,now=Date.now()) {
  const journal=normalizeJournal(value,now),rows=journal.rows,places=Object.keys(PLACES).filter(id=>rows['visit:'+id]);
  const tasks=[{id:'wardrobe',title:'나를 닮은 모습 고르기',action:'wardrobe'},{id:'reading:saju',title:'명리전에서 나의 구조 읽기',action:'myeongri'},{id:'knowledge',title:'명리 한 걸음 풀어보기',action:'knowledge'},{id:'room',title:'일주방 풍경 둘러보기',action:'rooms'},{id:'photo',title:'오늘의 풍경 카드 남기기',action:'photo'}].map(task=>({...task,done:!!rows[task.id]}));
  return {places,tasks,today:Object.entries(rows).filter(([,row])=>koreaDay(row.last)===koreaDay(now)).length,recent:Object.entries(rows).sort((a,b)=>b[1].last-a[1].last).slice(0,8).map(([id,row])=>({id,label:ACTIONS[id],...row}))};
}
