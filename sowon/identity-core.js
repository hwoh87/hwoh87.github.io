const STEMS = ['갑','을','병','정','무','기','경','신','임','계'];
const BRANCHES = ['자','축','인','묘','진','사','오','미','신','유','술','해'];
const GAN = '甲乙丙丁戊己庚辛壬癸', JI = '子丑寅卯辰巳午未申酉戌亥';
const ELEMENTS = { 木:'목', 火:'화', 土:'토', 金:'금', 水:'수' };
const EMPTY = Object.freeze({ hasIdentity:false, ilju:null, ganzi:null, element:null });

/** Only a verified day pillar leaves this controller. No birth, name or chart. */
export function identityFromChart(chart) {
  const day=chart?.pillars?.day;
  const index=Array.from({length:60},(_,i)=>i).find(i=>chart?.iljuKr===STEMS[i%10]+BRANCHES[i%12] && day?.ganzi===GAN[i%10]+JI[i%12]);
  if(index===undefined || !ELEMENTS[day?.stemEl]) throw new TypeError('일주를 확인하지 못했어요.');
  return {hasIdentity:true,ilju:chart.iljuKr,ganzi:day.ganzi,element:ELEMENTS[day.stemEl]};
}

export function createIdentityTracker({getProfile,loadEngine,announce}) {
  let revision=0, identity=EMPTY, disposed=false;
  const publish=value=>{identity=value;announce({...value});};
  return {
    current:()=>({...identity}),
    announce:()=>announce({...identity}),
    async refresh() {
      if(disposed) return;
      const ticket=++revision;
      publish(EMPTY);
      const birth=getProfile()?.solar;
      if(!birth || disposed) return;
      const input={...birth};
      try {
        const bundle=await loadEngine();
        if(disposed || ticket!==revision) return;
        const engine=bundle?.com?.samramanshang?.manseryeok?.orrery?.js || bundle;
        const chart=JSON.parse(engine.SajuCalc.calculate(input.y,input.mo,input.d,input.h,input.mi,input.g,false,127));
        const next=identityFromChart(chart);
        if(!disposed && ticket===revision) publish(next);
      } catch (_) { if(!disposed && ticket===revision) publish(EMPTY); }
    },
    dispose(){disposed=true;revision++;identity=EMPTY;},
  };
}
