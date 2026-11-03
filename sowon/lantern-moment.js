import {MOMENT_COUNT,lanternMoment,lanternPose} from './lantern-moment-core.js?v=20261103-benchmark2';
/** Twenty-four lanterns, three instanced draw calls; no light per lantern. */
export function createLanternMoment(THREE){
  const group=new THREE.Group();group.name='hourly-lantern-moment';group.visible=false;
  const paper=new THREE.MeshStandardMaterial({color:'#f3d69c',emissive:'#e9a956',emissiveIntensity:.7,roughness:.9});
  const trim=new THREE.MeshStandardMaterial({color:'#876339',roughness:1});
  const glow=new THREE.MeshBasicMaterial({color:'#ffedb3'});
  const parts=[{geometry:new THREE.BoxGeometry(.30,.42,.30),material:paper,dy:0},{geometry:new THREE.BoxGeometry(.35,.04,.35),material:trim,dy:.23},{geometry:new THREE.BoxGeometry(.15,.03,.15),material:glow,dy:-.23}];
  for(const part of parts){part.mesh=new THREE.InstancedMesh(part.geometry,part.material,MOMENT_COUNT);part.mesh.frustumCulled=false;part.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);group.add(part.mesh);}
  const dummy=new THREE.Object3D();let previewStart=null,disposed=false,lastActive=false,lastPreview=false;
  function update(now,{calm=false}={}){const state=lanternMoment(now,{previewStart});if(disposed)return state;group.visible=state.active;
    if(state.active){for(let i=0;i<MOMENT_COUNT;i++){const pose=lanternPose(i,state.elapsed,{calm});for(const part of parts){dummy.position.set(pose.x,pose.y+part.dy*pose.scale,pose.z);dummy.rotation.set(0,pose.rotation||0,0);dummy.scale.setScalar(Math.max(0,pose.scale));dummy.updateMatrix();part.mesh.setMatrixAt(i,dummy.matrix);}}parts.forEach(p=>p.mesh.instanceMatrix.needsUpdate=true);}
    state.changed=lastActive!==state.active||lastPreview!==state.preview;lastActive=state.active;lastPreview=state.preview;return state;
  }
  return {group,update,preview(now=Date.now()){if(!disposed)previewStart=now;},cancelPreview(){previewStart=null;},dispose(){if(disposed)return;disposed=true;parts.forEach(p=>p.geometry.dispose());paper.dispose();trim.dispose();glow.dispose();group.removeFromParent();}};
}
