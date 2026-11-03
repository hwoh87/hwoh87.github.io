export const REST_DURATIONS=Object.freeze([60,180,300,600,1500]);
export const AUDIO_KEY='samra.sowon.audio.v1';
export function normalizeAudio(raw){const defaults={master:.3,nature:1,music:.5};for(const key of Object.keys(defaults))if(typeof raw?.[key]==='number'&&Number.isFinite(raw[key]))defaults[key]=Math.max(0,Math.min(1,raw[key]));return defaults;}
export function createRestTimer({now=()=>performance.now()}={}){
  let phase='idle',duration=60,elapsed=0,started=0;
  function snapshot(){const value=Math.min(duration*1000,elapsed+(phase==='running'?Math.max(0,now()-started):0));return {phase,duration,elapsed:value,remaining:Math.max(0,duration*1000-value),progress:Math.min(1,value/(duration*1000))};}
  function tick(){const s=snapshot();if(phase==='running'&&s.remaining===0){elapsed=duration*1000;phase='complete';}return snapshot();}
  return {getState:tick,start(seconds){if(!REST_DURATIONS.includes(seconds))return false;duration=seconds;elapsed=0;started=now();phase='running';return true;},pause(){const s=tick();if(phase!=='running')return s;elapsed=s.elapsed;phase='paused';return snapshot();},resume(){if(phase!=='paused')return false;started=now();phase='running';return true;},cancel(){phase='idle';elapsed=0;return snapshot();}};
}
