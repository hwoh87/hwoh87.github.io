/* 만세력 웹 퍼스트파티 계측 — 쿠키·개인식별자 없음.
 *
 * 재는 것 딱 셋:
 *   pageview   어느 쪽에 사람이 왔나 (+ 검색엔진에서 왔나 / 어느 채널이 보냈나)
 *   cta        계산기로 갔나(calc-*) 스토어로 갔나(store-*)
 *   calc_done  계산기에서 실제로 명식을 뽑았나  → window.__track('calc_done')
 *
 * 실패해도 페이지는 그대로 — 전부 fire-and-forget. DNT 켜진 브라우저는 아무것도 보내지 않는다.
 *
 * 안 세는 곳(2026-09-11 — 원시 방문 수가 크롤러·QA 로 5~20배 부풀어 있었다):
 *   · 우리 도메인이 아닌 곳(localhost 미리보기·file://)
 *   · 자동화 브라우저(navigator.webdriver)
 *   · QA 브라우저: 아무 쪽에서 ?notrack=1 한 번 → 그 브라우저는 계속 제외(?notrack=0 으로 해제).
 *     localStorage 는 이 제외 플래그 하나만 쓰고, 서버로 보내지 않는다.
 *   크롤러 UA·타 출처는 서버(supabase/functions/web-beacon/filter.ts)가 한 번 더 거른다.
 * 꺼져 있어도 window.__track 은 빈 함수로 둔다 — 페이지의 __track(...) 호출이 터지면 안 된다.
 */
(function () {
  "use strict";
  function off() {
    if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return true;
    if (!/^(www\.)?samra\.cc$|^hwoh87\.github\.io$/.test(location.hostname)) return true;
    if (navigator.webdriver) return true;
    try {
      var nt = new URLSearchParams(location.search).get("notrack");
      if (nt === "1") localStorage.setItem("samra_notrack", "1");
      else if (nt === "0") localStorage.removeItem("samra_notrack");
      return localStorage.getItem("samra_notrack") === "1";
    } catch (e) { return false; /* 저장소가 막힌 브라우저는 그냥 센다 */ }
  }
  if (off()) { window.__track = function () {}; return; }

  var URL_ = "https://sidxbzpbesbaiokxrqsf.supabase.co/functions/v1/web-beacon";
  var mobile = window.matchMedia && window.matchMedia("(max-width: 767px)").matches;

  var FUNNEL = {calc_done: 1, paywall_view: 1, pay_start: 1, pay_done: 1};

  function send(kind, label) {
    var body = JSON.stringify({
      kind: kind,
      // 완주형 이벤트는 호출부가 라벨을 안 준다 — 채널을 물려서 "어느 채널이 어디까지 갔나"를 남긴다.
      // /pair/ 퍼널의 판정 기준이 광고 앵글별 전환율이라, 이 물림이 없으면 앵글을 구분할 수 없다.
      label: label || (FUNNEL[kind] ? CHAN : null),
      path: location.pathname,
      ref: document.referrer || "",
      mobile: !!mobile
    });
    try {
      // sendBeacon 은 페이지를 떠나는 중에도 살아남는다(스토어 이동 클릭이 이 경우).
      if (navigator.sendBeacon &&
          navigator.sendBeacon(URL_, new Blob([body], { type: "text/plain" }))) return;
      fetch(URL_, { method: "POST", body: body, keepalive: true, mode: "no-cors" });
    } catch (e) { /* 계측 실패는 무시 */ }
  }

  // 유입 채널 — 우리가 링크에 직접 박은 utm_source(+utm_medium)만 읽는다.
  // 레퍼러로는 못 잡는다: 유튜브·인스타 앱의 인앱 브라우저는 document.referrer 가 비어서 온다.
  // 그 외 쿼리(생년월일 y/mo 등)는 절대 읽지 않고, 값은 [a-z0-9_-] 로 깎아 라벨에 싣는다.
  function chan() {
    try {
      var q = new URLSearchParams(location.search);
      var clean = function (v) {
        return (v || "").toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 24);
      };
      var s = clean(q.get("utm_source"));
      if (!s) return null;
      var m = clean(q.get("utm_medium"));
      return m ? s + ":" + m : s;
    } catch (e) { return null; }
  }

  var CHAN = chan();
  send("pageview", CHAN);

  // CTA 클릭 — 상단 nav·본문 CTA 박스 모두 data-cta 로 표시돼 있다.
  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest("[data-cta]");
    if (el) send("cta", el.getAttribute("data-cta"));
  }, true);

  window.__track = send;
})();
