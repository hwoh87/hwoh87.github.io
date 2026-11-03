import { getOwnIdentity } from './identity.js?v=20261103-benchmark2';
import { safeIlju } from './ilju-room-core.js?v=20261103-benchmark2';

const launcher=document.createElement('nav');launcher.className='leisure-launcher';launcher.setAttribute('aria-label','산책과 풍경 도구');
launcher.innerHTML='<button type="button" data-open-leisure><svg class="icon" aria-hidden="true"><use href="#i-compass"/></svg><span>산책 도구</span></button><button type="button" data-quiet-toggle aria-pressed="false"><svg class="icon" aria-hidden="true"><use href="#i-overview"/></svg><span>풍경만 보기</span></button>';
document.body.append(launcher);
const dialog=document.createElement('dialog');dialog.className='leisure-dialog';dialog.setAttribute('aria-labelledby','leisureTitle');
dialog.innerHTML=`<header><div><p>천천히 둘러보는 신당</p><h2 id="leisureTitle">산책과 쉼</h2></div><button type="button" data-close-leisure aria-label="산책 도구 닫기">×</button></header><div class="leisure-body"><div class="leisure-grid"><button type="button" data-leisure="walk"><strong>신당 한 바퀴</strong><span>전각 8곳을 자동으로 둘러봐요</span></button><button type="button" data-leisure="photo"><strong>오늘의 장면</strong><span>내 일주가 담긴 사진 카드</span></button><button type="button" data-leisure="wardrobe"><strong>나그네 꾸미기</strong><span>머리·한복·소품을 골라요</span></button><button type="button" data-leisure="rest"><strong>조용히 쉬기</strong><span>잠깐 마음을 고르는 시간</span></button><button type="button" data-leisure="journal"><strong>나의 산책 기록</strong><span>발걸음이 닿은 곳을 모아요</span></button><button type="button" data-leisure="knowledge"><strong>명리 한 걸음</strong><span>세 문제로 개념을 알아가요</span></button></div><section class="leisure-moment"><div><p>매 시 정각, 45초의 풍경</p><h3>정각의 등불</h3><span data-next-moment></span></div><button type="button" data-leisure="lantern">나만 미리보기</button></section><section class="leisure-record"><div><h3>움직이는 장면 남기기</h3><p>설치 없이 신당 화면만 녹화해요.</p></div><div class="leisure-durations" aria-label="영상 길이"><button type="button" data-clip-seconds="8" aria-pressed="true">8초</button><button type="button" data-clip-seconds="15" aria-pressed="false">15초</button><button type="button" data-clip-seconds="30" aria-pressed="false">30초</button></div><button type="button" class="leisure-primary" data-leisure="record">짧은 영상 찍기</button><p class="leisure-note">캐릭터와 풍경만 담겨요. 이름·출생정보·대화·소리는 포함하지 않아요. 해석 창을 열거나 다른 방으로 옮기면 녹화를 마쳐요.</p></section><div class="leisure-utilities"><button type="button" data-leisure="quiet">풍경만 보기</button><button type="button" data-leisure="overview">신당 전체 보기</button><button type="button" data-leisure="greet">인사하기</button><button type="button" data-leisure="gate">처음 자리</button><button type="button" data-leisure="settings">풍경·화면 설정</button></div><p class="leisure-feedback" role="status"></p></div>`;
document.body.append(dialog);
const result=document.createElement('dialog');result.className='leisure-dialog leisure-result';result.setAttribute('aria-labelledby','sceneResultTitle');
result.innerHTML='<header><div><p>삼라 신당에서 남긴 시간</p><h2 id="sceneResultTitle">오늘의 장면</h2></div><button type="button" data-result-close aria-label="촬영 결과 닫기">×</button></header><div class="leisure-body"><div class="leisure-media"></div><p class="leisure-note">이 기기에서 만들어진 파일이에요. 저장한 뒤 원하는 곳에 올려 주세요.</p><div class="leisure-result-actions"><a class="leisure-primary" data-download>저장하기</a><button type="button" data-result-close>풍경으로 돌아가기</button></div><p class="leisure-save-note" role="status"></p></div>';
document.body.append(result);
const walkBar=document.createElement('aside');walkBar.className='leisure-walkbar';walkBar.hidden=true;walkBar.setAttribute('aria-label','자동 산책');walkBar.innerHTML='<div><small data-walk-step></small><strong data-walk-title></strong><p data-walk-text></p></div><button type="button" data-stop-walk>산책 중지</button>';document.body.append(walkBar);
const quietExit=document.createElement('button');quietExit.type='button';quietExit.className='leisure-quiet-exit';quietExit.textContent='도구 다시 보기 · Esc';quietExit.hidden=true;document.body.append(quietExit);
const recorderBar=document.createElement('aside');recorderBar.className='leisure-recorder';recorderBar.hidden=true;recorderBar.innerHTML='<span role="status">녹화 중 <b></b></span><button type="button">녹화 마치기</button>';document.body.append(recorderBar);
const momentBar=document.createElement('aside');momentBar.className='leisure-momentbar';momentBar.hidden=true;momentBar.innerHTML='<span role="status"></span><button type="button">원래 시점</button>';momentBar.querySelector('button').onclick=()=>document.dispatchEvent(new CustomEvent('sowon:lantern-stop'));document.body.append(momentBar);
function nextMoment(){const now=Date.now(),next=Math.floor(now/3600000)*3600000+3600000;dialog.querySelector('[data-next-moment]').textContent='다음 풍경 '+new Intl.DateTimeFormat('ko-KR',{hour:'2-digit',minute:'2-digit',timeZone:'Asia/Seoul',hour12:false}).format(next);}
nextMoment();setInterval(nextMoment,30000);
document.addEventListener('sowon:lantern-state',event=>{nextMoment();momentBar.hidden=!event.detail?.active;momentBar.querySelector('button').hidden=!event.detail?.preview;momentBar.querySelector('span').textContent=event.detail?.preview?'정각의 등불 · 나만 보는 미리보기':'정각의 등불이 천천히 오르고 있어요';});
let opener,clipSeconds=8,recording=null,outputUrl=null,outputName='',pendingOutput=false;
function openTools(){if(document.querySelector('dialog[open]'))return;nextMoment();opener=document.activeElement;const inside=document.body.classList.contains('ilju-interior-open');dialog.querySelector('[data-leisure="walk"]').hidden=inside;dialog.querySelector('.leisure-moment').hidden=inside;dialog.querySelector('[data-leisure="overview"]').textContent=inside?(document.querySelector('[data-interior-overview]')?.textContent||'방 전체 보기'):document.querySelector('#overviewWorld')?.getAttribute('aria-pressed')==='true'?'나그네 가까이 보기':'신당 전체 보기';dialog.querySelector('[data-leisure="gate"]').textContent=inside?'신당 마당으로':'처음 자리';dialog.querySelector('.leisure-feedback').textContent='';dialog.showModal();document.body.classList.add('dialog-open');}
function closeTools(){dialog.close();}
function afterClose(action){closeTools();queueMicrotask(action);}
function source(){const detail={};document.dispatchEvent(new CustomEvent('sowon:scene-source',{detail}));return detail.source;}
function caption(label){const own=getOwnIdentity(),ilju=own?.hasIdentity&&safeIlju(own.ilju);return {place:typeof label==='string'?label.slice(0,30):'신당 마당',ilju:ilju?ilju+'일주':'달빛 나그네',date:new Intl.DateTimeFormat('ko-KR',{year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Seoul'}).format(new Date())};}
function drawCard(context,canvas,meta,{video=false}={}){
  const {width:w,height:h}=context.canvas,top=video?0:74,bottom=video?46:100,space=h-top-bottom;
  context.fillStyle='#f4f2e9';context.fillRect(0,0,w,h);
  const portrait=canvas.height>canvas.width*1.1,scale=(portrait?Math.max:Math.min)(w/canvas.width,space/canvas.height),dw=canvas.width*scale,dh=canvas.height*scale;
  context.fillStyle='#142332';context.fillRect(0,top,w,space);context.save();context.beginPath();context.rect(0,top,w,space);context.clip();context.drawImage(canvas,(w-dw)/2,top+(space-dh)/2,dw,dh);context.restore();
  context.fillStyle='#304c3e';context.font=`600 ${video?19:28}px sans-serif`;context.textAlign='left';
  if(!video){context.fillText('삼라 신당',34,47);context.font='16px sans-serif';context.textAlign='right';context.fillText(meta.date,w-34,45);}
  context.textAlign='left';context.font=`600 ${video?19:26}px sans-serif`;context.fillText(meta.place,video?22:34,h-(video?16:56));
  context.textAlign='right';context.font=`${video?16:18}px sans-serif`;context.fillText(video?'samra.cc/sowon':meta.ilju,w-(video?22:34),h-(video?16:57));
  if(!video){context.textAlign='left';context.font='16px sans-serif';context.fillStyle='#768476';context.fillText('잠깐의 산책, 나를 알아가는 시간',34,h-27);context.textAlign='right';context.fillText('samra.cc/sowon',w-34,h-27);}
}
function showOutput(blob,type){
  if(!blob?.size)throw new Error('empty_media');
  if(outputUrl)URL.revokeObjectURL(outputUrl);outputUrl=URL.createObjectURL(blob);
  const stamp=new Date().toISOString().replace(/[:.]/g,'-');outputName=`samra-shrine-${stamp}.${type==='image'?'png':blob.type.includes('mp4')?'mp4':'webm'}`;
  const media=document.createElement(type==='image'?'img':'video');media.src=outputUrl;
  if(type==='image')media.alt='삼라 신당에서 저장한 풍경 카드';else{media.controls=true;media.playsInline=true;media.loop=true;media.muted=true;media.setAttribute('aria-label','내가 녹화한 신당 영상');}
  result.querySelector('.leisure-media').replaceChildren(media);result.querySelector('#sceneResultTitle').textContent=type==='image'?'오늘의 장면':'내가 걸었던 신당';
  const download=result.querySelector('[data-download]');download.href=outputUrl;download.download=outputName;
  result.querySelector('.leisure-save-note').textContent=type==='image'?'출생정보와 이름표는 카드에 담지 않았어요.':'영상 파일을 저장해 확인할 수 있어요. 자동으로 게시되지는 않아요.';
  if(!document.querySelector('dialog[open]')){result.showModal();document.body.classList.add('dialog-open');}else pendingOutput=true;
  document.dispatchEvent(new CustomEvent('sowon:journey-action',{detail:{id:type==='image'?'photo':'video'}}));
}
async function photo(){
  try{const view=source();if(!view?.canvas?.width)throw new Error('unavailable');view.draw();const canvas=document.createElement('canvas');const portrait=view.canvas.height>view.canvas.width*1.1;canvas.width=portrait?1080:1200;canvas.height=portrait?1920:850;const ctx=canvas.getContext('2d');drawCard(ctx,view.canvas,caption(view.label));const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));showOutput(blob,'image');}
  catch{openTools();dialog.querySelector('.leisure-feedback').textContent='장면을 저장하지 못했어요. 입체 공간이 열린 뒤 다시 시도해 주세요.';}
}
function stopRecording(){if(recording&&recording.recorder.state!=='inactive')recording.recorder.stop();}
function record(){
  if(recording)return;
  let session=null;
  function cleanup(){if(!session||session.cleaned)return false;session.cleaned=true;clearInterval(session.tick);clearTimeout(session.finish);session.unsubscribe?.();session.stream?.getTracks().forEach(track=>track.stop());if(recording===session)recording=null;recorderBar.hidden=true;document.body.classList.remove('is-scene-recording');return true;}
  function failed(){if(session&&!cleanup())return;if(document.hidden)return;openTools();dialog.querySelector('.leisure-feedback').textContent='영상을 만들지 못했어요. 오늘의 장면에서 사진을 먼저 남겨 보세요.';}
  try{
    const view=source();if(!view?.canvas||!view.subscribe||typeof MediaRecorder==='undefined'||typeof HTMLCanvasElement.prototype.captureStream!=='function')throw new Error('unsupported');
    const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm','video/mp4'].find(type=>MediaRecorder.isTypeSupported(type));if(!mime)throw new Error('unsupported');
    const canvas=document.createElement('canvas');const portrait=view.canvas.height>view.canvas.width*1.1;canvas.width=portrait?720:1280;canvas.height=portrait?1280:766;const ctx=canvas.getContext('2d'),meta=caption(view.label);let last=0;
    const paint=now=>{if(now-last<32)return;last=now;drawCard(ctx,view.canvas,meta,{video:true});};
    view.draw();paint(performance.now());
    session={stream:canvas.captureStream(30),cleaned:false};
    const recorder=new MediaRecorder(session.stream,{mimeType:mime,videoBitsPerSecond:3000000}),chunks=[];
    session.recorder=recorder;session.unsubscribe=view.subscribe(paint);const started=performance.now();
    session.tick=setInterval(()=>{recorderBar.querySelector('b').textContent=Math.max(0,Math.ceil(clipSeconds-(performance.now()-started)/1000))+'초';},200);
    session.finish=setTimeout(stopRecording,clipSeconds*1000);
    recording=session;recorderBar.hidden=false;document.body.classList.add('is-scene-recording');recorderBar.querySelector('b').textContent=clipSeconds+'초';
    recorder.ondataavailable=event=>{if(event.data.size&&!session.cleaned)chunks.push(event.data);};
    recorder.onstop=()=>{if(!cleanup())return;try{showOutput(new Blob(chunks,{type:mime}),'video');}catch{if(!document.hidden){openTools();dialog.querySelector('.leisure-feedback').textContent='영상을 만들지 못했어요. 사진 카드로 먼저 남겨 보세요.';}}};
    recorder.onerror=failed;recorder.start(200);
  }catch{cleanup();openTools();dialog.querySelector('.leisure-feedback').textContent='이 브라우저에서는 영상 녹화를 지원하지 않아요. 오늘의 장면에서 사진을 저장할 수 있어요.';}
}
function quiet(value){document.body.classList.toggle('leisure-quiet',value);quietExit.hidden=!value;launcher.querySelector('[data-quiet-toggle]').setAttribute('aria-pressed',String(value));if(value)quietExit.focus({preventScroll:true});}
launcher.addEventListener('click',event=>{if(event.target.closest('[data-open-leisure]'))openTools();else quiet(true);});quietExit.onclick=()=>quiet(false);
dialog.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-close-leisure')){closeTools();return;}
  if(button.dataset.clipSeconds){clipSeconds=Number(button.dataset.clipSeconds);dialog.querySelectorAll('[data-clip-seconds]').forEach(x=>x.setAttribute('aria-pressed',String(x===button)));return;}
  const action=button.dataset.leisure;if(!action)return;
  if(action==='photo'){afterClose(photo);return;}if(action==='record'){afterClose(record);return;}
  if(action==='walk'){afterClose(()=>{if(document.body.classList.contains('ilju-interior-open')){openTools();dialog.querySelector('.leisure-feedback').textContent='신당 마당으로 돌아가면 한 바퀴 산책을 시작할 수 있어요.';}else document.dispatchEvent(new CustomEvent('sowon:guided-walk',{detail:{action:'start'}}));});return;}
  if(action==='lantern'){if(document.body.classList.contains('ilju-interior-open')){dialog.querySelector('.leisure-feedback').textContent='정각의 등불은 신당 마당에서 볼 수 있어요.';return;}afterClose(()=>document.dispatchEvent(new CustomEvent('sowon:lantern-preview')));return;}
  if(action==='wardrobe'){afterClose(()=>document.dispatchEvent(new CustomEvent('sowon:wardrobe-open')));return;}
  if(action==='quiet'){afterClose(()=>quiet(true));return;}
  if(action==='journal'||action==='knowledge'){afterClose(()=>document.dispatchEvent(new CustomEvent('sowon:'+action+'-open')));return;}
  if(action==='rest'){afterClose(()=>document.dispatchEvent(new CustomEvent('sowon:rest-open')));return;}
  const inside=document.body.classList.contains('ilju-interior-open');
  if(inside&&action==='greet'){afterClose(()=>document.dispatchEvent(new CustomEvent('sowon:interior-greet')));return;}
  const target={overview:inside?'[data-interior-overview]':'#overviewWorld',greet:'#greetTraveler',gate:inside?'[data-interior-back]':'#returnToGate',settings:'[data-open-traveler]'}[action];if(target)afterClose(()=>document.querySelector(target)?.click());
});
result.addEventListener('click',event=>{if(event.target.closest('[data-result-close]'))result.close();});
for(const node of [dialog,result])node.addEventListener('close',()=>{if(!document.querySelector('dialog[open]'))document.body.classList.remove('dialog-open');if(node===result){result.querySelector('video')?.pause();}if(opener?.isConnected)opener.focus({preventScroll:true});});
walkBar.querySelector('button').onclick=()=>document.dispatchEvent(new CustomEvent('sowon:guided-walk',{detail:{action:'stop'}}));
document.addEventListener('sowon:walk-state',event=>{const s=event.detail;walkBar.hidden=!['walking','resting'].includes(s.phase);if(walkBar.hidden)return;walkBar.querySelector('[data-walk-step]').textContent=`신당 한 바퀴 · ${s.index+1} / ${s.total} · ${s.phase==='walking'?'걷는 중':'잠깐 머무는 중'}`;walkBar.querySelector('[data-walk-title]').textContent=s.stop.title;walkBar.querySelector('[data-walk-text]').textContent=s.stop.text;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('leisure-quiet')&&!document.querySelector('dialog[open]'))quiet(false);});
document.addEventListener('sowon:quiet-set',event=>quiet(event.detail?.value===true));
recorderBar.querySelector('button').onclick=stopRecording;
new MutationObserver(()=>{const opened=document.querySelector('dialog[open]');if(recording&&opened)stopRecording();if(pendingOutput&&!opened){pendingOutput=false;result.showModal();document.body.classList.add('dialog-open');}}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopRecording();});
document.addEventListener('sowon:interior-state',stopRecording);document.addEventListener('sowon:room-change',stopRecording);
window.addEventListener('pagehide',()=>{stopRecording();if(outputUrl)URL.revokeObjectURL(outputUrl);});

document.addEventListener('sowon:scene-photo',photo);
