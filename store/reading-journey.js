(() => {
  if (!["/", "/index.html", "/calc/", "/calc/index.html"].includes(location.pathname)) return;
  const host = document.getElementById('sjResult') || document.getElementById('result');
  if (!host || document.getElementById('readingJourney')) return;
  const section = document.createElement('section');
  section.id = 'readingJourney'; section.className = 'reading-journey';
  section.innerHTML = `<span class="journey-kicker">다음으로 궁금한 것</span><h3>내 고민으로 이어서 읽기</h3><p>관심 주제를 고르면 관련 유료 리포트의 목차와 가격을 확인할 수 있어요. 기본 계산은 계속 무료예요.</p><div class="journey-options" role="group" aria-label="관심 고민"></div><div class="journey-choice" aria-live="polite" hidden></div>`;
  const choices = [
    ['연애','love-sal','내 사주에 연애 살, 진짜 있을까','도화·홍염과 연애 흐름을 읽는 리포트'],
    ['재물','money-bowl','내 돈은 어디로 새고 있을까','돈의 흐름과 소비 성향을 읽는 리포트'],
    ['일·진로','job-change','지금 회사, 옮겨도 될까','남을 때와 옮길 때의 흐름을 읽는 리포트'],
    ['앞으로의 흐름','three-months','앞으로 3개월, 나는 어떻게 흐를까','다가오는 석 달의 흐름을 읽는 리포트']
  ];
  choices.forEach(([label, slug, title, description]) => {
    const button = document.createElement('button'); button.type = 'button';
    button.textContent = label; button.setAttribute('aria-pressed','false');
    button.addEventListener('click', () => {
      section.querySelectorAll('button').forEach(b => b.setAttribute('aria-pressed',String(b === button)));
      const box = section.querySelector('.journey-choice'); box.hidden = false;
      box.replaceChildren();
      const heading = document.createElement('h4'); heading.textContent = title;
      const text = document.createElement('p'); text.textContent = description;
      const link = document.createElement('a'); link.href = '/store/product.html?id=' + slug;
      link.textContent = '목차·가격 확인하기 →';
      box.append(heading,text,link);
      window.__track?.('cta','reading-interest-' + slug);
    });
    section.querySelector('.journey-options').append(button);
  });
  const oldSuggestions = host.querySelector('#xsell');
  if (oldSuggestions) {
    oldSuggestions.style.display = 'none';
    oldSuggestions.before(section);
  } else host.append(section);
})();
