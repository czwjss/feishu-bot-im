/** Only DSH's documented reference/provider boundary is replaced in UI tests. */
export function workerViewFixture({ ready = () => Promise.resolve(), known = true, refresh = async () => {} } = {}) {
  const retained = [], released = [], scopes = [], slots = [];
  const workerView = {
    sessions: {
      list: { getSnapshot: () => ({ byId: known ? new Proxy({}, { get: () => ({}) }) : {} }) },
      refresh,
      retain(sessionId, { source }) {
        retained.push({ sessionId, source });
        return { sessionId, ready: ready(sessionId), release() { released.push(sessionId); } };
      },
    },
    SessionProvider({ session, children }) {
      scopes.push(session.sessionId);
      return { type: 'div', props: { 'data-native-worker': session.sessionId, children } };
    },
    renderSlot(name, props) {
      slots.push({ name, props });
      return { type: 'div', props: { children: ['Native Worker conversation'] } };
    },
  };
  return { workerView, retained, released, scopes, slots };
}
