import { getNpcPersona, prepareDialogueQuestion, normalizeDialogueAnswer, projectDialogueHistory, projectDialogueReading } from './dialogue-core.js?v=20261101-flashlite1';

export const SHRINE_CHAT_ENDPOINT = 'https://sidxbzpbesbaiokxrqsf.supabase.co/functions/v1/shrine-chat';
export const SHRINE_CHAT_MODEL = 'gemini-3.5-flash-lite';
export const SHRINE_CHAT_TIMEOUT_MS = 45000;
const MAX_REQUEST_BYTES = 24 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024;
const MESSAGES = Object.freeze({
  aborted:'대화를 멈췄어요. 원할 때 다시 질문해 주세요.',
  timeout:'답변이 늦어지고 있어요. 잠시 후 다시 질문해 주세요.',
  network:'연결을 확인한 뒤 다시 질문해 주세요.',
  invalid_request:'질문을 짧게 정리해 다시 보내 주세요.',
  private_content:'출생정보나 비밀 키는 보내지 말고, 궁금한 주제만 적어 주세요.',
  rate_limited:'질문이 잠시 많아졌어요. 조금 기다린 뒤 다시 이야기해요.',
  unavailable:'지금은 대화를 준비하지 못했어요. 잠시 후 다시 질문해 주세요.',
  invalid_response:'답변을 안전하게 읽지 못했어요. 다시 질문해 주세요.',
  server_error:'답변을 준비하지 못했어요. 잠시 후 다시 질문해 주세요.',
});

export class ShrineChatError extends Error {
  constructor(code,retryAfter){
    super(MESSAGES[code]||MESSAGES.server_error);this.name='ShrineChatError';this.code=Object.hasOwn(MESSAGES,code)?code:'server_error';
    if(Number.isFinite(retryAfter)&&retryAfter>0)this.retryAfter=Math.min(86400,Math.ceil(retryAfter));
  }
}
const failure=(code,retryAfter)=>new ShrineChatError(code,retryAfter);
const bytes=value=>new TextEncoder().encode(value).byteLength;

function payload(input){
  const npc=getNpcPersona(input?.npc),question=prepareDialogueQuestion(input?.question);
  if(question?.private)throw failure('private_content');
  if(!npc||!question?.text)throw failure('invalid_request');
  const reading=input.reading==null?null:projectDialogueReading(input.reading,npc.readingKind);
  if(input.reading!=null&&!reading)throw failure('invalid_request');
  const value={npc:npc.id,question:question.text,history:projectDialogueHistory(input.history),reading};
  let body=JSON.stringify(value);
  // The current question and its calculated evidence take priority over older
  // conversation pairs, including long Korean answers with larger UTF-8 size.
  while(bytes(body)>MAX_REQUEST_BYTES&&value.history.length){value.history.shift();body=JSON.stringify(value);}
  if(bytes(body)>MAX_REQUEST_BYTES)throw failure('invalid_request');
  return {body,npc:npc.id};
}
async function boundedJson(response){
  const length=response.headers?.get?.('content-length');
  if(length&&Number(length)>MAX_RESPONSE_BYTES)throw failure('invalid_response');
  let raw='';
  if(response.body?.getReader){
    const reader=response.body.getReader(),chunks=[];let size=0;
    try{
      while(true){
        const {value,done}=await reader.read();if(done)break;
        size+=value.byteLength;if(size>MAX_RESPONSE_BYTES){void reader.cancel().catch(()=>{});throw failure('invalid_response');}chunks.push(value);
      }
      const buffer=new Uint8Array(size);let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.byteLength;}
      raw=new TextDecoder('utf-8',{fatal:true}).decode(buffer);
    }finally{reader.releaseLock();}
  }else if(typeof response.text==='function'){
    raw=await response.text();if(typeof raw!=='string'||bytes(raw)>MAX_RESPONSE_BYTES)throw failure('invalid_response');
  }else throw failure('invalid_response');
  try{return JSON.parse(raw);}catch(_){throw failure('invalid_response');}
}
function errorForResponse(response,body){
  const status=response.status;
  const known={private_content:'private_content',invalid_reading:'invalid_request',invalid_answer:'invalid_response',model_timeout:'timeout',request_cancelled:'aborted',rate_limited:'rate_limited',rate_limit_unavailable:'unavailable'};
  const code=status===429?'rate_limited':Object.hasOwn(known,body?.error)?known[body.error]:status===400||status===413?'invalid_request':status===503||status===502||status===504?'unavailable':'server_error';
  const retry=Number(body?.retry_after??response.headers?.get?.('retry-after'));
  return failure(code,code==='rate_limited'?(Number.isFinite(retry)&&retry>0?retry:30):undefined);
}

/** No credentials, birth fields, persistence, telemetry or automatic retries. */
export function createShrineChatClient({fetchImpl=globalThis.fetch,timeoutMs=SHRINE_CHAT_TIMEOUT_MS}={}){
  const duration=Number.isFinite(timeoutMs)&&timeoutMs>0?Math.min(timeoutMs,SHRINE_CHAT_TIMEOUT_MS):SHRINE_CHAT_TIMEOUT_MS;
  return {
    async request(input,{signal}={}){
      let prepared;try{prepared=payload(input);}catch(error){if(error instanceof ShrineChatError)throw error;throw failure('invalid_request');}
      if(signal?.aborted)throw failure('aborted');
      if(typeof fetchImpl!=='function')throw failure('network');
      const controller=new AbortController();let timer,removeAbort=()=>{},stopped=false;
      const stop=new Promise((_,reject)=>{
        const abort=()=>{if(stopped)return;stopped=true;controller.abort();reject(failure('aborted'));};
        if(signal?.addEventListener){signal.addEventListener('abort',abort,{once:true});removeAbort=()=>signal.removeEventListener('abort',abort);}
        timer=setTimeout(()=>{if(stopped)return;stopped=true;controller.abort();reject(failure('timeout'));},duration);
      });
      const send=async()=>{
        let response;
        try{response=await fetchImpl(SHRINE_CHAT_ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:prepared.body,signal:controller.signal,credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store'});}
        catch(_){throw failure('network');}
        if(!response||!Number.isInteger(response.status))throw failure('invalid_response');
        if(response.status<200||response.status>=300){let body=null;try{body=await boundedJson(response);}catch(_){}throw errorForResponse(response,body);}
        const body=await boundedJson(response),answer=normalizeDialogueAnswer(body?.answer);
        if(!body||body.npc!==prepared.npc||body.source!=='gemini'||body.model!==SHRINE_CHAT_MODEL||!answer)throw failure('invalid_response');
        return {npc:prepared.npc,answer,source:'gemini',model:SHRINE_CHAT_MODEL};
      };
      try{return await Promise.race([send(),stop]);}
      catch(error){controller.abort();if(error instanceof ShrineChatError)throw error;throw failure('invalid_response');}
      finally{stopped=true;clearTimeout(timer);removeAbort();}
    },
  };
}
