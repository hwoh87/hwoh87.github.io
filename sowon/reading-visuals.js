const SVG_NS = 'http://www.w3.org/2000/svg';
const COLORS = Object.freeze({
  '木':'#337b62',wood:'#337b62','목':'#337b62',
  '火':'#c15c49',fire:'#c15c49','화':'#c15c49',
  '土':'#a57b30',earth:'#a57b30','토':'#a57b30',
  '金':'#7b83a3',metal:'#7b83a3','금':'#7b83a3',
  '水':'#3e7398',water:'#3e7398','수':'#3e7398',air:'#8a76a9',
  consumption:'#b65c4d',consumptionAxis:'#b65c4d',
  yang:'#b67836',yin:'#526483',help:'#397e66',weaken:'#997050',
  '비겁':'#426e8c','식상':'#b55d55','재성':'#a57b30','관성':'#586da2','인성':'#547d69',
  cardinal:'#b47734',fixed:'#526d95',mutable:'#5a836d',
});
const SERIES = ['#3d7b69','#547b9f','#ae7b3e','#a15c76','#6775a3','#a3664e','#5d8a89'];
const TYPES = new Set(['pillars','distribution','balance','radar','timeline','palaces','placements']);
const str = (value, limit=500) => typeof value === 'string' || typeof value === 'number' ? String(value).slice(0,limit) : '';
const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 1e9;
const format = value => new Intl.NumberFormat('ko-KR',{maximumFractionDigits:1}).format(value);
const color = (key, index=0) => Object.hasOwn(COLORS,str(key,40)) ? COLORS[str(key,40)] : SERIES[index % SERIES.length];
const percent = (value,total) => total > 0 ? Math.round(value / total * 1000) / 10 : 0;

/** A read-only visual summary. Source values remain available as ordinary text. */
export function renderReadingVisuals(visualizations, {document:doc=globalThis.document, compact=false}={}) {
  if (!doc?.createElement) throw new TypeError('시각화를 표시할 문서가 필요해요.');
  const make = (tag, className, text) => {
    const node=doc.createElement(tag);
    if(className)node.className=className;
    if(text != null)node.textContent=str(text,2000);
    return node;
  };
  const svg = (tag, attrs={}) => {
    const node=doc.createElementNS ? doc.createElementNS(SVG_NS,tag) : doc.createElement(tag);
    for(const [key,value] of Object.entries(attrs))node.setAttribute(key,String(value));
    return node;
  };
  const style = (node, value) => node.setAttribute('style',value);
  const root=make('div',`reading-visuals${compact?' is-compact':''}`);
  root.setAttribute('aria-label','계산 결과를 한눈에 보는 분석');
  const models=(Array.isArray(visualizations)?visualizations:[]).filter(model=>model&&TYPES.has(model.type)&&Array.isArray(model.items)).slice(0,16);
  for(const [index,model] of models.entries()) {
    const raw=model.items.filter(item=>item&&typeof item==='object').slice(0,60);
    const items=['distribution','balance','radar'].includes(model.type) ? raw.filter(item=>str(item.label)&&finite(item.value)&&(!['balance','radar'].includes(model.type)||item.value<=100)) : raw.filter(item=>str(item.label));
    if(!items.length)continue;
    const card=make('section',`rv-card rv-card-${model.type}`);
    card.setAttribute('data-viz-id',str(model.id,80));card.setAttribute('data-viz-type',model.type);
    card.setAttribute('data-viz-variant',str(model.variant,40));
    const head=make('header','rv-heading'), eyebrow=make('p','rv-eyebrow');
    eyebrow.append(make('span','rv-order',String(root.children.length+1).padStart(2,'0')),make('span','',model.kicker||({pillars:'내 사주의 뼈대',distribution:'기운의 분포',balance:'서로 다른 힘의 균형',radar:'관계의 구조',timeline:'시간을 따라 읽기',palaces:'열두 영역의 지도',placements:'계산된 자리와 신호'}[model.type])));
    head.append(eyebrow,make('h3','rv-title',model.title||'분석 데이터'));
    if(str(model.description))head.append(make('p','rv-description',model.description));
    card.append(head);
    if(model.type==='pillars')pillars(card,items);
    else if(model.type==='distribution')distribution(card,model,items);
    else if(model.type==='balance')balance(card,model,items);
    else if(model.type==='radar')radar(card,model,items);
    else if(model.type==='timeline')timeline(card,items);
    else if(model.type==='palaces')palaces(card,items);
    else placements(card,items);
    if(str(model.note))card.append(make('p','rv-source-note',model.note));
    root.append(card);
  }
  root.hidden=root.children.length===0;
  return root;

  function pillars(card,items) {
    const grid=make('div','rv-pillars-grid');
    style(grid,`--rv-pillar-count:${Math.min(4,items.length)};`);
    for(const item of items) {
      const pillar=make('div',`rv-pillar${item.muted?' is-muted':''}${item.active?' is-current':''}`);
      style(pillar,`--rv-stem:${color(item.stemElement)};--rv-branch:${color(item.branchElement,1)};`);
      pillar.append(make('p','rv-pillar-label',item.label));
      const signs=make('div','rv-pillar-signs');
      signs.append(make('strong','rv-stem',str(item.stem,6)||'—'),make('strong','rv-branch',str(item.branch,6)||'—'));
      pillar.append(signs);
      if(str(item.subtitle))pillar.append(make('p','rv-pillar-subtitle',item.subtitle));
      const elements=[str(item.stemElement),str(item.branchElement)].filter(Boolean);
      if(elements.length)pillar.append(make('p','rv-pillar-elements',elements.join(' · ')));
      grid.append(pillar);
    }
    card.append(grid);
  }

  function distribution(card,model,items) {
    const total=items.reduce((sum,item)=>sum+item.value,0);
    if(model.variant==='polarity'&&items.length===2) {
      split(card,model,items,total);return;
    }
    const layout=make('div','rv-distribution-layout');
    if(model.variant==='gods'&&items.length>=3&&items.length<=8) {
      const figure=make('figure','rv-plot rv-radar-plot');
      figure.append(radarPlot(items,Math.max(1,...items.map(item=>item.value))),make('figcaption','rv-plot-caption',`바깥 눈금 ${format(Math.max(1,...items.map(item=>item.value)))}${str(model.unit,12)||'개'} 기준`));
      layout.append(figure);
    } else layout.append(donut(items,total));
    layout.append(bars(items,model,{total}));
    card.append(layout);
  }

  function donut(items,total) {
    const figure=make('figure','rv-plot rv-donut-plot');
    const drawing=svg('svg',{viewBox:'0 0 220 220',class:'rv-donut','aria-hidden':'true',focusable:'false'});
    drawing.append(svg('circle',{cx:110,cy:110,r:80,fill:'none',stroke:'#e6e8df','stroke-width':22}));
    const circumference=2*Math.PI*80;
    let offset=0;
    items.forEach((item,index)=>{
      if(item.value<=0||total<=0)return;
      const length=item.value/total*circumference,gap=items.filter(row=>row.value>0).length>1?Math.min(4,length*.2):0;
      drawing.append(svg('circle',{cx:110,cy:110,r:80,fill:'none',stroke:color(item.key,index),'stroke-width':22,'stroke-dasharray':`${Math.max(0,length-gap)} ${circumference}`,'stroke-dashoffset':-offset,transform:'rotate(-90 110 110)'}));
      offset+=length;
    });
    const top=items.reduce((best,item)=>item.value>best.value?item:best,items[0]);
    const center=make('div','rv-donut-center');
    center.append(make('span','rv-donut-kicker',total?'가장 큰 비중':'집계된 비중'),make('strong','rv-donut-value',total?`${format(percent(top.value,total))}%`:'0%'),make('span','rv-donut-label',total?top.label:'집계 없음'));
    const wrap=make('div','rv-donut-wrap');wrap.append(drawing,center);figure.append(wrap);
    figure.append(make('figcaption','rv-plot-caption','각 항목이 차지하는 비중'));
    return figure;
  }

  function bars(items,model,{total,independent=false}={}) {
    const list=make('dl','rv-bars');
    items.forEach((item,index)=>{
      const row=make('div','rv-bar-row'), label=make('dt','rv-bar-label'),value=make('dd','rv-bar-value');
      const c=color(item.key,index),amount=independent?Math.min(100,item.value):percent(item.value,total);
      style(row,`--rv-color:${c};--rv-percent:${amount}%;`);
      label.append(make('span','rv-swatch'),make('span','',item.label));
      const unit=str(item.unit||model.unit,12);
      value.append(make('strong','',format(item.value)),make('span','rv-value-unit',unit));
      if(!independent&&unit!=='%')value.append(make('small','',`${format(percent(item.value,total))}%`));
      const track=make('div','rv-bar-track');track.setAttribute('aria-hidden','true');track.append(make('span','rv-bar-fill'));
      row.append(label,value,track);list.append(row);
    });
    return list;
  }

  function split(card,model,items,total) {
    const values=make('dl','rv-split-values');
    items.forEach((item,index)=>{
      const value=make('div','rv-split-value');style(value,`--rv-color:${color(item.key,index)};`);
      value.append(make('dt','',item.label));
      const percentValue=make('dd','');percentValue.append(make('strong','',format(percent(item.value,total))),make('span','','%'));value.append(percentValue);
      value.append(make('p','',`${format(item.value)}${str(item.unit||model.unit,12)}`));values.append(value);
    });
    const track=make('div','rv-split-track');track.setAttribute('aria-hidden','true');
    items.forEach((item,index)=>{const segment=make('span','');style(segment,`width:${percent(item.value,total)}%;--rv-color:${color(item.key,index)};`);track.append(segment);});
    card.append(values,track);
  }

  function balance(card,model,items) {
    // Only a genuinely complementary help/weaken pair becomes a split bar.
    const isPair=items.length===2&&model.unit==='%'&&items.every(item=>['help','weaken'].includes(item.key));
    const total=items.reduce((sum,item)=>sum+item.value,0);
    if(isPair&&Math.abs(total-100)<.2)split(card,model,items,total);
    else card.append(bars(items,model,{independent:true}));
  }

  function radarPlot(items,max=100) {
    const drawing=svg('svg',{viewBox:'0 0 300 270',class:'rv-radar','aria-hidden':'true',focusable:'false'}),cx=150,cy=132,radius=84;
    const point=(index,r)=>{const angle=-Math.PI/2+index/items.length*Math.PI*2;return [cx+Math.cos(angle)*r,cy+Math.sin(angle)*r];};
    const points=scale=>items.map((_,i)=>point(i,radius*scale).map(value=>value.toFixed(2)).join(',')).join(' ');
    for(const scale of [.25,.5,.75,1])drawing.append(svg('polygon',{points:points(scale),fill:scale===1?'#f7f8f2':'none',stroke:'#d9dfd2','stroke-width':1}));
    items.forEach((item,index)=>{
      const [x,y]=point(index,radius);drawing.append(svg('line',{x1:cx,y1:cy,x2:x,y2:y,stroke:'#e1e6dc','stroke-width':1}));
      const [tx,ty]=point(index,radius+27),text=svg('text',{x:tx,y:ty+4,'text-anchor':tx<cx-10?'end':tx>cx+10?'start':'middle',class:'rv-radar-label'});text.textContent=str(item.label,14);drawing.append(text);
    });
    const coordinates=items.map((item,index)=>point(index,radius*Math.min(1,item.value/max)));
    drawing.append(svg('polygon',{points:coordinates.map(pair=>pair.map(value=>value.toFixed(2)).join(',')).join(' '),fill:'#4d82724a',stroke:'#39735e','stroke-width':2.5,'stroke-linejoin':'round'}));
    coordinates.forEach(([x,y])=>drawing.append(svg('circle',{cx:x,cy:y,r:3.5,fill:'#fffdf7',stroke:'#39735e','stroke-width':2})));
    return drawing;
  }

  function radar(card,model,items) {
    const safe=items.filter(item=>item.value<=100).slice(0,12),layout=make('div','rv-distribution-layout');
    if(safe.length>=3) {
      const figure=make('figure','rv-plot rv-radar-plot');figure.append(radarPlot(safe),make('figcaption','rv-plot-caption','각 축 0–100점 · 축마다 독립된 지표'));layout.append(figure);
    }
    if(safe.length)layout.append(bars(safe,model,{independent:true}));
    card.append(layout);
  }

  function timeline(card,items) {
    const list=make('ol','rv-timeline');
    for(const item of items) {
      const period=make('li',`rv-period${item.active?' is-current':''}`);
      if(item.active)period.setAttribute('aria-current','step');
      const label=make('div','rv-period-label');label.append(make('span','rv-period-dot'),make('strong','',item.label));
      period.append(label);
      if(str(item.tag))period.append(make('span','rv-period-tag',item.tag));
      if(str(item.detail))period.append(make('p','rv-period-detail',item.detail));
      list.append(period);
    }
    card.append(list);
  }

  function palaces(card,items) {
    const grid=make('dl','rv-palaces-grid');
    items.forEach((item,index)=>{
      const palace=make('div',`rv-palace${item.active?' is-current':''}`);
      const label=make('dt','');label.append(make('span','rv-palace-index',String(index+1).padStart(2,'0')),make('span','',item.label));palace.append(label,make('dd','rv-palace-stars',str(item.value)||'주성 없음'));
      if(str(item.detail))palace.append(make('p','rv-palace-detail',item.detail));
      appendTags(palace,item.tags);grid.append(palace);
    });
    card.append(grid);
  }

  function placements(card,items) {
    const list=make('dl','rv-placements');
    for(const [index,item] of items.entries()) {
      const row=make('div',`rv-placement${item.active?' is-current':''}`);style(row,`--rv-color:${color(item.key,index)};`);
      const label=make('dt','');label.append(make('span','rv-placement-orb'),make('span','',item.label));row.append(label,make('dd','',str(item.value)||'—'));
      if(str(item.detail))row.append(make('p','rv-placement-detail',item.detail));
      appendTags(row,item.tags);list.append(row);
    }
    card.append(list);
  }

  function appendTags(host,tags) {
    const safe=(Array.isArray(tags)?tags:[]).map(tag=>str(tag,80)).filter(Boolean).slice(0,8);
    if(!safe.length)return;
    const row=make('div','rv-tags');safe.forEach(tag=>row.append(make('span','rv-tag',tag)));host.append(row);
  }
}
