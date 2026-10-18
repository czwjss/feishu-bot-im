import { randomUUID } from 'node:crypto';

/**
 * DSH Harness adapter for the Feishu channel.
 *
 * Every gateway call carries the in-process Peer: DSH 0.2.1 rejects an invoke or
 * stream without one (INTERNAL_UNKNOWN), which is exactly the failure the
 * upstream dsh-im 4.39.0 needed a binary patch for.
 */

function failure(error) {
  const value = error?.failure ?? (error?.isDSHRemoteError === true ? error : undefined);
  if (value && typeof value === 'object' && typeof value.code === 'string') {
    const wrapped = new Error(value.message ?? value.code);
    wrapped.code = value.code;
    wrapped.details = value.details ?? {};
    return wrapped;
  }
  const wrapped = error instanceof Error ? error : new Error(String(error));
  if (!wrapped.code) wrapped.code = wrapped.name === 'AbortError' ? 'cancelled' : 'gateway/internal';
  return wrapped;
}

/** Read the text blocks of one assistant message payload. */
export function textOfContent(content) {
  if (!Array.isArray(content)) return '';
  return content
    .map((block) => (block && block.type === 'text' && typeof block.text === 'string' ? block.text : ''))
    .filter(Boolean)
    .join('');
}

export class HarnessAdapter {
  #ctx;
  #gateway;
  #peer;

  constructor(ctx) {
    this.#ctx = ctx;
    this.#gateway = ctx.typertGateway;
    if (!this.#gateway || typeof this.#gateway.invoke !== 'function') {
      throw new TypeError('feishu-bot requires ctx.typertGateway.invoke');
    }
    const connection = ctx.connection;
    this.#peer = connection && typeof connection.createPeer === 'function'
      ? connection.createPeer({ principal: { kind: 'owner' }, interactions: 'none' })
      : undefined;
  }

  get peer() {
    return this.#peer;
  }

  #request(namespace, method, args, signal) {
    const request = { namespace, method, args };
    if (this.#peer !== undefined) request.peer = this.#peer;
    if (signal !== undefined) request.signal = signal;
    return request;
  }

  async invoke(namespace, method, args, signal) {
    try {
      return await this.#gateway.invoke(this.#request(namespace, method, args, signal));
    } catch (error) {
      throw failure(error);
    }
  }

  async stream(namespace, method, args, signal) {
    try {
      return await this.#gateway.stream(this.#request(namespace, method, args, signal));
    } catch (error) {
      throw failure(error);
    }
  }

  /** First frame of a one-shot stream, then close it. */
  async #firstFrame(namespace, method, args, signal) {
    const source = await this.stream(namespace, method, args, signal);
    const iterator = source[Symbol.asyncIterator]();
    try {
      const first = await iterator.next();
      if (first.done) throw new Error(`harness ${namespace}.${method} stream ended before its baseline`);
      return first.value;
    } finally {
      await Promise.resolve(iterator.return?.()).catch(() => undefined);
    }
  }

  async createSession({ cwd, workspaceId, agentPreset } = {}) {
    const request = {};
    if (typeof workspaceId === 'string' && workspaceId) request.workspaceId = workspaceId;
    if (typeof cwd === 'string' && cwd) request.cwd = cwd;
    if (typeof agentPreset === 'string' && agentPreset) request.agentPreset = agentPreset;
    const value = await this.invoke('session', 'create', { request });
    if (!value || typeof value.sessionId !== 'string') {
      throw new Error('harness session.create returned no sessionId');
    }
    return value.sessionId;
  }

  async prompt(sessionId, content, { mode = 'queue', signal } = {}) {
    const parts = typeof content === 'string' ? [{ type: 'text', text: content }] : content;
    const request = {
      requestId: `im-feishu-${randomUUID()}`,
      sessionId,
      mode: mode === 'steer' ? 'steer' : 'queue',
      content: parts,
    };
    return this.invoke('session', 'prompt', { request }, signal);
  }

  async cancel(sessionId) {
    return this.invoke('session', 'cancel', { request: { sessionId } });
  }

  async listSessions() {
    const value = await this.invoke('session', 'list', { _request: {} });
    return Array.isArray(value?.items) ? value.items : [];
  }

  async modelCatalog() {
    return this.invoke('session', 'modelCatalog', {});
  }

  async selectModel(sessionId, selection) {
    const request = { sessionId };
    if (selection?.provider) request.provider = selection.provider;
    if (selection?.model) request.model = selection.model;
    if (selection?.reasoningEffort) request.reasoningEffort = selection.reasoningEffort;
    return this.invoke('session', 'selectModel', { request });
  }


  /** Map a configured directory to the workspace the Host already registered. */
  async resolveWorkspaceId(path) {
    if (typeof path !== 'string' || !path) return null;
    const baseline = await this.workspaceBaseline().catch(() => ({}));
    const items = Array.isArray(baseline?.items) ? baseline.items : [];
    const match = items.find((item) => item?.path === path);
    return match?.workspaceId ?? null;
  }

  /** Register (or look up) the Host workspace for one directory. */
  async ensureWorkspace(path) {
    if (typeof path !== 'string' || !path) return null;
    const value = await this.invoke('workspace', 'create', { request: { path } });
    return value?.workspace?.workspaceId ?? null;
  }

  async workspaceBaseline() {
    const frame = await this.#firstFrame('workspace', 'follow', {});
    const value = frame?.type === 'baseline' ? frame.value : null;
    return value && typeof value === 'object' ? value : {};
  }


  /** Last `maxMessages`-worth page of one Session, already chronological. */
}
