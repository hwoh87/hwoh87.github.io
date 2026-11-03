export const WALK_STOPS=Object.freeze([
  {id:'breath',title:'연못 옆 숨고르기',text:'물결을 보며 잠깐 쉬어요. 마음 고르기에서 짧은 호흡을 따라갈 수 있어요.'},
  {id:'myeongri',title:'나를 읽는 명리전',text:'토정이 원국·오행과 생활 속 의미를 풀어줘요. 기본 사주 해석은 무료예요.'},
  {id:'inyeon',title:'서로를 알아가는 인연정',text:'알고 있는 두 사람을 직접 입력하거나, 만난 나그네에게 궁합을 청해요. 상대의 승인이 필요해요.'},
  {id:'stars',title:'태어난 하늘, 별마루',text:'별자리와 자미두수를 펼쳐요. 태어난 시간이 없다면 확인 가능한 범위부터 읽어요.'},
  {id:'archive',title:'이야기가 쌓이는 서고',text:'삼라 매거진에서 사주 개념과 삶의 이야기를 읽고, 마음에 든 글은 저장해요.'},
  {id:'celeb',title:'연예인 사주관',text:'공개된 출생 자료로 인물의 명식을 읽어요. 태어난 시각이 알려지지 않은 경우는 따로 안내해요.'},
  {id:'rooms',title:'같은 일주가 만나는 마당',text:'60일주방의 벽화와 자리를 둘러봐요. 내 일주를 알면 같은 방으로 쉽게 찾아갈 수 있어요.'},
  {id:'wish',title:'바람을 남기는 소원당',text:'마지막은 나를 위한 작은 바람. 글을 남기면 이 브라우저에만 보관돼요.'},
]);

/** Arrival callbacks belong to one tour generation; stale callbacks cannot restart it. */
export function createGuidedWalk({stops=WALK_STOPS,travel,onState=()=>{},onVisit=()=>{},schedule=setTimeout,unschedule=clearTimeout,pauseMs=5000}){
  let generation=0,index=-1,phase='idle',timer=null;
  const snapshot=()=>({phase,index,total:stops.length,stop:stops[index]||null});
  const emit=()=>onState(snapshot());
  function stop(){generation++;if(timer!==null)unschedule(timer);timer=null;phase='idle';emit();}
  function next(version){
    if(version!==generation)return;
    index++;
    if(index>=stops.length){phase='complete';emit();return;}
    phase='walking';emit();let arrived=false;
    const accepted=travel(stops[index],()=>{
      if(version!==generation||arrived||phase!=='walking')return;arrived=true;phase='resting';onVisit(stops[index]);emit();
      timer=schedule(()=>{timer=null;next(version);},pauseMs);
    });
    if(accepted===false&&version===generation){phase='unavailable';emit();generation++;}
  }
  return {start(){stop();index=-1;const version=++generation;next(version);},stop,getState:snapshot};
}
