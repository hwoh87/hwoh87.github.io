/** Field-specific feedback before the canonical profile/engine validation. */
export function readProfileDraft(values, { today = new Date() } = {}) {
  const fail = (field, message) => { throw Object.assign(new Error(message), { field }); };
  if (!['M', 'F'].includes(values.gender)) fail('gender', '풀이에 사용할 성별을 선택해 주세요.');
  const digits = String(values.birthday || '').replace(/[^0-9]/g, '');
  if (digits.length !== 8) fail('birthday', '생년월일을 8자리로 입력해 주세요. 예: 19950302');
  const y = +digits.slice(0,4), mo = +digits.slice(4,6), d = +digits.slice(6,8), calendar = values.calendar;
  if (!['S','L','LL'].includes(calendar)) fail('calendar', '양력이나 음력 달력을 선택해 주세요.');
  if (y < 1940 || y > today.getFullYear() || mo < 1 || mo > 12 || d < 1 || d > (calendar === 'S' ? 31 : 30)) fail('birthday', '1940년 이후의 실제 생년월일을 확인해 주세요.');
  if (calendar === 'S') {
    const day = new Date(y,mo-1,d);
    if (day.getMonth() !== mo-1 || day.getDate() !== d || day > today) fail('birthday', '달력에 있는 날짜를 입력해 주세요. 태어난 날짜는 오늘 이후일 수 없어요.');
  }
  const unk = values.unknown === true;
  if (!unk && String(values.hour ?? '') === '') fail('hour', '태어난 시를 선택하거나 ‘태어난 시간을 몰라요’를 골라주세요.');
  const h = unk ? -1 : Number(values.hour), mi = unk ? 0 : Number(values.minute);
  if (!unk && (!Number.isInteger(h) || h < 0 || h > 23)) fail('hour', '태어난 시를 00시부터 23시 사이에서 선택해 주세요.');
  if (!unk && (String(values.minute ?? '').trim() === '' || !Number.isInteger(mi) || mi < 0 || mi > 59)) fail('minute', '태어난 분을 0~59 사이로 입력해 주세요. 분을 모르면 0분으로 준비할 수 있어요.');
  return { nickname: values.nickname, birth: { y, mo, d, g: values.gender, calendar, unk, h, mi } };
}
