const KEY = 'samra.shrine.checkout.v1';
const TTL = 10 * 60 * 1000;
function valid(value, slug, now) {
  const b=value?.birth;
  return value?.slug===slug && /^[a-z0-9-]+$/.test(slug) && Number.isFinite(value.at) && now-value.at>=0 && now-value.at<=TTL &&
    b && ['y','mo','d','h','mi'].every(k=>Number.isInteger(b[k])) && b.y>=1900 && b.mo>=1 && b.mo<=12 && b.d>=1 && b.d<=31 &&
    b.h>=-1 && b.h<=23 && b.mi>=0 && b.mi<=59 && ['M','F'].includes(value.gender);
}
export function writeShrineCheckout(storage, slug, birth, name='', now=Date.now()) {
  const value={slug,at:now,gender:birth.g,birth:{y:birth.y,mo:birth.mo,d:birth.d,h:birth.unk?-1:birth.h,mi:birth.unk?0:birth.mi},name:String(name).slice(0,20)};
  if (!valid(value,slug,now)) return false;
  try { storage.setItem(KEY,JSON.stringify(value));return true; } catch (_) { return false; }
}
export function consumeShrineCheckout(storage, slug, now=Date.now()) {
  try { const value=JSON.parse(storage.getItem(KEY)||'null');
    if (!value) return null;
    if (!valid(value,slug,now)) { if(now-value.at>TTL || now<value.at)storage.removeItem(KEY);return null; }
    storage.removeItem(KEY);return value;
  } catch (_) { return null; }
}
