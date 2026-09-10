/* 생년월일 한 칸 입력 — 스토어 홈 맛보기 · 주문서 · 무료 계산기 4종 공용.
 *
 * 왜: 연·월·일 세 칸은 칸마다 손을 옮겨야 하고, 1~12·1~31 을 스스로 맞춰야 했다. 한 칸에
 *     숫자 8자리를 치면 "1995. 03. 02" 로 알아서 끊고, 달력에 없는 날은 그 자리에서 알려 주고,
 *     맞는 날이면 그날의 일주(日柱)를 그림과 함께 바로 보여 준다. 결제·계산 직전에
 *     "이 사이트가 진짜 계산을 한다"는 걸 한 번 보여 주는 자리이기도 하다.
 *
 * 원래 연·월·일 입력은 지우지 않고 감춘다 — 검증·계산·결제 코드(readPerson, readForm,
 *     홈 맛보기)가 그 값을 그대로 읽으므로 계산 경로는 한 줄도 바뀌지 않는다.
 *
 * 일주 미리보기 = (UTC 일수 + 17) mod 60. 1900~2099 1,449일을 엔진(SajuCalc)과 대조해
 *     불일치 0(2026-09-11). 엔진 기본값에서는 태어난 시가 일주를 바꾸지 않는다.
 *     ⚠️ 엔진의 일주 규칙을 바꾸면 이 식도 같이 — 미리보기와 결과가 다른 일주를 말하게 된다.
 *     ⚠️ 음력 입력은 미리보기를 하지 않는다. 양력으로 바꾸려면 엔진이 필요하고,
 *        음력 날짜를 그대로 식에 넣으면 틀린 일주가 나온다.
 *
 * 저장: 본인(share) 칸에 사람이 직접 친 양력 값만 이 탭의 sessionStorage 에 남긴다 — 홈에서 넣고
 *     주문서·계산기로 가면 다시 치지 않게. URL 로 복원된 값은 남의 생일일 수 있어 저장하지 않는다.
 *     탭을 닫으면 사라지고 서버로 가지 않는다. 상대방 칸은 채우지 않는다.
 *
 * CSS 는 이 파일이 한 번 주입한다 — 계산기 쪽은 store/style.css 를 읽지 않는다.
 *     입력 칸 자체의 바탕·테두리는 페이지 것을 따른다(스토어 .sj-input · 계산기 폼 input).
 */
(function () {
  "use strict";
  var G = "甲乙丙丁戊己庚辛壬癸", Z = "子丑寅卯辰巳午未申酉戌亥";
  var GK = "갑을병정무기경신임계", ZK = "자축인묘진사오미신유술해";
  var KEY = "samra.birth.v1";
  var coarse = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

  var CSS =
    ".bf-box{position:relative}" +
    ".bf .bf-in{font-size:16px;letter-spacing:.02em;font-variant-numeric:tabular-nums;padding-right:46px}" +
    ".bf-label{display:block;margin:0 0 6px;font-size:12.5px;font-weight:600;color:rgba(255,255,255,.62)}" +
    ".bf-ok{position:absolute;right:13px;top:50%;width:22px;height:22px;margin-top:-11px;border-radius:50%;" +
      "background:#7c3aed;transform:scale(0);transition:transform .28s cubic-bezier(.34,1.56,.64,1);pointer-events:none}" +
    ".bf-ok::after{content:\"\";position:absolute;left:8px;top:4px;width:5px;height:10px;border:solid #fff;" +
      "border-width:0 2px 2px 0;transform:rotate(45deg)}" +
    ".bf.is-ok .bf-ok{transform:scale(1)}" +
    ".bf.is-ok .bf-in{border-color:rgba(139,92,246,.7)}" +
    ".bf.is-bad .bf-in{border-color:rgba(249,168,212,.75);animation:bf-nudge .32s cubic-bezier(.22,1,.36,1)}" +
    "@keyframes bf-nudge{25%{transform:translateX(-4px)}75%{transform:translateX(4px)}}" +
    ".bf-msg{margin:7px 2px 0;font-size:12px;color:#f9a8d4;text-align:left}" +
    ".bf-msg:empty{display:none}" +
    ".bf-ilju{display:flex;align-items:center;gap:12px;margin-top:10px;padding:8px 12px 8px 8px;border-radius:14px;" +
      "background:rgba(124,58,237,.1);border:1px solid rgba(139,92,246,.32);text-align:left}" +
    ".bf-ilju[hidden]{display:none}" +
    ".bf-ilju img{width:96px;height:54px;border-radius:10px;object-fit:cover;flex-shrink:0;background:#16131f}" +
    ".bf-ilju img[hidden]{display:none}" +
    ".bf-ilju b{display:block;font-size:14.5px;font-weight:800;color:#f4f1ff}" +
    ".bf-ilju b .hz{font-family:\"Noto Serif KR\",\"Nanum Myeongjo\",serif;font-weight:600;color:#ddd6fe;margin-left:3px}" +
    /* > 필수 — 자손 선택자면 이름 옆 한자(.hz)까지 태그라인 모양으로 끌려 내려간다 */
    ".bf-ilju .bf-t>span{display:block;margin-top:2px;font-size:11.5px;color:rgba(255,255,255,.66)}" +
    ".bf-ilju.pop{animation:bf-rise .42s cubic-bezier(.22,1,.36,1)}" +
    "@keyframes bf-rise{from{opacity:0;transform:translateY(6px) scale(.98)}}" +
    "@media (prefers-reduced-motion:reduce){.bf-ok{transition:none}.bf.is-bad .bf-in,.bf-ilju.pop{animation:none}}";

  function injectCss() {
    if (document.getElementById("bf-css")) return;
    var st = document.createElement("style");
    st.id = "bf-css";
    st.textContent = CSS;
    document.head.appendChild(st);
  }

  // 반말(스토어) · 해요체(계산기) — 같은 판정, 페이지 말투만 다르다.
  var PLAIN = {
    range: function (a, b) { return a + "년부터 " + b + "년 사이로 넣어줘"; },
    month: "월은 01부터 12까지야",
    lunar: "음력 날짜는 30일까지 있어",
    dim: function (y, m, n) { return y + "년 " + m + "월은 " + n + "일까지 있어"; },
    future: "아직 오지 않은 날이야",
    partial: "생년월일 8자리를 넣어줘 · 예: 1995 03 02",
    tail: " 뜻하는 날의 기둥이야"
  };
  var POLITE = {
    range: function (a, b) { return a + "년부터 " + b + "년 사이로 넣어 주세요"; },
    month: "월은 01부터 12까지예요",
    lunar: "음력 날짜는 30일까지 있어요",
    dim: function (y, m, n) { return y + "년 " + m + "월은 " + n + "일까지 있어요"; },
    future: "아직 오지 않은 날이에요",
    partial: "생년월일 8자리를 넣어 주세요 · 예: 1995 03 02",
    tail: " 뜻하는 날의 기둥이에요"
  };

  function pad(n) { return ("0" + n).slice(-2); }
  function daysIn(y, m) { return new Date(Date.UTC(y, m, 0)).getUTCDate(); }
  function byId(id) { return document.getElementById(id); }

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

  /** mode "S" 양력 · "L" 음력 · "LL" 음력 윤달. 음력은 달마다 29·30일이고 윤달 여부는 엔진이 가린다 —
   *  여기서는 30일까지만 받고 미래 판정은 하지 않는다. */
  function judge(dg, minY, mode, T) {
    if (dg.length < 8) return { state: "partial" };
    var y = +dg.slice(0, 4), m = +dg.slice(4, 6), d = +dg.slice(6, 8);
    var now = new Date(), maxY = now.getFullYear();
    if (y < minY || y > maxY) return { state: "bad", msg: T.range(minY, maxY) };
    if (m < 1 || m > 12) return { state: "bad", msg: T.month };
    if (mode && mode !== "S") {
      if (d < 1 || d > 30) return { state: "bad", msg: T.lunar };
      return { state: "ok", y: y, m: m, d: d, lunar: true };
    }
    var dim = daysIn(y, m);
    if (d < 1 || d > dim) return { state: "bad", msg: T.dim(y, m, dim) };
    if (Date.UTC(y, m - 1, d) > Date.UTC(maxY, now.getMonth(), now.getDate()))
      return { state: "bad", msg: T.future };
    return { state: "ok", y: y, m: m, d: d, lunar: false };
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
   * @param p    입력 id 접두사("me" · "pt" · "sj"). opt.ids 를 주면 쓰지 않는다.
   * @param opt
   *   ids      [연, 월, 일] 요소 id — 계산기처럼 접두사 규칙이 아닐 때
   *   row      감출 행을 찾는 closest 선택자(기본 ".sj-row" — 계산기는 ".row")
   *   cal      달력 모드 hidden input id("cal" 등). 없으면 양력 고정
   *   share    본인 입력이면 true — 탭 안에서 이어받기(양력만 저장)
   *   prefill  false 면 원래 칸의 기본값(계산기의 1995·1·1)을 이어받지 않고 비운다
   *   who      미리보기 문구의 주어(기본 "나") · polite 해요체 · label 보이는 라벨 · fieldId 새 칸 id
   *   minYear  받는 가장 이른 해(그 페이지 계산 경로의 하한과 맞춘다)
   * @param onChange  유효/무효가 바뀔 때 부른다
   * @return { input, isValid(), setDigits(digits, focus), pull(), refresh() } — 조건이 안 맞으면 null
   */
  function enhance(p, opt, onChange) {
    opt = opt || {};
    var ids = opt.ids || [p + "Y", p + "Mo", p + "D"];
    var Y = byId(ids[0]), Mo = byId(ids[1]), D = byId(ids[2]);
    if (!Y || !Mo || !D || Y.getAttribute("data-bf")) return null;
    var row = Y.closest(opt.row || ".sj-row");
    if (!row) return null;
    Y.setAttribute("data-bf", "1");
    injectCss();

    var T = opt.polite ? POLITE : PLAIN;
    var calEl = opt.cal ? byId(opt.cal) : null;
    var mode = function () { return calEl && calEl.value ? calEl.value : "S"; };
    var who = opt.who || "나";
    // 조사를 받침으로 고른다 — "‘나’를" · "‘그 사람’을"(이름이 데이터라 고정 조사는 반은 틀린다).
    var wc = who.charCodeAt(who.length - 1) - 0xAC00;
    var eul = wc >= 0 && wc < 11172 && wc % 28 ? "을" : "를";
    var fid = opt.fieldId || (p + "Birth");
    var aria = opt.label || (who === "나" ? "생년월일" : who + " 생년월일");

    var wrap = document.createElement("div");
    wrap.className = "bf";
    wrap.innerHTML =
      (opt.label ? '<label class="bf-label" for="' + fid + '">' + opt.label + "</label>" : "") +
      '<div class="bf-box">' +
        '<input class="sj-input bf-in" id="' + fid + '" type="text" inputmode="numeric" maxlength="14"' +
        ' autocomplete="' + (opt.share ? "bday" : "off") + '"' +
        ' placeholder="생년월일 8자리 · 1995 03 02" aria-label="' + aria + ' 8자리">' +
        '<span class="bf-ok" aria-hidden="true"></span>' +
      "</div>" +
      '<p class="bf-msg" role="status" aria-live="polite"></p>' +
      '<div class="bf-ilju" hidden>' +
        '<img alt="" width="96" height="54" decoding="async">' +
        '<div class="bf-t"><b></b><span>여덟 글자 중 ‘' + who + "’" + eul + T.tail + "</span></div>" +
      "</div>";
    row.parentNode.insertBefore(wrap, row);
    row.style.display = "none"; // 행이 display:flex 라 hidden 속성으로는 안 감춰진다

    var inp = wrap.querySelector(".bf-in"), msg = wrap.querySelector(".bf-msg"), card = wrap.querySelector(".bf-ilju");
    var lastOk = "", wasValid = false;

    /** silent — 페이지가 스스로 채울 때(이어받기·URL 복원)는 입력 이벤트를 쏘지 않는다.
     *  궁합 계산기는 폼의 입력 이벤트를 "사용자가 고쳤다"로 읽는다(공유 링크 수신자 판정). */
    function setHidden(v, silent) {
      Y.value = v ? v.y : ""; Mo.value = v ? String(v.m) : ""; D.value = v ? String(v.d) : "";
      if (silent) return;
      [Y, Mo, D].forEach(function (el) {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      });
    }

    function showIlju(v, silent) {
      var j = ilju(v.y, v.m, v.d);
      var slug = window.ILJU_ART && window.ILJU_ART[j.hanja];
      card.querySelector("b").innerHTML = j.kr + ' <span class="hz">' + j.hanja + "</span>";
      var img = card.querySelector("img");
      if (slug) { img.src = "/assets/art/ilju/" + slug + "@t.webp"; img.hidden = false; }
      else img.hidden = true;
      card.hidden = false;
      card.classList.remove("pop");
      if (!silent) { void card.offsetWidth; card.classList.add("pop"); }
    }

    function update(settled, silent) {
      var dg = digitsOf(inp.value);
      // 커서가 끝에 있을 때만 다시 모양을 잡는다 — 중간을 고치는 동안 커서가 튀지 않게.
      if (inp.selectionStart === null || inp.selectionStart >= inp.value.length) inp.value = shape(dg);
      var md = mode();
      var r = judge(dg, opt.minYear || 1900, md, T);
      var bad = r.state === "bad" || (settled && r.state === "partial" && dg.length > 0);
      wrap.classList.toggle("is-ok", r.state === "ok");
      wrap.classList.toggle("is-bad", bad);
      msg.textContent = r.state === "bad" ? r.msg : (bad ? T.partial : "");

      if (r.state === "ok") {
        var key = dg + md;
        if (key !== lastOk) {
          setHidden(r, silent);
          lastOk = key;
          if (r.lunar) card.hidden = true; else showIlju(r, silent);
          // 사람이 친 값만 저장한다 — URL 복원(silent)은 남의 생일일 수 있다(친구가 보낸 계산기 공유 링크).
          // 그걸 저장하면 주문서에 친구 생일이 "내 생년월일"로 들어간다.
          if (opt.share && !r.lunar && !silent) save({ y: r.y, mo: r.m, d: r.d });
          // 휴대폰에서는 8자리를 다 치면 키패드를 내려 미리보기가 가려지지 않게 한다.
          if (!settled && !silent && coarse && document.activeElement === inp) inp.blur();
        }
      } else {
        if (lastOk) setHidden(null, silent);
        lastOk = "";
        card.hidden = true;
      }
      var valid = r.state === "ok";
      if (valid !== wasValid) { wasValid = valid; if (onChange) onChange(valid); }
    }

    inp.addEventListener("input", function () { update(false, false); });
    inp.addEventListener("blur", function () { update(true, false); });

    // 달력(양력·음력·윤달)을 바꾸면 같은 8자리를 다시 판정한다 — 세그먼트가 hidden 값을 먼저 바꾸도록 한 틱 뒤.
    if (opt.cal) {
      Array.prototype.forEach.call(document.querySelectorAll('.seg button[data-for="' + opt.cal + '"]'), function (b) {
        b.addEventListener("click", function () { setTimeout(function () { if (inp.value) update(true, false); }, 0); });
      });
    }

    function pullHidden() {
      if (!(Y.value && Mo.value && D.value)) return false;
      inp.value = shape(String(+Y.value) + pad(+Mo.value) + pad(+D.value));
      lastOk = "";
      update(true, true);
      return true;
    }

    // 이어받기 — 원래 칸 값(URL 복원 등) → 이 탭의 본인 양력 값 → 없으면 비운다.
    if (!(opt.prefill !== false && pullHidden())) {
      var s = opt.share && mode() === "S" ? load() : {};
      if (s.y && s.mo && s.d) { inp.value = shape(String(s.y) + pad(s.mo) + pad(s.d)); update(true, true); }
      else if (opt.prefill === false) Y.value = ""; // 기본값(1995·1·1)으로 조용히 계산되지 않게
    }

    // 스토어 폼(접두사 규칙)은 이름·태어난 시도 탭 안에서 이어받는다.
    if (opt.share && !opt.ids) {
      var s2 = load();
      var nm = byId(p + "Name"), hh = byId(p + "H");
      if (nm) {
        if (!nm.value && s2.name) nm.value = s2.name;
        nm.addEventListener("input", function () { save({ name: nm.value.trim() }); });
      }
      if (hh) {
        if (s2.h !== undefined && hh.value === "-1" && hh.querySelector('option[value="' + s2.h + '"]')) hh.value = String(s2.h);
        hh.addEventListener("change", function () { save({ h: +hh.value }); });
      }
    }

    return {
      input: inp,
      isValid: function () { return wasValid; },
      /** 일부만 채운다(년생 페이지의 ?py=1995 등). 미완성이라도 경고하지 않는다. */
      setDigits: function (digits, focus) {
        inp.value = shape(digitsOf(digits)); update(false, true);
        if (focus) { inp.focus(); try { inp.setSelectionRange(inp.value.length, inp.value.length); } catch (e) {} }
      },
      /** 나중에 원래 칸이 채워졌을 때(비동기 URL 복원) 그 값을 끌어온다. */
      pull: pullHidden,
      refresh: function () { update(true, true); }
    };
  }

  window.SamraBirth = { enhance: enhance, ilju: ilju };
})();
