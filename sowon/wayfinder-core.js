export const DEFAULT_BOUNDS=Object.freeze({minX:-23,maxX:23,minZ:-25,maxZ:22});
export const MAP_SIZE=Object.freeze({width:320,height:300,padding:22});
export function validPoint(point){return Boolean(point&&Number.isFinite(point.x)&&Number.isFinite(point.z));}
export function mapPoint(point,{bounds=DEFAULT_BOUNDS,width=MAP_SIZE.width,height=MAP_SIZE.height,padding=MAP_SIZE.padding}={}){
  if(!validPoint(point)||![width,height,padding,bounds?.minX,bounds?.maxX,bounds?.minZ,bounds?.maxZ].every(Number.isFinite)||padding<0||width<=padding*2||height<=padding*2||bounds.minX>=bounds.maxX||bounds.minZ>=bounds.maxZ)return null;
  const spanX=bounds.maxX-bounds.minX,spanZ=bounds.maxZ-bounds.minZ,scale=Math.min((width-padding*2)/spanX,(height-padding*2)/spanZ);
  const offsetX=(width-spanX*scale)/2,offsetY=(height-spanZ*scale)/2;
  const x=Math.max(bounds.minX,Math.min(bounds.maxX,point.x)),z=Math.max(bounds.minZ,Math.min(bounds.maxZ,point.z));
  return{x:offsetX+(x-bounds.minX)*scale,y:offsetY+(z-bounds.minZ)*scale,inside:x===point.x&&z===point.z};
}
export function headingDegrees(rotation){if(!Number.isFinite(rotation))return null;return((180-rotation*180/Math.PI)%360+360)%360;}
export function routePoints(position,path=[],target=null){
  if(!validPoint(position))return[];
  const points=[{x:position.x,z:position.z}];
  if(Array.isArray(path))for(const point of path)if(validPoint(point)&&Math.hypot(point.x-points.at(-1).x,point.z-points.at(-1).z)>0.00001)points.push({x:point.x,z:point.z});
  if(validPoint(target)&&Math.hypot(target.x-points.at(-1).x,target.z-points.at(-1).z)>0.00001)points.push({x:target.x,z:target.z});
  return points;
}
export function routeDistance(position,path=[],target=null){const points=routePoints(position,path,target);let distance=0;for(let index=1;index<points.length;index++)distance+=Math.hypot(points[index].x-points[index-1].x,points[index].z-points[index-1].z);return distance;}
export function journeyProgress({position,path=[],target=null,totalDistance}={}){
  if(!validPoint(position)||!validPoint(target))return{remaining:0,total:Number.isFinite(totalDistance)&&totalDistance>0?totalDistance:0,completed:0,percent:0,arrived:false};
  const remaining=routeDistance(position,path,target),total=Number.isFinite(totalDistance)&&totalDistance>0?Math.max(totalDistance,remaining):remaining;
  const arrived=Math.hypot(position.x-target.x,position.z-target.z)<0.2&&remaining<0.2;
  const completed=Math.max(0,total-remaining),percent=total>0?Math.max(0,Math.min(100,Math.round(completed/total*100))):arrived?100:0;
  return{remaining,total,completed,percent,arrived};
}
