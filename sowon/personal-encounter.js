import { getOwnProfile } from './profile.js?v=20261101-sanctuary2';
import { mountReadingReport } from './reading-report.js?v=20261101-sanctuary2';

export function mountPersonalEncounter(container, npc, options = {}) {
  const profile = getOwnProfile();
  if (!profile) throw new Error('내 정보를 먼저 입력해 주세요.');
  return mountReadingReport(container, npc, profile, options);
}
