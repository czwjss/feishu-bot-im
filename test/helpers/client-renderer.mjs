import { build } from 'esbuild';
import { runInNewContext } from 'node:vm';

/** Execute real components/hooks against mock RPCs, without mounting a live Host. */
export async function clientRenderer({ confirm = () => { throw new Error('Unexpected confirmation'); }, clock } = {}) {
  const slots = new Map();
  let current, cursor, effects = [], visited, tree, root;
  const same = (a, b) => a?.length === b?.length && a.every((value, i) => Object.is(value, b[i]));
  const React = {
    Component: class { constructor(props) { this.props = props; } }, Fragment: Symbol('fragment'),
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState(initial) {
      const entry = slots.get(current), index = cursor++;
      entry[index] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [entry[index].value, (value) => { entry[index].value = typeof value === 'function' ? value(entry[index].value) : value; }];
    },
    useRef(initial) { const entry = slots.get(current), index = cursor++; return entry[index] ??= { current: initial }; },
    useMemo(factory, deps) {
      const entry = slots.get(current), index = cursor++;
      if (!entry[index] || !same(entry[index].deps, deps)) entry[index] = { value: factory(), deps };
      return entry[index].value;
    },
    useCallback(fn, deps) { return React.useMemo(() => fn, deps); },
    useEffect(effect, deps) {
      const entry = slots.get(current), index = cursor++;
      if (entry[index] && same(entry[index].deps, deps)) return;
      const previous = entry[index];
      const next = entry[index] = { deps };
      effects.push(() => { previous?.cleanup?.(); next.cleanup = effect(); });
    },
  };
  const timers = new Set();
  const schedule = clock ? clock.setTimeout.bind(clock) : setTimeout;
  const cancel = clock ? clock.clearTimeout.bind(clock) : clearTimeout;
  const setTimer = (fn, delay) => { const timer = schedule(() => { timers.delete(timer); fn(); }, delay); timers.add(timer); return timer; };
  const clearTimer = (timer) => { cancel(timer); timers.delete(timer); };
  const result = await build({
    stdin: { contents: "export { WorkspacePage } from './client/workspace.js'; export { ActionButton } from './client/action-button.js'; export { WorkerSessionView, WorkerConversationContent } from './client/worker-conversation.js'; ", resolveDir: new URL('../../', import.meta.url).pathname },
    bundle: true, write: false, format: 'cjs', platform: 'node', external: ['react'],
    loader: { '.svg': 'dataurl' },
  });
  const module = { exports: {} };
  runInNewContext(result.outputFiles[0].text, {
    module, exports: module.exports, require: () => React, console, AbortController,
    setTimeout: setTimer, clearTimeout: clearTimer, navigator: { language: 'zh-CN' },
    window: { addEventListener() {}, removeEventListener() {}, confirm },
  });
  function render(node, path = 'root') {
    if (node == null || typeof node === 'boolean') return null;
    if (Array.isArray(node)) return node.map((child, index) => render(child, `${path}/${child?.props?.key ?? index}`));
    if (typeof node !== 'object') return node;
    if (node.props.key != null) path = `${path}/key:${node.props.key}`;
    if (node.type === React.Fragment) return render(node.props.children, `${path}/fragment`);
    if (typeof node.type === 'function') {
      const key = `${path}/${node.type.name}`;
      visited.add(key);
      if (!slots.has(key)) slots.set(key, []);
      const previous = [current, cursor]; current = key; cursor = 0;
      const output = node.type.prototype?.render ? new node.type(node.props).render() : node.type(node.props);
      [current, cursor] = previous;
      return render(output, key);
    }
    return { ...node, props: { ...node.props, children: render(node.props.children, path) } };
  }
  function repaint() {
    visited = new Set();
    tree = render(root);
    for (const [key, entries] of slots) if (!visited.has(key)) { entries.forEach((entry) => entry.cleanup?.()); slots.delete(key); }
    const pending = effects; effects = []; pending.forEach((effect) => effect());
    return tree;
  }
  return {
    mount(name, props) { root = React.createElement(module.exports[name], props); return repaint(); },
    async settle() { for (let i = 0; i < 8; i++) { await new Promise(setImmediate); repaint(); } return tree; },
    get tree() { return tree; },
    dispose() { for (const entries of slots.values()) entries.forEach((entry) => entry.cleanup?.()); slots.clear(); for (const timer of timers) cancel(timer); timers.clear(); },
  };
}

export function findNodes(tree, predicate, includeHidden = false) {
  if (tree == null || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap((child) => findNodes(child, predicate, includeHidden));
  if (!includeHidden && tree.props.hidden) return [];
  return [...(predicate(tree) ? [tree] : []), ...findNodes(tree.props.children, predicate, includeHidden)];
}
export function textOf(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(textOf).join('');
  if (typeof tree !== 'object') return String(tree);
  return tree.type === 'style' || tree.props.hidden ? '' : textOf(tree.props.children);
}
