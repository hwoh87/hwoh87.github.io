/* Compare every minute in a same-day range; no predictions, storage or network. */
(function (root) {
  'use strict';
  var keys = ['year', 'month', 'day', 'time'];
  var labels = ['년주', '월주', '일주', '시주'];
  function clock(n) { return String(Math.floor(n / 60)).padStart(2, '0') + ':' + String(n % 60).padStart(2, '0'); }
  async function compare(input, start, end, calculate, pause, cancelled) {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > 1439 || start > end)
      throw Error('같은 날짜 안에서 시작 시간부터 끝 시간까지 선택해 주세요.');
    var groups = [], values = keys.map(function () { return new Map(); });
    for (var t = start; t <= end; t++) {
      if (cancelled && cancelled()) return null;
      var r = calculate(input.y, input.mo, input.d, Math.floor(t / 60), t % 60, input.g, input.tst, input.lon);
      if (typeof r === 'string') r = JSON.parse(r);
      var pillars = keys.map(function (k, i) {
        var p = r.pillars[k];
        if (!p || !p.ganzi) throw Error('시간대별 명식을 계산하지 못했어요. 다시 시도해 주세요.');
        var name = p.stemKr + p.branchKr + ' (' + p.ganzi + ')';
        values[i].set(p.ganzi, name);
        return {ganzi: p.ganzi, name: name};
      });
      var signature = pillars.map(function (p) { return p.ganzi; }).join('|');
      var last = groups[groups.length - 1];
      if (last && last.signature === signature) last.end = t;
      else groups.push({start: t, end: t, signature: signature, pillars: pillars});
      if ((t - start + 1) % 30 === 0 && pause) await pause();
    }
    return {groups: groups, values: values.map(function (m) { return Array.from(m.values()); }), start: start, end: end};
  }
  root.SamraTimeCompare = {compare: compare, clock: clock};
  if (typeof document === 'undefined') return;
  var host = document.getElementById('timeCompare');
  if (!host) return;
  host.innerHTML = '<summary>태어난 시간이 정확하지 않나요? 시간대 비교하기</summary>' +
    '<p>위에 생년월일을 입력하고, 태어났을 법한 시간 범위를 골라보세요. 시간이 달라도 같은 글자와 달라지는 글자를 비교해요.</p>' +
    '<div class="tc-range"><label>시작 시간<input id="tcStart" type="time" value="05:00" step="60"></label>' +
    '<label>끝 시간<input id="tcEnd" type="time" value="07:00" step="60"></label></div>' +
    '<p class="tc-help">입력한 생일의 시간이에요. 양 끝 시각을 포함해 1분 단위로 비교해요. 날짜를 넘는 범위는 나눠 확인해 주세요.</p>' +
    '<div class="tc-actions"><button type="button" id="tcAll">시간을 전혀 몰라요 · 하루 전체</button>' +
    '<button type="button" id="tcRun" data-cta="calc-time-compare">이 시간대 비교하기</button></div>' +
    '<p id="tcStatus" role="status" aria-live="polite"></p><div id="tcResult" hidden></div>';
  var startEl = document.getElementById('tcStart'), endEl = document.getElementById('tcEnd');
  var btn = document.getElementById('tcRun'), status = document.getElementById('tcStatus'), result = document.getElementById('tcResult');
  var generation = 0;
  function invalidate() {
    generation++; result.hidden = true; result.replaceChildren();
    status.textContent = '입력한 조건으로 다시 비교해 주세요.';
    btn.disabled = false; btn.textContent = '이 시간대 비교하기';
  }
  document.getElementById('f').addEventListener('input', invalidate);
  document.getElementById('f').addEventListener('change', invalidate);
  document.getElementById('f').addEventListener('click', function (e) { if (e.target.closest('.seg button')) invalidate(); });
  startEl.addEventListener('input', invalidate); endEl.addEventListener('input', invalidate);
  document.getElementById('tcAll').addEventListener('click', function () { startEl.value = '00:00'; endEl.value = '23:59'; invalidate(); });
  function minutes(value) { if (!/^\d{2}:\d{2}$/.test(value)) return NaN; var p = value.split(':').map(Number); return p[0] * 60 + p[1]; }
  function text(tag, content, parent) { var el = document.createElement(tag); el.textContent = content; parent.appendChild(el); return el; }
  function render(data, input) {
    result.replaceChildren();
    text('h3', clock(data.start) + '–' + clock(data.end) + ' · ' + data.groups.length + '가지 명식', result);
    text('p', '양력 ' + input.y + '.' + input.mo + '.' + input.d + ' · ' + (input.tst ? '진태양시 보정 적용 (경도 ' + input.lon + '°)' : '진태양시 보정 안 함'), result);
    text('h4', '이 범위에서 같은 글자', result);
    var common = data.values.map(function (v, i) { return v.length === 1 ? labels[i] + ' ' + v[0] : null; }).filter(Boolean);
    text('p', common.length ? common.join(' · ') : '네 기둥 모두 시간에 따라 달라져요.', result);
    text('h4', '시간에 따라 달라지는 글자', result);
    var changes = data.values.map(function (v, i) { return v.length > 1 ? labels[i] + ' ' + v.length + '가지' : null; }).filter(Boolean);
    text('p', changes.length ? changes.join(' · ') : '선택한 범위에서는 네 기둥의 글자가 같아요.', result);
    text('p', data.values[2].length > 1 ? '일주도 달라져요. 시간을 확인하기 전에는 한 일주의 성격 풀이로 단정하지 마세요.' : '일주는 같아도 시주 등 다른 조건에 따라 전체 해석이 달라질 수 있어요.', result);
    var list = text('ol', '', result);
    data.groups.forEach(function (g) {
      var item = text('li', '', list);
      text('strong', clock(g.start) + (g.start === g.end ? '' : '–' + clock(g.end)), item);
      text('p', g.pillars.map(function (p, i) { return labels[i] + ' ' + p.name; }).join(' · '), item);
    });
    text('p', '이 비교는 네 기둥의 글자만 비교해요. 글자가 같아도 대운 시작 시점 등 세부 계산까지 같다는 뜻은 아니에요. 실제 출생시간이나 어느 해석이 더 맞는지를 추정하지 않아요. 비교 결과는 저장하거나 전송하지 않아요.', result).className = 'tc-help';
    result.hidden = false;
  }
  btn.addEventListener('click', async function () {
    var ticket = ++generation;
    btn.disabled = true; btn.textContent = '시간대를 비교하는 중…'; result.hidden = true; status.textContent = '계산을 준비하고 있어요.';
    try {
      await root.loadEngine();
      if (ticket !== generation) return;
      var y = +document.getElementById('y').value, mo = +document.getElementById('mo').value, d = +document.getElementById('d').value;
      if (!Number.isInteger(y) || y < 1940 || y > new Date().getFullYear() || !mo || !d) throw Error('위에 생년월일을 먼저 입력해 주세요.');
      var mode = document.getElementById('cal').value;
      if (mode !== 'S') JSON.parse(root.SajuCalc().lunarToSolar(y, mo, d, mode === 'LL'));
      else { var date = new Date(y, mo - 1, d); if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) throw Error('실제로 있는 생년월일을 입력해 주세요.'); }
      var input = root.readForm();
      var today = new Date();
      if (Date.UTC(input.y, input.mo - 1, input.d) > Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) throw Error("미래의 생년월일은 입력할 수 없어요.");
      var data = await compare(input, minutes(startEl.value), minutes(endEl.value), function () { return root.SajuCalc().calculate.apply(root.SajuCalc(), arguments); },
        function () { return new Promise(function (resolve) { setTimeout(resolve, 0); }); }, function () { return ticket !== generation; });
      if (!data || ticket !== generation) return;
      render(data, input); status.textContent = '비교가 끝났어요. 아래에서 공통점과 차이를 확인하세요.';
    } catch (e) { if (ticket === generation) status.textContent = e.message && !/Exception|Error|load|fetch/i.test(e.message) ? e.message : '계산하지 못했어요. 날짜와 시간 범위를 확인하고 다시 시도해 주세요.'; }
    finally { if (ticket === generation) { btn.disabled = false; btn.textContent = '이 시간대 비교하기'; } }
  });
})(typeof window === 'undefined' ? globalThis : window);
