/* Report generation policy shared by the viewer and its offline tests. */
(function (root) {
  function chaptersOf(data) {
    const total = Number(data.total);
    const saved = new Map();
    for (const chapter of data.chapters || []) {
      if (Number.isInteger(chapter.idx) && chapter.idx >= 0 && chapter.idx < total &&
          typeof chapter.body === 'string' && chapter.body.trim() && !saved.has(chapter.idx)) saved.set(chapter.idx, chapter);
    }
    return Array.from(saved.values()).sort((a, b) => a.idx - b.idx);
  }
  function complete(data) {
    return data?.status === 'paid' && data.done === true && data.total > 0 && chaptersOf(data).length === data.total;
  }
  function rangesOf(data) {
    const size = data.chunkSize > 0 ? data.chunkSize : Math.max(1, Math.ceil(data.total / Math.max(1, data.chunks)));
    return Array.from({length: data.chunks}, (_, i) => [i * size, Math.min(data.total, (i + 1) * size)]);
  }
  function scheduleOf(data) {
    const ranges = rangesOf(data), plan = data.generationPlan;
    const modern = data.slug === 'year-2027' && data.generationVersion === 'annual-life-v1' && data.total === 16 && ranges.length === 8 &&
      ranges.every(([from, to]) => to - from === 2) &&
      JSON.stringify(plan?.phases) === '[[0],[1,2,3,4,5,6],[7]]';
    return modern ? {phases: plan.phases, parallelism: Math.max(1, Math.min(3, Math.floor(Number(plan.parallelism)) || 1))} :
      {phases: ranges.map((_, i) => [i]), parallelism: 1};
  }
  function merge(data, response) {
    // Already saved chapters retain their exact purchased text, even during retries.
    const prior = chaptersOf(data), saved = new Map(prior.map(chapter => [chapter.idx, chapter]));
    for (const chapter of chaptersOf({...data, chapters: response.chapters || []})) if (!saved.has(chapter.idx)) saved.set(chapter.idx, chapter);
    return {...data, chapters: Array.from(saved.values()).sort((a, b) => a.idx - b.idx), one_liner: response.one_liner || data.one_liner};
  }
  async function generate(data, request, changed, activity) {
    let current = {...data, chapters: chaptersOf(data), done: false};
    const ranges = rangesOf(data), schedule = scheduleOf(data);
    const missing = i => {const saved = new Set(current.chapters.map(chapter => chapter.idx)); const [from, to] = ranges[i];
      for (let k = from; k < to; k++) if (!saved.has(k)) return true;
      return false;
    };
    changed(current);
    for (const phase of schedule.phases) {
      const queue = phase.filter(missing), failures = [];
      const worker = async () => {
        while (queue.length && !failures.length) {
          const chunk = queue.shift();
          activity(chunk, 'writing');
          try {
            let response = await request({action: 'generate', chunk});
            if (!Array.isArray(response.chapters)) response = await request({action: 'get'});
            current = merge(current, response);
            changed(current);
            if (missing(chunk)) throw Object.assign(new Error('incomplete_response'), {code: 'incomplete_response'});
            activity(chunk, 'done');
          } catch (error) {activity(chunk, 'waiting'); failures.push(error);}
        }
      };
      await Promise.all(Array.from({length: Math.min(schedule.parallelism, queue.length)}, worker));
      if (failures.length) throw failures[0];
    }
    const full = await request({action: 'get'});
    // A server response cannot silently turn a partial result into an exportable report.
    current = {...current, ...full, chapters: merge(current, full).chapters};
    changed(current);
    if (!complete(current)) throw Object.assign(new Error('incomplete_response'), {code: 'incomplete_response'});
    return current;
  }
  root.StoreReportGeneration = {chaptersOf, complete, rangesOf, scheduleOf, merge, generate};
})(typeof window === 'object' ? window : globalThis);
