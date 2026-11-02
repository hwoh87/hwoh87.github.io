import {renderReadingVisuals} from '../sowon/reading-visuals.js?v=20261101-report-visual3';
import {buildSajuVisuals,buildJamiVisuals,buildStarVisuals} from '../sowon/reading-visual-data.js?v=20261101-report-visual3';

/** Reuse the shrine's deterministic chart views; no AI call or new birth calculation. */
export function renderGrandCharts(container, context) {
  const fusion=context?.fusion, document=container.ownerDocument;
  if(fusion?.version!=='fusion-web-v1' || !context.me?.base || !fusion.astrology?.chart)return false;
  const group=(title,models)=>{
    const section=document.createElement('section'),heading=document.createElement('h3');
    heading.textContent=title;section.append(heading,renderReadingVisuals(models,{document,compact:true}));return section;
  };
  const year=context.me.now.year;
  container.replaceChildren(
    group('사주 원국과 기운',buildSajuVisuals(context.me.base,context.me.interpret,{year})),
    group('자미두수 열두 궁',buildJamiVisuals(fusion.ziwei,{year})),
    group('태어난 하늘의 구조',buildStarVisuals(fusion.astrology.chart,fusion.astrology.reading)),
  );return true;
}
