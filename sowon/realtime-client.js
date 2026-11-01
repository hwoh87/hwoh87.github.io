import { MOTION_INTERVAL_MS, realtimePosition, movementChanged, realtimeTicket, createRealtimeFrameDecoder, validRealtimeIdentity, reconnectDelay } from './realtime-client-core.js?v=20261101-realtime3';

/** Authenticated socket lifetime. Credentials exist only in the auth frame. */
export function createRealtimeClient({getTicket,getPosition,onReady,onFrame,onNotify,onStatus,onFatal,
  WebSocket:Socket=globalThis.WebSocket,setTimer=globalThis.setTimeout,clearTimer=globalThis.clearTimeout,
  now=()=>Date.now(),random=Math.random}={}) {
  let running=false,disposed=false,generation=0,socket=null,identity=null,connected=false,retries=0;
  let lastSequence=-1,motionSequence=0,lastPosition=null,lastMotionAt=0,lastReceiveAt=0,lastPingAt=0,connectedAt=0,renewTimer=null;
  const timers=new Set();
  const later=(fn,ms)=>{const id=setTimer(()=>{timers.delete(id);fn();},ms);timers.add(id);return id;};
  const cancel=id=>{if(id!==null){clearTimer(id);timers.delete(id);}};
  const cancelTimers=()=>{for(const id of timers)clearTimer(id);timers.clear();renewTimer=null;};
  const status=value=>onStatus?.(value);
  const memberChanged=value=>value?.available===true&&((value.self_id!==undefined&&value.self_id!==identity.selfId)||(value.room_key!==undefined&&value.room_key!==identity.roomKey)||(value.presence_epoch!==undefined&&value.presence_epoch!==identity.presenceEpoch));
  function current(ticket){return running&&!disposed&&ticket===generation;}
  function send(value) {
    if (!socket || socket.readyState !== 1 || socket.bufferedAmount > 131072) return false;
    try {socket.send(JSON.stringify(value));return true;} catch (_) {return false;}
  }
  function closeSocket() {const old=socket;socket=null;try{old?.close(1000,'connection reset');}catch(_){} }
  function retry(ticket) {
    if(!current(ticket))return;
    if(connected&&now()-connectedAt>=10000)retries=0;
    ++generation;cancelTimers();closeSocket();connected=false;lastSequence=-1;status('reconnecting');
    // A free host can stop accepting sockets after its daily allowance. Leave
    // HTTP encounters available without repeatedly minting tickets all day.
    if(retries>=6){running=false;status('unavailable');return;}
    const delay=reconnectDelay(retries++,random);
    later(()=>{if(running&&!disposed)void connect();},delay);
  }
  function fatal(ticket,error) {
    if(!current(ticket))return;
    ++generation;running=false;connected=false;cancelTimers();closeSocket();status('unavailable');onFatal?.(error);
  }
  function scheduleRenew(ticket,expiresAt) {
    cancel(renewTimer);
    const delay=Math.max(1000,Math.min(30000,(expiresAt-now())*.6));
    renewTimer=later(()=>void renew(ticket),delay);
  }
  async function renew(ticket) {
    if(!current(ticket)||!connected)return;
    try {
      const raw=await getTicket();
      if(!current(ticket))return;
      if(memberChanged(raw)){fatal(ticket,{code:'presence_changed'});return;}
      const fresh=realtimeTicket(raw,identity,now());
      if(!fresh?.available || fresh.url!==socket?.url || !send({type:'auth',ticket:fresh.ticket})) {retry(ticket);return;}
      scheduleRenew(ticket,fresh.expiresAt);
    } catch(error) {
      if(['session_expired','invalid_session','profile_required','presence_changed'].includes(error?.code))fatal(ticket,error);
      else retry(ticket);
    }
  }
  function motion(ticket) {
    if(!current(ticket)||!connected)return;
    if(now()-lastReceiveAt>12000){retry(ticket);return;}
    if(now()-lastPingAt>=5000){if(!send({type:'ping',sentAt:now()})){retry(ticket);return;}lastPingAt=now();}
    let position;
    try {position=realtimePosition(getPosition?.());}catch(_){}
    if(position&&(movementChanged(lastPosition,position)||now()-lastMotionAt>=10000)) {
      if(send({type:'motion',seq:++motionSequence,...position,sentAt:now()})){lastPosition=position;lastMotionAt=now();}
      else if(socket?.bufferedAmount>131072){retry(ticket);return;}
    }
    later(()=>motion(ticket),MOTION_INTERVAL_MS);
  }
  async function connect() {
    if(!running||disposed)return;
    const ticket=++generation;connected=false;lastSequence=-1;motionSequence=0;lastPosition=null;status('connecting');
    try {
      const raw=await getTicket();
      if(!current(ticket))return;
      if(memberChanged(raw)){fatal(ticket,{code:'presence_changed'});return;}
      const credential=realtimeTicket(raw,identity,now());
      if(credential?.available===false){running=false;status('unavailable');return;}
      if(!credential)throw new Error('invalid_realtime_ticket');
      const ws=new Socket(credential.url),decoder=createRealtimeFrameDecoder(identity);socket=ws;
      const authTimeout=later(()=>retry(ticket),10000);
      ws.addEventListener('open',()=>{
        if(!current(ticket))return;
        if(!send({type:'auth',ticket:credential.ticket}))retry(ticket);
      });
      ws.addEventListener('message',event=>{
        if(!current(ticket))return;
        if(typeof event.data!=='string'||event.data.length>65536){retry(ticket);return;}
        let data;try{data=JSON.parse(event.data);}catch(_){retry(ticket);return;}
        const packet=decoder.read(data);
        if(!packet){
          // A missed alias/full baseline cannot be repaired by later deltas.
          if(data?.type==='frame'&&data.roomKey===identity.roomKey&&Number.isSafeInteger(data.sequence)&&data.sequence>lastSequence)retry(ticket);
          return;
        }
        lastReceiveAt=now();
        if(packet.type==='error'){retry(ticket);return;}
        if(packet.type==='ready') {
          if(connected)return;
          cancel(authTimeout);connected=true;connectedAt=now();lastPingAt=now();status('ready');scheduleRenew(ticket,credential.expiresAt);
          onReady?.(packet);motion(ticket);return;
        }
        if(!connected)return;
        if(packet.type==='frame'){lastSequence=packet.sequence;onFrame?.(packet);}
        else if(packet.type==='social')onNotify?.(packet);
      });
      ws.addEventListener('error',()=>retry(ticket));
      ws.addEventListener('close',event=>event.code===4001?fatal(ticket,{code:'presence_changed'}):retry(ticket));
    } catch(error) {
      if(['session_expired','invalid_session','profile_required','presence_changed'].includes(error?.code))fatal(ticket,error);
      else if(['invalid_action','service_unavailable'].includes(error?.code)){if(current(ticket)){running=false;connected=false;cancelTimers();closeSocket();status('unavailable');}}
      else retry(ticket);
    }
  }
  function stop() {++generation;running=false;connected=false;cancelTimers();closeSocket();identity=null;lastPosition=null;lastSequence=-1;status('stopped');}
  return {
    start(value) {if(disposed||running||!validRealtimeIdentity(value)||typeof Socket!=='function'||typeof getTicket!=='function')return false;identity={selfId:value.selfId,roomKey:value.roomKey,presenceEpoch:value.presenceEpoch};running=true;void connect();return true;},
    stop,
    dispose(){if(disposed)return;stop();disposed=true;},
    getState(){return {running,connected,generation,retries,lastSequence};},
  };
}
