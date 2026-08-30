// 스토어 리포트 PDF 책자 생성기 — report.html 이 다운로드 시점에 지연 로드한다.
//
// 조판 원칙(앱 ReportPdfExporter 코스믹 에디션의 웹 대응):
//   커버·마무리 = 딥스페이스, 본문 = 웜 페이퍼. 표제는 마루부리(한자는 Noto Serif KR).
//   챕터는 강제 새 페이지가 아니라 "남은 공간이 모자랄 때만" 넘기는 흐름 조판 + 금박 디바이더.
// 렌더는 페이지 DOM(794×1123 = A4 @96dpi) → html2canvas(scale 2) → jsPDF. 폰트 임베드가
// 필요 없고(래스터) 화면 디자인과 픽셀 단위로 같은 책이 나온다.

(function () {
  "use strict";

  const PAGE_W = 794, PAGE_H = 1123;

  function el(cls, html) {
    const d = document.createElement("div");
    d.className = cls;
    if (html != null) d.innerHTML = html;
    return d;
  }

  function htmlToBlocks(html) {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return Array.from(tmp.children);
  }

  window.buildStoreReportPdf = async function (data, prod, reader, cat, onPct) {
    onPct && onPct(2);
    // 마루부리 글리프를 미리 확실히 로드 — 래스터에 폴백 세리프가 박히는 사고 방지.
    try {
      await Promise.all([
        document.fonts.load('600 20px "MaruBuri"', "삼라만상"),
        document.fonts.load('400 16px "MaruBuri"', "삼라만상"),
        document.fonts.load('600 20px "Noto Serif KR"', "四柱"),
        document.fonts.ready,
      ]);
    } catch (e) { /* 폰트 실패 시 시스템 세리프 강등 */ }

    const inputs = data.inputs || {};
    const name = inputs.name || "당신";
    const dateKr = new Date(data.created_at).toLocaleDateString("ko-KR");
    const stage = el("pdfstage");
    document.body.appendChild(stage);
    const pages = [];

    function newPage(space) {
      const pg = el("pdfpage" + (space ? " space" : ""));
      const inner = el("inner");
      pg.appendChild(inner);
      stage.appendChild(pg);
      pages.push(pg);
      return inner;
    }

    // ── 1) 커버(딥스페이스) ───────────────────────────────────
    newPage(true).innerHTML = `
      <p class="pdf-cover-cat">SAMRA MANSANG · ${escHtml(cat.label)}</p>
      <h1 class="pdf-cover-title">${escHtml(prod.title)}</h1>
      <p class="pdf-cover-for"><b>${escHtml(name)}</b>님을 위한 ${data.total}장의 리딩 · ${reader.emoji} ${escHtml(reader.name)} 술사</p>
      <img class="pdf-cover-art" src="art/covers/${prod.slug}.webp" alt="">
      ${data.one_liner ? `<p class="pdf-cover-sig">“ ${escHtml(data.one_liner)} ”</p>` : ""}
      <p class="pdf-cover-foot">삼 라 만 상 · ${dateKr}</p>`;

    // ── 공용: 웜 페이퍼 흐름 조판 ────────────────────────────
    let inner = null;      // 현재 페이지의 콘텐츠 영역
    let sheetHost = null;  // 분석지 카드 컨테이너(.sheet) — 페이지가 바뀌면 새로 만든다
    function freshPaper(headerHtml) {
      inner = newPage(false);
      sheetHost = null;
      if (headerHtml) inner.appendChild(el("", headerHtml));
    }
    // ⚠️ scrollHeight 는 절대배치 컨테이너에서 항상 clientHeight 이상이라 "남은 공간" 측정에 못 쓴다
    //    (그걸 썼더니 매 블록이 새 페이지로 밀려 29쪽짜리 책이 나왔다). 마지막 블록의 실제
    //    바닥 좌표로 사용 높이를 잰다 — 오프스크린(fixed)에서도 getBoundingClientRect 는 유효.
    const usedHeight = () => {
      const last = inner.lastElementChild;
      if (!last) return 0;
      return last.getBoundingClientRect().bottom - inner.getBoundingClientRect().top;
    };
    const remaining = () => inner.clientHeight - usedHeight();
    const overflowed = () => usedHeight() > inner.clientHeight - 4;
    /** 블록 하나를 현재 페이지에 놓고, 넘치면 새 페이지로 옮긴다. */
    function place(block, minRoom) {
      if (minRoom != null && remaining() < minRoom) freshPaper();
      inner.appendChild(block);
      if (overflowed()) {
        inner.removeChild(block);
        freshPaper();
        inner.appendChild(block);
      }
    }
    /** 분석지 카드 전용 — .sheet 컨테이너(grid 간격) 안에 넣되 페이지 넘침을 처리. */
    function placeSheetCard(card) {
      if (!sheetHost) { sheetHost = el("sheet"); inner.appendChild(sheetHost); }
      sheetHost.appendChild(card);
      if (overflowed()) {
        sheetHost.removeChild(card);
        if (!sheetHost.childElementCount) sheetHost.remove();
        freshPaper();
        sheetHost = el("sheet");
        inner.appendChild(sheetHost);
        sheetHost.appendChild(card);
      }
    }

    // ── 2) 명리 분석지 ────────────────────────────────────────
    freshPaper(`<h2 class="pdf-h1"><small>SHEET</small>명리 분석지</h2><div class="pdf-rule"></div>`);
    {
      const sheetHtml = renderSheetHtml(data);
      const tmp = document.createElement("div");
      tmp.innerHTML = sheetHtml;
      const cards = Array.from(tmp.querySelector(".sheet")?.children ?? []);
      cards.forEach(placeSheetCard);
    }

    // ── 3) 차례 ───────────────────────────────────────────────
    freshPaper(`<h2 class="pdf-h1"><small>CONTENTS</small>차례</h2><div class="pdf-rule"></div>`);
    {
      const toc = el("pdf-toc");
      data.chapters.forEach(ch => {
        toc.appendChild(el("row",
          `<span class="no">${String(ch.idx + 1).padStart(2, "0")}</span><span class="tt">${escHtml(ch.title)}</span>`));
      });
      place(toc);
    }

    // ── 4) 챕터 — 흐름 조판(남은 공간이 모자랄 때만 새 페이지) ─
    freshPaper(`<h2 class="pdf-h1"><small>REPORT</small>${escHtml(reader.name)}의 리딩</h2><div class="pdf-rule"></div>`);
    data.chapters.forEach((ch, i) => {
      if (i > 0) {
        if (remaining() < 300) freshPaper();
        else place(el("pdf-div", "<span>✦</span>"));
      }
      place(el("pdf-ch-head",
        `<span class="pdf-ch-no">제 ${ch.idx + 1} 장</span><span class="pdf-ch-title">${escHtml(ch.title)}</span>`), 230);
      // 본문은 문단 단위 낱개 배치 — 페이지 사이를 자연스럽게 흐른다.
      htmlToBlocks(mdToHtml(ch.body)).forEach(node => {
        const wrap = el("pdf-body");
        wrap.appendChild(node);
        place(wrap);
      });
    });

    // ── 5) 추가질문(플러스 티어) ─────────────────────────────
    if (data.extra_q) {
      freshPaper(`<h2 class="pdf-h1"><small>ONE MORE</small>추가질문</h2><div class="pdf-rule"></div>`);
      place(el("pdf-body", `<p><strong>Q. ${escHtml(data.extra_q.question)}</strong></p>`));
      htmlToBlocks(mdToHtml(data.extra_q.answer)).forEach(node => {
        const wrap = el("pdf-body");
        wrap.appendChild(node);
        place(wrap);
      });
    }

    // ── 6) 마무리(딥스페이스) ────────────────────────────────
    newPage(true).innerHTML = `
      ${data.one_liner
        ? `<p class="pdf-close-sig">“ ${escHtml(data.one_liner)} ”</p>`
        : `<p class="pdf-close-sig">여덟 글자의 흐름이<br>${escHtml(name)}님의 편이 되기를.</p>`}
      <p class="pdf-close-note">${escHtml(name)}님의 명식 위에서 ${escHtml(reader.name)} 술사가 집필한 삼라만상 사주 리포트<br>
      해석은 참고용 · 엔터테인먼트 목적이에요 · ${dateKr}</p>
      <p class="pdf-cover-foot">삼 라 만 상</p>`;

    // 웜 페이퍼 페이지에 하단 푸터(쪽 번호)
    pages.forEach((pg, i) => {
      if (pg.classList.contains("space")) return;
      pg.appendChild(el("pdf-foot",
        `<span>삼라만상 · ${escHtml(prod.title)}</span><span>${String(i + 1).padStart(2, "0")} / ${pages.length}</span>`));
    });

    onPct && onPct(8);
    // 커버 아트 등 이미지 로드 대기
    await Promise.all(Array.from(stage.querySelectorAll("img")).map(img =>
      img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })
    ));

    // ── 렌더 → PDF ───────────────────────────────────────────
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: "mm", format: "a4", compress: true });
    for (let i = 0; i < pages.length; i++) {
      const canvas = await window.html2canvas(pages[i], {
        scale: 2, useCORS: true, logging: false,
        width: PAGE_W, height: PAGE_H, windowWidth: PAGE_W,
      });
      const img = canvas.toDataURL("image/jpeg", 0.88);
      if (i > 0) pdf.addPage();
      pdf.addImage(img, "JPEG", 0, 0, 210, 297, undefined, "FAST");
      onPct && onPct(8 + Math.round(((i + 1) / pages.length) * 90));
    }

    const safe = s => String(s).replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
    pdf.save(`삼라만상_${safe(prod.title)}_${safe(name)}.pdf`);
    stage.remove();
    onPct && onPct(100);
  };
})();
