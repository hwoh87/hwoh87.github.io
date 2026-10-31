import { readSettings, writeSettings, normalizeSettings } from './experience-core.js';
import { getOwnProfile } from './profile.js?v=20261101-editorial1';

let storage;
try { storage = localStorage; } catch (_) {}
let settings = readSettings(storage);
const body = document.body;
const settingsDialog = document.createElement('dialog');
settingsDialog.className = 'xp-dialog';
settingsDialog.id = 'travelerDialog';
settingsDialog.setAttribute('aria-labelledby', 'travelerTitle');
settingsDialog.innerHTML = `<header class="xp-dialog-header"><div><p>YOUR LITTLE SANCTUARY</p><h2 id="travelerTitle">나그네의 취향</h2></div><button class="xp-close" type="button" aria-label="나그네 설정 닫기">×</button></header><div class="xp-settings-body"><p class="xp-lead">오늘의 풍경을, 나에게 편안한 모습으로.</p><fieldset><legend>머물고 싶은 시간</legend><div class="xp-moods"><button type="button" data-xp-mood="moon"><span class="xp-mood-scene xp-mood-moon" aria-hidden="true">☾</span><strong>달이 머무는 밤</strong><small>차분한 푸른 달빛</small></button><button type="button" data-xp-mood="dawn"><span class="xp-mood-scene xp-mood-dawn" aria-hidden="true">☀</span><strong>빛이 스미는 새벽</strong><small>따뜻한 복숭앗빛 하늘</small></button></div></fieldset><fieldset><legend>오늘의 한복</legend><div class="xp-outfits"><button type="button" data-xp-outfit="sage"><i style="--cloth:#8eaa98;--jacket:#e9e4cf"></i>숲빛</button><button type="button" data-xp-outfit="moon"><i style="--cloth:#788fa9;--jacket:#e5e8ed"></i>달빛</button><button type="button" data-xp-outfit="dawn"><i style="--cloth:#c6927c;--jacket:#f0dec9"></i>살구빛</button><button type="button" data-xp-outfit="plum"><i style="--cloth:#97839e;--jacket:#e9dfeb"></i>자줏빛</button></div></fieldset><fieldset><legend>화면의 편안함</legend><div class="xp-quality"><button type="button" data-xp-quality="auto">자동</button><button type="button" data-xp-quality="smooth">가볍게</button><button type="button" data-xp-quality="clear">선명하게</button></div><p class="xp-setting-note">움직임이 끊긴다면 ‘가볍게’를 골라보세요.</p></fieldset><p class="xp-preference-status" role="status"></p><button class="xp-done" type="button">이 풍경에 머물기 ↗</button></div>`;
document.body.appendChild(settingsDialog);
const encounterDialog = document.createElement('dialog');
encounterDialog.className = 'xp-dialog xp-encounter-dialog';
encounterDialog.id = 'encounterDialog';
encounterDialog.setAttribute('aria-label', '술사와 이야기 나누기');
document.body.appendChild(encounterDialog);
let settingsOpener, encounterOpener, encounterCleanup, encounterVersion = 0;
const dialogueSessions = new Map();

function announceSettings() {
  document.dispatchEvent(new CustomEvent('sowon:preferences', { detail: { ...settings } }));
  document.body.dataset.mood = settings.mood;
}
function renderSettings() {
  for (const key of ['mood', 'outfit', 'quality']) settingsDialog.querySelectorAll(`[data-xp-${key}]`).forEach(button => {
    const selected = button.getAttribute(`data-xp-${key}`) === settings[key];
    button.setAttribute('aria-pressed', String(selected));
  });
}
function closeSettings() { settingsDialog.close(); }
function openSettings() {
  if (document.querySelector('dialog[open]')) return;
  settingsOpener = document.activeElement;
  renderSettings(); settingsDialog.showModal(); body.classList.add('dialog-open');
}
function closeEncounter() { if (encounterDialog.open) encounterDialog.close(); }
async function openEncounter(npc, {reading=false, kind}={}) {
  if (!['tojeong','seol','luna'].includes(npc) || document.querySelector('dialog[open]')) return;
  const version = ++encounterVersion;
  const active = document.activeElement;
  if (active && active !== document.body && !active.closest?.('dialog')) encounterOpener = active;
  encounterCleanup?.(); encounterCleanup = null;
  encounterDialog.textContent = '술사가 당신을 맞이하고 있어요…';
  encounterDialog.showModal(); body.classList.add('dialog-open');
  const profile = getOwnProfile();
  const shared = {
    onClose: closeEncounter,
    onProfile: () => { closeEncounter(); document.dispatchEvent(new CustomEvent('sowon:profile-open',{detail:{returnToNpc:npc}})); },
    onSocial: () => { closeEncounter(); document.dispatchEvent(new CustomEvent('sowon:social-open')); },
    onFeature: id => { closeEncounter(); document.dispatchEvent(new CustomEvent('sowon:feature',{detail:{id}})); },
    onHall: id => { closeEncounter(); document.dispatchEvent(new CustomEvent('sowon:hall',{detail:{id}})); },
  };
  try {
    let result;
    if (profile && reading) {
      const module = await import('./personal-encounter.js?v=20261101-dialogue1');
      if (version !== encounterVersion || !encounterDialog.open) return;
      result = module.mountPersonalEncounter(encounterDialog,npc,{
        ...shared, initialKind:kind, guideLabel:'대화 이어가기',
        onGuide: () => { closeEncounter(); queueMicrotask(() => openEncounter(npc)); },
      });
    } else {
      const module = await import('./npc-dialog.js?v=20261101-dialogue1');
      if (version !== encounterVersion || !encounterDialog.open) return;
      result = module.mountNpcDialogue(encounterDialog,npc,{
        ...shared, profile, session:dialogueSessions.get(npc),
        onReading: nextKind => {
          if (!['saju','jami','star'].includes(nextKind)) return;
          if (!profile) { shared.onFeature(nextKind); return; }
          closeEncounter(); queueMicrotask(() => openEncounter(npc,{reading:true,kind:nextKind}));
        },
      });
      dialogueSessions.set(npc,result.session);
    }
    if (version !== encounterVersion || !encounterDialog.open) { result?.(); return; }
    encounterCleanup = result;
  } catch (_) {
    if (version !== encounterVersion || !encounterDialog.open) return;
    encounterDialog.classList.remove('npc-dialog','xp-personal-dialog');
    encounterDialog.innerHTML = '<div class="xp-failed"><h2>이야기를 잠시 불러오지 못했어요.</h2><p>전체 기능에서 같은 해석과 안내를 열 수 있어요.</p><button type="button">풍경으로 돌아가기</button></div>';
    encounterDialog.querySelector('button').onclick=closeEncounter;
  }
}
document.addEventListener('click',event=>{
  if(event.target.closest?.('[data-open-traveler]')) {event.preventDefault();openSettings();return;}
  for(const key of ['mood','outfit','quality']) {
    const button=event.target.closest?.(`[data-xp-${key}]`);
    if(!button)continue;
    settings=normalizeSettings({...settings,[key]:button.getAttribute(`data-xp-${key}`)});
    const saved=writeSettings(storage,settings);
    renderSettings();announceSettings();
    settingsDialog.querySelector('.xp-preference-status').textContent=saved?'다음에 와도 이 취향으로 맞이할게요.':'이곳에 머무는 동안 취향을 적용해요.';
    return;
  }
});
settingsDialog.querySelector('.xp-close').onclick=closeSettings;
settingsDialog.querySelector('.xp-done').onclick=closeSettings;
settingsDialog.addEventListener('close',()=>{
  if(!document.querySelector('dialog[open]'))body.classList.remove('dialog-open');
  if(settingsOpener?.isConnected)settingsOpener.focus({preventScroll:true});
});
encounterDialog.addEventListener('close',()=>{
  if(encounterDialog.open)return;
  encounterVersion++;encounterCleanup?.();encounterCleanup=null;encounterDialog.replaceChildren();
  encounterDialog.classList.remove('xp-personal-dialog','npc-dialog');
  if(!document.querySelector('dialog[open]')){body.classList.remove('dialog-open');if(encounterOpener?.isConnected)encounterOpener.focus({preventScroll:true});}
});
document.addEventListener('sowon:encounter',event=>openEncounter(event.detail?.npc));
document.addEventListener('sowon:profile-change',()=>{dialogueSessions.clear();if(encounterDialog.open)closeEncounter();});
document.addEventListener('sowon:preferences-request',announceSettings);
announceSettings();
