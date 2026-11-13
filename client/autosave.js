/** Coalesce edits per setting and serialize writes. Failed edits stay available for retry. */
export function createAutoSave() {
  const pending = new Map();
  const listeners = new Set();
  let flight = null;
  let running = false;
  let saved = false;
  let composing = false;
  const snapshot = () => {
    const error = [...pending.values()].find((job) => job.error)?.error ?? null;
    return { status: error ? 'error' : running ? 'saving' : pending.size ? 'pending' : saved ? 'saved' : 'idle', error };
  };
  const publish = () => { const value = snapshot(); listeners.forEach((listener) => listener(value)); };
  const pump = () => {
    if (flight) return flight;
    flight = Promise.resolve().then(async () => {
      for (;;) {
        const entry = [...pending].find(([, job]) => job.ready && !job.error);
        if (!entry) break;
        const [key, job] = entry;
        pending.delete(key);
        running = true; publish();
        try { await job.work(); saved = true; }
        catch (error) {
          // An edit made during this write supersedes the failed older value.
          if (!pending.has(key)) pending.set(key, { ...job, ready: false, error: error?.message ?? String(error) });
        }
        running = false; publish();
      }
    }).finally(() => { flight = null; publish(); });
    return flight;
  };
  return {
    subscribe(listener) { listeners.add(listener); listener(snapshot()); return () => listeners.delete(listener); },
    schedule(key, work, delay = 0) {
      clearTimeout(pending.get(key)?.timer);
      const job = { work, delay, ready: delay === 0, error: null, timer: null };
      pending.set(key, job);
      if (delay > 0 && !composing) job.timer = setTimeout(() => { job.ready = true; void pump(); }, delay);
      publish();
      if (job.ready) void pump();
    },
    cancel(key) { clearTimeout(pending.get(key)?.timer); pending.delete(key); publish(); },
    pauseText() {
      composing = true;
      for (const job of pending.values()) if (job.delay > 0) { clearTimeout(job.timer); job.ready = false; }
    },
    resumeText() {
      composing = false;
      for (const job of pending.values()) if (job.delay > 0 && !job.error) {
        clearTimeout(job.timer);
        job.timer = setTimeout(() => { job.ready = true; void pump(); }, job.delay);
      }
    },
    async flush(retry = false) {
      // New edits may arrive while a write is in flight; drain those too before closing.
      do {
        for (const job of pending.values()) {
          clearTimeout(job.timer);
          if (retry) job.error = null;
          if (!job.error) job.ready = true;
        }
        await pump();
        retry = false;
      } while ([...pending.values()].some((job) => !job.error));
      return pending.size === 0;
    },
  };
}
