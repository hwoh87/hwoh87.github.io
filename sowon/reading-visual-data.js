/** View-only projections of canonical calculation output. No birth input or scores are made here. */
const ELEMENTS = Object.freeze({木:'목(木)',火:'화(火)',土:'토(土)',金:'금(金)',水:'수(水)'});
const GROUPS = Object.freeze({비견:'비겁',겁재:'비겁',식신:'식상',상관:'식상',편재:'재성',정재:'재성',편관:'관성',정관:'관성',편인:'인성',정인:'인성'});
const STEMS = '甲乙丙丁戊己庚辛壬癸', BRANCHES = '子丑寅卯辰巳午未申酉戌亥';
const HUAS = Object.freeze({化祿:'화록',化權:'화권',化科:'화과',化忌:'화기'});
const clean = value => typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g,'').trim() : '';
const list = value => Array.isArray(value) ? value : [];
const amount = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
const lookup = (map,key,fallback='') => Object.hasOwn(map,key) ? map[key] : fallback;
const rounded = value => Math.round(value * 10) / 10;
const join = parts => parts.filter(Boolean).join(' · ');
const chart = (id,type,title,items,extra={}) => ({id,type,title,...extra,items});
const distribution = (id,title,items,extra={}) => items.length && items.every(item=>amount(item.value)!==null) && items.some(item=>item.value>0)
  ? chart(id,'distribution',title,items,extra) : null;

export function buildSajuVisuals(c={},t={},options={}) {
  const unknown=options.unknown===true||c.unknownTime===true||t.unknownTime===true;
  const slots=[['time','시주'],['day','일주'],['month','월주'],['year','연주']].filter(([key])=>key!=='time'||!unknown);
  const pillars=slots.map(([key,label])=>({key,label,row:c.pillars?.[key]}));
  const known=pillars.filter(({row})=>clean(row?.ganzi).length===2);
  const visuals=[];
  if(known.length)visuals.push(chart('pillars','pillars','나를 이루는 사주 원국',known.map(({key,label,row})=>({
    label,stem:row.ganzi[0],branch:row.ganzi[1],stemElement:Object.hasOwn(ELEMENTS,row.stemEl)?row.stemEl:'',branchElement:Object.hasOwn(ELEMENTS,row.branchEl)?row.branchEl:'',
    subtitle:join([clean(row.stemKr)+clean(row.branchKr),clean(row.stemSipsin),clean(row.branchSipsin)]),active:key==='day',
  })),{kicker:unknown?'세 기둥의 구조':'네 기둥의 구조',description:'일주의 위 글자, 일간을 나의 기준으로 읽어요.',note:unknown?'출생시간을 몰라 시주는 표시하지 않았어요.':'왼쪽부터 시주·일주·월주·연주예요. 각 칸은 천간과 지지로 이루어져요.'}));
  const elements=Object.entries(ELEMENTS).map(([key,label])=>({key,label,value:amount(t.elements?.[key])}));
  const elementChart=distribution('elements','오행의 에너지 분포',elements,{kicker:'다섯 기운의 비중',variant:'elements',unit:'가중치',description:'목·화·토·금·수가 명식에서 차지하는 비중을 비교해요.',note:'앱과 같은 지장간 포함 오행 가중치예요. 비중은 능력이나 운의 점수가 아니에요.'});
  if(elementChart)visuals.push(elementChart);
  // These are counts of the exposed characters, separate from the weighted elements above.
  const letters=known.flatMap(({row})=>[row.ganzi[0],row.ganzi[1]]);
  if(known.length===slots.length && letters.every((letter,index)=>(index%2===0?STEMS:BRANCHES).includes(letter))){
    let yang=0,yin=0;
    letters.forEach((letter,index)=>{const position=(index%2===0?STEMS:BRANCHES).indexOf(letter);if(position%2===0)yang++;else yin++;});
    visuals.push(distribution('polarity','음과 양의 리듬',[{key:'yang',label:'양(陽)',value:yang},{key:'yin',label:'음(陰)',value:yin}],{kicker:'드러난 글자의 음양',variant:'polarity',unit:'개',description:'움직여 꺼내는 양과, 받아들이며 다듬는 음을 나란히 봐요.',note:`원국의 천간·지지 ${letters.length}글자를 같은 비중으로 센 값이에요. ${unknown?'시간 모름으로 시주 두 글자는 제외했어요.':'오행의 지장간 가중 집계와는 기준이 달라요.'}`}));
  }
  const gods=known.flatMap(({key,row})=>key==='day'?[clean(row.branchSipsin)]:[clean(row.stemSipsin),clean(row.branchSipsin)]);
  if(known.length===slots.length && gods.length===slots.length*2-1 && gods.every(god=>Object.hasOwn(GROUPS,god))){
    const counts=Object.fromEntries(['비겁','식상','재성','관성','인성'].map(key=>[key,0]));
    gods.forEach(god=>counts[GROUPS[god]]++);
    visuals.push(distribution('gods','십신으로 보는 힘의 쓰임',Object.entries(counts).map(([key,value])=>({key,label:key,value})),{kicker:'다섯 관계의 언어',variant:'gods',unit:'개',description:'자기 기준·표현·자원·책임·배움이 어디에 나타나는지 읽어요.',note:`일간 본원을 제외한 천간과 지지 정기의 십신 ${gods.length}자리를 센 값이에요. 지장간 전체나 월주 가중치를 합산한 분포는 아니에요.`}));
  }
  const help=amount(t.strength?.help),weaken=amount(t.strength?.weaken);
  if(help!==null&&weaken!==null&&help+weaken>0)visuals.push(chart('strength','balance','도움을 받는 힘, 밖으로 쓰는 힘',[
    {key:'help',label:'나를 돕는 힘',value:rounded(help*100/(help+weaken))},
    {key:'weaken',label:'밖으로 쓰는 힘',value:rounded(weaken*100/(help+weaken))},
  ],{kicker:'기운의 균형',unit:'%',description:clean(t.strength?.label),note:'앱의 강약 분석에서 월주의 비중을 더한 생조·설극 값을 비율로 비교했어요. 좋고 나쁨이나 성취를 매긴 점수가 아니에요.'}));
  const periods=list(c.daewoon).filter(row=>Number.isInteger(row?.startYear)&&clean(row.ganzi)).map(row=>({...row})).sort((a,b)=>a.startYear-b.startYear);
  if(periods.length){
    const year=Number.isInteger(options.year)?options.year:null;
    const index=year===null?-1:periods.findLastIndex(row=>row.startYear<=year);
    const active=index>=0&&year<(periods[index+1]?.startYear??periods[index].startYear+10)?index:-1;
    const start=active<0?0:Math.max(0,active-1),end=active<0?Math.min(periods.length,6):Math.min(periods.length,active+4);
    visuals.push(chart('daewoon','timeline','긴 시간 속에서 보는 대운',periods.slice(start,end).map((row,offset)=>{
      const absolute=start+offset,next=periods[absolute+1],endYear=(next?.startYear??row.startYear+10)-1;
      return {label:clean(row.ganzi),detail:join([`${row.startYear}–${endYear}년`,clean(row.stemSipsin)]),tag:absolute===active?'현재 대운':year!==null&&row.startYear>year?'다가올 흐름':year!==null?'지나온 흐름':'',active:absolute===active};
    }),{kicker:year===null?'계산된 대운 순서':`${year}년 기준`,description:'약 10년 단위로 바뀌는 긴 배경을 살펴요.',note:unknown?'정오를 대신 사용한 대운 시작 연도예요. 실제 출생시간에 따라 경계가 달라질 수 있어요.':'계산된 시작 연도를 기준으로 나눈 구간이에요. 사건이나 행운의 크기를 점수로 만들지 않았어요.'}));
  }
  return visuals.filter(Boolean);
}

export function buildStarVisuals(c={},t={},options={}) {
  const unknown=options.unknown===true||c.unknownTime===true||t.unknownTime===true,visuals=[];
  const uncertain=unknown?'시간 모름은 정오 대체 배치의 집계예요. 당일 달의 별자리 이동에 따라 분포가 달라질 수 있어요. ':'';
  const elements=list(t.elementBalance).filter(row=>clean(row?.label)).map(row=>({key:lookup({불:'fire',흙:'earth',공기:'air',물:'water'},row.label,clean(row.label)),label:clean(row.label),value:amount(row.count)}));
  const elementChart=distribution('star-elements','네 원소로 보는 기본 기질',elements,{kicker:'태어난 하늘의 원소',variant:'elements',unit:'개',description:'불·흙·공기·물이 행성 배치에 얼마나 나타나는지 비교해요.',note:uncertain+'앱이 집계한 행성의 별자리 원소 개수예요. 성격이나 능력에 매긴 점수가 아니에요.'});
  if(elementChart)visuals.push(elementChart);
  const modes=list(t.modalityBalance).filter(row=>clean(row?.label)).map(row=>({key:lookup({기본궁:'cardinal',고정궁:'fixed',변동궁:'mutable'},row.label,clean(row.label)),label:clean(row.label),value:amount(row.count)}));
  const modeChart=distribution('star-modality','시작하고, 지키고, 바꾸는 방식',modes,{kicker:'움직임의 세 리듬',variant:'modality',unit:'개',description:'기본궁은 시작, 고정궁은 유지, 변동궁은 적응의 방식을 읽어요.',note:uncertain+'앱과 같은 기본궁·고정궁·변동궁 집계예요. 세 방식은 우열을 뜻하지 않아요.'});
  if(modeChart)visuals.push(modeChart);
  const included=new Set(['태양','달','수성','금성','화성','목성','토성','천왕성','해왕성','명왕성','키론']);
  const placements=list(c.planets).filter(row=>included.has(clean(row?.ko))&&clean(row.signKo)&&(!unknown||row.ko!=='달')).map(row=>({
    label:clean(row.ko),value:join([clean(row.signSymbol),clean(row.signKo)]),
    detail:join([clean(row.degreeLabel),!unknown&&Number.isInteger(row.house)&&row.house>=1&&row.house<=12?`${row.house}하우스`:'']),
    tags:row.isRetrograde===true?['역행']:[],
  }));
  if(!unknown&&clean(c.angles?.asc?.signKo))placements.push({label:'상승궁',value:join([clean(c.angles.asc.signSymbol),clean(c.angles.asc.signKo)]),detail:clean(c.angles.asc.degreeLabel),tags:['첫인상·접점']});
  if(placements.length)visuals.push(chart('star-placements','placements','행성이 머무는 자리',placements,{kicker:unknown?'정오 대체 행성 배치':'출생 차트의 배치',description:'행성은 마음의 주제, 별자리는 그 주제를 표현하는 방식을 읽어요.',note:unknown?'출생시간을 몰라 달·상승궁·하우스·행운점은 표시하지 않았어요. 나머지 행성도 정오를 대신 사용한 위치예요.':'행성의 별자리와 각도·하우스는 입력한 출생시각과 장소를 기준으로 계산했어요.'}));
  return visuals;
}

export function buildJamiVisuals(t={},options={}) {
  if(options.unknown===true)return [];
  const palaces=list(t.palaces).filter(row=>clean(row?.kr)),visuals=[];
  const name=row=>/궁$/.test(clean(row.kr))?clean(row.kr):clean(row.kr)+'궁';
  const starName=star=>clean(t.starDict?.[star?.name]?.kr)||clean(star?.name);
  const stars=row=>list(row.mainStars).map(starName).filter(Boolean).join(' · ');
  if(palaces.length)visuals.push(chart('jami-palaces','palaces','열두 궁으로 읽는 삶의 지도',palaces.map(row=>({
    label:name(row),value:stars(row)||'주성 없는 궁',detail:join([clean(row.theme),clean(row.ganZhi)]),
    tags:[row.name==='命宮'?'명궁':'',row.isShenGong===true?'신궁':'',...list(row.mainStars).map(star=>lookup(HUAS,star?.siHua))].filter(Boolean),active:row.name==='命宮',
  })),{kicker:'자미두수 명반',description:join([clean(t.wuXingJu?.name),'궁마다 놓인 중심 별과 생활의 주제를 살펴요.']),note:'명궁은 나의 기준, 신궁은 그 기준을 생활에서 펼치는 자리예요. 주성이 없다고 그 영역이 비어 있거나 약하다는 뜻은 아니에요.'}));
  const natal=palaces.flatMap(row=>[...list(row.mainStars),...list(row.auxStars)].filter(star=>Object.hasOwn(HUAS,star?.siHua)).map(star=>({label:HUAS[star.siHua],value:starName(star),detail:join([name(row),clean(row.theme)]),tags:['출생 사화']})));
  if(natal.length)visuals.push(chart('jami-transformations','placements','별에 더해진 네 가지 변화',natal,{kicker:'출생 사화의 자리',description:'화록·화권·화과·화기가 어떤 별과 궁에 놓이는지 함께 봐요.',note:'태어난 명반에 놓인 사화예요. 올해의 유년 사화와 구분해서 읽어요.'}));
  const year=Number.isInteger(options.year)?options.year:null;
  const annual=year===null?[]:palaces.flatMap(row=>list(row.actions).map(clean).filter(action=>action.startsWith('올해 ')).map(action=>({label:name(row),detail:action,tag:clean(row.theme),active:row.name==='命宮'})));
  if(annual.length)visuals.push(chart('jami-annual','timeline',`${year}년, 다시 살펴볼 생활 영역`,annual,{kicker:'올해의 관찰 지도',description:'출생 명반 위에서 올해의 변화 신호가 들어오는 영역을 살펴요.',note:'앱 엔진이 해당 궁에 연결한 유년 행동 안내예요. 발생 확률이나 성과 점수로 바꾸지 않았어요.'}));
  return visuals;
}
