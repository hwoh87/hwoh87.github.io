/* 생년월일 한 칸 입력 — 스토어 홈 맛보기 카드 · 주문서 공용.
 *
 * 왜: 연·월·일 세 칸(type=number)은 칸마다 손을 옮겨야 하고, 1~12·1~31 을 스스로 맞춰야
 *     했다. 한 칸에 숫자 8자리를 치면 "1995. 03. 02" 로 알아서 끊고, 달력에 없는 날은 그
 *     자리에서 알려 주고, 맞는 날이면 그날의 일주(日柱)를 그림과 함께 바로 보여 준다.
 *     결제 직전 화면에서 "이 사이트가 진짜 계산을 한다"는 걸 한 번 보여 주는 자리이기도 하다.
 *
 * 기존 #{p}Y · #{p}Mo · #{p}D 입력은 지우지 않고 감춘다 — 검증·주문 코드(readPerson,
 *     홈 맛보기 계산)가 그 값을 그대로 읽으므로 계산·결제 경로는 한 줄도 바뀌지 않는다.
 *
 * 일주 미리보기 = (UTC 일수 + 17) mod 60. 1900~2099 1,449일을 엔진(SajuCalc)과 대조해
 *     불일치 0(2026-09-11). 엔진 기본값에서는 태어난 시가 일주를 바꾸지 않는다.
 *     엔진을 고치다 이 식이 어긋나면 미리보기와 리포트가 서로 다른 일주를 말하게 된다 — 같이 볼 것.
 *
 * 저장: 본인(share) 입력만 이 탭의 sessionStorage 에 남긴다 — 홈에서 넣고 주문서로 가면 다시
 *     치지 않게. 탭을 닫으면 사라지고 서버로 가지 않는다. 상대방 칸은 절대 채우지 않는다.
 */
(function () {
  "use strict";
  var G = "甲乙丙丁戊己庚辛壬癸", Z = "子丑寅卯辰巳午未申酉戌亥";
  var GK = "갑을병정무기경신임계", ZK = "자축인묘진사오미신유술해";
  var KEY = "samra.birth.v1";
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  function pad(n) { return ("0" + n).slice(-2); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

  function ilju(y, m, d) {
    var n = Math.round(Date.UTC(y, m - 1, d) / 86400000);
    var i = ((n + 17) % 60 + 60) % 60;
    return { hanja: G[i % 10] + Z[i % 12], kr: GK[i % 10] + ZK[i % 12] + "일주" };
  }

  /** "1995-3-2" · "1995.03.02" · "19950302" → "19950302"(자르다 만 입력은 숫자만) */
  function digitsOf(raw) {
    var s = String(raw || "").trim();
    var m = s.match(/^(\d{4})\D+(\d{1,2})\D+(\d{1,2})\D*$/);
    if (m) return m[1] + pad(m[2]) + pad(m[3]);
    return s.replace(/\D/g, "").slice(0, 8);
  }

  function shape(dg) {
    var out = dg.slice(0, 4);
    if (dg.length > 4) out += ". " + dg.slice(4, 6);
    if (dg.length > 6) out += ". " + dg.slice(6, 8);
    return out;
  }

  function judge(dg, minY) {
    if (dg.length < 8) return { state: "partial" };
    var y = +dg.slice(0, 4), m = +dg.slice(4, 6), d = +dg.slice(6, 8);
    var now = new Date(), maxY = now.getFullYear();
    if (y < minY || y > maxY) return { state: "bad", msg: minY + "년부터 " + maxY + "년 사이로 넣어줘" };
    if (m < 1 || m > 12) return { state: "bad", msg: "월은 01부터 12까지야" };
    var dim = daysIn(y, m);
    if (d < 1 || d > dim) return { state: "bad", msg: y + "년 " + m + "월은 " + dim + "일까지 있어" };
    if (Date.UTC(y, m - 1, d) > Date.UTC(maxY, now.getMonth(), now.getDate()))
      return { state: "bad", msg: "아직 오지 않은 날이야" };
    return { state: "ok", y: y, m: m, d: d };
  }

  function load() { try { return JSON.parse(sessionStorage.getItem(KEY) || "{}"); } catch (e) { return {}; } }
  function save(patch) {
    try {
      var o = load();
      for (var k in patch) o[k] = patch[k];
      sessionStorage.setItem(KEY, JSON.stringify(o));
    } catch (e) { /* 사생활 보호 모드 등 — 저장 못 해도 입력은 된다 */ }
  }

  /**
   * @param p    입력 id 접두사("me" · "pt" · "sj")
   * @param opt  share: 본인 입력이면 true(탭 안에서 이어받기) · who: 미리보기 문구의 주어 ·
   *             minYear: 받는 가장 이른 해(홈 맛보기는 1940 — 그 페이지 계산 경로의 하한과 맞춘다)
   * @param onChange  유효/무효가 바뀔 때 부른다(주문서의 단계 체크 표시용)
   */
  function enhance(p, opt, onChange) {
    opt = opt || {};
    var Y = document.getElementById(p + "Y"), Mo = document.getElementById(p + "Mo"), D = document.getElementById(p + "D");
    if (!Y || !Mo || !D || Y.getAttribute("data-bf")) return null;
    Y.setAttribute("data-bf", "1");
    var row = Y.closest(".sj-row");
    if (!row) return null;

    var who = opt.who || "나";
    // 조사를 받침으로 고른다 — "‘나’를" · "‘그 사람’을"(이름이 데이터라 고정 조사는 반은 틀린다).
    var wc = who.charCodeAt(who.length - 1) - 0xAC00;
    var eul = wc >= 0 && wc < 11172 && wc % 28 ? "을" : "를";
    var wrap = document.createElement("div");
    wrap.className = "bf";
    wrap.innerHTML =
      '<div class="bf-box">' +
        '<input class="sj-input bf-in" id="' + p + 'Birth" type="text" inputmode="numeric" maxlength="14"' +
        ' autocomplete="' + (opt.share ? "bday" : "off") + '"' +
        ' placeholder="생년월일 8자리 · 1995 03 02" aria-label="' + (opt.share ? "생년월일" : "그 사람 생년월일") + ' 8자리">' +
        '<span class="bf-ok" aria-hidden="true"></span>' +
      '</div>' +
      '<p class="bf-msg" role="status" aria-live="polite"></p>' +
      '<div class="bf-ilju" hidden>' +
        '<img alt="" width="96" height="54" decoding="async">' +
        '<div class="bf-t"><b></b><span>여덟 글자 중 ‘' + who + '’' + eul + ' 뜻하는 날의 기둥이야</span></div>' +
      '</div>';
    row.parentNode.insertBefore(wrap, row);
    row.style.display = "none"; // .sj-row 가 display:flex 라 hidden 속성으로는 안 감춰진다

    var inp = wrap.querySelector(".bf-in"), msg = wrap.querySelector(".bf-msg"), card = wrap.querySelector(".bf-ilju");
    var lastOk = "", wasValid = false;

    function setHidden(v) {
      Y.value = v ? v.y : ""; Mo.value = v ? v.m : ""; D.value = v ? v.d : "";
      [Y, Mo, D].forEach(function (el) { el.dispatchEvent(new Event("input", { bubbles: true })); });
    }

    function showIlju(v) {
      var j = ilju(v.y, v.m, v.d);
      var slug = window.ILJU_ART && window.ILJU_ART[j.hanja];
      card.querySelector("b").innerHTML = j.kr + ' <span class="hz">' + j.hanja + "</span>";
      var img = card.querySelector("img");
      if (slug) { img.src = "/assets/art/ilju/" + slug + "@t.webp"; img.hidden = false; }
      else img.hidden = true;
      card.hidden = false;
      card.classList.remove("pop"); void card.offsetWidth; card.classList.add("pop");
    }

    function update(settled) {
      var dg = digitsOf(inp.value);
      // 커서가 끝에 있을 때만 다시 모양을 잡는다 — 중간을 고치는 동안 커서가 튀지 않게.
      if (inp.selectionStart === null || inp.selectionStart >= inp.value.length) inp.value = shape(dg);
      var r = judge(dg, opt.minYear || 1900);
      var bad = r.state === "bad" || (settled && r.state === "partial" && dg.length > 0);
      wrap.classList.toggle("is-ok", r.state === "ok");
      wrap.classList.toggle("is-bad", bad);
      msg.textContent = r.state === "bad" ? r.msg
        : (bad ? "생년월일 8자리를 넣어줘 · 예: 1995 03 02" : "");

      if (r.state === "ok") {
        setHidden(r);
        if (dg !== lastOk) {
          lastOk = dg;
          showIlju(r);
          if (opt.share) save({ y: r.y, mo: r.m, d: r.d });
          // 휴대폰에서는 8자리를 다 치면 키패드를 내려 미리보기가 가려지지 않게 한다.
          if (!settled && coarse && document.activeElement === inp) inp.blur();
        }
      } else {
        if (lastOk) setHidden(null);
        lastOk = "";
        card.hidden = true;
      }
      var valid = r.state === "ok";
      if (valid !== wasValid) { wasValid = valid; if (onChange) onChange(valid); }
    }

    inp.addEventListener("input", function () { update(false); });
    inp.addEventListener("blur", function () { update(true); });

    // 이어받기 — 이미 값이 있으면(뒤로 가기 복원 등) 그것을, 없으면 이 탭에서 넣었던 본인 값을.
    var pre = null;
    if (Y.value && Mo.value && D.value) pre = { y: +Y.value, mo: +Mo.value, d: +D.value };
    else if (opt.share) { var s = load(); if (s.y && s.mo && s.d) pre = s; }
    if (pre) { inp.value = shape(String(pre.y) + pad(pre.mo) + pad(pre.d)); update(true); }

    if (opt.share) {
      var s2 = load();
      var nm = document.getElementById(p + "Name"), hh = document.getElementById(p + "H");
      if (nm) {
        if (!nm.value && s2.name) nm.value = s2.name;
        nm.addEventListener("input", function () { save({ name: nm.value.trim() }); });
      }
      if (hh) {
        if (s2.h !== undefined && hh.value === "-1" && hh.querySelector('option[value="' + s2.h + '"]')) hh.value = String(s2.h);
        hh.addEventListener("change", function () { save({ h: +hh.value }); });
      }
    }
    return { input: inp, isValid: function () { return wasValid; } };
  }

  window.SamraBirth = { enhance: enhance, ilju: ilju };
})();
