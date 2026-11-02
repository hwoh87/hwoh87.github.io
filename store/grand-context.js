/* The existing KMP exports calculate every chart; this adapter only names their fields. */
(function (scope) {
  function build(engine, person, place, now = new Date()) {
    const b = person.birth;
    if (!b || !Number.isInteger(b.h) || b.h < 0 || b.h > 23 || !Number.isInteger(b.mi) || b.mi < 0 || b.mi > 59) throw new Error('그랜드 리포트는 태어난 시와 분을 확인해 주세요. 세 체계를 같은 시각으로 계산해요.');
    const cities = JSON.parse(engine.NatalCalc.cities());
    const matches = cities.filter(item => item.name+'|'+item.region === place || item.name === place);
    const city = matches.length===1 ? matches[0] : null;
    if (!city) throw new Error('한국 출생 도시를 선택해 주세요.');
    const date = new Intl.DateTimeFormat('en-CA', {timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
    const part = name => Number(date.find(item => item.type === name).value);
    const y = part('year'), mo = part('month'), d = part('day'), args = [b.y,b.mo,b.d,b.h,b.mi];
    const me = JSON.parse(engine.StoreCalc.context(...args,person.gender,false,city.lon,y,mo,d));
    const ziwei = JSON.parse(engine.ZiweiCalc.interpret(...args,person.gender === 'M',city.lon,y));
    const natal = JSON.parse(engine.NatalCalc.calculate(...args,city.lat,city.lon,'P'));
    const natalReading = JSON.parse(engine.NatalCalc.interpret(...args,city.lat,city.lon,'P'));
    const interpret = me.interpret, entries = me.daewoonFlow.entries, current = entries.find(item => item.isCurrent);
    const luck = item => item ? {...item, ganzi:item.ganzi || item.ganji, stem_sipsin:item.stemSipsin,branch_sipsin:item.branchSipsin,start_year:item.startYear} : null;
    const fusion = {
      version:'fusion-web-v1',birth:{...b,g:person.gender},
      user_info:{gender:person.gender,birth_date:`${b.y}-${b.mo}-${b.d} ${b.h}:${b.mi}`,time_unknown:false},
      location:{name:city.name+' · '+city.region,lat:city.lat,lon:city.lon,timeZone:'Asia/Seoul',houseSystem:'P',trueSolarTime:false},
      saju:{bazi:Object.fromEntries(Object.entries(me.base.pillars).map(([key,p])=>[key,[...p.ganzi]])),
        pillars_detail:Object.fromEntries(Object.entries(me.base.pillars).map(([key,p])=>[key,{ganji:p.ganzi,stem_sipsin:p.stemSipsin,branch_sipsin:p.branchSipsin,unseong:p.unseong}])),
        geokguk:{...interpret.geokguk,name:interpret.geokguk.hangul},relations:me.relations,
        sinsal:me.sinsal.map(s=>({...s,positions:s.at})),daewun:entries,gongmang:me.gongmang},
      strength:{is_strong:interpret.strength.isStrong,help_score:interpret.strength.help,weaken_score:interpret.strength.weaken,
        help_ratio:interpret.strength.help/(interpret.strength.help+interpret.strength.weaken),yongsin:interpret.yongsin.yong,gisin:interpret.yongsin.gi,elements:interpret.elements},
      ziwei,
      astrology:{sun:natal.planets.find(p=>p.id==='Sun')?.signKo,moon:natal.planets.find(p=>p.id==='Moon')?.signKo,
        asc:natal.angles?.asc?.signKo,major_placements:natal.planets,aspects:natal.aspects,structural_patterns:natal.patterns,chart:natal,reading:natalReading},
      luck_context:{current_daewoon:luck(current),next_daewoon:luck(entries[entries.indexOf(current)+1]),
        current_saewoon:luck(me.years.find(item=>item.year===y)),
        months_ahead:me.months.slice(0,12).map(luck),years_ahead:me.years.filter(item=>item.year>=y&&item.year<y+10).map(luck)},
      life_phase:JSON.parse(engine.SajuCalc.lifePhase(...args,person.gender,false,city.lon)),
    };
    if (!ziwei?.palaces?.length || !fusion.astrology.sun || fusion.luck_context.months_ahead.length !== 12 || fusion.luck_context.years_ahead.length !== 10) throw new Error('그랜드 리포트의 계산 자료를 준비하지 못했어요. 입력 정보를 확인해 주세요.');
    return {me,fusion};
  }
  scope.SamraGrandContext = {build};
})(typeof window === 'object' ? window : globalThis);
