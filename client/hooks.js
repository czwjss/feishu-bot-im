import React from 'react';
import { rpc } from './shared.js';
import { createQuery, startPolling, syncDraft, commitDraft } from './async.js';
import { createAutoSave } from './autosave.js';

export function usePolling(task, { interval, enabled = true, immediate = true, scope = null }) {
  const current = React.useRef(task);
  current.current = task;
  React.useEffect(() => enabled ? startPolling((signal) => current.current(signal), { interval, immediate }) : undefined,
    [interval, enabled, immediate, scope]);
}

export function useRpcQuery(connection, method, initialValue = null) {
  const [data, setData] = React.useState(initialValue);
  const [error, setError] = React.useState(null);
  const [loaded, setLoaded] = React.useState(false);
  const query = React.useMemo(() => createQuery(() => rpc(connection, method, {}), {
    onValue(value) { setData(value); setError(null); setLoaded(true); },
    onError(failure) { setError(failure?.message ?? String(failure)); setLoaded(true); },
  }), [connection, method]);
  React.useEffect(() => {
    query.activate();
    setData(initialValue); setError(null); setLoaded(false);
    return () => query.dispose();
  }, [query]);
  return { data, error, loaded, ...query };
}

/** Preserve edits through background refreshes and edits made during a save. */
export function useDraft(serverValue) {
  const [draft, setDraft] = React.useState(() => ({ baseline: serverValue, value: serverValue }));
  React.useEffect(() => { setDraft((previous) => syncDraft(previous, serverValue)); }, [serverValue]);
  return [draft.value,
    (value) => setDraft((previous) => ({ ...previous, value })),
    (saved, submitted) => setDraft((previous) => commitDraft(previous, saved, submitted))];
}

/** Only user edits enqueue writes. Unmounting flushes accepted edits without updating stale UI. */
export function useAutoSave() {
  const [queue] = React.useState(createAutoSave);
  const [state, setState] = React.useState({ status: 'idle', error: null });
  const alive = React.useRef(false);
  React.useEffect(() => {
    alive.current = true;
    const unsubscribe = queue.subscribe(setState);
    return () => { alive.current = false; unsubscribe(); void queue.flush(); };
  }, [queue]);
  return {
    state, flush: queue.flush, cancel: queue.cancel,
    retry: () => queue.flush(true),
    compositionHandlers: { onCompositionStartCapture: queue.pauseText, onCompositionEndCapture: queue.resumeText },
    schedule(key, operation, delay = 0, onSaved) {
      queue.schedule(key, async () => {
        const value = await operation();
        if (alive.current) onSaved?.(value);
      }, delay);
    },
  };
}

export function useMutation() {
  const [busy, setBusy] = React.useState('');
  const [error, setError] = React.useState(null);
  const tail = React.useRef(Promise.resolve());
  const alive = React.useRef(true);
  React.useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const run = (label, operation, onSuccess = () => {}) => {
    const task = tail.current.then(async () => {
      if (!alive.current) return;
      setBusy(label);
      setError(null);
      try {
        const value = await operation();
        if (alive.current) await onSuccess(value);
        return value;
      } catch (failure) {
        if (alive.current) setError(failure?.message ?? String(failure));
      } finally {
        if (alive.current) setBusy('');
      }
    });
    tail.current = task;
    return task;
  };
  return { busy, error, run };
}
