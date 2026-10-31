const ROOTS=new Set(['learn','ilju','term','tti','jami','star','cheongan','jiji','year']);
const TAGS=new Set(['article','section','div','p','h1','h2','h3','h4','h5','h6','ul','ol','li','dl','dt','dd','table','caption','colgroup','col','thead','tbody','tfoot','tr','th','td','strong','em','b','i','small','br','hr','blockquote','figure','figcaption','img','a','span','details','summary','pre','code','abbr','sup','sub','time','nav','aside']);
const DROP=new Set(['script','style','link','meta','iframe','object','embed','form','input','button','textarea','select','option','noscript','template','svg','math','audio','video','canvas','source','base']);
const mounts=new WeakMap();let sequence=0;

export function normalizeReferencePath(raw,origin='https://samra.cc'){
  if(typeof raw!=='string'||!raw||/[\x00-\x20\\%?#]/.test(raw)||raw.split('/').includes('..'))return null;
  try{
    const url=new URL(raw,origin+'/');
    if(url.origin!==origin||url.username||url.password||url.search||url.hash)return null;
    let path=url.pathname.replace(/\/index\.html$/,'/');
    if(!path.endsWith('/'))path+='/';
    if(!/^\/(?:[a-z0-9-]+\/)+$/.test(path)||!ROOTS.has(path.split('/')[1]))return null;
    return path;
  }catch(_){return null;}
}

function localUrl(raw,baseUrl,{image=false}={}){
  if(typeof raw!=='string'||!raw||/[\x00-\x1f\\]/.test(raw))return null;
  try{
    const base=new URL(baseUrl),url=new URL(raw,base);
    if(!['http:','https:'].includes(url.protocol)||url.username||url.password)return null;
    if(url.origin!==base.origin&&url.origin!=='https://samra.cc')return null;
    if(image&&(!/^\/(assets\/|store\/art\/|og\/)/.test(url.pathname)||!/\.(?:png|jpe?g|webp|gif|avif)$/i.test(url.pathname)||url.search||url.hash))return null;
    return url.pathname+url.search+url.hash;
  }catch(_){return null;}
}

/** Build new, inert article nodes. Never import source HTML or its executable attributes. */
export function sanitizeReferenceContent(source,targetDocument,baseUrl){
  const fragment=targetDocument.createDocumentFragment(),idMap=new Map(),localAnchors=[];
  const prefix='sr-'+(++sequence)+'-';
  function clone(node,parent){
    if(node.nodeType===3){parent.appendChild(targetDocument.createTextNode(node.textContent));return;}
    if(node.nodeType!==1)return;
    const tag=node.tagName.toLowerCase();if(DROP.has(tag))return;
    if(!TAGS.has(tag)){Array.from(node.childNodes).forEach(child=>clone(child,parent));return;}
    const output=targetDocument.createElement(tag);
    const id=node.getAttribute('id');if(id&&/^[A-Za-z][A-Za-z0-9_.:-]{0,100}$/.test(id)&&!idMap.has(id)){output.id=prefix+id;idMap.set(id,output);}
    for(const name of ['title','aria-label']){const value=node.getAttribute(name);if(value)output.setAttribute(name,value.slice(0,1000));}
    if(['td','th','col'].includes(tag))for(const name of ['colspan','rowspan','span']){const value=node.getAttribute(name);if(/^\d{1,2}$/.test(value||'')&&Number(value)>0&&Number(value)<=32)output.setAttribute(name,value);}
    if(tag==='th'&&['row','col','rowgroup','colgroup'].includes(node.getAttribute('scope')))output.setAttribute('scope',node.getAttribute('scope'));
    if(tag==='ol'&&/^-?\d{1,5}$/.test(node.getAttribute('start')||''))output.setAttribute('start',node.getAttribute('start'));
    if(tag==='details')output.setAttribute('open','');
    if(tag==='img'){
      const src=localUrl(node.getAttribute('src'),baseUrl,{image:true});if(!src)return;
      output.setAttribute('src',src);output.setAttribute('alt',(node.getAttribute('alt')||'').slice(0,1000));output.setAttribute('loading','lazy');output.setAttribute('decoding','async');output.setAttribute('referrerpolicy','no-referrer');
      for(const name of ['width','height']){const value=Number(node.getAttribute(name));if(Number.isInteger(value)&&value>0&&value<=4096)output.setAttribute(name,String(value));}
    }
    if(tag==='a'){
      const raw=node.getAttribute('href'),href=localUrl(raw,baseUrl);
      if(href){
        const current=new URL(baseUrl),resolved=new URL(href,current);
        if(resolved.pathname===current.pathname&&!resolved.search&&resolved.hash){localAnchors.push({output,id:resolved.hash.slice(1)});}
        else{output.setAttribute('href',href);output.setAttribute('rel','noreferrer');}
      }
    }
    Array.from(node.childNodes).forEach(child=>clone(child,output));parent.appendChild(output);
  }
  Array.from(source.childNodes).forEach(node=>clone(node,fragment));
  localAnchors.forEach(({output,id})=>{const target=idMap.get(id);if(target)output.setAttribute('href','#'+target.id);});
  return{fragment,idMap};
}

function el(tag,cls,text){const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;}

export async function mountReference(container,path,{navigate,signal,onTitle}={}){
  const canonical=normalizeReferencePath(path,location.origin);if(!canonical)throw new Error('Unsupported reference path');
  const controller=new AbortController(),token={};mounts.set(container,token);let disposed=false;
  const root=el('article','sr-root'),notice=el('p','sr-status','삼라의 글을 펼치는 중이에요…');notice.setAttribute('role','status');root.append(notice);container.replaceChildren(root);
  const active=()=>!disposed&&mounts.get(container)===token;
  const cleanup=()=>{disposed=true;controller.abort();signal?.removeEventListener('abort',cleanup);root.remove();if(mounts.get(container)===token)mounts.delete(container);};
  signal?.addEventListener('abort',cleanup,{once:true});if(signal?.aborted){cleanup();return cleanup;}
  root.addEventListener('click',event=>{
    const anchor=event.target.closest?.('a[href]');if(!anchor||!root.contains(anchor)||event.defaultPrevented||event.button>0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    const href=anchor.getAttribute('href');
    if(href.startsWith('#')){const target=root.querySelector('[id="'+href.slice(1)+'"]');if(target){event.preventDefault();target.tabIndex=-1;target.focus({preventScroll:true});target.scrollIntoView({block:'start',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});}return;}
    if(navigate){event.preventDefault();navigate(href,{kind:anchor.dataset.referenceFallback?'fallback':'reference'});}
  },{signal:controller.signal});
  try{
    const response=await fetch(canonical,{headers:{Accept:'text/html'},credentials:'same-origin',redirect:'error',signal:controller.signal});
    if(!response.ok)throw new Error('reference_fetch');
    const html=await response.text();if(!active())return cleanup;if(html.length>1500000)throw new Error('reference_size');
    const parsed=new DOMParser().parseFromString(html,'text/html');
    const source=parsed.querySelector('main .paper-inner');if(!source||!source.textContent.trim())throw new Error('reference_body');
    const title=(parsed.querySelector('h1')?.textContent||parsed.title||'삼라의 글').replace(/\s+/g,' ').trim().slice(0,200);
    const body=el('div','sr-body');body.append(sanitizeReferenceContent(source,document,new URL(canonical,location.origin).href).fragment);
    if(!active())return cleanup;
    root.replaceChildren(el('p','sr-kicker','SAMRA REFERENCE'),el('h2','sr-title',title),el('p','sr-intro','삼라 자료실의 원문을 함께 읽고 있어요.'),body);
    const footer=el('footer','sr-footer'),original=el('a','sr-original','기존 페이지에서 원문 열기 ↗');original.href=canonical;original.dataset.referenceFallback='true';footer.append(original);root.append(footer);onTitle?.(title);
  }catch(error){
    if(!active()||error?.name==='AbortError')return cleanup;
    notice.textContent='글을 불러오지 못했어요. 연결을 확인하거나 기존 페이지에서 읽어주세요.';
    const fallback=el('a','sr-original','기존 페이지에서 원문 열기 ↗');fallback.href=canonical;fallback.dataset.referenceFallback='true';root.append(fallback);
  }
  return cleanup;
}
