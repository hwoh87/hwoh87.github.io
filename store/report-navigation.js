/* 웹 리포트 장 이동. 고객 본문을 새로 저장하거나 전송하지 않는다. */
function reportContentsHtml(chapters) {
  if (!Array.isArray(chapters) || chapters.length < 2) return "";
  return '<nav class="rp-contents" id="report-contents" tabindex="-1" aria-label="리포트 목차">' +
    '<details open><summary>목차 · ' + chapters.length + '장</summary><ol>' +
    chapters.map((ch, i) => '<li><a href="#report-chapter-' + i + '">' + escHtml(ch.title) + '</a></li>').join('') +
    '</ol></details></nav>';
}
