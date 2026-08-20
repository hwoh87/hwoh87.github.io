/* 만세력 웹 퍼스트파티 계측 — 쿠키·localStorage·개인식별자 없음.
 *
 * 재는 것 딱 셋:
 *   pageview   어느 쪽에 사람이 왔나 (+ 검색엔진에서 왔나)
 *   cta        계산기로 갔나(calc-*) 스토어로 갔나(store-*)
 *   calc_done  계산기에서 실제로 명식을 뽑았나  → window.__track('calc_done')
 *
 * 실패해도 페이지는 그대로 — 전부 fire-and-forget. DNT 켜진 브라우저는 아무것도 보내지 않는다.
 */
(function () {
  "use strict";
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;

  var URL_ = "https://sidxbzpbesbaiokxrqsf.supabase.co/functions/v1/web-beacon";
  var mobile = window.matchMedia && window.matchMedia("(max-width: 767px)").matches;

  function send(kind, label) {
    var body = JSON.stringify({
      kind: kind,
      path: location.pathname,
      label: label || null,
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

  send("pageview");

  // CTA 클릭 — 상단 nav·본문 CTA 박스 모두 data-cta 로 표시돼 있다.
  document.addEventListener("click", function (ev) {
    var el = ev.target && ev.target.closest && ev.target.closest("[data-cta]");
    if (el) send("cta", el.getAttribute("data-cta"));
  }, true);

  window.__track = send;
})();
