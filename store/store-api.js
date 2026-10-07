// 스토어 공용 런타임 — checkout.html / report.html / library.html 이 함께 쓴다.
// (index/product 는 카탈로그 표시만 해서 catalog.js 로 충분 — 이 파일은 파이프라인 쪽 공용.)

const STORE_API = "https://sidxbzpbesbaiokxrqsf.supabase.co/functions/v1/store-report";

/** store-report 호출 — 서버 {error} 는 코드가 담긴 Error 로 던진다. */
async function storeApi(body) {
  const r = await fetch(STORE_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  let data = null;
  try { data = await r.json(); } catch (e) { /* 아래에서 처리 */ }
  if (!r.ok || (data && data.error)) {
    const err = new Error((data && data.error) || ("http_" + r.status));
    err.code = (data && data.error) || ("http_" + r.status);
    err.detail = data;
    throw err;
  }
  return data;
}

const STORE_ERR_KR = {
  bad_recovery_link: "삼라만상 개인 복구 링크를 확인해 주세요.",
  original_channel_required: "이 주문을 만든 원래 결제 채널에서 결제를 이어 주세요.",
  original_channel_unknown: "과거 주문의 결제 채널을 확인할 수 없어요. 주문번호로 문의해 주세요.",
  sale_closed: "이 리포트는 판매가 종료되었어요. 이미 구매한 리포트는 계속 열 수 있어요.",
  payment_in_progress: "결제가 진행 중이에요. 새 결제를 시작하지 않고 잠시 후 상태를 다시 확인해 주세요.",
  payment_not_payable: "취소되거나 환불된 주문은 다시 결제할 수 없어요. 주문 내역을 확인해 주세요.",
  web_orders_closed: "현재 웹 결제가 닫혀 있어요. 기존 주문번호를 보관하고 나중에 다시 확인해 주세요.",
  payment_not_configured: "결제 연결이 준비되지 않았어요. 잠시 후 다시 확인해 주세요.",
  storage_unavailable: "주문 정보를 불러오지 못했어요. 잠시 후 다시 확인해 주세요.",
  bad_fixed_period: "기간별 계산 근거를 복구하지 못했어요. 주문번호로 문의해 주세요.",
  sale_ended: "이 리포트는 판매가 종료되었어요. 이미 구매한 리포트는 계속 열 수 있어요.",
  generation_in_progress: "다른 창에서 이어 쓰는 중이에요. 잠시 후 다시 확인해 주세요.",
  fixed_period_context_required: "기간별 계산 근거를 복구하지 못했어요. 주문번호로 문의해 주세요.",
  minor_blocked: "이 분석은 만 19세 이상만 신청할 수 있어요.",
  rate_limited: "요청이 너무 잦았어요. 잠시 후 다시 시도해줘.",
  bad_inputs: "입력값을 다시 확인해줘 — 생년월일이 올바른지 봐줘.",
  generation_failed: "술사가 붓을 놓쳤어… 다시 시도하면 이어서 써줄게.",
  payment_required: "결제가 확인되지 않은 주문이야.",
  amount_mismatch: "결제 금액이 주문 금액과 달라요. 결제하지 않았다면 그대로 두고 문의해줘.",
  toss_lookup_failed: "결제 상태를 확인하지 못했어. 잠시 후 새로고침해줘.",
  toss_confirm_failed: "결제 승인 중에 잠시 문제가 있었어. 다시 시도해줘.",
  verification_not_configured: "결제 확인 준비가 아직 끝나지 않았어요. 잠시 후 다시 시도해줘.",
  not_found: "리포트를 찾을 수 없어요. 링크를 다시 확인해줘.",
  expired: "보관 기간이 지난 리포트예요.",
  report_not_ready: "리포트가 아직 완성되지 않았어요.",
  already_asked: "추가질문은 한 번만 할 수 있어요.",
};
const storeErrMsg = e =>
  STORE_ERR_KR[e && e.code] || "잠시 연결이 매끄럽지 않았어요. 다시 시도해줘.";

// Read-only capability lookup. Unknown never enables payment; no persisted optimistic cache.
async function webPayState(slug) {
  try {
    const config = await storeApi({ action: "config", slug, platform: "web" });
    if (!config || typeof config.canPurchase !== "boolean") return "unknown";
    if (config.reason === "sale_closed" || config.reason === "sale_ended") return "ended";
    return config.canPurchase ? "open" : "closed";
  } catch (_) { return "unknown"; }
}

// The same payment launcher serves new orders and resumed orders, retaining the original rid.
let __storeToss = null;
async function payStoreOrder(order) {
  if (!order.payment) throw new Error("payment_missing");
  if (!__storeToss) __storeToss = new Promise((resolve, reject) => {
    const script = document.createElement("script"); script.src = "https://js.tosspayments.com/v2/standard";
    script.onload = () => resolve(window.TossPayments);
    script.onerror = () => { __storeToss = null; reject(new Error("pgsdk")); };
    document.head.appendChild(script);
  });
  const Toss = await __storeToss, pm = order.payment;
  const back = new URL("/store/report.html", location.origin); back.searchParams.set("rid", order.rid);
  await Toss(pm.clientKey).payment({ customerKey: Toss.ANONYMOUS }).requestPayment({
    method: "CARD", amount: { currency: "KRW", value: pm.amount }, orderId: pm.orderId,
    orderName: pm.orderName, successUrl: back.toString(), failUrl: back.toString(),
    card: { useEscrow: false, flowMode: "DEFAULT", useCardPoint: false, useAppCardOnly: false },
  });
}

// ── KMP 엔진(landing/calc 공유 번들) ─────────────────────────
let __engP = null;
function loadEngine() {
  if (__engP) return __engP;
  __engP = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "/calc/saju-engine.js?v=2026-10-07";
    s.onload = () => res(window["engine-core"]);
    s.onerror = () => { __engP = null; rej(new Error("engine")); };
    document.head.appendChild(s);
  });
  return __engP;
}
const engineRoot = () => window["engine-core"].com.samramanshang.manseryeok.orrery.js;

// ── 보관함(localStorage) — 서버 계정 없이 이 브라우저에 남긴다 ──
const LIB_KEY = "samra_store_library";
function libAll() {
  try {
    const list = JSON.parse(localStorage.getItem(LIB_KEY) || "[]");
    // 저장소의 형식이 어긋나도 정상 리포트는 열 수 있게 한다. 읽을 때 원본은 덮어쓰지 않는다.
    return Array.isArray(list) ? list.filter(x =>
      x && typeof x === "object" && !Array.isArray(x) &&
      typeof x.rid === "string" && x.rid.trim().length > 0
    ) : [];
  } catch (e) { return []; }
}
function libAdd(entry) {
  try {
    const list = libAll().filter(x => x.rid !== entry.rid);
    const prior = libAll().find(x => x.rid === entry.rid) || {};
    list.unshift({ ...prior, ...entry });
    localStorage.setItem(LIB_KEY, JSON.stringify(list));
  } catch (e) { /* 프라이빗 모드 등 — 보관함만 포기 */ }
}

// Private recovery is a bearer capability. Keep it in a fragment and out of telemetry.
function recoveryUrl(rid) { return "https://samra.cc/store/recover/#rid=" + encodeURIComponent(rid); }
function recoveryRid(value) {
  try {
    const u = new URL(String(value).trim());
    if (u.origin !== "https://samra.cc" || u.username || u.password || u.pathname !== "/store/recover/") return null;
    const id = new URLSearchParams(u.hash.slice(1)).get("rid");
    return id && /^[A-Za-z0-9_-]{22}$/.test(id) ? id : null;
  } catch (_) { return null; }
}
function libraryState(order, now = Date.now()) {
  if (order.reason === "expired" || (order.expires_at && Date.parse(order.expires_at) <= now)) return "expired";
  if (order.reason === "not_found") return "retry";
  if (order.status === "confirming") return "confirming";
  if (order.status === "pending") return "pending";
  if (order.status === "paid" && (order.done || (order.total > 0 && order.completed >= order.total))) return "ready";
  if (order.generationFailed || order.generationState === "failed" || order.reason) return "retry";
  if (order.status === "paid") return "generating";
  return "checking";
}
const LIBRARY_STATE_LABELS = { pending:"미결제", confirming:"결제 확인 중", generating:"생성 중 · 이어쓰기", ready:"완성", retry:"재시도 필요", expired:"만료", checking:"상태 확인 중" };
async function refreshLibraryStatus(entries) {
  const result = [];
  const valid = entries.filter(entry => /^[A-Za-z0-9_-]{16,40}$/.test(entry.rid));
  entries.filter(entry => !/^[A-Za-z0-9_-]{16,40}$/.test(entry.rid)).forEach(entry => libAdd({rid:entry.rid,reason:"not_found"}));
  entries = valid;
  for (let i = 0; i < entries.length; i += 50) {
    const response = await storeApi({ action:"status", rids:entries.slice(i,i+50).map(x=>x.rid) });
    for (const order of response.orders || []) { libAdd({...order,reason:order.reason || null,generationFailed:order.generationFailed || false}); result.push(order); }
    for (const failure of response.errors || []) { const order = {rid:failure.rid, reason:failure.error}; libAdd(order); result.push(order); }
  }
  return result;
}
async function importRecoveryLink(value) {
  const rid = recoveryRid(value);
  if (!rid) throw Object.assign(new Error("bad_recovery_link"), {code:"bad_recovery_link"});
  let data;
  try { data = await storeApi({ action:"get", rid }); }
  catch (error) {
    if (error.code !== "expired") throw error;
    const pending = await expiredPendingWebOrder(rid);
    if (!pending) throw error;
    libAdd(pending); return rid;
  }
  libAdd({rid,slug:data.slug,title:data.product?.title || data.title || "사주 리포트",name:data.inputs?.name || "",status:data.status,channel:data.channel,paymentPlatform:data.paymentPlatform,at:Date.parse(data.created_at)||Date.now(),expires_at:data.expires_at,done:data.done,completed:data.chapters?.length || 0,total:data.total});
  return rid;
}
// An expired unpaid order may still have a provider receipt awaiting reconciliation.
// Never infer a new payment or reopen an expired paid entitlement here.
async function expiredPendingWebOrder(rid) {
  try {
    const result = await storeApi({action:"status",rids:[rid]});
    return (result.orders || []).find(order => order.rid === rid && order.status === "pending" &&
      (order.channel || order.paymentPlatform) === "web") || null;
  } catch (_) { return null; }
}
function reportIdentity(data) {
  const current = PRODUCT_BY_SLUG[data.slug] || {};
  const snapshot = data.product || {};
  const savedReader = snapshot.reader;
  const readerId = typeof savedReader === "object" && savedReader ? savedReader.id : savedReader || current.reader;
  const product = {...current,...snapshot,slug:data.slug,reader:readerId};
  const reader = {...(READERS[readerId] || {name:"삼라",emoji:"",title:"명리 술사",tag:""}), ...(typeof savedReader === "object" && savedReader ? savedReader : {})};
  const category = CATS[product.cat || product.catId] || {label:"사주 리포트",emoji:"",color:"#bda675"};
  return {product,reader,category};
}
async function repairFixedPeriod(data, rid) {
  if (!data.fixedPeriodRequired) return data;
  await loadEngine();
  const me = data.context?.me, day = me?.base?.pillars?.day?.ganzi;
  if (!day) throw Object.assign(new Error("fixed_period_context_required"), {code:"fixed_period_context_required"});
  const ys = me.interpret?.yongsin || {};
  const months = JSON.parse(engineRoot().StoreCalc.monthRange(day[0],(ys.yong||[]).join(','),(ys.gi||[]).join(','),2026,9,4));
  await storeApi({action:"repair_fixed_period",rid,months});
  return storeApi({action:"get",rid});
}

/** Retry a historical seasonal order only after restoring its saved calculation facts. */
async function resumeStoreOrder(rid) {
  try { return await storeApi({action:"resume",rid,platform:"web"}); }
  catch (error) {
    if (error.code !== "fixed_period_context_required") throw error;
    const data = await storeApi({action:"get",rid});
    await repairFixedPeriod(data,rid);
    return storeApi({action:"resume",rid,platform:"web"});
  }
}

// ── 마크다운(서버 챕터 본문 부분집합) ─────────────────────────
const escHtml = s => String(s == null ? "" : s)
  .replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
function mdInline(s) {
  return escHtml(s)
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    // [[용어]] — 혹시 온 [[a|b]] 파이프는 앞 표기만 쓴다(렌더 사고 방지).
    .replace(/\[\[([^\]|]+)(?:\|[^\]]*)?\]\]/g, '<span class="term">$1</span>');
}
function mdToHtml(md) {
  const out = []; let para = []; let inList = false;
  const flushPara = () => { if (para.length) { out.push("<p>" + para.map(mdInline).join("<br>") + "</p>"); para = []; } };
  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  String(md || "").split("\n").forEach(raw => {
    const line = raw.replace(/^\s+/, "");
    if (line.startsWith("### ")) { flushPara(); closeList(); out.push("<h3>" + mdInline(line.slice(4)) + "</h3>"); }
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      flushPara();
      if (!inList) { out.push("<ul>"); inList = true; }
      out.push("<li>" + mdInline(line.slice(2)) + "</li>");
    } else if (line === "") { flushPara(); closeList(); }
    else { closeList(); para.push(line); }
  });
  flushPara(); closeList();
  return out.join("\n");
}

// ── 표시 헬퍼 ────────────────────────────────────────────────
const HOUR_LABELS = {
  "-1": "태어난 시 모름", 0: "자시", 2: "축시", 4: "인시", 6: "묘시", 8: "진시", 10: "사시",
  12: "오시", 14: "미시", 16: "신시", 18: "유시", 20: "술시", 22: "해시",
};
function fmtBirth(b) {
  if (!b) return "";
  const t = b.h < 0 ? "시간 모름" : String(b.h).padStart(2, "0") + ":" + String(b.mi).padStart(2, "0");
  return `양력 ${b.y}.${b.mo}.${b.d} · ${t}`;
}

// ── 분석지(SHEET) 렌더러 — 뷰어(.rp-paper)와 PDF 지면이 같은 마크업을 쓴다 ──
const WUXING_COLORS = { "木": "#5E8966", "火": "#B06A62", "土": "#A58757", "金": "#7A8794", "水": "#4D6E97" };
const WUXING_KR = { "木": "목", "火": "화", "土": "토", "金": "금", "水": "수" };
const AXIS_DEFS = [["bond", "결속력", "#5E8966"], ["stability", "안정성", "#46698F"], ["growth", "성장성", "#9F7743"], ["consumption", "소모도", "#9C5D58"]];

function sheetPillarsHtml(me, ownerLabel) {
  const base = me.base;
  const order = [["time", "시주"], ["day", "일주"], ["month", "월주"], ["year", "연주"]];
  const cols = order.map(([key, lb]) => {
    const p = base.pillars[key];
    if (!p) return `<div class="sh-p" style="opacity:.45"><p class="lb">${lb}</p><p class="gz">—</p><p class="kr">미상</p><p class="ss">&nbsp;</p><p class="un">&nbsp;</p></div>`;
    return `<div class="sh-p${key === "day" ? " day" : ""}">
      <p class="lb">${lb}</p><p class="gz">${escHtml(p.ganzi)}</p>
      <p class="kr">${escHtml(p.stemKr)}${escHtml(p.branchKr)}</p>
      <p class="ss">${escHtml(p.stemSipsin)}·${escHtml(p.branchSipsin)}</p>
      <p class="un">${escHtml(p.unseong)}</p>
      <p class="jj">${escHtml(p.jijanggan)}</p>
    </div>`;
  }).join("");
  const notes = [];
  if (base.gongmang) notes.push(`공망(空亡) ${escHtml(base.gongmang)}`);
  if (base.unknownTime) notes.push("태어난 시각을 몰라 시주 없이 여섯 글자로 본 명식이에요");
  return `<div class="sh-card">
    <p class="sh-t">사주 원국${ownerLabel ? `<small>${escHtml(ownerLabel)}</small>` : ""}</p>
    <div class="sh-pgrid">${cols}</div>
    ${notes.length ? `<p class="sh-note">${notes.join(" · ")}</p>` : ""}
  </div>`;
}

function sheetElementsHtml(me) {
  const counts = me.interpret.elements || {};
  const max = Math.max(1, ...Object.values(counts));
  const rows = ["木", "火", "土", "金", "水"].map(el => {
    const c = counts[el] || 0;
    return `<div class="row"><span class="nm">${WUXING_KR[el]} ${el}</span>
      <span class="bar"><i style="width:${Math.round(c * 100 / max)}%;background:${WUXING_COLORS[el]}"></i></span>
      <span class="ct">${c}</span></div>`;
  }).join("");
  return `<div class="sh-card"><p class="sh-t">오행 분포</p><div class="sh-el">${rows}</div></div>`;
}

function sheetStrengthHtml(me) {
  const st = me.interpret.strength || {};
  const tot = (st.help || 0) + (st.weaken || 0);
  const hp = tot ? Math.round(st.help * 100 / tot) : 50;
  return `<div class="sh-card"><p class="sh-t">타고난 기운의 세기 <small>${escHtml(st.label || "")}</small></p>
    <div class="sh-gauge"><div class="h" style="width:${hp}%"></div><div class="w" style="width:${100 - hp}%"></div></div>
    <div class="sh-gauge-lb"><span>돕는 힘 ${hp}%</span><span>빼는 힘 ${100 - hp}%</span></div>
    ${me.interpret.hint ? `<p class="sh-note">${escHtml(me.interpret.hint)}</p>` : ""}
  </div>`;
}

function sheetGeokYongHtml(me) {
  const gg = me.interpret.geokguk || {};
  const yj = me.interpret.yongsin;
  const badges = [];
  if (gg.hangul) {
    const why = [gg.resolvedBy && gg.resolvedBy + " 기준", gg.transparentStem && gg.transparentStem + " 투출"].filter(Boolean).join(" · ");
    badges.push(`<span class="sh-badge">격국 ${escHtml(gg.hangul)}${why ? ` <small>${escHtml(why)}</small>` : ""}</span>`);
  }
  if (yj && yj.yong && yj.yong.length) badges.push(`<span class="sh-badge gold">용신 ${yj.yong.map(escHtml).join("·")}</span>`);
  if (yj && yj.gi && yj.gi.length) badges.push(`<span class="sh-badge plain">기신 ${yj.gi.map(escHtml).join("·")}</span>`);
  if (me.interpret.johu) badges.push(`<span class="sh-badge plain">조후 ${escHtml(me.interpret.johu.element)}</span>`);
  if (!badges.length) return "";
  return `<div class="sh-card"><p class="sh-t">격국과 용신 <small>중화 사주는 억부를 단정하지 않아요</small></p>
    <div class="sh-badge-row">${badges.join("")}</div></div>`;
}

function sheetSinsalHtml(me) {
  const list = me.sinsal || [];
  if (!list.length) {
    return `<div class="sh-card"><p class="sh-t">신살과 귀인</p>
      <p class="sh-note" style="margin-top:0">원국에 강하게 도는 특수 신살이 없어요 — 소문의 살에 흔들릴 이유가 없다는 뜻이기도 해요.</p></div>`;
  }
  const chips = list.map(s =>
    `<span class="sh-badge${/귀인|암록|금여|천덕|월덕|문창|학당|복성|천주|관귀학관/.test(s.name) ? " gold" : ""}">${escHtml(s.name)} <small>${escHtml(s.at.join("·"))}</small></span>`
  ).join("");
  return `<div class="sh-card"><p class="sh-t">신살과 귀인 <small>궁위 표기 · 계산으로 확인된 것만</small></p>
    <div class="sh-badge-row">${chips}</div></div>`;
}

function sheetDaewoonHtml(me) {
  const flow = me.daewoonFlow || {};
  const entries = flow.entries || [];
  if (!entries.length) return "";
  const cells = entries.map((e, i) => {
    const tags = [];
    if (i === flow.gloryIndex) tags.push("영광기");
    if (i === flow.risingIndex) tags.push("도약기");
    if (i === flow.trialIndex) tags.push("단련기");
    return `<div class="cell${e.isCurrent ? " cur" : ""}">
      <p class="age">${e.age}세</p><p class="gz">${escHtml(e.ganzi)}</p>
      <p class="tn tn-${e.tone}">${e.tone}</p>
      ${tags.length ? `<p class="tag">${tags.join("·")}</p>` : `<p class="tag">&nbsp;</p>`}
    </div>`;
  }).join("");
  return `<div class="sh-card"><p class="sh-t">대운 타임라인 <small>10년 단위 큰 흐름</small></p>
    <div class="sh-dw">${cells}</div></div>`;
}

function sheetMonthsHtml(me, fixedPeriod) {
  const months = (fixedPeriod?.months || me.months || []).slice(0, 12);
  if (!months.length) return "";
  const cells = months.map(m =>
    `<div class="cell"><p class="m">${m.year % 100}.${m.month}</p>
     <p class="gz">${escHtml(m.ganji)}</p><p class="tn tn-${m.tone}">${m.tone}</p></div>`
  ).join("");
  return `<div class="sh-card"><p class="sh-t">${fixedPeriod ? escHtml(fixedPeriod.year + "년 " + fixedPeriod.fromMonth + "~" + fixedPeriod.toMonth + "월") : "다가오는 12개월"} <small>${fixedPeriod ? "지난달은 회고로 읽어요" : "월건 기운 흐름"}</small></p>
    <div class="sh-mo">${cells}</div></div>`;
}

function sheetGunghapHtml(g, nameA, nameB) {
  if (!g) return "";
  const pct = Math.max(0, Math.min(100, Number(g.totalScore) || 0));
  const axes = AXIS_DEFS.map(([k, nm, col]) => {
    const v = (g.subScores && g.subScores[k]) || 0;
    return `<div class="row"><span class="nm">${nm}</span>
      <span class="bar"><i style="width:${Math.max(0, Math.min(100, v))}%;background:${col}"></i></span>
      <span class="v">${v}</span></div>`;
  }).join("");
  // verdict 는 엔진 문자열 그대로 — " — " 앞뒤 분할 표시만 허용(가공 금지 계약).
  const vd = String(g.verdict || "");
  const cut = vd.indexOf(" — ");
  const v1 = cut > 0 ? vd.slice(0, cut) : vd;
  const v2 = cut > 0 ? vd.slice(cut + 3) : "";
  // 링은 SVG 스트로크 — CSS conic+mask 는 html2canvas(PDF 책자)가 못 그린다.
  const circ = 2 * Math.PI * 42;
  const ringSvg = `<svg class="sh-ringsvg" viewBox="0 0 96 96" aria-hidden="true">
    <circle cx="48" cy="48" r="42" fill="none" stroke="#ece5d6" stroke-width="7"/>
    <circle cx="48" cy="48" r="42" fill="none" stroke="#8a76d8" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${(circ * pct / 100).toFixed(1)} ${circ.toFixed(1)}" transform="rotate(-90 48 48)"/>
  </svg>`;
  return `<div class="sh-card"><p class="sh-t">두 사람의 궁합 계산 <small>${escHtml(nameA || "나")} × ${escHtml(nameB || "그 사람")}</small></p>
    <div class="sh-score">
      <div class="sh-ring">${ringSvg}<span class="n">${pct}</span><span class="u">궁합 점수</span></div>
      <div class="sh-axes">${axes}</div>
    </div>
    ${vd ? `<p class="sh-verdict">${escHtml(v1)}${v2 ? `<small>${escHtml(v2)}</small>` : ""}</p>` : ""}
  </div>`;
}

function sheetPetHtml(ctx) {
  if (!ctx.pet || !ctx.pet.yearGanzi) return "";
  return `<div class="sh-card"><p class="sh-t">아이의 띠</p>
    <div class="sh-badge-row"><span class="sh-badge">${escHtml(ctx.pet.name || "아이")} · ${escHtml(String(ctx.pet.birthYear || ""))}년생 ${escHtml(ctx.pet.yearGanzi)}</span></div>
    <p class="sh-note">출생 연도만으로 본 년주(띠) 기준 리딩이에요.</p></div>`;
}

/**
 * 명식 오프닝 — 히어로 직후, 리딩의 근거를 먼저 편다(앱 결과 화면과 같은 구성):
 * 내 원국표 (+궁합 계산·상대 원국·반려 띠).
 */
function sheetOpeningHtml(data) {
  const ctx = data.context || {};
  const me = ctx.me;
  if (!me || !me.base) return "";
  const inputs = data.inputs || {};
  const parts = [sheetPillarsHtml(me, inputs.name ? inputs.name + "님" : "")];
  if (ctx.gunghap) {
    parts.push(sheetGunghapHtml(ctx.gunghap, inputs.name, inputs.partner && inputs.partner.name));
    if (ctx.partner && ctx.partner.base) {
      parts.push(sheetPillarsHtml(ctx.partner, (inputs.partner && inputs.partner.name ? inputs.partner.name + "님" : "그 사람") + "의 원국"));
    }
  }
  parts.push(sheetPetHtml(ctx));
  return `<div class="sheet">${parts.filter(Boolean).join("")}</div>`;
}

/** 챕터 머리에 끼우는 분석지 시각 카드 — 앱 RenderSheetVisual 과 같은 4종. */
function sheetVisualHtml(kind, data) {
  const me = (data.context || {}).me;
  if (!me || !me.base) return "";
  switch (kind) {
    case "elements": // 오행 저울 = 오행 분포 + 신강약 + 격국/용신 배지 묶음
      return `<div class="sheet">${[sheetElementsHtml(me), sheetStrengthHtml(me), sheetGeokYongHtml(me)].filter(Boolean).join("")}</div>`;
    case "sinsal": return `<div class="sheet">${sheetSinsalHtml(me)}</div>`;
    case "months": return `<div class="sheet">${sheetMonthsHtml(me, data.context?.fixedPeriod)}</div>`;
    case "daewoon": return `<div class="sheet">${sheetDaewoonHtml(me)}</div>`;
    default: return "";
  }
}

/**
 * 챕터 제목 키워드 → 시각 카드 앵커(각 1회) — 앱 anchorVisuals 와 같은 규칙.
 * 반환: {idx: kind}. 못 찾은 카드는 호출부가 말미 '명리 분석지'로 모은다.
 */
function anchorSheetVisuals(chapters) {
  const remaining = new Set(["sinsal", "daewoon", "months", "elements"]);
  const KEYS = {
    sinsal: ["살", "귀인", "신살"],
    daewoon: ["대운", "10년", "흐를", "흐름", "갈림길", "지형"],
    months: ["개월", "월:", "달과", "달까지", "시기", "연락", "창이", "타이밍", "계절"],
    elements: ["기운의 균형", "오행", "그릇", "저울", "바탕", "타고난 결", "에너지", "기운", "채우는"],
  };
  const map = {};
  chapters.forEach(ch => {
    if (!remaining.size) return;
    const t = ch.title || "";
    for (const kind of ["sinsal", "daewoon", "months", "elements"]) {
      if (remaining.has(kind) && KEYS[kind].some(k => t.includes(k))) {
        map[ch.idx] = kind;
        remaining.delete(kind);
        break;
      }
    }
  });
  return map;
}

/** 카테고리색을 지면 대비로 살짝 눌러 쓰기(앱 lerp(black, 0.3)의 웹판). */
function darkenHex(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const f = c => Math.round(c * (1 - amt));
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

/**
 * 분석지 전체 HTML — PDF 책자(report-pdf.js)가 쓰는 정본 구성(전 카드 일괄).
 * 뷰어는 sheetOpeningHtml + 앵커 삽입으로 나눠 쓴다.
 */
function renderSheetHtml(data) {
  const ctx = data.context || {};
  const me = ctx.me;
  if (!me || !me.base) return "";
  const inputs = data.inputs || {};
  const parts = [sheetPillarsHtml(me, inputs.name ? inputs.name + "님" : "")];
  if (ctx.gunghap) {
    parts.push(sheetGunghapHtml(ctx.gunghap, inputs.name, inputs.partner && inputs.partner.name));
    if (ctx.partner && ctx.partner.base) {
      parts.push(sheetPillarsHtml(ctx.partner, (inputs.partner && inputs.partner.name ? inputs.partner.name + "님" : "그 사람") + "의 원국"));
    }
  }
  parts.push(sheetElementsHtml(me), sheetStrengthHtml(me), sheetGeokYongHtml(me), sheetSinsalHtml(me), sheetDaewoonHtml(me), sheetMonthsHtml(me, ctx.fixedPeriod));
  parts.push(sheetPetHtml(ctx));
  return `<div class="sheet">${parts.filter(Boolean).join("")}</div>`;
}
