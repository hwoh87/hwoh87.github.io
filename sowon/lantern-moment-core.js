export const MOMENT_DURATION=45000;
export const MOMENT_COUNT=24;
export function lanternMoment(now,{previewStart=null}={}){
  if(!Number.isFinite(now)||now<0)return {active:false,preview:false,elapsed:0,progress:0,nextAt:null};
  const start=Math.floor(now/3600000)*3600000,realElapsed=now-start;
  const previewElapsed=Number.isFinite(previewStart)?now-previewStart:Infinity;
  const real=realElapsed<MOMENT_DURATION,preview=previewElapsed>=0&&previewElapsed<MOMENT_DURATION;
  const elapsed=preview?previewElapsed:real?realElapsed:0;
  return {active:real||preview,preview,elapsed,progress:elapsed/MOMENT_DURATION,nextAt:start+3600000};
}
export function lanternPose(index,elapsed,{calm=false}={}){
  if(!Number.isInteger(index)||index<0||index>=MOMENT_COUNT||!Number.isFinite(elapsed)||elapsed<0||elapsed>=MOMENT_DURATION)return {x:0,y:0,z:0,scale:0};
  const angle=index*2.39996323,spread=1.2+(index%5)*.62;
  const life=elapsed/1000-index*.48,p=life/30,visible=life>=0&&life<=30;
  if(!visible&&!calm)return {x:0,y:0,z:0,scale:0};
  return {x:Math.cos(angle)*spread+(calm?0:Math.sin(p*3+angle)*.7),y:calm?3.5+(index%6)*.72:.7+p*10,z:-2+Math.sin(angle)*spread,scale:calm?.85:Math.min(1,life/1.8,(30-life)/2)*.9,rotation:calm?angle:angle+p*.4};
}
