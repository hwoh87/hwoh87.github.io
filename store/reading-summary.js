(function(root) {
  function describe(st) {
    const total = (st.help || 0) + (st.weaken || 0);
    if (!total) return '명식은 계산됐지만 기운의 균형 요약은 준비되지 않았어요. 아래 명식과 계산 근거를 확인해 주세요.';
    if (st.neutral) return '나를 돕는 힘과 밖으로 쓰는 힘이 균형에 가까워요. 강하다·약하다 한 가지로 단정하지 않고, 다른 글자와의 관계를 함께 읽는 사주예요.';
    return st.help > st.weaken
      ? '나를 돕는 힘의 비중이 더 커요. 이 힘을 어떻게 쓰는지는 다른 글자와의 관계를 함께 읽어야 해요. 좋고 나쁨을 매긴 점수는 아니에요.'
      : '밖으로 쓰거나 나를 제어하는 힘의 비중이 더 커요. 부족한 사람이라는 뜻은 아니에요. 나를 돕는 글자와의 관계를 함께 읽어 보세요.';
  }
  root.SamraReading = {describe};
  if (typeof module !== 'undefined') module.exports = {describe};
})(typeof window !== 'undefined' ? window : globalThis);
