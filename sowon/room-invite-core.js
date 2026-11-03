import {roomForIlju,roomForKey} from './ilju-room-core.js?v=20261103-benchmark2';
export function publicRoomLink(key){const room=roomForKey(key);return room&&room.ilju?'https://samra.cc/sowon/?room='+encodeURIComponent(room.ilju):null;}
export function invitedRoom(raw){try{const url=new URL(raw);if(url.pathname!=='/sowon/'||url.searchParams.getAll('room').length!==1)return null;return roomForIlju(url.searchParams.get('room'));}catch{return null;}}
