import {DEFAULT_BOUNDS,MAP_SIZE,mapPoint,headingDegrees,routePoints,routeDistance,journeyProgress,validPoint} from './wayfinder-core.js?v=20261101-sanctuary2';

const PLACES={myeongri:{name:'명리전',short:'명리전',kind:'hall'},inyeon:{name:'인연정',short:'인연정',kind:'hall'},stars:{name:'별마루',short:'별마루',kind:'hall'},readers:{name:'술사각',short:'술사각',kind:'hall'},archive:{name:'서고',short:'서고',kind:'hall'},wish:{name:'소원 등불',short:'소원',kind:'ritual'},breath:{name:'마음 고르기',short:'쉼',kind:'ritual'},blessing:{name:'응원나무',short:'응원',kind:'ritual'}};
let sequence=0;
function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}
function svg(tag,attrs={}){const node=document.createElementNS('http://www.w3.org/2000/svg',tag);for(const[key,value]of Object.entries(attrs))node.setAttribute(key,String(value));return node;}

/** Compact, session-memory-only map. Position and route data never leave this component. */
export function createWayfinder(host,{destinations={},onTravel,onCancel,bounds=DEFAULT_BOUNDS}={}){
  if(!host)throw new Error('Wayfinder host required');
  const controller=new AbortController();let disposed=false,expanded=false,journey=null,lastAnnouncement='',lastBucket=-1;
  const mapOptions={bounds},map=point=>mapPoint(point,mapOptions),id='wf-map-'+(++sequence);
  const root=el('section','wf-root'),toggle=el('button','wf-toggle');toggle.type='button';toggle.setAttribute('aria-expanded','false');toggle.setAttribute('aria-controls',id);
  const emblem=el('span','wf-toggle-emblem','⌖');emblem.setAttribute('aria-hidden','true');const toggleCopy=el('span','wf-toggle-copy');toggleCopy.append(el('strong','','신당 지도'),el('small','wf-toggle-hint','장소를 골라 걸어가요'));const chevron=el('span','wf-chevron','⌄');chevron.setAttribute('aria-hidden','true');toggle.append(emblem,toggleCopy,chevron);
  const panel=el('div','wf-panel');panel.id=id;panel.hidden=true;
  const help=el('p','wf-help','장소를 누르면 나그네가 걸어가요.');
  const graphic=svg('svg',{viewBox:`0 0 ${MAP_SIZE.width} ${MAP_SIZE.height}`,class:'wf-map','aria-label':'신당의 장소와 내 위치','role':'group'});
  graphic.append(svg('rect',{x:6,y:6,width:308,height:288,rx:13,class:'wf-map-field'}));
  const borderA=map({x:bounds.minX,z:bounds.minZ}),borderB=map({x:bounds.maxX,z:bounds.maxZ});
  if(borderA&&borderB)graphic.append(svg('rect',{x:borderA.x,y:borderA.y,width:borderB.x-borderA.x,height:borderB.y-borderA.y,rx:10,class:'wf-boundary'}));
  const linePoints=[{x:-17,z:-4.9},{x:0,z:-4.9},{x:0,z:-20},{x:0,z:8},{x:-16,z:8.2},{x:0,z:8},{x:17,z:6.7},{x:0,z:6.7},{x:0,z:-6.7},{x:17,z:-6.7}].map(map).filter(Boolean);
  graphic.append(svg('polyline',{points:linePoints.map(point=>point.x.toFixed(1)+','+point.y.toFixed(1)).join(' '),class:'wf-pathways'}));
  const pond=map({x:-8,z:-3.9});if(pond)graphic.append(svg('ellipse',{cx:pond.x,cy:pond.y,rx:17,ry:13,class:'wf-pond'}));
  const shrineA=map({x:-4.7,z:-12.6}),shrineB=map({x:4.7,z:-6.5});if(shrineA&&shrineB)graphic.append(svg('rect',{x:shrineA.x,y:shrineA.y,width:shrineB.x-shrineA.x,height:shrineB.y-shrineA.y,rx:3,class:'wf-shrine'}));
  const route=svg('polyline',{class:'wf-route',points:'','aria-hidden':'true'});graphic.append(route);
  const stops=new Map();
  function travel(action){if(disposed)return;const name=PLACES[action]?.name;if(!name)return;setExpanded(false);announce(name+'까지 걸어갑니다.');if(typeof onTravel==='function')onTravel(action);else document.dispatchEvent(new CustomEvent('sowon:walk',{detail:{action}}));}
  for(const[action,place]of Object.entries(PLACES)){
    const point=map(destinations[action]);if(!point||!point.inside)continue;
    const stop=svg('g',{class:'wf-stop wf-stop--'+place.kind,transform:`translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`,tabindex:0,role:'button','aria-label':place.name+'까지 걸어가기'});
    stop.append(svg('circle',{r:21,class:'wf-stop-hit'}),svg('circle',{r:place.kind==='hall'?7:5,class:'wf-stop-dot'}));
    const label=svg('text',{y:place.kind==='hall'?-13:17,'text-anchor':'middle',class:'wf-stop-label'});label.textContent=place.short;stop.append(label);
    stop.addEventListener('click',event=>{if(event.button===undefined||event.button===0)travel(action);},{signal:controller.signal});
    stop.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();travel(action);}},{signal:controller.signal});
    graphic.append(stop);stops.set(action,stop);
  }
  const player=svg('g',{class:'wf-player','aria-hidden':'true',display:'none'}),heading=svg('g');heading.append(svg('path',{d:'M0 -12 L-6 5 L0 2 L6 5 Z',class:'wf-heading'}));player.append(svg('circle',{r:13,class:'wf-player-halo'}),heading,svg('circle',{r:3,class:'wf-player-core'}));graphic.append(player);
  const legend=el('p','wf-legend');legend.append(el('span','wf-legend-dot','●'),document.createTextNode(' 나의 위치 · 위쪽이 신당 뒤편'));
  panel.append(help,graphic,legend);
  const journeyBox=el('div','wf-journey');journeyBox.hidden=true;const journeyTop=el('div','wf-journey-top'),journeyName=el('span','wf-journey-name'),percent=el('span','wf-percent','0%');journeyTop.append(journeyName,percent);
  const bar=el('div','wf-progress');bar.setAttribute('role','progressbar');bar.setAttribute('aria-label','목적지까지 걷기');bar.setAttribute('aria-valuemin','0');bar.setAttribute('aria-valuemax','100');bar.setAttribute('aria-valuenow','0');const fill=el('span');bar.append(fill);
  const cancel=el('button','wf-cancel','걷기 멈추기');cancel.type='button';journeyBox.append(journeyTop,bar,cancel);
  const live=el('p','wf-live');live.setAttribute('role','status');live.setAttribute('aria-live','polite');live.setAttribute('aria-atomic','true');
  root.append(toggle,panel,journeyBox,live);host.append(root);
  function announce(message){if(message!==lastAnnouncement){lastAnnouncement=message;live.textContent=message;}}
  function setExpanded(value){if(disposed)return;const changed=expanded!==Boolean(value);expanded=Boolean(value);panel.hidden=!expanded;root.classList.toggle('wf-expanded',expanded);toggle.setAttribute('aria-expanded',String(expanded));toggle.setAttribute('aria-label','신당 지도 '+(expanded?'접기':'펼치기'));host.setAttribute('data-expanded',String(expanded));chevron.textContent=expanded?'⌃':'⌄';if(!expanded&&panel.contains(document.activeElement))toggle.focus({preventScroll:true});if(changed)host.dispatchEvent(new CustomEvent('sowon:wayfinder',{detail:{expanded},bubbles:true}));}
  toggle.addEventListener('click',()=>setExpanded(!expanded),{signal:controller.signal});
  panel.addEventListener('keydown',event=>{if(event.key==='Escape'&&expanded){event.preventDefault();setExpanded(false);}},{signal:controller.signal});
  cancel.addEventListener('click',()=>{if(disposed)return;if(typeof onCancel==='function')onCancel();else document.dispatchEvent(new CustomEvent('sowon:cancel'));announce('걷기를 멈췄어요.');},{signal:controller.signal});
  function update({position,rotation=0,path=[],target=null,action=null,exploring=false}={}){
    if(disposed)return;const point=map(position);if(!point||!exploring)player.setAttribute('display','none');else player.removeAttribute('display');if(point){player.setAttribute('transform',`translate(${point.x.toFixed(2)} ${point.y.toFixed(2)})`);heading.setAttribute('transform',`rotate(${headingDegrees(rotation)??180})`);}
    const active=validPoint(position)&&validPoint(target);
    for(const[key,stop]of stops)stop.classList.toggle('wf-stop--active',active&&key===action);
    if(active){
      const name=PLACES[action]?.name||'선택한 자리';
      const signature=String(action||'ground')+':'+target.x.toFixed(3)+','+target.z.toFixed(3);
      if(!journey||journey.signature!==signature){journey={signature,name,total:routeDistance(position,path,target),target:{x:target.x,z:target.z}};lastBucket=-1;announce(name+'까지 걷기 시작했어요.');}
      const progress=journeyProgress({position,path,target,totalDistance:journey.total});journeyBox.hidden=false;journeyName.textContent=name+'에 가고 있어요';percent.textContent=progress.percent+'%';bar.setAttribute('aria-valuenow',String(progress.percent));bar.setAttribute('aria-valuetext',name+'까지 '+progress.percent+'%');fill.style.width=progress.percent+'%';toggleCopy.querySelector('small').textContent=name+' · '+progress.percent+'%';
      const bucket=Math.floor(progress.percent/25);if(bucket>lastBucket){if(bucket>0)announce(name+'까지 '+Math.min(100,bucket*25)+'% 걸어왔어요.');lastBucket=bucket;}
      const points=routePoints(position,path,target).map(map).filter(Boolean);route.setAttribute('points',points.map(value=>value.x.toFixed(1)+','+value.y.toFixed(1)).join(' '));
    }else{
      if(journey){const arrived=validPoint(position)&&Math.hypot(position.x-journey.target.x,position.z-journey.target.z)<0.35;announce(arrived?journey.name+'에 도착했어요.':'걷기를 멈췄어요.');journey=null;lastBucket=-1;}
      journeyBox.hidden=true;route.setAttribute('points','');toggleCopy.querySelector('small').textContent='장소를 골라 걸어가요';
    }
  }
  function dispose(){if(disposed)return;disposed=true;controller.abort();root.remove();host.removeAttribute('data-expanded');journey=null;stops.clear();}
  setExpanded(false);
  return{update,setExpanded,dispose};
}
