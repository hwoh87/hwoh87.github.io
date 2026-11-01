import { getOwnProfile } from './profile.js?v=20261101-freepath1';
import { loadReadingEngine } from './readings.js?v=20261101-freepath1';
import { createIdentityTracker } from './identity-core.js?v=20261101-freepath1';

const identity=createIdentityTracker({getProfile:getOwnProfile,loadEngine:loadReadingEngine,
  announce:detail=>document.dispatchEvent(new CustomEvent('sowon:identity-change',{detail}))});
export const getOwnIdentity=()=>identity.current();
document.addEventListener('sowon:profile-change',()=>void identity.refresh());
document.addEventListener('sowon:identity-request',()=>identity.announce());
void identity.refresh();
