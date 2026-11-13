/** Serial polling, with visibility pause and cancellation of stale results. */
export function startPolling(task, { interval, immediate = true, document = globalThis.document, onError = () => {} }) {
  const controller = new AbortController();
  let timer;
  let running = false;
  const schedule = (delay) => {
    clearTimeout(timer);
    if (!controller.signal.aborted && !document?.hidden) timer = setTimeout(tick, delay);
  };
  const tick = async () => {
    if (running || controller.signal.aborted || document?.hidden) return;
    running = true;
    try { await task(controller.signal); }
    catch (error) { if (!controller.signal.aborted) onError(error); }
    finally { running = false; schedule(interval); }
  };
  const onVisibility = () => {
    clearTimeout(timer);
    if (!document?.hidden) void tick();
  };
  document?.addEventListener('visibilitychange', onVisibility);
  if (immediate) void tick();
  else schedule(interval);
  return () => {
    controller.abort();
    clearTimeout(timer);
    document?.removeEventListener('visibilitychange', onVisibility);
  };
}

/** Manual refresh and polling share one request; mutations invalidate old responses. */
export function createQuery(fetchValue, { onValue, onError }) {
  let active = true;
  let revision = 0;
  let flight = null;
  return {
    activate() { active = true; },
    dispose() { active = false; revision += 1; flight = null; },
    invalidate() { revision += 1; flight = null; },
    accept(value) { revision += 1; flight = null; if (active) onValue(value); },
    refresh() {
      if (!active) return Promise.resolve(null);
      if (flight) return flight;
      const current = revision;
      const request = Promise.resolve().then(fetchValue).then((value) => {
        if (active && revision === current) onValue(value);
        return value;
      }, (error) => {
        if (active && revision === current) onError(error);
        return null;
      }).finally(() => { if (flight === request) flight = null; });
      flight = request;
      return request;
    },
  };
}

export function syncDraft(draft, serverValue) {
  return { baseline: serverValue, value: draft.value === draft.baseline ? serverValue : draft.value };
}

export function commitDraft(draft, savedValue, submittedValue) {
  return { baseline: savedValue, value: draft.value === submittedValue ? savedValue : draft.value };
}

export const remainingSeconds = (expiresAt, now = Date.now()) => Number.isFinite(expiresAt)
  ? Math.max(0, Math.ceil((expiresAt - now) / 1000)) : 0;
