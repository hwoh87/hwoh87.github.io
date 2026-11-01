import { safeVisitors, safePosition, validId, roomForKey } from './social-core.js?v=20261101-realtime3';

export const MOTION_INTERVAL_MS = 200;
const finite = value => typeof value === 'number' && Number.isFinite(value);
const time = value => finite(value) && value >= 0;
const sequence = value => Number.isSafeInteger(value) && value >= 0;

/** Positions are public virtual-world coordinates, never physical location. */
export function realtimePosition(raw) {
  if (!raw || !finite(raw.x) || !finite(raw.z) || Math.abs(raw.x) > 23 || raw.z < -25 || raw.z > 22) return null;
  if (raw.heading !== undefined && !finite(raw.heading)) return null;
  const value = safePosition(raw);
  return { x: Math.round(value.x * 100) / 100, z: Math.round(value.z * 100) / 100,
    heading: Math.round(value.heading * 1000) / 1000, outfit: value.outfit };
}

export function movementChanged(previous, current) {
  if (!current) return false;
  if (!previous) return true;
  const turn = Math.atan2(Math.sin(current.heading-previous.heading),Math.cos(current.heading-previous.heading));
  return Math.hypot(current.x-previous.x,current.z-previous.z) >= .02 || Math.abs(turn) >= .025 || current.outfit !== previous.outfit;
}

/** A credential is accepted only from the authenticated ticket endpoint. */
export function realtimeTicket(raw, expected, now=Date.now()) {
  if (raw?.available === false) return {available:false};
  if (raw?.available !== true || typeof raw.url !== 'string' || typeof raw.ticket !== 'string' || raw.ticket.length < 20 || raw.ticket.length > 8192) return null;
  let url;
  try { url = new URL(raw.url); } catch (_) { return null; }
  const loopback = ['localhost','127.0.0.1','[::1]'].includes(url.hostname);
  if (url.protocol !== 'wss:' && !(url.protocol === 'ws:' && loopback)) return null;
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/ws') return null;
  const expiresAt = typeof raw.expires_at === 'number' ? raw.expires_at : Date.parse(raw.expires_at);
  if (!time(expiresAt) || expiresAt <= now+2000) return null;
  if ((raw.self_id !== undefined && raw.self_id !== expected.selfId) || (raw.room_key !== undefined && raw.room_key !== expected.roomKey)
      || (raw.presence_epoch !== undefined && raw.presence_epoch !== expected.presenceEpoch)) return null;
  return {available:true,url:url.href,ticket:raw.ticket,expiresAt};
}

/** Control messages and frame headers never carry request authority or birth data. */
export function realtimePacket(raw, expected, lastSequence=-1) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  if (raw.type === 'ready') {
    if (raw.selfId !== expected.selfId || raw.roomKey !== expected.roomKey || !validId(raw.connectionId) || !time(raw.serverTime)) return null;
    return {type:'ready',selfId:raw.selfId,roomKey:raw.roomKey,connectionId:raw.connectionId,serverTime:raw.serverTime};
  }
  if (raw.type === 'frame') {
    if (raw.roomKey !== expected.roomKey || !sequence(raw.sequence) || raw.sequence <= lastSequence || !time(raw.serverTime) || !Array.isArray(raw.visitors)) return null;
    const positions = raw.visitors.filter(peer=>realtimePosition(peer));
    const visitors = safeVisitors(positions,expected.selfId).slice(0,24);
    return {type:'frame',roomKey:raw.roomKey,sequence:raw.sequence,serverTime:raw.serverTime,visitors,
      onlineCount:Number.isSafeInteger(raw.onlineCount)&&raw.onlineCount>=0&&raw.onlineCount<=1000000 ? raw.onlineCount : null};
  }
  if (raw.type === 'social') {
    if (raw.roomKey !== expected.roomKey || !time(raw.serverTime)) return null;
    return {type:'social',roomKey:raw.roomKey,serverTime:raw.serverTime,invalidateResult:raw.invalidateResult===true,
      ...(validId(raw.requestId)?{requestId:raw.requestId}:{})};
  }
  if (raw.type === 'renewed' && time(raw.expiresAt) && time(raw.serverTime)) return {type:'renewed',expiresAt:raw.expiresAt,serverTime:raw.serverTime};
  if (raw.type === 'pong' && time(raw.serverTime)) return {type:'pong',serverTime:raw.serverTime};
  if (raw.type === 'error') return {type:'error'};
  return null;
}

export function validRealtimeIdentity(value) {
  return Boolean(value && validId(value.selfId) && roomForKey(value.roomKey) && Number.isInteger(value.presenceEpoch) && value.presenceEpoch>=0);
}

/** Per-socket compact snapshots. Updates commit atomically after validation. */
export function createRealtimeFrameDecoder(expected) {
  let aliases=new Map(),lastSequence=-1,initialized=false;
  const validAlias=value=>Number.isSafeInteger(value)&&value>0;
  const publicRow=raw=>{
    const position=realtimePosition(raw);
    if(!raw||typeof raw!=='object'||!validAlias(raw.k)||!sequence(raw.seq)||!position||!finite(raw.heading))return null;
    const value=safeVisitors([raw],expected.selfId)[0];
    if(!value)return null;
    if(raw.sentAt!==undefined&&!time(raw.sentAt))return null;
    return {...value,...position,seq:raw.seq,...(time(raw.sentAt)?{sentAt:raw.sentAt}:{})};
  };
  function reset(){aliases=new Map();lastSequence=-1;initialized=false;}
  function read(raw){
    if(raw?.type!=='frame')return realtimePacket(raw,expected,lastSequence);
    if(typeof raw.full!=='boolean'||!Array.isArray(raw.visitors)||!Array.isArray(raw.motions)||!Array.isArray(raw.gone))return null;
    if(raw.visitors.length>24||raw.motions.length>24||raw.gone.length>24||(!initialized&&!raw.full))return null;
    const base=realtimePacket({...raw,visitors:[]},expected,lastSequence);
    if(!base)return null;
    const next=raw.full?new Map():new Map(aliases),gone=new Set(),upserts=new Set();
    for(const k of raw.gone){if(!validAlias(k)||gone.has(k))return null;gone.add(k);next.delete(k);}
    for(const row of raw.visitors){
      if(gone.has(row?.k)||upserts.has(row?.k))return null;
      const value=publicRow(row);if(!value)return null;
      const before=next.get(row.k);
      if(before&&before.id!==value.id)return null;
      upserts.add(row.k);
      if(!before||value.seq>=before.seq)next.set(row.k,value);
    }
    const moved=new Set();
    for(const tuple of raw.motions){
      if(!Array.isArray(tuple)||tuple.length!==6)return null;
      const [k,seq,x,z,heading,sentAt]=tuple;
      if(!validAlias(k)||!sequence(seq)||gone.has(k)||moved.has(k)||!next.has(k)||!finite(heading)||(sentAt!==null&&!time(sentAt)))return null;
      const position=realtimePosition({x,z,heading,outfit:next.get(k).outfit});if(!position)return null;
      moved.add(k);const before=next.get(k);
      if(seq>before.seq){const {sentAt:previousSentAt,...rest}=before;next.set(k,{...rest,...position,seq,...(sentAt!==null?{sentAt}:{})});}
    }
    if(next.size>24||new Set([...next.values()].map(row=>row.id)).size!==next.size)return null;
    aliases=next;lastSequence=raw.sequence;initialized=true;
    return {...base,visitors:[...aliases.values()].map(row=>({...row}))};
  }
  return {read,reset,getState(){return {sequence:lastSequence,initialized,size:aliases.size};}};
}

export function reconnectDelay(attempt,random=Math.random) {
  const base=Math.min(30000,1000*2**Math.min(5,Math.max(0,attempt)));
  return Math.round(Math.min(30000,base*(.8+Math.max(0,Math.min(1,random()))*.4)));
}
