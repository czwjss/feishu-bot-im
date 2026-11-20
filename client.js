window.__ModuleLoader__.load({
  id: "@czwjss/feishu-bot-im",
  factory(require) {
    const module = { exports: {} };
    (function (module, exports, require) {
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// client/index.js
var index_exports = {};
__export(index_exports, {
  createPlugin: () => createPlugin
});
module.exports = __toCommonJS(index_exports);
var import_react19 = __toESM(require("react"), 1);

// client/shared.js
var import_react = __toESM(require("react"), 1);

// src/contracts.js
var RPC_ENDPOINT = "im-feishu";
var ACCESS_MODES = Object.freeze({ ALL: "all", ALLOWLIST: "allowlist" });
var BUSY_MODES = Object.freeze({ QUEUE: "queue", STEER: "steer" });
var CONTEXT_ENHANCEMENT_FIELDS = Object.freeze([
  "senderId",
  "senderName",
  "botId",
  "sentAt",
  "conversationTitle"
]);
var API = Object.freeze({
  managementSnapshot: "management.snapshot",
  chatSessions: "chat.sessions.list",
  chatBind: "chat.bind",
  chatUnbind: "chat.unbind",
  botAccessSet: "bot.access.set",
  botAdd: "bot.add",
  botBusyModeSet: "bot.busy-mode.set",
  botContextSet: "bot.context-enhancement.set",
  botEavesdropSet: "bot.eavesdrop.set",
  botMentionsSet: "bot.mentions.set",
  botBotReplySet: "bot.bot-reply.set",
  botProcessDetailSet: "bot.process-detail.set",
  botModelSet: "bot.model.set",
  botPresetSet: "bot.preset.set",
  botPermissionSet: "bot.permission.set",
  botReconnect: "bot.reconnect",
  botRemove: "bot.remove",
  botCheck: "bot.check",
  botWorkspaceSet: "bot.workspace.set",
  botsList: "bots.list",
  modelsList: "models.list",
  presetsList: "presets.list",
  provisionBegin: "provision.begin",
  provisionCancel: "provision.cancel",
  provisionPoll: "provision.poll",
  workspacesList: "workspaces.list",
  permissionList: "permission.list",
  userStatus: "user.status",
  userConnectBegin: "user.connect.begin",
  userConnectCancel: "user.connect.cancel",
  userDisconnect: "user.disconnect",
  userRefresh: "user.refresh",
  userMonitorStatus: "user.monitor.status",
  userMonitorDetail: "user.monitor.detail",
  userMonitorChats: "user.monitor.chats",
  userMonitorAdd: "user.monitor.add",
  userMonitorRemove: "user.monitor.remove",
  userMonitorEnable: "user.monitor.enable",
  userMonitorDirectEnable: "user.monitor.direct.enable",
  userMonitorWorkerSet: "user.monitor.worker.set",
  userMonitorHandoffSet: "user.monitor.handoff.set",
  userMonitorReplyRulesSet: "user.monitor.reply-rules.set",
  userMonitorWorkerOptions: "user.monitor.worker.options",
  userMonitorPoll: "user.monitor.poll",
  userMonitorFlush: "user.monitor.flush",
  userMonitorChatSet: "user.monitor.chat.set"
});

// client/shared.js
var h = import_react.default.createElement;
var activeLocale = "";
function configureLocale(service) {
  activeLocale = service.getLocale().active;
  const unsubscribe = service.subscribe(() => {
    activeLocale = service.getLocale().active;
  });
  return () => {
    unsubscribe?.();
    activeLocale = "";
  };
}
function t(zh, en) {
  const language = activeLocale || (navigator.language || "");
  return language.toLowerCase().startsWith("zh") ? zh : en;
}
var text = (pair) => Array.isArray(pair) ? t(pair[0], pair[1]) : String(pair);
var CE_FIELDS = CONTEXT_ENHANCEMENT_FIELDS;
var CE_LABELS = {
  senderId: ["\u53D1\u9001\u8005 Open ID", "Sender Open ID"],
  senderName: ["\u53D1\u9001\u8005\u540D\u79F0", "Sender name"],
  botId: ["\u673A\u5668\u4EBA Open ID", "Bot Open ID"],
  sentAt: ["\u53D1\u9001\u65F6\u95F4", "Sent at"],
  conversationTitle: ["\u7FA4\u540D\u79F0", "Group name"]
};
var emptyScope = () => ({ enabled: true, fields: ["senderId", "senderName", "botId", "sentAt"], guidance: "" });
var emptyEnhancement = () => ({ group: emptyScope(), direct: emptyScope() });
var CSS = `
.bxf-page { --bxf-radius: 12px; }
.bxf-page select:not(.bxf-worker-native *) {
  appearance: none; -webkit-appearance: none; cursor: pointer;
  padding-right: 30px !important;
  background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M6 9l6 6 6-6'/%3E%3C/svg%3E") !important;
  background-repeat: no-repeat !important;
  background-position: right 10px center !important;
}
.bxf-page input:not([type="checkbox"]):not([type="radio"]):not(.bxf-worker-native *),
.bxf-page select:not(.bxf-worker-native *) { height: 34px; }
.bxf-page :is(input, select, textarea):not(.bxf-worker-native *):focus {
  outline: 2px solid color-mix(in srgb, var(--dsw-alias-brand-primary, #3370ff) 32%, transparent);
  outline-offset: 1px;
  border-color: var(--dsw-alias-brand-primary, #3370ff);
}
.bxf-page select:not(.bxf-worker-native *) option:checked {
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff)) !important;
  color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff)) !important;
}
.bxf-field { min-width: 0; }
.bxf-bot-actions { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.bxf-mini { background: transparent !important; -webkit-appearance: none; appearance: none;
  font-size: 11px; padding: 3px 8px; border-radius: 7px; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, #e2e8f0); color: var(--dsw-alias-label-secondary); }
.bxf-mini:hover { color: var(--dsw-alias-brand-primary, #3370ff); border-color: var(--dsw-alias-brand-primary, #3370ff); background: color-mix(in srgb, var(--dsw-alias-brand-primary, #3370ff) 10%, transparent) !important; }
.bxf-button { appearance: none; display: inline-flex; align-items: center; justify-content: center;
  min-height: 34px; padding: 6px 12px; border-radius: 8px; font-size: 12px; font-weight: 500; cursor: pointer;
  border: 1px solid var(--dsw-alias-border-l1, #d1d5db); background: transparent; color: inherit; }
.bxf-button:not(:disabled):hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); border-color: var(--dsw-alias-border-l2, #d1d5db); }
.bxf-button[data-variant="primary"] { border-color: transparent;
  background: var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #111318));
  color: var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff)); }
.bxf-button[data-variant="primary"]:not(:disabled):hover { border-color: transparent;
  background: var(--dsw-alias-button-primary-hover, var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #252830))); }
.bxf-danger:hover { background: rgba(185,28,28,.07); border-color: rgba(185,28,28,.55); }
.bxf-tip { position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; margin-left: 6px; border-radius: 50%;
  background: var(--dsw-alias-bg-layer-2); color: var(--dsw-alias-label-secondary); font-size: 10px; font-weight: 700;
  cursor: help; user-select: none; flex: none; }
.bxf-tip-body { position: absolute; left: 0; top: 21px; min-width: 180px; max-width: 300px;
  padding: 8px 10px; border-radius: 8px; background: var(--dsw-alias-bg-overlay); color: var(--dsw-alias-label-primary); border: 1px solid var(--dsw-alias-border-l1);
  font-size: 11px; font-weight: 400; line-height: 1.55; white-space: normal;
  box-shadow: 0 10px 26px rgba(15,23,42,.22); opacity: 0; visibility: hidden;
  transition: opacity .12s ease; z-index: 30; pointer-events: none; }
.bxf-tip:hover .bxf-tip-body, .bxf-tip:focus .bxf-tip-body, .bxf-tip:focus-within .bxf-tip-body {
  opacity: 1; visibility: visible; }
.bxf-save-status { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; min-width: 0;
  font-size: 11px; color: var(--dsw-alias-label-secondary); }
.bxf-save-status > span { min-width: 0; overflow-wrap: anywhere; }
.bxf-save-status[data-state="error"] { color: var(--dsw-alias-state-error-primary); }
`;
var S = {
  labelrow: { display: "flex", alignItems: "center", marginBottom: "5px" },
  grow: { flex: 1, minWidth: 0 },
  nameRow: { display: "flex", alignItems: "center", gap: "4px" },
  badge: (tone) => ({
    display: "inline-block",
    padding: "1px 8px",
    borderRadius: "999px",
    fontSize: "11px",
    background: tone === "ok" ? "rgba(16,185,129,.12)" : tone === "warn" ? "rgba(245,158,11,.16)" : "rgba(148,163,184,.18)",
    color: tone === "ok" ? "var(--dsw-alias-state-success-primary)" : tone === "warn" ? "var(--dsw-alias-state-warn-primary)" : "var(--dsw-alias-state-idle-primary)"
  }),
  panelBody: { marginTop: "8px", display: "grid", gap: "10px" },
  label: { display: "block", fontSize: "12px", fontWeight: 500, marginBottom: "4px", color: "var(--dsw-alias-label-secondary, #4b5563)" },
  hint: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #6b7280)", marginTop: "3px", lineHeight: 1.5 },
  input: {
    width: "100%",
    boxSizing: "border-box",
    height: "34px",
    padding: "0 10px",
    fontSize: "13px",
    borderRadius: "8px",
    border: "1px solid var(--dsw-alias-border-l2, #d1d5db)",
    background: "var(--dsw-alias-bg-layer-2, #fff)",
    color: "var(--dsw-alias-label-primary)"
  },
  area: { width: "100%", boxSizing: "border-box", minHeight: "62px", padding: "7px 9px", fontSize: "12px", borderRadius: "8px", border: "1px solid var(--dsw-alias-border-l2, #d1d5db)", background: "var(--dsw-alias-bg-layer-2, #fff)", color: "var(--dsw-alias-label-primary)" },
  row: { display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" },
  btn: (kind2) => ({
    padding: "6px 12px",
    fontSize: "12px",
    borderRadius: "8px",
    cursor: "pointer",
    border: kind2 === "primary" ? "1px solid transparent" : "1px solid var(--dsw-alias-border-l1, #d1d5db)",
    background: kind2 === "primary" ? "var(--dsw-alias-button-primary-fill, var(--dsw-alias-label-primary, #3370ff))" : "transparent",
    color: kind2 === "primary" ? "var(--dsw-alias-label-primary-foreground, var(--dsw-alias-bg-base, #fff))" : "inherit"
  }),
  error: { fontSize: "12px", color: "var(--dsw-alias-state-error-primary)" },
  checkRow: { display: "flex", flexWrap: "wrap", gap: "6px 14px" },
  checkLabel: { fontSize: "12px", display: "flex", gap: "5px", alignItems: "center" },
  modal: {
    width: "min(460px, 100%)",
    background: "var(--dsw-alias-bg-layer-1, #fff)",
    color: "var(--dsw-alias-label-primary)",
    borderRadius: "14px",
    padding: "18px",
    boxShadow: "0 24px 60px rgba(15,23,42,.24)",
    border: "1px solid var(--dsw-alias-border-l1, #e5e7eb)"
  }
};
var Boundary = class extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, stack: null };
  }
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error("[im-feishu] render failed", error, info?.componentStack);
    this.setState({ stack: info?.componentStack ?? null });
  }
  render() {
    const { error, stack } = this.state;
    if (!error) return this.props.children;
    return h(
      "div",
      { style: { padding: "16px", color: "var(--dsw-alias-state-error-primary)", fontSize: "12px" } },
      h("div", { style: { fontWeight: 600, marginBottom: "6px" } }, t("\u8FD9\u91CC\u51FA\u9519\u4E86", "Something broke")),
      h("pre", { style: { whiteSpace: "pre-wrap", margin: 0 } }, String(error?.message ?? error)),
      stack ? h("pre", { style: { whiteSpace: "pre-wrap", marginTop: "8px", color: "var(--dsw-alias-label-secondary)" } }, stack) : null
    );
  }
};
async function rpc(connection, method, payload) {
  const result = await connection.rpc.call("/api", RPC_ENDPOINT, { method, payload }, void 0);
  if (!result || result.ok !== true) {
    const error = new Error(result?.error?.message ?? t("\u8BF7\u6C42\u5931\u8D25", "Request failed"));
    error.code = result?.error?.code ?? "rpc-failed";
    throw error;
  }
  return result.value;
}
function FieldLabel({ label, hint }) {
  return h(
    "div",
    { style: S.labelrow },
    label ? h("span", { style: S.label }, label) : null,
    hint ? h(
      "span",
      {
        className: "bxf-tip",
        tabIndex: 0,
        role: "button",
        "aria-label": hint
      },
      h("span", { "aria-hidden": true }, "?"),
      h("span", { className: "bxf-tip-body", role: "tooltip" }, hint)
    ) : null
  );
}
function Field({ label, hint, children, className = "" }) {
  return h(
    "div",
    { className: `bxf-field ${className}`.trim() },
    label ? h(FieldLabel, { label, hint }) : null,
    children
  );
}
function SaveStatus({ state, onRetry, onDiscard }) {
  if (state.status === "idle") return null;
  const label = state.status === "error" ? `${t("\u4FDD\u5B58\u5931\u8D25\uFF1A", "Save failed: ")}${state.error}` : state.status === "pending" ? t("\u7B49\u5F85\u4FDD\u5B58\u2026", "Waiting to save\u2026") : state.status === "saving" ? t("\u4FDD\u5B58\u4E2D\u2026", "Saving\u2026") : t("\u5DF2\u4FDD\u5B58", "Saved");
  return h(
    "div",
    { className: "bxf-save-status", "data-state": state.status, role: "status" },
    h("span", null, label),
    state.status === "error" ? h("button", { type: "button", className: "bxf-mini", onClick: onRetry }, t("\u91CD\u8BD5", "Retry")) : null,
    state.status === "error" && onDiscard ? h("button", { type: "button", className: "bxf-mini", onClick: onDiscard }, t("\u653E\u5F03\u4FEE\u6539", "Discard")) : null
  );
}
function StatusBadge({ state }) {
  const map = {
    connected: [t("\u8FD0\u884C\u6B63\u5E38", "Connected"), "ok"],
    connecting: [t("\u6B63\u5728\u8FDE\u63A5", "Connecting"), "warn"],
    reconnecting: [t("\u6B63\u5728\u91CD\u8FDE", "Reconnecting"), "warn"],
    error: [t("\u8FDE\u63A5\u5F02\u5E38", "Error"), "warn"],
    idle: [t("\u672A\u8FDE\u63A5", "Idle"), "muted"]
  };
  const [label, tone] = map[state] ?? map.idle;
  return h("span", { style: S.badge(tone) }, label);
}

// client/locale.js
var NS = "imFeishu";
var MESSAGES = Object.freeze({
  "\u98DE\u4E66\u673A\u5668\u4EBAIM": "Feishu Bot IM"
});
function dictionaries() {
  const zh = {};
  const en = {};
  for (const [key, value] of Object.entries(MESSAGES)) {
    zh[key] = key;
    en[key] = value;
  }
  return { zh, en };
}

// client/workspace.js
var import_react18 = __toESM(require("react"), 1);

// client/hooks.js
var import_react2 = __toESM(require("react"), 1);

// client/async.js
function startPolling(task, { interval, immediate = true, document = globalThis.document, onError = () => {
} }) {
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
    try {
      await task(controller.signal);
    } catch (error) {
      if (!controller.signal.aborted) onError(error);
    } finally {
      running = false;
      schedule(interval);
    }
  };
  const onVisibility = () => {
    clearTimeout(timer);
    if (!document?.hidden) void tick();
  };
  document?.addEventListener("visibilitychange", onVisibility);
  if (immediate) void tick();
  else schedule(interval);
  return () => {
    controller.abort();
    clearTimeout(timer);
    document?.removeEventListener("visibilitychange", onVisibility);
  };
}
function createQuery(fetchValue, { onValue, onError }) {
  let active = true;
  let revision = 0;
  let flight = null;
  return {
    activate() {
      active = true;
    },
    dispose() {
      active = false;
      revision += 1;
      flight = null;
    },
    invalidate() {
      revision += 1;
      flight = null;
    },
    accept(value) {
      revision += 1;
      flight = null;
      if (active) onValue(value);
    },
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
      }).finally(() => {
        if (flight === request) flight = null;
      });
      flight = request;
      return request;
    }
  };
}
function syncDraft(draft, serverValue) {
  return { baseline: serverValue, value: draft.value === draft.baseline ? serverValue : draft.value };
}
function commitDraft(draft, savedValue, submittedValue) {
  return { baseline: savedValue, value: draft.value === submittedValue ? savedValue : draft.value };
}
var remainingSeconds = (expiresAt, now = Date.now()) => Number.isFinite(expiresAt) ? Math.max(0, Math.ceil((expiresAt - now) / 1e3)) : 0;

// client/autosave.js
function createAutoSave() {
  const pending = /* @__PURE__ */ new Map();
  const listeners = /* @__PURE__ */ new Set();
  let flight = null;
  let running = false;
  let saved = false;
  let composing = false;
  const snapshot = () => {
    const error = [...pending.values()].find((job) => job.error)?.error ?? null;
    return { status: error ? "error" : running ? "saving" : pending.size ? "pending" : saved ? "saved" : "idle", error };
  };
  const publish = () => {
    const value = snapshot();
    listeners.forEach((listener) => listener(value));
  };
  const pump = () => {
    if (flight) return flight;
    flight = Promise.resolve().then(async () => {
      for (; ; ) {
        const entry = [...pending].find(([, job2]) => job2.ready && !job2.error);
        if (!entry) break;
        const [key, job] = entry;
        pending.delete(key);
        running = true;
        publish();
        try {
          await job.work();
          saved = true;
        } catch (error) {
          if (!pending.has(key)) pending.set(key, { ...job, ready: false, error: error?.message ?? String(error) });
        }
        running = false;
        publish();
      }
    }).finally(() => {
      flight = null;
      publish();
    });
    return flight;
  };
  return {
    subscribe(listener) {
      listeners.add(listener);
      listener(snapshot());
      return () => listeners.delete(listener);
    },
    schedule(key, work, delay = 0) {
      clearTimeout(pending.get(key)?.timer);
      const job = { work, delay, ready: delay === 0, error: null, timer: null };
      pending.set(key, job);
      if (delay > 0 && !composing) job.timer = setTimeout(() => {
        job.ready = true;
        void pump();
      }, delay);
      publish();
      if (job.ready) void pump();
    },
    cancel(key) {
      clearTimeout(pending.get(key)?.timer);
      pending.delete(key);
      publish();
    },
    discard() {
      composing = false;
      for (const job of pending.values()) clearTimeout(job.timer);
      pending.clear();
      publish();
    },
    pauseText() {
      composing = true;
      for (const job of pending.values()) if (job.delay > 0) {
        clearTimeout(job.timer);
        job.ready = false;
      }
    },
    resumeText() {
      composing = false;
      for (const job of pending.values()) if (job.delay > 0 && !job.error) {
        clearTimeout(job.timer);
        job.timer = setTimeout(() => {
          job.ready = true;
          void pump();
        }, job.delay);
      }
    },
    async flush(retry = false) {
      composing = false;
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
    }
  };
}

// client/hooks.js
function usePolling(task, { interval, enabled = true, immediate = true, scope = null }) {
  const current = import_react2.default.useRef(task);
  current.current = task;
  import_react2.default.useEffect(
    () => enabled ? startPolling((signal) => current.current(signal), { interval, immediate }) : void 0,
    [interval, enabled, immediate, scope]
  );
}
function useRpcQuery(connection, method, initialValue = null, payload = {}) {
  const [data, setData] = import_react2.default.useState(initialValue);
  const [error, setError] = import_react2.default.useState(null);
  const [loaded, setLoaded] = import_react2.default.useState(false);
  const payloadKey = JSON.stringify(payload);
  const query = import_react2.default.useMemo(() => createQuery(() => rpc(connection, method, JSON.parse(payloadKey)), {
    onValue(value) {
      setData(value);
      setError(null);
      setLoaded(true);
    },
    onError(failure) {
      setError(failure?.message ?? String(failure));
      setLoaded(true);
    }
  }), [connection, method, payloadKey]);
  import_react2.default.useEffect(() => {
    query.activate();
    setData(initialValue);
    setError(null);
    setLoaded(false);
    return () => query.dispose();
  }, [query]);
  return { data, error, loaded, ...query };
}
function useDraft(serverValue) {
  const [draft, setDraft] = import_react2.default.useState(() => ({ baseline: serverValue, value: serverValue }));
  import_react2.default.useEffect(() => {
    setDraft((previous) => syncDraft(previous, serverValue));
  }, [serverValue]);
  return [
    draft.value,
    (value) => setDraft((previous) => ({ ...previous, value })),
    (saved, submitted) => setDraft((previous) => commitDraft(previous, saved, submitted))
  ];
}
function useAutoSave() {
  const [queue] = import_react2.default.useState(createAutoSave);
  const [state, setState] = import_react2.default.useState({ status: "idle", error: null });
  const alive = import_react2.default.useRef(false);
  import_react2.default.useEffect(() => {
    alive.current = true;
    const unsubscribe = queue.subscribe(setState);
    return () => {
      alive.current = false;
      unsubscribe();
      void queue.flush();
    };
  }, [queue]);
  return {
    state,
    flush: queue.flush,
    cancel: queue.cancel,
    discard: queue.discard,
    retry: () => queue.flush(true),
    compositionHandlers: { onCompositionStartCapture: queue.pauseText, onCompositionEndCapture: queue.resumeText },
    schedule(key, operation, delay = 0, onSaved) {
      queue.schedule(key, async () => {
        const value = await operation();
        if (alive.current) onSaved?.(value);
      }, delay);
    }
  };
}
function useMutation() {
  const [busy, setBusy] = import_react2.default.useState("");
  const [error, setError] = import_react2.default.useState(null);
  const tail = import_react2.default.useRef(Promise.resolve());
  const alive = import_react2.default.useRef(true);
  import_react2.default.useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const run = (label, operation, onSuccess = () => {
  }) => {
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
        if (alive.current) setBusy("");
      }
    });
    tail.current = task;
    return task;
  };
  return { busy, error, run };
}

// client/bot.js
var import_react4 = __toESM(require("react"), 1);

// client/bot-settings.js
var ids = (text2) => text2.split(/[\s,;，；、]+/).map((item) => item.trim()).filter(Boolean);
var model = (draft) => draft.provider && draft.model ? { provider: draft.provider, model: draft.model, ...draft.reasoningEffort ? { reasoningEffort: draft.reasoningEffort } : {} } : null;
function botSettingUpdates(previous, next) {
  const updates = [];
  const changed = (method, payload, before, after, key = method) => {
    if (JSON.stringify(before) !== JSON.stringify(after)) updates.push({ key, method, payload });
  };
  changed(API.botWorkspaceSet, { workspace: next.workspace || null }, previous.workspace, next.workspace);
  changed(API.botModelSet, { model: model(next) }, model(previous), model(next));
  changed(API.botPresetSet, { preset: next.preset || null }, previous.preset, next.preset);
  changed(API.botProcessDetailSet, { mode: next.processDetail }, previous.processDetail, next.processDetail);
  changed(API.botPermissionSet, { permissionPreset: next.permissionPreset || null }, previous.permissionPreset, next.permissionPreset);
  for (const scope of ["direct", "group"]) {
    changed(API.botBusyModeSet, { scope, mode: next.busyMode[scope] }, previous.busyMode[scope], next.busyMode[scope], `${API.botBusyModeSet}:${scope}`);
  }
  changed(API.botContextSet, { config: next.contextEnhancement }, previous.contextEnhancement, next.contextEnhancement);
  changed(API.botBotReplySet, { enabled: next.respondBot }, previous.respondBot, next.respondBot);
  changed(API.botEavesdropSet, { eavesdrop: next.eavesdrop }, previous.eavesdrop, next.eavesdrop);
  changed(API.botMentionsSet, { mentions: next.mentions }, previous.mentions, next.mentions);
  const access = (draft) => ({ group: draft.group, allowOpenIds: ids(draft.allow), managers: ids(draft.managers) });
  changed(API.botAccessSet, { access: access(next) }, access(previous), access(next));
  return updates;
}

// client/action-button.js
var import_react3 = __toESM(require("react"), 1);
var h2 = import_react3.default.createElement;
function ActionButton({ hint, hintId, active = true, variant = "compact", children, onClick, ...props }) {
  const [visible, setVisible] = import_react3.default.useState(false);
  const [left, setLeft] = import_react3.default.useState(0);
  const anchor = import_react3.default.useRef(null);
  const timer = import_react3.default.useRef(null);
  const hide = () => {
    clearTimeout(timer.current);
    timer.current = null;
    setVisible(false);
  };
  const start = () => {
    clearTimeout(timer.current);
    if (!active) return;
    timer.current = setTimeout(() => {
      const rect = anchor.current?.getBoundingClientRect();
      if (rect) {
        const viewport = anchor.current.ownerDocument.documentElement.clientWidth;
        const width = Math.min(280, viewport - 24);
        setLeft(Math.max(12 - rect.left, Math.min(0, viewport - 12 - rect.left - width)));
      }
      setVisible(true);
    }, 2e3);
  };
  import_react3.default.useEffect(() => {
    if (!active) hide();
    return () => clearTimeout(timer.current);
  }, [active]);
  return h2(
    "span",
    {
      className: "bxf-action-tip",
      ref: anchor,
      onMouseEnter: start,
      onMouseLeave: hide,
      onFocus: start,
      onBlur: hide,
      onKeyDown: (event) => {
        if (event.key === "Escape") hide();
      }
    },
    h2("button", {
      type: "button",
      className: variant === "compact" ? "bxf-mini" : "bxf-button",
      "data-variant": variant,
      ...props,
      "aria-describedby": hintId,
      onClick: (event) => {
        hide();
        return onClick?.(event);
      }
    }, children),
    h2("span", { id: hintId, role: "tooltip", className: "bxf-action-tip-body", hidden: !visible || !active, style: { left } }, hint)
  );
}

// client/bot.js
var h3 = import_react4.default.createElement;
function AddBotModal({ connection, mode = "manual", grant = null, onClose, onAdded }) {
  const [form, setForm] = import_react4.default.useState({ appId: "", appSecret: "" });
  const { data: scan, error: pollError, accept: setScan, refresh: poll, invalidate } = useRpcQuery(connection, API.provisionPoll);
  const { busy, error: actionError, run } = useMutation();
  const error = actionError ?? pollError;
  const [remaining, setRemaining] = import_react4.default.useState(0);
  const terminal = ["success", "denied", "expired", "error", "cancelled"].includes(scan?.state);
  usePolling(poll, { interval: Math.max(2e3, scan?.nextPollInMs ?? 3e3), enabled: Boolean(scan) && !terminal && !pollError && busy !== "scan", immediate: false, scope: connection });
  usePolling(() => setRemaining(remainingSeconds(scan?.expiresAt)), {
    interval: 1e3,
    enabled: Boolean(scan) && !terminal,
    scope: scan?.expiresAt
  });
  const callbacks = import_react4.default.useRef({ onAdded, onClose });
  callbacks.current = { onAdded, onClose };
  import_react4.default.useEffect(() => {
    if (scan?.state === "success") {
      callbacks.current.onAdded();
      callbacks.current.onClose();
    }
  }, [scan?.state]);
  const startScan = () => run("scan", () => {
    invalidate();
    return rpc(connection, API.provisionBegin, grant ? { botId: grant.id } : {});
  }, (snapshot) => {
    setRemaining(remainingSeconds(snapshot.expiresAt));
    setScan(snapshot);
  });
  const cancelScan = () => {
    if (busy === "submit") return;
    invalidate();
    setScan(null);
    if (mode === "scan") void rpc(connection, API.provisionCancel, {}).catch(() => void 0);
    onClose();
  };
  const dialogRef = import_react4.default.useRef(null);
  const backdropDownRef = import_react4.default.useRef(false);
  import_react4.default.useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || typeof dialog.showModal !== "function") return;
    if (!dialog.open) dialog.showModal();
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);
  const started = import_react4.default.useRef(false);
  import_react4.default.useEffect(() => {
    if (mode === "scan" && !started.current) {
      started.current = true;
      void startScan();
    }
  }, [mode]);
  const submit = () => run("submit", () => rpc(connection, API.botAdd, form), () => {
    onAdded();
    onClose();
  });
  const titleId = `bxf-add-bot-title-${mode}`;
  return h3(
    "dialog",
    {
      ref: dialogRef,
      className: "bxf-modal-dialog",
      "aria-labelledby": titleId,
      onCancel: (event) => {
        event.preventDefault();
        cancelScan();
      },
      onPointerDown: (event) => {
        backdropDownRef.current = event.target === event.currentTarget;
      },
      onClick: (event) => {
        const fromBackdrop = backdropDownRef.current;
        backdropDownRef.current = false;
        if (event.target === event.currentTarget && fromBackdrop) cancelScan();
      }
    },
    h3(
      "form",
      {
        style: S.modal,
        onSubmit: (event) => {
          event.preventDefault();
          if (mode === "manual" && !busy && form.appId && form.appSecret) void submit();
        }
      },
      h3(
        "h3",
        { id: titleId, style: { margin: "0 0 4px", fontSize: "15px" } },
        mode === "scan" ? grant ? t("\u626B\u7801\u8865\u9F50\u6743\u9650", "Grant by scanning") : t("\u626B\u7801\u6DFB\u52A0\u673A\u5668\u4EBA", "Add by scanning") : t("\u624B\u52A8\u6DFB\u52A0\u673A\u5668\u4EBA", "Add manually")
      ),
      mode === "scan" ? h3(
        "div",
        { style: { display: "grid", justifyItems: "center", gap: "8px", marginTop: "10px" } },
        scan?.qrCodeDataUrl ? h3("div", {
          style: {
            padding: "10px",
            background: "#fff",
            borderRadius: "12px",
            lineHeight: 0,
            border: "1px solid var(--dsw-alias-border-l1)",
            boxShadow: "0 2px 10px rgba(15,23,42,.08)"
          }
        }, h3("img", { src: scan.qrCodeDataUrl, width: 200, height: 200, alt: t("\u98DE\u4E66\u6388\u6743\u4E8C\u7EF4\u7801", "Feishu authorization QR code") })) : h3("div", {
          style: {
            width: "200px",
            height: "200px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "10px",
            background: "var(--dsw-alias-bg-layer-2)",
            color: "var(--dsw-alias-label-secondary)",
            fontSize: "12px"
          }
        }, t("\u6B63\u5728\u751F\u6210\u4E8C\u7EF4\u7801\u2026", "Preparing QR\u2026")),
        h3(
          "div",
          { style: { ...S.hint, textAlign: "center" } },
          scan ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} \xB7 ${scan.state === "pending" || scan.state === "qr_ready" ? t("\u7B49\u5F85\u626B\u7801\u786E\u8BA4", "Waiting for scan") : scan.state === "slow_down" ? t("\u8BF7\u5728\u98DE\u4E66\u91CC\u786E\u8BA4", "Confirm in Feishu") : scan.state === "denied" ? t("\u5DF2\u5728\u98DE\u4E66\u91CC\u53D6\u6D88", "Cancelled in Feishu") : scan.state === "expired" ? t("\u5DF2\u8FC7\u671F", "Expired") : scan.state === "success" ? t("\u5DF2\u751F\u6548", "Applied") : scan.state}` : t("\u8BF7\u7A0D\u5019\u2026", "Please wait\u2026")
        ),
        error ? h3("div", { style: S.error }, error) : null,
        h3(
          "div",
          { style: { display: "flex", gap: "8px" } },
          h3("button", { type: "button", style: S.btn(), onClick: cancelScan }, t("\u53D6\u6D88\u626B\u7801", "Cancel scan")),
          pollError && scan && !terminal ? h3("button", { type: "button", style: S.btn(), disabled: Boolean(busy), onClick: () => void poll() }, t("\u7EE7\u7EED\u68C0\u67E5", "Resume check")) : null,
          error || scan && ["denied", "expired", "error", "cancelled"].includes(scan.state) ? h3("button", { type: "button", style: S.btn("primary"), disabled: Boolean(busy), onClick: startScan }, t("\u91CD\u65B0\u751F\u6210", "Retry")) : null
        )
      ) : null,
      mode === "manual" ? h3("p", { style: S.hint }, t("\u98DE\u4E66\u5F00\u653E\u5E73\u53F0 \u2192 \u81EA\u5EFA\u5E94\u7528 \u2192 \u51ED\u8BC1\u4E0E\u57FA\u7840\u4FE1\u606F\uFF0C\u590D\u5236 App ID \u4E0E App Secret\u3002", "Feishu console \u2192 custom app \u2192 credentials.")) : null,
      h3(
        "div",
        { style: { ...S.panelBody, display: mode === "manual" ? "grid" : "none" } },
        h3(
          Field,
          { label: "App ID" },
          h3("input", { style: S.input, value: form.appId, placeholder: "cli_xxxxxxxxxxxxxxxx", onChange: (event) => setForm({ ...form, appId: event.target.value }) })
        ),
        h3(
          Field,
          { label: "App Secret", hint: t("\u53EA\u63D0\u4EA4\u7ED9\u672C\u673A Host\uFF0C\u5199\u5165 DSH \u51ED\u636E\u5E93\uFF0C\u4E0D\u4F1A\u56DE\u4F20\u6D4F\u89C8\u5668\u3002", "Stored by the local Host credential service; never returned.") },
          h3("input", { style: S.input, type: "password", value: form.appSecret, onChange: (event) => setForm({ ...form, appSecret: event.target.value }) })
        ),
        error ? h3("div", { style: S.error }, error) : null
      ),
      h3(
        "div",
        { style: { ...S.row, justifyContent: "flex-end", marginTop: "14px" } },
        mode === "manual" ? h3("button", { type: "button", style: S.btn(), onClick: cancelScan, disabled: busy }, t("\u53D6\u6D88", "Cancel")) : null,
        mode === "manual" ? h3(
          "button",
          { type: "submit", style: S.btn("primary"), disabled: busy || !form.appId || !form.appSecret },
          busy ? t("\u6B63\u5728\u9A8C\u8BC1\u2026", "Verifying\u2026") : t("\u7ED1\u5B9A\u5E76\u8FDE\u63A5", "Bind and connect")
        ) : null
      )
    )
  );
}
function BotSettings({ connection, bot, models = [], presets = [], workspaces = [], permissionOptions = [], onChanged, registerSave }) {
  const [settingsTab, setSettingsTab] = import_react4.default.useState("general");
  const [draft, setDraft] = import_react4.default.useState(null);
  const [limitText, setLimitText] = import_react4.default.useState("20");
  const draftRef = import_react4.default.useRef(null);
  const baselineRef = import_react4.default.useRef(null);
  const autoSave = useAutoSave();
  import_react4.default.useEffect(() => registerSave?.(`bot:${bot.id}`, autoSave.flush), [registerSave, bot.id, autoSave.flush]);
  const seed = import_react4.default.useCallback((source = bot) => {
    const enhancement = source.contextEnhancement ?? emptyEnhancement();
    return {
      workspace: source.workspace ?? "",
      workspaceMode: source.workspace ?? "",
      workspaceCustom: source.workspace ?? "",
      provider: source.model?.provider ?? "",
      model: source.model?.model ?? "",
      reasoningEffort: source.model?.reasoningEffort ?? "",
      preset: source.agentPreset ?? "",
      busyMode: {
        direct: source.busyMode?.direct ?? "queue",
        group: source.busyMode?.group ?? "queue"
      },
      contextEnhancement: {
        group: { ...emptyScope(), ...enhancement.group ?? {}, enabled: true },
        direct: { ...emptyScope(), ...enhancement.direct ?? {}, enabled: true }
      },
      respondBot: source.respondToBotMessages !== false,
      processDetail: source.processDetail === "brief" ? "brief" : "detailed",
      permissionPreset: source.permissionPreset ?? "",
      eavesdrop: {
        enabled: source.eavesdrop?.enabled !== false,
        limit: Number.isFinite(Number(source.eavesdrop?.limit)) && Number(source.eavesdrop?.limit) > 0 ? Math.min(500, Number(source.eavesdrop.limit)) : 20
      },
      mentions: {
        enabled: source.mentions?.enabled !== false,
        allowAll: source.mentions?.allowAll === true
      },
      group: source.access?.group ?? "all",
      allow: (source.access?.allowOpenIds ?? []).join(", "),
      managers: (source.access?.managers ?? []).join(", ")
    };
  }, [bot]);
  const seedRef = import_react4.default.useRef(seed);
  seedRef.current = seed;
  import_react4.default.useEffect(() => {
    const initial = seedRef.current();
    draftRef.current = initial;
    baselineRef.current = initial;
    setDraft(initial);
    setLimitText(String(initial.eavesdrop.limit));
    setSettingsTab("general");
  }, [bot.id]);
  import_react4.default.useEffect(() => {
    const current = draftRef.current;
    const prevBase = baselineRef.current;
    if (!current || !prevBase) return;
    const nextBase = seed(bot);
    baselineRef.current = nextBase;
    const sameJson = (a, b) => JSON.stringify(a) === JSON.stringify(b);
    let changed = false;
    const merged = { ...current };
    for (const key of Object.keys(nextBase)) {
      if (sameJson(current[key], prevBase[key]) && !sameJson(nextBase[key], prevBase[key])) {
        merged[key] = nextBase[key];
        changed = true;
      }
    }
    if (changed) {
      draftRef.current = merged;
      setDraft(merged);
      if (sameJson(current.eavesdrop, prevBase.eavesdrop) && merged.eavesdrop.limit !== prevBase.eavesdrop.limit) {
        setLimitText(String(merged.eavesdrop.limit));
      }
    }
  }, [bot, seed]);
  const set = (patch, delay = 0) => {
    const previous = draftRef.current;
    const next = typeof patch === "function" ? patch(previous) : { ...previous, ...patch };
    draftRef.current = next;
    setDraft(next);
    for (const update of botSettingUpdates(previous, next)) {
      autoSave.schedule(update.key, () => rpc(connection, update.method, { botId: bot.id, ...update.payload }), delay, onChanged);
    }
  };
  const selectedModel = models.find((item) => item.provider === draft?.provider && item.model === draft?.model) ?? null;
  const sections = [["general", t("\u901A\u7528", "General")], ["direct", t("\u79C1\u804A", "Private chat")], ["group", t("\u7FA4\u804A", "Group chat")]];
  const selectSettings = (id) => {
    setSettingsTab(id);
    void autoSave.flush();
  };
  const sectionId = (id) => `bxf-${bot.id}-settings-${id}`;
  const onTabKey = (event, index) => {
    const next = event.key === "Home" ? 0 : event.key === "End" ? sections.length - 1 : event.key === "ArrowRight" ? (index + 1) % sections.length : event.key === "ArrowLeft" ? (index + sections.length - 1) % sections.length : null;
    if (next === null) return;
    event.preventDefault();
    selectSettings(sections[next][0]);
    event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
  };
  const pane = (id, ...children) => h3("div", {
    id: sectionId(id),
    role: "tabpanel",
    "aria-labelledby": `${sectionId(id)}-tab`,
    hidden: settingsTab !== id,
    className: `bxf-settings-pane bxf-settings-pane-${id}`,
    tabIndex: 0
  }, children);
  const group = (label, ...children) => h3(
    "section",
    { className: "bxf-settings-group", "aria-label": label },
    h3("h4", null, label),
    h3("div", { className: "bxf-settings-fields" }, children)
  );
  const scopeEditor = (scopeKey, label) => {
    const scope = draft.contextEnhancement[scopeKey] ?? emptyScope();
    const update = (patch, delay = 0) => set((current) => ({
      ...current,
      contextEnhancement: { ...current.contextEnhancement, [scopeKey]: { ...current.contextEnhancement[scopeKey], ...patch } }
    }), delay);
    const fields = scopeKey === "group" ? CE_FIELDS : CE_FIELDS.filter((field) => field !== "conversationTitle");
    return h3(
      "section",
      { className: "bxf-settings-context", "aria-label": label },
      h3(FieldLabel, { label, hint: t("\u6CE8\u5165\u54EA\u4E9B\u6765\u6E90\u5B57\u6BB5\uFF1A\u53EA\u52FE\u9009\u6A21\u578B\u65E0\u6CD5\u81EA\u884C\u63A8\u65AD\u7684\u6D88\u606F\u5143\u4FE1\u606F\u3002", "Which source fields to inject.") }),
      h3(
        "div",
        { style: S.checkRow },
        fields.map((field) => h3(
          "label",
          { key: field, style: S.checkLabel },
          h3("input", {
            type: "checkbox",
            checked: (scope.fields ?? []).includes(field),
            onChange: (event) => {
              const next = new Set(scope.fields ?? []);
              if (event.target.checked) next.add(field);
              else next.delete(field);
              update({ fields: CE_FIELDS.filter((item) => next.has(item)) });
            }
          }),
          text(CE_LABELS[field])
        ))
      ),
      h3("textarea", {
        style: { ...S.area, minHeight: "120px", marginTop: "12px" },
        "aria-label": label,
        value: scope.guidance ?? "",
        placeholder: t("\u589E\u5F3A\u63D0\u793A\u8BCD\uFF08\u53EF\u9009\uFF09", "Guidance (optional)"),
        onChange: (event) => update({ guidance: event.target.value }, 600),
        onBlur: () => void autoSave.flush()
      })
    );
  };
  return h3(
    "article",
    { className: "bxf-bot-configuration" },
    draft ? h3(
      "div",
      { ...autoSave.compositionHandlers, className: "bxf-bot-settings" },
      h3(
        "div",
        { className: "bxf-settings-toolbar" },
        h3(
          "div",
          { className: "bxf-settings-tabs", role: "tablist", "aria-label": t("\u673A\u5668\u4EBA\u8BBE\u7F6E", "Bot settings") },
          sections.map(([id, label], index) => h3("button", {
            key: id,
            type: "button",
            role: "tab",
            id: `${sectionId(id)}-tab`,
            "aria-controls": sectionId(id),
            "aria-selected": settingsTab === id,
            tabIndex: settingsTab === id ? 0 : -1,
            onClick: () => selectSettings(id),
            onKeyDown: (event) => onTabKey(event, index)
          }, label))
        ),
        h3(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry, onDiscard: autoSave.discard })
      ),
      pane(
        "general",
        group(
          t("\u4F1A\u8BDD\u9ED8\u8BA4", "Session defaults"),
          h3(
            Field,
            { label: t("\u9ED8\u8BA4\u5DE5\u4F5C\u533A", "Default workspace"), hint: t("\u5217\u8868\u6765\u81EA DSH \u5DF2\u767B\u8BB0\u7684\u5DE5\u4F5C\u533A\u3002", "From the workspaces DSH already knows.") },
            (() => {
              const knownWorkspace = workspaces.some((item) => item.path === draft.workspaceMode);
              const effectiveWorkspaceMode = draft.workspaceMode === "" ? "" : draft.workspaceMode === "__custom__" || !knownWorkspace ? "__custom__" : draft.workspaceMode;
              return h3(
                import_react4.default.Fragment,
                null,
                h3(
                  "select",
                  {
                    style: S.input,
                    value: effectiveWorkspaceMode,
                    title: draft.workspace || t("\u8DDF\u968F DSH \u9ED8\u8BA4", "Host default"),
                    onChange: (event) => {
                      const next = event.target.value;
                      set((current) => ({ ...current, workspaceMode: next, workspace: next === "__custom__" ? current.workspaceCustom : next }));
                    }
                  },
                  h3("option", { value: "" }, t("\u8DDF\u968F DSH \u9ED8\u8BA4", "Host default")),
                  workspaces.map((item) => h3("option", { key: item.path, value: item.path }, item.title && item.title !== item.path ? `${item.title} \u2014 ${item.path}` : item.path)),
                  h3("option", { value: "__custom__" }, t("\u81EA\u5B9A\u4E49\u8DEF\u5F84\u2026", "Custom path\u2026"))
                ),
                effectiveWorkspaceMode === "__custom__" ? h3("input", {
                  style: { ...S.input, marginTop: "8px" },
                  value: draft.workspaceCustom,
                  placeholder: "/Users/you/work",
                  "aria-label": t("\u81EA\u5B9A\u4E49\u8DEF\u5F84\u2026", "Custom path\u2026"),
                  onChange: (event) => set({ workspaceCustom: event.target.value, workspace: event.target.value }, 600),
                  onBlur: () => void autoSave.flush()
                }) : null
              );
            })()
          ),
          h3(
            Field,
            { label: t("Agent \u9884\u8BBE", "Agent preset"), hint: t("\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002", "Applies only to Sessions created later.") },
            h3(
              "select",
              { style: S.input, value: draft.preset, onChange: (event) => set({ preset: event.target.value }) },
              h3("option", { value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4\u9884\u8BBE", "Host default preset")),
              draft.preset && !presets.some((item) => item.id === draft.preset) ? h3("option", { value: draft.preset }, `${draft.preset}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
              presets.map((item) => h3("option", { key: item.id, value: item.id }, item.name ?? item.id))
            )
          ),
          h3(
            Field,
            { label: t("\u65B0\u4F1A\u8BDD\u6743\u9650\u6863\u4F4D", "New-session permission"), hint: t("\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002", "Applies only to Sessions created later.") },
            h3(
              "select",
              {
                style: S.input,
                value: draft.permissionPreset,
                onChange: (event) => set({ permissionPreset: event.target.value })
              },
              h3("option", { value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")),
              draft.permissionPreset && !(permissionOptions ?? []).some((item) => item.value === draft.permissionPreset) ? h3("option", { value: draft.permissionPreset }, `${draft.permissionPreset}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
              (permissionOptions ?? []).map((item) => h3("option", { key: item.value, value: item.value }, item.name ?? item.value))
            )
          )
        ),
        group(
          t("\u6A21\u578B\u4E0E\u8F93\u51FA", "Model and output"),
          h3(
            Field,
            { label: t("\u9ED8\u8BA4\u6A21\u578B", "Model"), hint: t("\u53EA\u5F71\u54CD\u4E4B\u540E\u65B0\u5EFA\u7684\u4F1A\u8BDD\uFF0C\u5DF2\u6709\u4F1A\u8BDD\u4E0D\u53D8\u3002", "Applies only to Sessions created later.") },
            h3(
              "select",
              {
                style: S.input,
                value: draft.provider && draft.model ? `${draft.provider}/${draft.model}` : "",
                title: selectedModel?.label || t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default"),
                onChange: (event) => {
                  const [provider, ...rest] = event.target.value.split("/");
                  set({ provider, model: rest.join("/"), reasoningEffort: "" });
                }
              },
              h3("option", { value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")),
              draft.provider && draft.model && !selectedModel ? h3("option", { value: `${draft.provider}/${draft.model}` }, `${draft.provider} / ${draft.model}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
              models.map((item) => h3("option", { key: `${item.provider}/${item.model}`, value: `${item.provider}/${item.model}` }, item.label))
            )
          ),
          h3(
            Field,
            { label: t("\u601D\u8003\u5F3A\u5EA6", "Reasoning effort") },
            h3(
              "select",
              {
                style: S.input,
                value: draft.reasoningEffort,
                disabled: !selectedModel,
                onChange: (event) => set({ reasoningEffort: event.target.value })
              },
              h3("option", { value: "" }, t("\u8DDF\u968F\u6A21\u578B\u9ED8\u8BA4", "Model default")),
              (selectedModel?.reasoning?.efforts ?? []).map((effort) => h3("option", { key: effort.id, value: effort.id }, effort.name ?? effort.id))
            )
          ),
          h3(
            Field,
            { label: t("\u8FC7\u7A0B\u8BE6\u7EC6\u5EA6", "Progress detail"), hint: t("\u8BE6\u7EC6\uFF1A\u663E\u793A\u6BCF\u4E2A\u5DE5\u5177\u7684\u540D\u79F0\u4E0E\u53C2\u6570\uFF1B\u7B80\u8981\uFF1A\u53EA\u663E\u793A\u5DE5\u5177\u540D\u4E0E\u6C47\u603B\u3002", "Detailed shows tool arguments; brief keeps names and the summary.") },
            h3(
              "select",
              {
                style: S.input,
                value: draft.processDetail,
                onChange: (event) => set({ processDetail: event.target.value })
              },
              h3("option", { value: "detailed" }, t("\u8BE6\u7EC6", "Detailed")),
              h3("option", { value: "brief" }, t("\u7B80\u8981", "Brief"))
            )
          )
        )
      ),
      pane(
        "direct",
        group(
          t("\u6D88\u606F\u5904\u7406", "Message handling"),
          h3(
            Field,
            { label: t("\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F", "While a turn runs") },
            h3(
              "select",
              { "aria-label": t("\u79C1\u804A\u6D88\u606F\u5904\u7406", "Private-chat message handling"), style: S.input, value: draft.busyMode.direct, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, direct: event.target.value } })) },
              h3("option", { value: "queue" }, t("\u6392\u961F\u7B49\u5F85", "Queue")),
              h3("option", { value: "steer" }, t("\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4", "Steer"))
            )
          )
        ),
        scopeEditor("direct", t("\u79C1\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165", "Private-chat context"))
      ),
      pane(
        "group",
        group(
          t("\u6D88\u606F\u5904\u7406", "Message handling"),
          h3(
            Field,
            { label: t("\u8FD0\u884C\u4E2D\u6536\u5230\u666E\u901A\u6D88\u606F", "While a turn runs") },
            h3(
              "select",
              { "aria-label": t("\u7FA4\u804A\u6D88\u606F\u5904\u7406", "Group-chat message handling"), style: S.input, value: draft.busyMode.group, onChange: (event) => set((current) => ({ ...current, busyMode: { ...current.busyMode, group: event.target.value } })) },
              h3("option", { value: "queue" }, t("\u6392\u961F\u7B49\u5F85", "Queue")),
              h3("option", { value: "steer" }, t("\u63D2\u5165\u4E3A\u8865\u5145\u6307\u4EE4", "Steer"))
            )
          ),
          h3(
            Field,
            { className: "bxf-setting-toggle", label: t("\u54CD\u5E94\u5176\u5B83\u673A\u5668\u4EBA\u7684\u6D88\u606F", "Reply to other bots"), hint: t("\u5F00\u542F\u540E\uFF0C\u5176\u5B83\u673A\u5668\u4EBA\uFF08\u5E94\u7528\uFF09\u5728\u7FA4\u91CC\u7684\u53D1\u8A00\u4E5F\u4F1A\u89E6\u53D1\u672C\u673A\u5668\u4EBA\u3002", "When on, messages from other bots also trigger this bot.") },
            h3(
              "label",
              { style: S.checkLabel },
              h3("input", {
                type: "checkbox",
                checked: draft.respondBot === true,
                onChange: (event) => set({ respondBot: event.target.checked })
              }),
              t("\u5141\u8BB8", "Allow")
            )
          ),
          h3(
            Field,
            { className: "bxf-setting-toggle", label: t("\u65C1\u542C\u7FA4\u6D88\u606F\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09", "Eavesdrop group messages (on by default)"), hint: t("\u53EA\u628A\u6CA1\u6709 at \u4F60\u7684\u6D88\u606F\u8BB0\u4E3A\u4E0A\u4E0B\u6587\uFF0C\u4E0D\u4F1A\u89E6\u53D1\u56DE\u590D\uFF1B\u56FE\u7247/\u6587\u4EF6\u53EA\u8BB0\u5360\u4F4D\u4FE1\u606F\uFF0C\u6A21\u578B\u9700\u8981\u65F6\u4F1A\u8BF7\u4F60 at \u5B83\u91CD\u53D1\u3002\u9700\u8981 im:message.group_msg \u6743\u9650\uFF1B\u53EF\u7528\u300C\u8865\u9F50\u6743\u9650\u300D\u626B\u7801\u6388\u6743\u3002", 'Only messages that do not mention the bot are kept as context; never triggers a reply; images/files become placeholders and the model asks you to mention it and resend them when needed. Requires im:message.group_msg; use "Grant permissions" to authorize.') },
            h3(
              "label",
              { style: S.checkLabel },
              h3("input", {
                type: "checkbox",
                checked: draft.eavesdrop.enabled,
                onChange: (event) => set((current) => ({ ...current, eavesdrop: { ...current.eavesdrop, enabled: event.target.checked } }))
              }),
              t("\u5141\u8BB8", "Allow")
            )
          ),
          draft.eavesdrop.enabled ? h3(
            Field,
            { label: t("\u6EDA\u52A8\u4FDD\u7559\u6761\u6570", "Rolling buffer size"), hint: t("\u9ED8\u8BA4\u4FDD\u7559\u6700\u8FD1 20 \u6761\uFF1B\u8D85\u8FC7\u540E\u4E22\u5F03\u6700\u65E7\u7684\u65C1\u542C\u6D88\u606F\uFF0C\u6700\u591A 500 \u6761\u3002", "Keeps the latest 20 messages by default; older messages are dropped past this limit, up to 500.") },
            h3("input", {
              type: "number",
              min: 1,
              max: 500,
              style: S.input,
              value: limitText,
              onChange: (event) => {
                const raw = event.target.value;
                setLimitText(raw);
                const parsed = Number.parseInt(raw, 10);
                if (Number.isFinite(parsed) && parsed >= 1) {
                  const clamped = Math.min(500, parsed);
                  set((current) => ({ ...current, eavesdrop: { ...current.eavesdrop, limit: clamped } }), 600);
                }
              },
              onBlur: () => {
                const parsed = Number.parseInt(limitText, 10);
                const clamped = Number.isFinite(parsed) && parsed >= 1 ? Math.min(500, parsed) : 20;
                setLimitText(String(clamped));
                set((current) => ({ ...current, eavesdrop: { ...current.eavesdrop, limit: clamped } }));
                void autoSave.flush();
              }
            })
          ) : null,
          h3(
            Field,
            { className: "bxf-setting-toggle", label: t("\u5141\u8BB8\u673A\u5668\u4EBA at \u4EBA\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09", "Let the bot mention people (on by default)"), hint: t("\u6D89\u53CA\u9700\u8981\u67D0\u4EBA\u51B3\u7B56\u3001\u6279\u51C6\u3001\u786E\u8BA4\u6216\u9009\u62E9\u65F6\uFF0C\u4E00\u5F8B\u7528 at \u63D0\u53CA\u5F53\u4E8B\u4EBA\uFF1B\u7EAF\u4FE1\u606F\u540C\u6B65\u3001\u72B6\u6001\u6C47\u62A5\u548C\u95F2\u804A\u4E0D\u8981 at\uFF1B\u4E0D\u786E\u5B9A\u5177\u4F53\u5F53\u4E8B\u4EBA\u65F6\u4E5F\u4E0D\u8981 at\u3002\u63D2\u4EF6\u4F1A\u6821\u9A8C open_id\uFF0C\u975E\u6CD5\u6216\u672A\u5F00\u542F\u65F6\u64E6\u9664\u3002", "When someone must decide, approve, confirm, or choose, always mention that person; do not mention for plain information sync, status updates, or chat, and do not guess when the person is unclear. The plugin validates open_ids and erases invalid or disabled mentions.") },
            h3(
              "label",
              { style: S.checkLabel },
              h3("input", {
                type: "checkbox",
                checked: draft.mentions.enabled,
                onChange: (event) => set((current) => ({ ...current, mentions: { ...current.mentions, enabled: event.target.checked } }))
              }),
              t("\u5141\u8BB8", "Allow")
            )
          ),
          draft.mentions.enabled ? h3(
            Field,
            { className: "bxf-setting-toggle", label: t("\u7981\u6B62 @\u6240\u6709\u4EBA\uFF08\u9ED8\u8BA4\u5F00\u542F\uFF09", "Forbid @all (on by default)"), hint: t("\u5173\u95ED\u540E\u6A21\u578B\u53EF\u4EE5 @\u6240\u6709\u4EBA\uFF1B\u63D2\u4EF6\u4ECD\u4F1A\u6821\u9A8C open_id\u3002", "When off, the model may mention everyone; open_ids are still validated.") },
            h3(
              "label",
              { style: S.checkLabel },
              h3("input", {
                type: "checkbox",
                checked: draft.mentions.allowAll !== true,
                onChange: (event) => set((current) => ({ ...current, mentions: { ...current.mentions, allowAll: !event.target.checked } }))
              }),
              t("\u7981\u6B62", "Forbid")
            )
          ) : null
        ),
        group(
          t("\u8BBF\u95EE\u6743\u9650", "Access control"),
          h3(
            Field,
            { label: t("\u8C01\u80FD\u4F7F\u7528\u7FA4\u804A\u4E2D\u7684\u673A\u5668\u4EBA", "Who may use the bot in groups") },
            h3(
              "select",
              { style: S.input, value: draft.group, onChange: (event) => set({ group: event.target.value }) },
              h3("option", { value: "all" }, t("\u6240\u6709\u7528\u6237", "Everyone")),
              h3("option", { value: "allowlist" }, t("\u4EC5\u767D\u540D\u5355", "Allowlist"))
            )
          ),
          draft.group === "allowlist" ? h3(
            Field,
            { label: t("\u7FA4\u804A\u767D\u540D\u5355 Open ID", "Group allowlist Open IDs") },
            h3("textarea", { style: S.area, value: draft.allow, onChange: (event) => set({ allow: event.target.value }, 600), onBlur: () => void autoSave.flush() })
          ) : null,
          h3(
            Field,
            { label: t("\u7BA1\u7406\u767D\u540D\u5355 Open ID\uFF08\u53EF\u6267\u884C /new\u3001\u505C\u6B62\u3001\u8C03\u6574\u4E0E\u5BA1\u6279\uFF09", "Manager allowlist (may run /new, stop, adjust and approve)"), hint: t("\u7559\u7A7A\u8868\u793A\u6CA1\u6709\u4EBA\u53EF\u4EE5\u5728\u7FA4\u91CC\u6267\u884C\u7BA1\u7406\u64CD\u4F5C\u3002", "Empty means nobody may manage in groups.") },
            h3("textarea", { style: S.area, value: draft.managers, onChange: (event) => set({ managers: event.target.value }, 600), onBlur: () => void autoSave.flush() })
          )
        ),
        scopeEditor("group", t("\u7FA4\u804A\u4E0A\u4E0B\u6587\u6CE8\u5165", "Group-chat context"))
      )
    ) : null
  );
}
function BotHeader({ connection, bot, onChanged, onRefresh, refreshing = false, actions, extraActions, active = true }) {
  const [grantOpen, setGrantOpen] = import_react4.default.useState(false);
  const [notice, setNotice] = import_react4.default.useState(null);
  const { busy, error, run } = useMutation();
  const connecting = ["connecting", "reconnecting"].includes(bot.state);
  import_react4.default.useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 3e3);
    return () => clearTimeout(timer);
  }, [notice]);
  const reconnect = () => {
    return run("reconnect", () => {
      setNotice(null);
      return rpc(connection, API.botReconnect, { botId: bot.id });
    }, async (result) => {
      setNotice(result.bots?.find((item) => item.id === bot.id)?.state === "connected" ? t("\u8FDE\u63A5\u5DF2\u6062\u590D", "Connection restored") : t("\u8FDE\u63A5\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u67E5\u770B\u72B6\u6001", "Connection is not ready. Check its status."));
      await onChanged();
    });
  };
  const reconnectButton = h3(ActionButton, {
    active,
    hintId: `bxf-${bot.id}-reconnect-tip`,
    hint: t("\u65AD\u5F00\u5E76\u91CD\u65B0\u5EFA\u7ACB\u5F53\u524D\u673A\u5668\u4EBA\u7684\u957F\u8FDE\u63A5\uFF0C\u7528\u4E8E\u6062\u590D\u8FDE\u63A5\u5F02\u5E38\u3002", "Disconnect and re-establish this bot\u2019s connection to recover connectivity."),
    disabled: Boolean(busy) || connecting,
    onClick: () => void reconnect()
  }, busy === "reconnect" || connecting ? t("\u91CD\u8FDE\u4E2D\u2026", "Reconnecting\u2026") : t("\u91CD\u8FDE", "Reconnect"));
  const title = bot.alias || bot.botName || bot.id;
  return h3(
    "header",
    { className: "bxf-status-summary" },
    h3(
      "div",
      { className: "bxf-work-heading" },
      h3(
        "div",
        { style: S.grow },
        h3(
          "div",
          { style: S.nameRow },
          h3("h2", null, title),
          h3(StatusBadge, { state: bot.state })
        )
      ),
      h3(
        "div",
        { className: "bxf-bot-actions" },
        actions,
        onRefresh && h3(ActionButton, {
          active,
          hintId: `bxf-${bot.id}-refresh-tip`,
          disabled: refreshing || Boolean(busy),
          hint: t("\u66F4\u65B0\u5F53\u524D\u673A\u5668\u4EBA\u7684\u4F1A\u8BDD\u76EE\u5F55\u4E0E\u8FD0\u884C\u72B6\u6001\uFF0C\u4E0D\u91CD\u8FDE\uFF0C\u4E5F\u4E0D\u62C9\u53D6\u5206\u8EAB\u65B0\u6D88\u606F\u3002", "Refresh this bot\u2019s chats and runtime status without reconnecting or polling avatar messages."),
          "aria-label": t("\u5237\u65B0\u4F1A\u8BDD\u4E0E\u72B6\u6001", "Refresh chats and status"),
          "aria-busy": refreshing,
          onClick: () => void onRefresh()
        }, refreshing ? t("\u5237\u65B0\u4E2D\u2026", "Refreshing\u2026") : t("\u5237\u65B0", "Refresh")),
        reconnectButton,
        h3(ActionButton, {
          active,
          hintId: `bxf-${bot.id}-grant-tip`,
          disabled: Boolean(busy),
          hint: t("\u6253\u5F00\u98DE\u4E66\u626B\u7801\u6388\u6743\uFF0C\u4E3A\u5F53\u524D\u673A\u5668\u4EBA\u8865\u9F50\u6240\u9700\u7684\u5E94\u7528\u6743\u9650\u3002", "Open Feishu authorization to grant this bot its required app permissions."),
          onClick: () => setGrantOpen(true)
        }, t("\u8865\u9F50\u6743\u9650", "Grant permissions")),
        extraActions
      )
    ),
    error && h3("div", { className: "bxf-work-alert", role: "alert" }, error),
    notice && h3("div", { className: "bxf-work-meta", role: "status" }, notice),
    grantOpen && h3(Boundary, null, h3(AddBotModal, { connection, mode: "scan", grant: bot, onClose: () => setGrantOpen(false), onAdded: onChanged }))
  );
}

// client/bot-status.js
var import_react16 = __toESM(require("react"), 1);

// client/conversations.js
var import_react6 = __toESM(require("react"), 1);

// client/workspace-model.js
var chatKey = (chat) => JSON.stringify([chat.botId, chat.chatId]);
function filterChats(chats, { query = "", botId = "", state = "", chatType = "" } = {}) {
  const keyword = query.trim().toLowerCase();
  return chats.filter((chat) => (!botId || chat.botId === botId) && (!chatType || chat.chatType === chatType) && (!state || (state === "bound" ? Boolean(chat.sessionId) : state === "unbound" ? !chat.sessionId : chat.conflict || chat.bindingState === "unavailable")) && (!keyword || [chat.title, chat.chatId, chat.sessionId, chat.session?.title].filter(Boolean).join(" ").toLowerCase().includes(keyword)));
}
function chatState(chat) {
  if (chat.conflict) return "conflict";
  if (chat.bindingState === "unbound") return "unbound";
  if (chat.bindingState === "unavailable") return "unavailable";
  if (chat.session?.running === true || chat.activity?.running === true) return "running";
  if (chat.activity?.queuedMessages > 0) return "queued";
  if (chat.bindingState === "unknown") return "unknown";
  return "bound";
}
function applyChatUnbound(snapshot, { botId, chatId, sessionId }) {
  let changed = false;
  const chats = snapshot.chats.map((chat) => {
    if (chat.botId !== botId || chat.chatId !== chatId || chat.sessionId !== sessionId) return chat;
    changed = true;
    return { ...chat, sessionId: null, session: null, bindingState: "unbound", conflict: false, activity: null };
  });
  if (!changed) return snapshot;
  return { ...snapshot, chats, bots: snapshot.bots.map((bot) => bot.id === botId && Number.isFinite(bot.boundChats) ? { ...bot, boundChats: Math.max(0, bot.boundChats - 1) } : bot) };
}
function applyChatBound(snapshot, { botId, chatId, sessionId, previousSessionId, session }) {
  let changed = false;
  let added = false;
  const chats = snapshot.chats.map((chat) => {
    if (chat.botId !== botId || chat.chatId !== chatId || (chat.sessionId ?? null) !== previousSessionId && chat.sessionId !== sessionId) return chat;
    changed = true;
    added = !chat.sessionId;
    return { ...chat, sessionId, session, bindingState: "available", conflict: false, activity: null };
  });
  if (!changed) return snapshot;
  return { ...snapshot, chats, bots: snapshot.bots.map((bot) => added && bot.id === botId && Number.isFinite(bot.boundChats) ? { ...bot, boundChats: bot.boundChats + 1 } : bot) };
}
function mergeBotSnapshot(snapshot, update, botId) {
  const bot = update.bots.find((item) => item.id === botId);
  if (!bot || !snapshot.bots.some((item) => item.id === botId)) return snapshot;
  return {
    ...snapshot,
    bots: snapshot.bots.map((item) => item.id === botId ? bot : item),
    chats: [...snapshot.chats.filter((item) => item.botId !== botId), ...update.chats.filter((item) => item.botId === botId)],
    warnings: [
      ...snapshot.warnings.filter((item) => item.source !== botId && item.source !== "sessions"),
      ...update.warnings.filter((item) => item.source === botId || item.source === "sessions")
    ]
  };
}

// client/session-binding.js
var import_react5 = __toESM(require("react"), 1);
var h4 = import_react5.default.createElement;
function SessionBinding({ connection, chat, active, onBind, onCancel, onBound }) {
  const { data, loaded, error: loadError, refresh } = useRpcQuery(connection, API.chatSessions, null, { botId: chat.botId, chatId: chat.chatId });
  const [search, setSearch] = import_react5.default.useState("");
  const [selected, setSelected] = import_react5.default.useState("");
  const [limit, setLimit] = import_react5.default.useState(40);
  const { busy, error, run } = useMutation();
  import_react5.default.useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);
  const keyword = search.trim().toLowerCase();
  const sessions = (data?.sessions ?? []).filter((item) => !keyword || [item.title, item.sessionId, item.cwd].filter(Boolean).join(" ").toLowerCase().includes(keyword));
  const target = sessions.find((item) => item.sessionId === selected);
  const changed = Boolean(data && (chat.sessionId ?? null) !== data.currentSessionId);
  const ready = loaded && !loadError && !changed && target && !target.unavailableReason && selected !== data.currentSessionId;
  const submit = () => {
    if (!ready || busy) return;
    const binding = { botId: chat.botId, chatId: chat.chatId, sessionId: selected, expectedSessionId: data.currentSessionId };
    if (binding.expectedSessionId && !window.confirm(t(
      `\u5C06\u300C${chat.title || chat.chatId}\u300D\u66F4\u6362\u7ED1\u5B9A\u5230\u300C${target.title}\u300D\uFF1F
\u539F DSH \u4F1A\u8BDD\u53CA\u5386\u53F2\u8BB0\u5F55\u4F1A\u4FDD\u7559\u3002`,
      `Bind \u201C${chat.title || chat.chatId}\u201D to \u201C${target.title}\u201D instead?
The previous DSH session and history are kept.`
    ))) return;
    return run("bind", () => onBind(binding), onBound);
  };
  return h4(
    "section",
    { className: "bxf-session-binding", "aria-label": t("\u7ED1\u5B9A DSH \u4F1A\u8BDD", "Bind a DSH session") },
    h4(
      "div",
      { className: "bxf-work-heading" },
      h4("strong", null, t("\u9009\u62E9 DSH \u4F1A\u8BDD", "Choose a DSH session")),
      h4("button", { type: "button", className: "bxf-mini", disabled: Boolean(busy), onClick: () => void refresh() }, t("\u5237\u65B0\u5217\u8868", "Refresh list"))
    ),
    h4("p", { className: "bxf-work-meta" }, t("\u540E\u7EED\u89E6\u53D1\u6D88\u606F\u5C06\u8FDB\u5165\u6240\u9009\u4F1A\u8BDD\uFF0C\u4FDD\u7559\u5176\u5386\u53F2\u3001\u6A21\u578B\u548C\u5DE5\u4F5C\u533A\u3002", "Future triggering messages use the selected session, keeping its history, model and workspace.")),
    h4("input", {
      type: "search",
      style: S.input,
      value: search,
      disabled: Boolean(busy),
      placeholder: t("\u641C\u7D22\u540D\u79F0\u3001Session ID \u6216\u5DE5\u4F5C\u533A", "Search name, Session ID or workspace"),
      "aria-label": t("\u641C\u7D22 DSH \u4F1A\u8BDD", "Search DSH sessions"),
      onChange: (event) => {
        setSearch(event.target.value);
        setLimit(40);
      }
    }),
    (loadError || error) && h4("div", { className: "bxf-work-alert", role: "alert" }, loadError || error),
    changed && h4("div", { className: "bxf-work-alert", role: "alert" }, t("\u5F53\u524D\u7ED1\u5B9A\u5DF2\u53D8\u5316\uFF0C\u8BF7\u5237\u65B0\u5217\u8868\u540E\u91CD\u65B0\u9009\u62E9\u3002", "The current binding changed. Refresh the list and select again.")),
    !loaded ? h4("p", { className: "bxf-work-meta", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u4F1A\u8BDD\u2026", "Loading sessions\u2026")) : !loadError && h4(
      "fieldset",
      { className: "bxf-session-options", disabled: Boolean(busy), "aria-label": t("DSH \u4F1A\u8BDD\u5217\u8868", "DSH sessions") },
      sessions.length === 0 && h4("p", { className: "bxf-work-empty" }, t("\u6CA1\u6709\u5339\u914D\u7684 DSH \u4F1A\u8BDD", "No matching DSH sessions")),
      sessions.slice(0, limit).map((item) => h4(
        "label",
        { key: item.sessionId, className: "bxf-session-option", "data-selected": selected === item.sessionId },
        h4("input", {
          type: "radio",
          name: `session-binding-${chat.botId}-${chat.chatId}`,
          value: item.sessionId,
          checked: selected === item.sessionId,
          disabled: Boolean(item.unavailableReason) || item.sessionId === data.currentSessionId,
          onChange: () => setSelected(item.sessionId)
        }),
        h4(
          "span",
          null,
          h4("strong", null, item.title),
          h4("span", { className: "bxf-work-meta" }, item.cwd || t("\u672A\u6307\u5B9A\u5DE5\u4F5C\u533A", "No workspace")),
          h4("code", null, item.sessionId),
          (item.unavailableReason || item.sessionId === data.currentSessionId) && h4(
            "span",
            { className: "bxf-work-meta" },
            item.unavailableReason || t("\u5F53\u524D\u7ED1\u5B9A", "Current binding")
          )
        )
      )),
      sessions.length > limit && h4("button", { type: "button", className: "bxf-mini", onClick: () => setLimit((value) => value + 40) }, t("\u663E\u793A\u66F4\u591A", "Show more"))
    ),
    h4(
      "div",
      { className: "bxf-session-binding-actions" },
      h4("button", { type: "button", className: "bxf-button", disabled: Boolean(busy), onClick: onCancel }, t("\u53D6\u6D88", "Cancel")),
      h4(
        "button",
        { type: "button", className: "bxf-button", "data-variant": "primary", disabled: !ready || Boolean(busy), onClick: submit },
        busy ? t("\u7ED1\u5B9A\u4E2D\u2026", "Binding\u2026") : t("\u786E\u8BA4\u7ED1\u5B9A", "Bind session")
      )
    )
  );
}

// client/conversations.js
var h5 = import_react6.default.createElement;
var dateText = (value) => {
  if (!value) return "\u2014";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "\u2014" : date.toLocaleString();
};
var modelText = (model2) => model2?.model ? `${model2.provider} \xB7 ${model2.model}${model2.reasoningEffort ? ` \xB7 ${model2.reasoningEffort}` : ""}` : "\u2014";
var kind = (chat) => chat.chatType === "p2p" ? t("\u79C1\u804A", "Direct") : chat.chatType === "group" ? t("\u7FA4\u804A", "Group") : t("\u7C7B\u578B\u672A\u77E5", "Unknown type");
function Facts({ rows }) {
  return h5("dl", { className: "bxf-work-facts" }, rows.flatMap(([label, value]) => [
    h5("dt", { key: `${label}:label` }, label),
    h5("dd", { key: label }, value ?? "\u2014")
  ]));
}
function ChatBadge({ chat }) {
  const state = chatState(chat);
  const labels = {
    conflict: t("\u7ED1\u5B9A\u51B2\u7A81", "Binding conflict"),
    unbound: t("\u672A\u7ED1\u5B9A", "Unbound"),
    unavailable: t("\u4F1A\u8BDD\u4E0D\u53EF\u7528", "Session unavailable"),
    running: t("\u5904\u7406\u4E2D", "Running"),
    queued: t("\u6392\u961F\u4E2D", "Queued"),
    unknown: t("\u72B6\u6001\u672A\u77E5", "Unknown"),
    bound: t("\u5DF2\u7ED1\u5B9A", "Bound")
  };
  return h5("span", { style: S.badge(["conflict", "unavailable"].includes(state) ? "warn" : state === "running" ? "ok" : "muted") }, labels[state]);
}
function Conversations({ connection, snapshot, active = true, onOpenSession, onBind, onUnbind, onBot }) {
  const [query, setQuery] = import_react6.default.useState("");
  const [state, setState] = import_react6.default.useState("");
  const [chatType, setChatType] = import_react6.default.useState("");
  const [selected, setSelected] = import_react6.default.useState(null);
  const [notice, setNotice] = import_react6.default.useState(null);
  const [bindingChat, setBindingChat] = import_react6.default.useState(null);
  const { busy, error, run } = useMutation();
  const chats = filterChats(snapshot.chats, { query, state, chatType });
  const chat = chats.find((item) => chatKey(item) === selected) ?? chats[0];
  const selectedKey = chat ? chatKey(chat) : null;
  import_react6.default.useEffect(() => {
    setBindingChat(null);
    setNotice(null);
  }, [selectedKey]);
  const editingBinding = bindingChat !== null && bindingChat === selectedKey;
  const bot = snapshot.bots.find((item) => item.id === chat?.botId);
  const next = chat?.nextSession;
  const source = (name) => next?.overrides?.includes(name) ? t("\u4F1A\u8BDD\u8986\u76D6", "Chat override") : t("\u673A\u5668\u4EBA\u9ED8\u8BA4", "Bot default");
  const unbind = () => {
    if (!chat?.sessionId || busy) return;
    const binding = { botId: chat.botId, chatId: chat.chatId, sessionId: chat.sessionId };
    const title = chat.title || chat.chatId;
    if (!window.confirm(t(
      `\u89E3\u9664\u300C${title}\u300D\u4E0E\u5F53\u524D DSH \u4F1A\u8BDD\u7684\u7ED1\u5B9A\uFF1F
\u539F DSH \u4F1A\u8BDD\u53CA\u5386\u53F2\u8BB0\u5F55\u4F1A\u4FDD\u7559\uFF0C\u4E0B\u4E00\u6761\u89E6\u53D1\u6D88\u606F\u5C06\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002`,
      `Unbind \u201C${title}\u201D from its current DSH session?
The session and history are kept. The next triggering message creates a new session.`
    ))) return;
    setNotice(null);
    return run(chatKey(chat), () => onUnbind(binding), () => setNotice(t(`\u5DF2\u89E3\u7ED1\u300C${title}\u300D`, `Unbound \u201C${title}\u201D`)));
  };
  return h5(
    import_react6.default.Fragment,
    null,
    error && h5("div", { className: "bxf-work-alert", role: "alert" }, error),
    notice && h5("div", { className: "bxf-identity-notice", style: { marginBottom: "14px" }, role: "status" }, notice),
    h5(
      "div",
      { className: "bxf-work-toolbar bxf-chat-toolbar" },
      h5("input", {
        style: S.input,
        type: "search",
        value: query,
        onChange: (event) => setQuery(event.target.value),
        placeholder: t("\u641C\u7D22\u4F1A\u8BDD\u3001chatId \u6216 Session", "Search chats, chatId or Session"),
        "aria-label": t("\u641C\u7D22\u4F1A\u8BDD", "Search chats")
      }),
      h5(
        "div",
        { className: "bxf-work-filters" },
        h5(
          "select",
          { style: S.input, value: chatType, "aria-label": t("\u7B5B\u9009\u4F1A\u8BDD\u7C7B\u578B", "Filter chat type"), onChange: (event) => setChatType(event.target.value) },
          h5("option", { value: "" }, t("\u5168\u90E8\u7C7B\u578B", "All types")),
          h5("option", { value: "group" }, t("\u7FA4\u804A", "Group")),
          h5("option", { value: "p2p" }, t("\u79C1\u804A", "Direct"))
        ),
        h5(
          "select",
          { style: S.input, value: state, "aria-label": t("\u7B5B\u9009\u7ED1\u5B9A", "Filter bindings"), onChange: (event) => setState(event.target.value) },
          h5("option", { value: "" }, t("\u5168\u90E8\u7ED1\u5B9A\u72B6\u6001", "All bindings")),
          h5("option", { value: "bound" }, t("\u5DF2\u7ED1\u5B9A", "Bound")),
          h5("option", { value: "unbound" }, t("\u672A\u7ED1\u5B9A", "Unbound")),
          h5("option", { value: "issues" }, t("\u9700\u8981\u5173\u6CE8", "Needs attention"))
        )
      )
    ),
    h5(
      "div",
      { className: "bxf-work-split" },
      h5(
        "div",
        { className: "bxf-work-list", "aria-label": t("\u98DE\u4E66\u4F1A\u8BDD", "Feishu chats") },
        h5("div", { className: "bxf-work-listhead" }, `${chats.length} ${t("\u4E2A\u4F1A\u8BDD \xB7 \u53EF\u89C1\u7FA4\u804A\u4E0E\u5DF2\u77E5\u7ED1\u5B9A", "chats \xB7 visible groups and known bindings")}`),
        chats.length === 0 && h5("div", { className: "bxf-work-empty" }, t("\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD", "No matching chats")),
        chats.map((item) => {
          const owner = snapshot.bots.find((value) => value.id === item.botId);
          return h5(
            "button",
            {
              key: chatKey(item),
              type: "button",
              className: "bxf-work-row",
              "aria-pressed": chatKey(item) === (chat && chatKey(chat)),
              onClick: () => setSelected(chatKey(item))
            },
            h5(
              "div",
              null,
              h5("strong", { title: item.title }, item.title),
              h5("div", { className: "bxf-work-meta" }, `${kind(item)} \xB7 ${owner?.alias || owner?.botName || item.botId}`)
            ),
            h5(
              "div",
              { className: "bxf-work-row-end" },
              h5(ChatBadge, { chat: item }),
              h5("div", { className: "bxf-work-meta", title: item.session?.title || item.sessionId || "" }, item.session?.title || item.sessionId || "\u2014")
            )
          );
        })
      ),
      chat ? h5(
        "section",
        { className: "bxf-work-detail", "aria-label": t("\u4F1A\u8BDD\u8BE6\u60C5", "Chat details") },
        h5("div", { className: "bxf-work-heading" }, h5("h2", null, chat.title), h5(ChatBadge, { chat })),
        h5("div", { className: "bxf-work-meta" }, `${kind(chat)} \xB7 ${bot?.alias || bot?.botName || chat.botId}`),
        h5(Facts, { rows: [
          ["Chat ID", h5("code", null, chat.chatId)],
          ["DSH Session", chat.sessionId ? h5("code", null, chat.sessionId) : t("\u672A\u7ED1\u5B9A", "Unbound")],
          [t("\u6700\u8FD1\u6D3B\u52A8", "Last activity"), dateText(chat.session?.updatedAt)],
          [t("\u5DE5\u4F5C\u533A", "Workspace"), chat.session?.cwd],
          [t("\u5F53\u524D\u6A21\u578B", "Current model"), modelText(chat.session?.model)],
          [t("\u672C\u5730\u6392\u961F", "Local queue"), chat.activity?.queuedMessages ?? "\u2014"]
        ] }),
        chat.conflict && h5("div", { className: "bxf-work-alert" }, t("\u6B64 Session \u5B58\u5728\u591A\u4E2A\u7ED1\u5B9A\uFF0C\u8BF7\u6838\u5BF9\u540E\u518D\u8C03\u6574\u3002", "This Session has multiple bindings. Review them before making changes.")),
        h5(
          "div",
          { style: S.row },
          !editingBinding && h5(ActionButton, {
            active,
            variant: chat.sessionId ? "default" : "primary",
            hintId: `bxf-${chat.botId}-chat-bind-tip`,
            disabled: Boolean(busy),
            hint: t("\u9009\u62E9\u5DF2\u6709 DSH \u4F1A\u8BDD\u627F\u63A5\u540E\u7EED\u6D88\u606F\uFF0C\u4FDD\u7559\u8BE5\u4F1A\u8BDD\u7684\u5386\u53F2\u4E0E\u914D\u7F6E\u3002", "Select an existing DSH session for future messages, keeping its history and settings."),
            onClick: () => {
              setNotice(null);
              setBindingChat(selectedKey);
            }
          }, chat.sessionId ? t("\u66F4\u6362\u7ED1\u5B9A", "Change binding") : t("\u7ED1\u5B9A\u4F1A\u8BDD", "Bind session")),
          chat.sessionId && h5("button", {
            type: "button",
            style: S.btn("primary"),
            disabled: chat.bindingState === "unavailable",
            onClick: () => void onOpenSession(chat.sessionId)
          }, t("\u6253\u5F00 DSH \u4F1A\u8BDD", "Open DSH session")),
          chat.sessionId && h5(ActionButton, {
            active,
            variant: "default",
            hintId: `bxf-${chat.botId}-chat-unbind-tip`,
            disabled: Boolean(busy) || editingBinding,
            hint: t("\u89E3\u9664\u4E0E DSH \u4F1A\u8BDD\u7684\u7ED1\u5B9A\uFF0C\u4FDD\u7559\u539F\u4F1A\u8BDD\u548C\u5386\u53F2\uFF1B\u4E0B\u6B21\u89E6\u53D1\u6D88\u606F\u4F1A\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002", "Detach the DSH session and keep its history. The next triggering message creates a new session."),
            style: { color: "var(--dsw-alias-state-error-primary)" },
            onClick: unbind
          }, busy === chatKey(chat) ? t("\u89E3\u7ED1\u4E2D\u2026", "Unbinding\u2026") : t("\u89E3\u7ED1", "Unbind"))
        ),
        editingBinding && h5(SessionBinding, {
          key: selectedKey,
          connection,
          chat,
          active,
          onBind,
          onCancel: () => setBindingChat(null),
          onBound: () => {
            setBindingChat(null);
            setNotice(t("\u4F1A\u8BDD\u5DF2\u7ED1\u5B9A\uFF0C\u540E\u7EED\u89E6\u53D1\u6D88\u606F\u5C06\u8FDB\u5165\u8BE5\u4F1A\u8BDD\u3002", "Session bound. Future triggering messages will use this session."));
          }
        }),
        h5("h3", null, t("\u4E0B\u6B21\u65B0\u5EFA\u4F1A\u8BDD", "Next new session")),
        h5(Facts, { rows: [
          [t("\u5DE5\u4F5C\u533A", "Workspace"), `${next?.workspace || t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")} \xB7 ${source("workspace")}`],
          [t("\u6A21\u578B", "Model"), `${next?.model ? modelText(next.model) : t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")} \xB7 ${source("model")}`],
          [t("\u9884\u8BBE", "Preset"), `${next?.preset || t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")} \xB7 ${source("preset")}`]
        ] }),
        h5("button", { type: "button", style: S.btn(), onClick: () => onBot(chat.botId) }, t("\u673A\u5668\u4EBA\u914D\u7F6E", "Bot settings"))
      ) : h5("div", { className: "bxf-work-detail bxf-work-empty" }, t("\u9009\u62E9\u4F1A\u8BDD\u67E5\u770B\u7ED1\u5B9A", "Select a chat to view its binding"))
    )
  );
}

// client/action-menu.js
var import_react7 = __toESM(require("react"), 1);
var h6 = import_react7.default.createElement;
function ActionMenu({ disabled, active, label = t("\u66F4\u591A\u64CD\u4F5C", "More actions"), renderActions }) {
  const [open, setOpen] = import_react7.default.useState(false);
  const ref = import_react7.default.useRef(null);
  const trigger = import_react7.default.useRef(null);
  import_react7.default.useEffect(() => {
    if (!active) setOpen(false);
  }, [active]);
  import_react7.default.useEffect(() => {
    if (!open) return;
    const outside = (event) => {
      if (ref.current && !ref.current.contains(event.target)) setOpen(false);
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      trigger.current?.focus();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [open]);
  return h6(
    "div",
    {
      className: "bxf-bot-more",
      ref,
      onBlur: (event) => {
        if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setOpen(false);
      }
    },
    h6("button", {
      ref: trigger,
      type: "button",
      className: "bxf-mini bxf-work-icon",
      disabled,
      "aria-label": label,
      "aria-expanded": open,
      onClick: () => setOpen((value) => !value)
    }, "\u2026"),
    open && h6(
      "div",
      { className: "bxf-bot-more-panel", role: "group", "aria-label": label },
      renderActions(() => setOpen(false))
    )
  );
}

// client/identity.js
var import_react14 = __toESM(require("react"), 1);

// client/avatar-workspace.js
var import_react11 = __toESM(require("react"), 1);

// client/drawer.js
var import_react8 = __toESM(require("react"), 1);
var h7 = import_react8.default.createElement;
function Drawer({ open, title, onClose, children }) {
  const ref = import_react8.default.useRef(null);
  const composingRef = import_react8.default.useRef(false);
  const backdropDownRef = import_react8.default.useRef(false);
  import_react8.default.useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open]);
  return h7("dialog", {
    ref,
    hidden: !open,
    className: "bxf-drawer",
    "aria-label": title,
    onCompositionStartCapture: () => {
      composingRef.current = true;
    },
    onCompositionEndCapture: () => {
      composingRef.current = false;
    },
    onCancel: (event) => {
      event.preventDefault();
      if (!composingRef.current && !event.isComposing) void onClose();
    },
    onPointerDown: (event) => {
      backdropDownRef.current = event.target === event.currentTarget;
    },
    onClick: (event) => {
      const fromBackdrop = backdropDownRef.current;
      backdropDownRef.current = false;
      if (event.target === event.currentTarget && fromBackdrop) void onClose();
    }
  }, h7(
    "div",
    { className: "bxf-drawer-sheet" },
    h7(
      "header",
      { className: "bxf-drawer-header" },
      h7("h2", null, title),
      h7("button", {
        type: "button",
        className: "bxf-mini bxf-work-icon",
        "aria-label": t("\u6536\u8D77\u9762\u677F", "Close panel"),
        onClick: () => void onClose()
      }, "\xD7")
    ),
    h7("div", { className: "bxf-drawer-body" }, children)
  ));
}

// client/monitor-detail.js
var import_react9 = __toESM(require("react"), 1);
var h8 = import_react9.default.createElement;
function MonitorDetail({ connection, botId, chatId, active, onViewWorker }) {
  const { data, error, refresh } = useRpcQuery(connection, API.userMonitorDetail, null, { botId, chatId });
  usePolling(refresh, { interval: 1e4, scope: chatId, enabled: active });
  const [filter, setFilter] = import_react9.default.useState("pending");
  const labels = {
    pending: t("\u5F85\u5904\u7406", "Pending"),
    background: t("\u4E0A\u4E0B\u6587\u6D88\u606F", "Context messages"),
    excluded: t("\u5DF2\u6392\u9664", "Excluded")
  };
  if (error) return h8(
    "div",
    { className: "bxf-work-alert", role: "alert" },
    error,
    h8("button", { type: "button", style: S.btn(), onClick: () => void refresh() }, t("\u91CD\u8BD5", "Retry"))
  );
  if (!data) return h8("div", { className: "bxf-work-meta" }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026"));
  const messages = data.messages.filter((message) => message.category === filter);
  return h8(
    "div",
    { className: "bxf-identity-chat-extra" },
    h8(
      "div",
      { className: "bxf-work-toolbar" },
      h8(
        "select",
        { style: S.input, value: filter, "aria-label": t("\u6D88\u606F\u5206\u7C7B", "Message category"), onChange: (event) => setFilter(event.target.value) },
        Object.entries(labels).map(([value, label]) => h8(
          "option",
          { key: value, value },
          `${label} \xB7 ${data.messages.filter((message) => message.category === value).length}`
        ))
      ),
      h8("span", { className: "bxf-work-meta" }, `${t("\u7B49\u5F85\u5361\u7247\u6536\u5C3E", "Waiting for cards")} \xB7 ${data.pendingCards.length}`)
    ),
    h8(
      "div",
      { className: "bxf-work-batch" },
      messages.length === 0 && h8("div", { className: "bxf-work-empty" }, t("\u6682\u65E0\u8BB0\u5F55", "No records")),
      messages.map((message) => h8(
        "article",
        { key: message.messageId, className: "bxf-work-message" },
        h8(
          "div",
          { className: "bxf-work-heading" },
          h8("strong", null, message.isSelf ? t("\u672C\u4EBA", "You") : message.senderName || message.senderOpenId || t("\u672A\u77E5\u53D1\u9001\u8005", "Unknown sender")),
          h8("time", { className: "bxf-work-meta" }, dateText(message.createTime))
        ),
        h8("pre", null, message.text),
        h8(
          "details",
          { className: "bxf-message-id" },
          h8("summary", { className: "bxf-work-meta" }, t("\u6D88\u606F ID", "Message ID")),
          h8("code", { className: "bxf-work-meta" }, message.messageId)
        )
      ))
    ),
    data.workers.some((worker) => !worker.current) && h8(
      "details",
      null,
      h8("summary", { className: "bxf-work-meta" }, t("\u5386\u53F2 Worker", "Previous Workers")),
      data.workers.filter((worker) => !worker.current).map((worker) => h8("button", {
        key: worker.sessionId,
        type: "button",
        className: "bxf-mini",
        title: worker.sessionId,
        onClick: () => void onViewWorker(worker.sessionId)
      }, worker.sessionId))
    )
  );
}

// client/worker-conversation.js
var import_react10 = __toESM(require("react"), 1);
var h9 = import_react10.default.createElement;
var WORKER_CONVERSATION_SLOT = "im-feishu.worker.conversation";
function WorkerChatView({ renderSlot }) {
  return renderSlot("conversation.session", { view: "chat" });
}
function WorkerConversationContent({ sessionId, useSession, useConversation, useSessions, renderFactorySlot }) {
  const session = useSession((value) => value);
  const conversation = useConversation((value) => value);
  const summaryBlank = useSessions((state) => state.byId[sessionId]?.blank);
  const hasContent = conversation.activeTargets.size > 0 || !session.blank && !session.awaitingFirstTurn || session.running || session.promptAttempted;
  const hero = !hasContent && (session.openState === "open" || summaryBlank === true);
  const settling = !hasContent && session.openState === "loading" && summaryBlank !== true;
  return renderFactorySlot("conversation.content", {
    variant: "embedded",
    phase: settling ? "settling" : hero ? "hero" : "active",
    hero
  }, { slots: { views: WorkerChatView } });
}
function RetainedWorker({ sessionId, sessions, SessionProvider, renderSlot, onRetry }) {
  const [reference, setReference] = import_react10.default.useState(null);
  const [error, setError] = import_react10.default.useState(null);
  import_react10.default.useEffect(() => {
    let alive = true;
    let retained;
    setReference(null);
    setError(null);
    void (async () => {
      try {
        const known = sessions.list?.getSnapshot?.()?.byId?.[sessionId] || sessions.binding?.(sessionId);
        if (!known) await sessions.refresh?.();
        if (!alive) return;
        retained = sessions.retain(sessionId, { source: "feishuAvatar" });
        setReference(retained);
        await retained.ready;
      } catch (failure) {
        if (alive) {
          const current = retained;
          retained = void 0;
          current?.release();
          setReference(null);
          setError(failure?.message ?? String(failure));
        }
      }
    })();
    return () => {
      alive = false;
      const current = retained;
      retained = void 0;
      current?.release();
    };
  }, [sessions, sessionId]);
  if (error) return h9(
    "div",
    { className: "bxf-work-alert", role: "alert" },
    error,
    h9("button", { type: "button", className: "bxf-mini", onClick: onRetry }, t("\u91CD\u8BD5", "Retry"))
  );
  if (!reference) return h9("div", { className: "bxf-work-empty", role: "status" }, t("\u6B63\u5728\u52A0\u8F7D Worker \u4F1A\u8BDD\u2026", "Loading Worker conversation\u2026"));
  return h9(SessionProvider, { session: reference }, renderSlot(WORKER_CONVERSATION_SLOT, {}));
}
function WorkerSessionView({ sessionId, workerView }) {
  const [attempt, setAttempt] = import_react10.default.useState(0);
  if (typeof workerView?.sessions?.retain !== "function" || !workerView?.SessionProvider || typeof workerView?.renderSlot !== "function") {
    return h9(
      "div",
      { className: "bxf-work-empty", role: "status" },
      t("\u5F53\u524D DSH \u672A\u63D0\u4F9B\u5185\u5D4C\u4F1A\u8BDD\u80FD\u529B\uFF0C\u53EF\u4F7F\u7528\u300C\u72EC\u7ACB\u6253\u5F00\u300D\u3002", "Embedded conversations are unavailable in this DSH version. Use Open separately.")
    );
  }
  return h9(
    Boundary,
    { key: `${sessionId}:${attempt}` },
    h9(RetainedWorker, { sessionId, ...workerView, onRetry: () => setAttempt((value) => value + 1) })
  );
}
function WorkerConversationPanel({ worker, currentSessionId, workerView, onBack, onCurrent, onOpenSession, actions }) {
  const historical = worker.sessionId && currentSessionId !== worker.sessionId;
  return h9(
    "section",
    { className: "bxf-worker-panel", "aria-label": t("Worker \u4F1A\u8BDD", "Worker conversation") },
    h9(
      "header",
      { className: "bxf-worker-header" },
      h9("button", { type: "button", className: "bxf-mini bxf-avatar-back", onClick: onBack }, t("\u4F1A\u8BDD\u5217\u8868", "Chat list")),
      h9(
        "div",
        { className: "bxf-worker-title" },
        h9("strong", null, worker.name || worker.chatId),
        h9(
          "span",
          { className: "bxf-work-meta", title: worker.sessionId },
          historical ? t("\u5386\u53F2 Worker", "Previous Worker") : worker.sessionId ? "Worker" : t("\u5C1A\u672A\u521B\u5EFA Worker", "No Worker yet")
        )
      ),
      h9(
        "div",
        { className: "bxf-worker-actions" },
        actions,
        historical && h9("button", { type: "button", className: "bxf-mini", onClick: onCurrent }, t("\u8FD4\u56DE\u5F53\u524D Worker", "Current Worker")),
        h9("button", {
          type: "button",
          className: "bxf-mini",
          disabled: !worker.sessionId || !onOpenSession,
          title: worker.sessionId,
          onClick: () => void onOpenSession(worker.sessionId)
        }, t("\u72EC\u7ACB\u6253\u5F00", "Open separately"))
      )
    ),
    h9("div", { className: "bxf-worker-native" }, worker.sessionId ? h9(WorkerSessionView, { sessionId: worker.sessionId, workerView }) : h9(
      "div",
      { className: "bxf-avatar-worker-empty" },
      h9("strong", null, t("\u7B49\u5F85\u9996\u6B21\u6D3E\u53D1", "Awaiting first dispatch")),
      h9("p", { className: "bxf-work-meta" }, t("\u65B0\u6D88\u606F\u6D3E\u53D1\u540E\uFF0CWorker \u5BF9\u8BDD\u4F1A\u663E\u793A\u5728\u8FD9\u91CC\u3002", "The Worker conversation appears here after the first message batch is dispatched."))
    ))
  );
}

// client/avatar-workspace.js
var h10 = import_react11.default.createElement;
function AvatarWorkspace({ connection, botId, saveRef, onOpenSession, workerView, query, active = true }) {
  const { data: monitor, error: loadError, accept: setMonitor, refresh: load, invalidate } = query;
  const call = (method, payload = {}) => rpc(connection, method, { ...payload, botId });
  const { busy, error: actionError, run } = useMutation();
  const error = actionError ?? loadError;
  const directEnabled = monitor?.directEnabled === true;
  const autoSave = useAutoSave();
  import_react11.default.useEffect(() => {
    if (!saveRef) return;
    saveRef.current = autoSave.flush;
    return () => {
      saveRef.current = null;
    };
  }, [saveRef, autoSave.flush]);
  const [available, setAvailable] = import_react11.default.useState(null);
  const [drawer, setDrawer] = import_react11.default.useState(null);
  const [selectedId, setSelectedId] = import_react11.default.useState(null);
  const [historicalWorker, setHistoricalWorker] = import_react11.default.useState(null);
  const [mobileDetail, setMobileDetail] = import_react11.default.useState(false);
  const [search, setSearch] = import_react11.default.useState("");
  const closeDrawer = async () => {
    if (await autoSave.flush()) setDrawer(null);
  };
  const selectChat = (chat, sessionId2 = null) => run("select-chat", async () => {
    if (!await autoSave.flush()) return;
    setSelectedId(chat.chatId);
    setHistoricalWorker(sessionId2 ? { chatId: chat.chatId, sessionId: sessionId2 } : null);
    setMobileDetail(true);
    setDrawer(null);
  });
  const [chatFilter, setChatFilter] = import_react11.default.useState("");
  const [keywordDrafts, setKeywordDrafts] = import_react11.default.useState(() => /* @__PURE__ */ new Map());
  const writeSeqRef = import_react11.default.useRef(0);
  const acceptMonitor = (seq, value) => {
    if (value && seq === writeSeqRef.current) setMonitor(value);
  };
  const act = (label, operation, onSaved) => run(label, () => {
    const seq = ++writeSeqRef.current;
    invalidate();
    return Promise.resolve(operation()).then((value) => ({ seq, value }));
  }, ({ seq, value }) => {
    acceptMonitor(seq, value);
    onSaved?.(value);
  });
  const add = (chat) => act(`add:${chat.chatId}`, () => call(API.userMonitorAdd, chat));
  const remove = async (chat) => {
    autoSave.cancel(`keywords:${chat.chatId}`);
    if (!await autoSave.flush()) return;
    autoSave.cancel(`keywords:${chat.chatId}`);
    return act(`remove:${chat.chatId}`, () => call(API.userMonitorRemove, { chatId: chat.chatId }), () => {
      setDrawer(null);
      setHistoricalWorker(null);
    });
  };
  const setChat = (chat, patch) => {
    if (patch.mode && patch.mode !== "keyword") {
      autoSave.cancel(`keywords:${chat.chatId}`);
      setKeywordDrafts((previous) => {
        if (!previous.has(chat.chatId)) return previous;
        const next = new Map(previous);
        next.delete(chat.chatId);
        return next;
      });
    }
    return act(`mode:${chat.chatId}`, () => call(API.userMonitorChatSet, { chatId: chat.chatId, ...patch }));
  };
  const scheduleSetting = (key, method, payload, delay = 600, onSaved) => {
    const seq = ++writeSeqRef.current;
    autoSave.schedule(key, () => {
      invalidate();
      return call(method, payload);
    }, delay, (value) => {
      acceptMonitor(seq, value);
      onSaved?.(value);
    });
  };
  const toggle = () => act("toggle", () => call(API.userMonitorEnable, { enabled: monitor?.enabled !== true }));
  const toggleDirect = () => act("toggle-direct", () => call(API.userMonitorDirectEnable, { enabled: !directEnabled }));
  const poll = () => act("poll", () => call(API.userMonitorPoll, {}));
  const flushPending = () => act("flush", () => call(API.userMonitorFlush, {}));
  const flushChat = (chatId) => act(`flush:${chatId}`, () => call(API.userMonitorFlush, { chatId }));
  const discover = () => act("chats", async () => {
    const value = await call(API.userMonitorChats, {});
    setAvailable(Array.isArray(value?.chats) ? value.chats.filter((chat) => chat.chatMode === "group") : []);
    return null;
  });
  const openPicker = () => {
    setDrawer("add");
    if (!available) void discover();
  };
  const chats = (Array.isArray(monitor?.chats) ? monitor.chats : []).filter((chat) => directEnabled || chat.chatMode !== "p2p");
  const groupChats = chats.filter((chat) => chat.chatMode === "group");
  const directChats = chats.filter((chat) => chat.chatMode === "p2p");
  const monitored = new Set(groupChats.map((chat) => chat.chatId));
  const candidates = (available ?? []).filter((chat) => !monitored.has(chat.chatId));
  const pendingTotal = chats.reduce((sum, chat) => sum + (chat.pendingBatch || 0), 0);
  const formatTime = (ms) => Number.isFinite(ms) && ms > 0 ? new Date(ms).toLocaleTimeString() : "\u2014";
  const lastPollAt = chats.reduce((latest, chat) => Math.max(latest, Number(chat.lastPollAt) || 0), 0);
  const control = { ...S.input, height: "36px" };
  const shortId = (id = "") => id.length > 22 ? `${id.slice(0, 10)}\u2026${id.slice(-6)}` : id;
  const field = (label, props, options) => h10(
    "label",
    { className: "bxf-identity-field" },
    h10("span", null, label),
    h10("select", { "aria-label": label, ...props, style: control, className: "bxf-identity-control" }, options)
  );
  const chatSettings = (chat) => {
    const mode = chat.mode ?? "mention";
    return h10(
      "div",
      { key: chat.chatId, className: "bxf-avatar-chat-settings" },
      h10("strong", null, chat.name || chat.chatId),
      h10("code", { className: "bxf-work-meta" }, chat.chatId),
      h10(
        "div",
        { className: "bxf-identity-chat-controls" },
        field(t("\u89E6\u53D1\u89C4\u5219", "Trigger"), {
          value: mode,
          disabled: busy === `mode:${chat.chatId}`,
          onChange: (event) => void setChat(chat, { mode: event.target.value })
        }, [
          h10("option", { key: "all", value: "all" }, t("\u5168\u90E8\u6D88\u606F", "All messages")),
          h10("option", { key: "mention", value: "mention" }, t("\u4EC5 @ \u4E0E\u56DE\u590D", "Mentions & replies")),
          h10("option", { key: "keyword", value: "keyword" }, t("\u5173\u952E\u8BCD", "Keywords"))
        ]),
        field(t("\u56DE\u590D\u5BF9\u8C61", "Reply to"), {
          value: chat.replyToBots ? "bots" : "human",
          disabled: busy === `mode:${chat.chatId}`,
          onChange: (event) => void setChat(chat, { replyToBots: event.target.value === "bots" })
        }, [
          h10("option", { key: "human", value: "human" }, t("\u4EC5\u771F\u4EBA", "People only")),
          h10("option", { key: "bots", value: "bots" }, t("\u5305\u542B\u673A\u5668\u4EBA", "People & bots"))
        ])
      ),
      h10("button", {
        type: "button",
        className: "bxf-mini bxf-danger bxf-identity-remove",
        disabled: busy === `remove:${chat.chatId}`,
        onClick: () => void remove(chat),
        "aria-label": `${t("\u79FB\u9664", "Remove")} ${chat.name || chat.chatId}`
      }, t("\u79FB\u9664", "Remove")),
      mode === "keyword" ? h10(
        "label",
        { className: "bxf-identity-field bxf-identity-chat-extra" },
        h10("span", null, t("\u5339\u914D\u5173\u952E\u8BCD", "Match keywords")),
        h10("input", {
          ...autoSave.compositionHandlers,
          style: control,
          className: "bxf-identity-control",
          value: keywordDrafts.has(chat.chatId) ? keywordDrafts.get(chat.chatId) : (chat.keywords ?? []).join("\uFF0C"),
          placeholder: t("\u5173\u952E\u8BCD\uFF0C\u9017\u53F7\u5206\u9694", "Keywords, comma separated"),
          onChange: (event) => {
            const text2 = event.target.value;
            setKeywordDrafts((previous) => new Map(previous).set(chat.chatId, text2));
            const keywords = text2.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
            scheduleSetting(`keywords:${chat.chatId}`, API.userMonitorChatSet, { chatId: chat.chatId, keywords }, 600, () => {
              setKeywordDrafts((previous) => {
                if (previous.get(chat.chatId) !== text2) return previous;
                const next = new Map(previous);
                next.delete(chat.chatId);
                return next;
              });
            });
          },
          onBlur: () => void autoSave.flush()
        })
      ) : null
    );
  };
  const keyword = chatFilter.trim().toLowerCase();
  const filtered = keyword ? (available ?? []).filter((chat) => `${chat.name || ""} ${chat.chatId}`.toLowerCase().includes(keyword)) : candidates;
  const pickerSection = drawer === "add" ? h10(
    "div",
    { className: "bxf-identity-picker" },
    h10("input", {
      style: control,
      className: "bxf-identity-control",
      value: chatFilter,
      autoFocus: true,
      "aria-label": t("\u641C\u7D22\u7FA4\u804A", "Search group chats"),
      placeholder: t("\u641C\u7D22\u7FA4\u540D\u6216 ID", "Search group name or ID"),
      onChange: (event) => setChatFilter(event.target.value)
    }),
    available === null ? h10("p", { className: "bxf-identity-hint", role: "status" }, busy === "chats" ? t("\u6B63\u5728\u8BFB\u53D6\u7FA4\u804A\u5217\u8868\u2026", "Loading group chats\u2026") : t("\u7FA4\u804A\u5217\u8868\u5C1A\u672A\u52A0\u8F7D\uFF0C\u53EF\u91CD\u8BD5\u3002", "Group chats could not be loaded. Retry to load them.")) : filtered.length === 0 ? h10("p", { className: "bxf-identity-hint" }, keyword ? t("\u6CA1\u6709\u627E\u5230\u5339\u914D\u7684\u7FA4\u804A\uFF0C\u8BD5\u8BD5\u5176\u4ED6\u5173\u952E\u8BCD\u3002", "No matching group chats. Try another keyword.") : available.length ? t("\u6240\u6709\u53EF\u7528\u7FA4\u804A\u90FD\u5DF2\u6DFB\u52A0\u3002", "All available group chats have been added.") : t("\u6682\u65E0\u53EF\u6DFB\u52A0\u7684\u7FA4\u804A\u3002", "No group chats are available.")) : h10("div", { className: "bxf-identity-picker-list" }, filtered.map((chat) => {
      const added = monitored.has(chat.chatId);
      return h10(
        "div",
        { key: chat.chatId, className: "bxf-identity-candidate" },
        h10(
          "div",
          { className: "bxf-identity-candidate-info" },
          h10("strong", { title: chat.name || chat.chatId }, chat.name || chat.chatId),
          h10("span", { className: "bxf-identity-chat-meta", title: chat.chatId }, shortId(chat.chatId))
        ),
        h10("button", {
          type: "button",
          className: "bxf-mini",
          disabled: added || busy === `add:${chat.chatId}`,
          onClick: () => void add(chat)
        }, added ? t("\u5DF2\u6DFB\u52A0", "Added") : busy === `add:${chat.chatId}` ? t("\u6DFB\u52A0\u4E2D\u2026", "Adding\u2026") : t("\u6DFB\u52A0", "Add"))
      );
    }))
  ) : null;
  const selectedChat = chats.find((chat) => chat.chatId === selectedId);
  const selected = selectedChat ?? chats[0];
  import_react11.default.useEffect(() => {
    if (!monitor || !selectedId || selectedChat) return;
    setSelectedId(null);
    setHistoricalWorker(null);
    setMobileDetail(false);
    setDrawer((value) => value === "add" ? value : null);
  }, [monitor, selectedId, selectedChat]);
  const openDetails = (kind2) => {
    setSelectedId(selected.chatId);
    setDrawer(kind2);
  };
  const sessionId = historicalWorker && historicalWorker.chatId === selected?.chatId ? historicalWorker.sessionId : selected?.sessionId;
  const needle = search.trim().toLowerCase();
  const watching = monitor?.enabled && monitor.authorization?.authorized;
  const status = !monitor?.enabled ? t("\u5DF2\u6682\u505C", "Paused") : !monitor.authorization?.authorized ? t("\u7B49\u5F85\u6388\u6743", "Awaiting authorization") : t("\u76D1\u542C\u4E2D", "Watching");
  const titles = { chat: t("\u76D1\u542C\u8BBE\u7F6E", "Monitoring settings"), messages: t("\u6D88\u606F\u8BE6\u60C5", "Message details"), add: t("\u6DFB\u52A0\u7FA4\u804A", "Add group chat") };
  const discardChanges = () => {
    autoSave.discard();
    setKeywordDrafts(/* @__PURE__ */ new Map());
  };
  const saveStatus = h10(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry, onDiscard: discardChanges });
  const chatRows = (items, empty) => {
    const visible = items.filter((chat) => `${chat.name || ""} ${chat.chatId}`.toLowerCase().includes(needle));
    if (!visible.length) {
      const message = items.length && needle ? t("\u6CA1\u6709\u5339\u914D\u7684\u4F1A\u8BDD", "No matching chats") : empty;
      return message ? h10("p", { className: "bxf-avatar-section-empty" }, message) : null;
    }
    return visible.map((chat) => h10(
      "button",
      {
        key: chat.chatId,
        type: "button",
        className: "bxf-avatar-chat-row",
        "aria-label": `${t("\u67E5\u770B\u4F1A\u8BDD", "View chat")} ${chat.name || chat.chatId}`,
        "aria-pressed": selected?.chatId === chat.chatId,
        disabled: busy === "select-chat",
        onClick: () => void selectChat(chat)
      },
      h10(
        "span",
        { className: "bxf-avatar-chat-top" },
        h10("strong", null, chat.name || chat.chatId),
        chat.pendingBatch > 0 && h10("span", { className: "bxf-avatar-count" }, chat.pendingBatch)
      ),
      h10("span", { className: "bxf-work-meta" }, chat.dispatching ? t("\u6D3E\u53D1\u4E2D", "Dispatching") : chat.lastError ? t("\u6D3E\u53D1\u5F02\u5E38", "Dispatch error") : chat.sessionId ? t("Worker \u5DF2\u5C31\u7EEA", "Worker ready") : t("\u7B49\u5F85\u9996\u6B21\u6D3E\u53D1", "Awaiting first dispatch"))
    ));
  };
  const showChatDrawer = Boolean(selectedChat && (drawer === "messages" || drawer === "chat" && selectedChat.chatMode === "group"));
  return h10(
    "div",
    { className: "bxf-avatar-workspace" },
    error && !drawer && h10(
      "div",
      { className: "bxf-work-alert", role: "alert" },
      error,
      loadError && h10("button", { type: "button", className: "bxf-mini", onClick: () => void load() }, t("\u91CD\u8BD5", "Retry"))
    ),
    !drawer && autoSave.state.status === "error" && saveStatus,
    h10(
      "div",
      { className: "bxf-avatar-split", "data-detail": mobileDetail && selected ? "true" : "false" },
      h10(
        "aside",
        { className: "bxf-avatar-rail", "aria-label": t("\u76D1\u542C\u4F1A\u8BDD", "Monitored chats") },
        h10(
          "div",
          { className: "bxf-avatar-rail-head" },
          h10(
            "div",
            { className: "bxf-work-heading" },
            h10("strong", null, `${t("\u76D1\u542C\u4F1A\u8BDD", "Monitored chats")} \xB7 ${chats.length}`),
            monitor && h10("span", { style: S.badge(watching ? "ok" : "muted") }, status)
          ),
          h10(
            "div",
            { className: "bxf-avatar-rail-actions" },
            h10("button", { type: "button", className: "bxf-mini", disabled: !monitor || Boolean(busy), onClick: () => void toggle() }, monitor?.enabled ? t("\u505C\u6B62\u76D1\u542C", "Stop monitoring") : t("\u5F00\u59CB\u76D1\u542C", "Start monitoring")),
            h10("button", { type: "button", className: "bxf-mini", disabled: !monitor?.enabled || Boolean(busy), onClick: () => void poll() }, busy === "poll" ? t("\u68C0\u67E5\u4E2D\u2026", "Checking\u2026") : t("\u7ACB\u5373\u68C0\u67E5", "Check now")),
            h10("button", { type: "button", className: "bxf-mini", disabled: !monitor, onClick: openPicker }, t("\u6DFB\u52A0\u7FA4\u804A", "Add group chat"))
          ),
          h10("button", {
            type: "button",
            className: "bxf-avatar-direct-toggle",
            role: "switch",
            "aria-checked": directEnabled,
            disabled: !monitor || Boolean(busy),
            onClick: () => void toggleDirect()
          }, t("\u76D1\u542C\u6240\u6709\u79C1\u804A", "Monitor all direct chats")),
          h10("input", { style: control, value: search, "aria-label": t("\u641C\u7D22\u76D1\u542C\u4F1A\u8BDD", "Search monitored chats"), placeholder: t("\u641C\u7D22\u4F1A\u8BDD", "Search chats"), onChange: (event) => setSearch(event.target.value) })
        ),
        h10(
          "nav",
          { className: "bxf-avatar-chat-list", "aria-label": t("\u76D1\u542C\u4F1A\u8BDD\u5217\u8868", "Monitored chat list") },
          !monitor ? h10("div", { className: "bxf-work-empty", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")) : h10(
            import_react11.default.Fragment,
            null,
            h10(
              "section",
              { className: "bxf-avatar-chat-section", "aria-label": t("\u7FA4\u804A", "Group chats") },
              h10("h3", null, `${t("\u7FA4\u804A", "Group chats")} \xB7 ${groupChats.length}`),
              chatRows(groupChats, t("\u8FD8\u6CA1\u6709\u6DFB\u52A0\u7FA4\u804A\u3002", "No groups added yet."))
            ),
            h10(
              "section",
              { className: "bxf-avatar-chat-section", "aria-label": t("\u79C1\u804A", "Direct chats") },
              h10("h3", null, `${t("\u79C1\u804A", "Direct chats")} \xB7 ${directChats.length}`),
              directEnabled && monitor.directError && h10("p", { className: "bxf-avatar-section-empty bxf-avatar-section-error", role: "alert" }, monitor.directError),
              directEnabled && chatRows(directChats, monitor.directError ? null : !monitor.enabled ? t("\u542F\u52A8\u76D1\u542C\u540E\u5C06\u81EA\u52A8\u53D1\u73B0\u79C1\u804A\u3002", "Direct chats will be discovered when monitoring starts.") : !watching ? t("\u6388\u6743\u540E\u5C06\u81EA\u52A8\u53D1\u73B0\u79C1\u804A\u3002", "Direct chats will be discovered after authorization.") : t("\u7B49\u5F85\u81EA\u52A8\u53D1\u73B0\u79C1\u804A\u3002", "Waiting to discover direct chats."))
            )
          )
        ),
        h10(
          "footer",
          { className: "bxf-avatar-rail-footer" },
          h10("span", { className: "bxf-work-meta" }, `${t("\u6700\u8FD1\u68C0\u67E5", "Last checked")} ${formatTime(lastPollAt)}`),
          pendingTotal > 0 && h10("button", { type: "button", className: "bxf-mini", disabled: !monitor?.enabled || Boolean(busy), onClick: () => void flushPending() }, t("\u91CD\u8BD5\u6D3E\u53D1", "Retry dispatch"))
        )
      ),
      h10("main", { className: "bxf-avatar-conversation" }, selected ? h10(WorkerConversationPanel, {
        worker: { ...selected, sessionId },
        currentSessionId: selected.sessionId,
        workerView,
        onOpenSession,
        onBack: () => setMobileDetail(false),
        onCurrent: () => void selectChat(selected),
        actions: h10(
          import_react11.default.Fragment,
          null,
          h10("button", { type: "button", className: "bxf-mini", onClick: () => openDetails("messages") }, t("\u67E5\u770B\u6D88\u606F", "View messages")),
          selected.chatMode === "group" && h10("button", { type: "button", className: "bxf-mini", onClick: () => openDetails("chat") }, t("\u76D1\u542C\u8BBE\u7F6E", "Monitoring settings"))
        )
      }) : h10("div", { className: "bxf-work-empty" }, t("\u6DFB\u52A0\u7FA4\u804A\u6216\u5F00\u542F\u79C1\u804A\u76D1\u542C", "Add a group or enable direct chat monitoring")))
    ),
    h10(
      Drawer,
      { open: (drawer === "add" || showChatDrawer) && active, title: titles[drawer] || "", onClose: closeDrawer },
      error && h10("div", { className: "bxf-work-alert", role: "alert" }, error),
      saveStatus,
      drawer === "chat" && showChatDrawer && chatSettings(selected),
      drawer === "messages" && showChatDrawer && h10(
        import_react11.default.Fragment,
        null,
        h10("h3", null, selected.name || selected.chatId),
        h10(
          "div",
          { className: "bxf-avatar-delivery" },
          h10("span", { className: "bxf-work-meta", title: t("\u5DF2\u6295\u9012\u7ED9 Worker\uFF0C\u4E0D\u4EE3\u8868\u5DF2\u56DE\u590D", "Delivered to the Worker; not a reply receipt") }, `${t("\u6700\u8FD1\u6295\u9012", "Last delivered")} ${formatTime(selected.lastDispatchAt)}`),
          selected.dispatching ? h10("span", null, t("\u6D3E\u53D1\u4E2D\u2026", "Dispatching\u2026")) : selected.scheduledAt ? h10("span", { className: "bxf-work-meta" }, `${t("\u8BA1\u5212\u6D3E\u53D1", "Scheduled dispatch")} ${formatTime(selected.scheduledAt)}`) : null,
          selected.pendingBatch > 0 && h10("button", { type: "button", className: "bxf-mini", disabled: !monitor.enabled || Boolean(busy) || selected.dispatching, onClick: () => void flushChat(selected.chatId) }, t("\u6D3E\u53D1\u672C\u6279", "Dispatch batch"))
        ),
        selected.lastError && h10("div", { className: "bxf-work-alert", role: "alert" }, selected.lastError),
        h10(MonitorDetail, { key: selected.chatId, connection, botId, chatId: selected.chatId, active: active && drawer === "messages", onViewWorker: (id) => selectChat(selected, id) })
      ),
      drawer === "add" && h10(
        import_react11.default.Fragment,
        null,
        pickerSection,
        busy !== "chats" && h10(
          "button",
          { type: "button", className: "bxf-mini", onClick: () => void discover() },
          available === null ? t("\u91CD\u8BD5", "Retry") : t("\u5237\u65B0\u5217\u8868", "Refresh list")
        )
      )
    )
  );
}

// client/avatar-reply-settings.js
var import_react12 = __toESM(require("react"), 1);
var h11 = import_react12.default.createElement;
function AvatarReplySettings({ connection, botId, query, registerSave }) {
  const { data: monitor, error: loadError, accept: setMonitor, refresh: load, invalidate } = query;
  const call = (method, payload = {}) => rpc(connection, method, { ...payload, botId });
  const { busy, error: actionError, run } = useMutation();
  const [optionsError, setOptionsError] = import_react12.default.useState(null);
  const [optionsRetry, setOptionsRetry] = import_react12.default.useState(0);
  const error = actionError || loadError || optionsError;
  const autoSave = useAutoSave();
  import_react12.default.useEffect(() => registerSave(`avatar-reply:${botId}`, autoSave.flush), [registerSave, botId, autoSave.flush]);
  const [handoffText, setHandoffText, commitHandoff] = useDraft((monitor?.handoffKeywords ?? []).join("\uFF0C"));
  const [replyRules, setReplyRules, commitReplyRules] = useDraft(monitor?.replyRules ?? "");
  const [workerOptions, setWorkerOptions] = import_react12.default.useState({ workspaces: [], presets: [], permissionOptions: [], defaultWorkspaceId: null });
  const writeSeqRef = import_react12.default.useRef(0);
  const acceptMonitor = (seq, value) => {
    if (value && seq === writeSeqRef.current) setMonitor(value);
  };
  import_react12.default.useEffect(() => {
    let alive = true;
    setOptionsError(null);
    void call(API.userMonitorWorkerOptions, {}).then((value) => {
      if (!alive) return;
      setWorkerOptions({
        workspaces: Array.isArray(value?.workspaces) ? value.workspaces : [],
        presets: Array.isArray(value?.presets) ? value.presets : [],
        permissionOptions: Array.isArray(value?.permissionOptions) ? value.permissionOptions : [],
        defaultWorkspaceId: typeof value?.defaultWorkspaceId === "string" ? value.defaultWorkspaceId : null
      });
    }).catch((failure) => {
      if (alive) setOptionsError(failure.message);
    });
    return () => {
      alive = false;
    };
  }, [connection, botId, optionsRetry]);
  const setWorker = (patch) => run("worker", () => {
    const seq = ++writeSeqRef.current;
    invalidate();
    return call(API.userMonitorWorkerSet, patch).then((value) => ({ seq, value }));
  }, ({ seq, value }) => acceptMonitor(seq, value));
  const scheduleSetting = (key, method, payload, delay = 600, onSaved) => {
    const seq = ++writeSeqRef.current;
    autoSave.schedule(key, () => {
      invalidate();
      return call(method, payload);
    }, delay, (value) => {
      acceptMonitor(seq, value);
      onSaved?.(value);
    });
  };
  const updateHandoff = (text2) => {
    setHandoffText(text2);
    const keywords = text2.split(/[,，\n]/).map((item) => item.trim()).filter(Boolean);
    scheduleSetting(
      "handoff",
      API.userMonitorHandoffSet,
      { keywords },
      600,
      (value) => commitHandoff((value.handoffKeywords ?? keywords).join("\uFF0C"), text2)
    );
  };
  const updateReplyRules = (text2, delay = 600) => {
    setReplyRules(text2);
    scheduleSetting(
      "reply-rules",
      API.userMonitorReplyRulesSet,
      { rules: text2 },
      delay,
      (value) => commitReplyRules(value.replyRules, text2)
    );
  };
  const defaultWorkspaceId = workerOptions.defaultWorkspaceId ?? null;
  const workspaces = [...workerOptions.workspaces].sort((left, right) => {
    if (left.id === defaultWorkspaceId) return -1;
    if (right.id === defaultWorkspaceId) return 1;
    return 0;
  });
  const currentWorkspaceId = monitor?.worker?.workspaceId || defaultWorkspaceId || "";
  const currentPreset = monitor?.worker?.preset || "";
  const currentPermissionPreset = monitor?.worker?.permissionPreset || "";
  const control = { ...S.input, height: "36px" };
  const field = (label, props, options) => h11(
    "label",
    { className: "bxf-identity-field" },
    h11("span", null, label),
    h11("select", { "aria-label": label, ...props, style: control, className: "bxf-identity-control" }, options)
  );
  const settings = monitor ? h11(
    "div",
    { className: "bxf-identity-settings bxf-reply-settings-grid" },
    h11(
      "div",
      { className: "bxf-reply-options" },
      h11(
        "div",
        { className: "bxf-identity-setting" },
        h11(
          "label",
          { className: "bxf-identity-field" },
          h11("strong", { className: "bxf-identity-setting-title" }, t("\u8F6C\u4EBA\u5DE5\u5173\u952E\u8BCD", "Handoff keywords")),
          h11("input", {
            ...autoSave.compositionHandlers,
            style: control,
            className: "bxf-identity-control",
            value: handoffText,
            placeholder: t("\u8F6C\u4EBA\u5DE5\uFF0C\u4EBA\u5DE5\u5BA2\u670D", "human, agent"),
            onChange: (event) => updateHandoff(event.target.value),
            onBlur: () => void autoSave.flush(),
            onKeyDown: (event) => {
              if (event.key === "Enter" && !event.nativeEvent?.isComposing) void autoSave.flush();
            }
          })
        ),
        h11("p", { className: "bxf-identity-hint" }, t("\u7528\u9017\u53F7\u5206\u9694\u3002\u547D\u4E2D\u65F6\u8DF3\u8FC7\u5F53\u524D\u56DE\u590D\uFF0C\u4EA4\u7531\u4EBA\u5DE5\u5904\u7406\u3002", "Separate with commas. Matching messages are left for a person."))
      ),
      h11(
        "div",
        { className: "bxf-identity-setting" },
        h11("p", { className: "bxf-identity-setting-title" }, t("\u5904\u7406\u4F1A\u8BDD", "Reply session")),
        h11(
          "div",
          { className: "bxf-identity-worker" },
          field(t("\u5206\u7EC4", "Group"), {
            value: currentWorkspaceId,
            disabled: busy === "worker",
            title: workspaces.find((item) => item.id === currentWorkspaceId)?.path || "",
            onChange: (event) => void setWorker({ workspaceId: event.target.value, workspacePath: "" })
          }, [
            currentWorkspaceId && !workspaces.some((item) => item.id === currentWorkspaceId) ? h11("option", { key: currentWorkspaceId, value: currentWorkspaceId }, `${currentWorkspaceId}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
            ...workspaces.map((item) => h11(
              "option",
              { key: item.id, value: item.id, title: item.path || "" },
              `${item.title || item.path?.split("/").filter(Boolean).at(-1) || item.id}${item.id === defaultWorkspaceId ? t("\uFF08\u9ED8\u8BA4\uFF09", " (default)") : ""}`
            ))
          ]),
          field(t("\u9884\u8BBE", "Preset"), { value: currentPreset, disabled: busy === "worker", onChange: (event) => void setWorker({ preset: event.target.value }) }, [
            h11("option", { key: "", value: "" }, t("\u9ED8\u8BA4", "Default")),
            currentPreset && !workerOptions.presets.some((item) => item.id === currentPreset) ? h11("option", { key: currentPreset, value: currentPreset }, `${currentPreset}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
            ...workerOptions.presets.map((item) => h11("option", { key: item.id, value: item.id }, item.name || item.id))
          ]),
          field(t("\u65B0\u4F1A\u8BDD\u6743\u9650\u6863\u4F4D", "New-session permission"), {
            value: currentPermissionPreset,
            disabled: busy === "worker",
            onChange: (event) => void setWorker({ permissionPreset: event.target.value })
          }, [
            h11("option", { key: "", value: "" }, t("\u8DDF\u968F Host \u9ED8\u8BA4", "Host default")),
            currentPermissionPreset && !workerOptions.permissionOptions.some((item) => item.value === currentPermissionPreset) ? h11("option", { key: currentPermissionPreset, value: currentPermissionPreset }, `${currentPermissionPreset}${t("\uFF08\u5F53\u524D\uFF09", " (current)")}`) : null,
            ...workerOptions.permissionOptions.map((item) => h11("option", { key: item.value, value: item.value }, item.name || item.value))
          ])
        ),
        h11("p", { className: "bxf-identity-hint" }, t("\u66F4\u6539\u540E\uFF0C\u5C06\u5728\u4E0B\u6B21\u81EA\u52A8\u56DE\u590D\u65F6\u521B\u5EFA\u65B0\u4F1A\u8BDD\u3002", "Changes create a new session on the next automatic reply."))
      )
    ),
    h11(
      "div",
      { className: "bxf-identity-setting bxf-reply-rules-setting" },
      h11(
        "div",
        { className: "bxf-identity-section-head" },
        h11("h3", { className: "bxf-identity-setting-title" }, t("\u5206\u8EAB\u56DE\u590D\u89C4\u5219", "Avatar reply rules")),
        h11("button", {
          type: "button",
          className: "bxf-mini",
          onClick: () => updateReplyRules(monitor.defaultReplyRules ?? "", 0)
        }, t("\u6062\u590D\u9ED8\u8BA4\u6A21\u677F", "Restore default template"))
      ),
      h11("textarea", {
        ...autoSave.compositionHandlers,
        style: { ...S.area, minHeight: "280px", padding: "12px 14px", fontSize: "13px" },
        className: "bxf-identity-rules",
        rows: 12,
        "aria-label": t("\u5206\u8EAB\u56DE\u590D\u89C4\u5219", "Avatar reply rules"),
        value: replyRules,
        onChange: (event) => updateReplyRules(event.target.value),
        spellCheck: false,
        onBlur: () => void autoSave.flush()
      })
    )
  ) : null;
  return h11(
    import_react12.default.Fragment,
    null,
    error && h11(
      "div",
      { className: "bxf-work-alert", role: "alert" },
      error,
      (loadError || optionsError) && h11("button", { type: "button", className: "bxf-mini", onClick: () => {
        if (loadError) void load();
        if (optionsError) setOptionsRetry((value) => value + 1);
      } }, t("\u91CD\u8BD5", "Retry"))
    ),
    !monitor && !loadError && h11("p", { className: "bxf-work-meta", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")),
    settings,
    h11(SaveStatus, { state: autoSave.state, onRetry: autoSave.retry, onDiscard: autoSave.discard })
  );
}

// client/status-settings.js
var import_react13 = __toESM(require("react"), 1);
var h12 = import_react13.default.createElement;
function StatusSettings({ visible, title, children }) {
  const [visited, setVisited] = import_react13.default.useState(visible);
  import_react13.default.useEffect(() => {
    if (visible) setVisited(true);
  }, [visible]);
  if (!visible && !visited) return null;
  return h12(
    "section",
    { className: "bxf-status-settings", hidden: !visible, "aria-label": title },
    h12("h3", null, title),
    children
  );
}

// client/identity.js
var h13 = import_react14.default.createElement;
function IdentityStatus({ connection, bot, bots, active, query, monitorQuery, settingsVisible, registerSave, beforeDisconnect }) {
  const { data: status, error: queryError } = query;
  const [notice, setNotice] = import_react14.default.useState(null);
  const { busy, error: actionError, run } = useMutation();
  const ownerId = status?.config?.app?.botId;
  const currentBot = ownerId === bot.id;
  const authorized = currentBot && status?.authorization?.authorized;
  const pending = currentBot && status?.connect?.phase === "pending";
  const owner = bots.find((item) => item.id === ownerId);
  const auth = authorized ? status.authorization : null;
  const expired = auth?.refreshTokenExpiresAt > 0 && auth.refreshTokenExpiresAt <= Date.now();
  const incomplete = auth?.scopeSatisfied === false;
  const name = auth?.user?.name || t("\u98DE\u4E66\u5206\u8EAB", "Feishu avatar");
  const state = pending ? t("\u7B49\u5F85\u626B\u7801", "Awaiting scan") : expired ? t("\u9700\u91CD\u65B0\u6388\u6743", "Re-authorization required") : incomplete ? t("\u6388\u6743\u4E0D\u5B8C\u6574", "Incomplete authorization") : authorized ? t("\u5DF2\u8FDE\u63A5", "Connected") : t("\u672A\u8FDE\u63A5", "Disconnected");
  const error = actionError || queryError || currentBot && status?.connect?.error;
  const update = (label, method, success) => run(label, async () => {
    setNotice(null);
    query.invalidate();
    const result = await rpc(connection, method, { botId: bot.id });
    if (method === API.userConnectBegin) {
      query.invalidate();
      await query.refresh();
    } else query.accept(result);
  }, () => setNotice(success || null));
  const disconnect = () => run("disconnect", async () => {
    if (!await beforeDisconnect()) return;
    if (!window.confirm(t(`\u65AD\u5F00\u300C${name}\u300D\u7684\u5206\u8EAB\u6388\u6743\uFF1F\u5C06\u6E05\u9664\u672C\u5730\u51ED\u8BC1\uFF0C\u4FDD\u7559\u76D1\u542C\u914D\u7F6E\u548C Worker \u4F1A\u8BDD\u3002`, `Disconnect ${name}? Local credentials are cleared; monitoring settings and Worker sessions are kept.`))) return;
    setNotice(null);
    query.invalidate();
    const result = await rpc(connection, API.userDisconnect, { botId: bot.id });
    query.accept(result);
    setNotice(t("\u5DF2\u65AD\u5F00\u6388\u6743", "Disconnected"));
  });
  const action = (id, hint, onClick, label, disabled = Boolean(busy)) => h13(ActionButton, {
    active,
    hintId: `bxf-${bot.id}-avatar-${id}-tip`,
    hint,
    disabled,
    onClick
  }, label);
  return h13(
    "section",
    { className: "bxf-status-block bxf-status-avatar", "aria-label": t("\u5206\u8EAB\u72B6\u6001", "Avatar status") },
    h13(
      "header",
      { className: "bxf-status-summary bxf-work-heading" },
      h13(
        "div",
        { className: "bxf-status-identity-title" },
        h13("h2", null, name),
        authorized && auth.user?.name && h13("span", { className: "bxf-work-meta" }, t("\u98DE\u4E66\u5206\u8EAB", "Feishu avatar")),
        status && h13("span", { style: S.badge(expired || incomplete || pending ? "warn" : authorized ? "ok" : "muted") }, state)
      ),
      h13(
        "div",
        { className: "bxf-bot-actions" },
        pending ? action(
          "cancel",
          t("\u53D6\u6D88\u5F53\u524D\u626B\u7801\u6388\u6743\u8BF7\u6C42\uFF0C\u4FDD\u7559\u5DF2\u6709\u6388\u6743\u3002", "Cancel this authorization request and keep the existing grant."),
          () => update("cancel", API.userConnectCancel),
          busy === "cancel" ? t("\u53D6\u6D88\u4E2D\u2026", "Cancelling\u2026") : t("\u53D6\u6D88\u626B\u7801", "Cancel scan")
        ) : action(
          "connect",
          t("\u626B\u7801\u6388\u6743\u5F53\u524D\u5206\u8EAB\uFF0C\u4EE5\u672C\u4EBA\u8EAB\u4EFD\u8BBF\u95EE\u98DE\u4E66\u3002", "Authorize this avatar by scanning to access Feishu as yourself."),
          () => update("connect", API.userConnectBegin),
          busy === "connect" ? t("\u6B63\u5728\u53D1\u8D77\u2026", "Starting\u2026") : authorized ? t("\u91CD\u65B0\u6388\u6743", "Re-authorize") : t("\u8FDE\u63A5\u5206\u8EAB", "Connect avatar"),
          !status || Boolean(busy)
        ),
        authorized && action(
          "refresh",
          t("\u4F7F\u7528\u5237\u65B0\u51ED\u8BC1\u66F4\u65B0\u8BBF\u95EE\u51ED\u8BC1\uFF1B\u6388\u6743\u5230\u671F\u540E\u9700\u8981\u91CD\u65B0\u626B\u7801\u3002", "Use the refresh token to renew access. Re-authorize if the grant has expired."),
          () => update("refresh", API.userRefresh, t("\u51ED\u8BC1\u5DF2\u5237\u65B0", "Credentials refreshed")),
          busy === "refresh" ? t("\u5237\u65B0\u4E2D\u2026", "Refreshing\u2026") : t("\u5237\u65B0\u51ED\u8BC1", "Refresh credentials"),
          Boolean(busy) || pending
        ),
        authorized && h13(ActionMenu, {
          active,
          disabled: Boolean(busy) || pending,
          label: t("\u5206\u8EAB\u66F4\u591A\u64CD\u4F5C", "More avatar actions"),
          renderActions: (close) => h13(ActionButton, {
            active,
            disabled: Boolean(busy) || pending,
            hintId: `bxf-${bot.id}-avatar-disconnect-tip`,
            hint: t("\u6E05\u9664\u5206\u8EAB\u7684\u672C\u5730\u6388\u6743\u51ED\u8BC1\uFF0C\u4FDD\u7559\u76D1\u542C\u914D\u7F6E\u4E0E Worker \u4F1A\u8BDD\u3002", "Clear local avatar credentials while keeping monitoring settings and Worker sessions."),
            style: { color: "var(--dsw-alias-state-error-primary)" },
            onClick: () => {
              close();
              return disconnect();
            }
          }, t("\u65AD\u5F00\u6388\u6743", "Disconnect"))
        })
      )
    ),
    error && h13(
      "div",
      { className: "bxf-identity-alert", role: "alert" },
      error,
      queryError && h13("button", { type: "button", className: "bxf-mini", onClick: () => void query.refresh() }, t("\u91CD\u8BD5", "Retry"))
    ),
    !error && notice && h13("div", { className: "bxf-identity-notice", role: "status" }, notice),
    incomplete && h13(
      "div",
      { className: "bxf-identity-alert", role: "alert" },
      `${t("\u5F53\u524D\u6388\u6743\u7F3A\u5C11\u6743\u9650\uFF0C\u8BF7\u91CD\u65B0\u6388\u6743\uFF1A", "Authorization is missing scopes; re-authorize: ")}${(auth.missingScopes ?? []).slice(0, 6).join("\u3001")}${auth.missingScopes?.length > 6 ? " \u2026" : ""}`
    ),
    !status ? h13("p", { className: "bxf-work-meta", role: "status" }, queryError ? t("\u8BFB\u53D6\u72B6\u6001\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5\u3002", "Unable to load status. Please retry.") : t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")) : authorized ? h13("dl", { className: "bxf-avatar-credentials" }, [
      ["Open ID", auth.user?.openId],
      [t("\u6388\u6743\u5230\u671F", "Authorization expires"), dateText(auth.refreshTokenExpiresAt)],
      [t("\u8BBF\u95EE\u51ED\u8BC1\u5230\u671F", "Access token expires"), dateText(auth.accessTokenExpiresAt)]
    ].map(([label, value]) => h13("div", { key: label }, h13("dt", null, label), h13("dd", null, value || "\u2014")))) : h13(Facts, { rows: owner && !currentBot ? [[t("\u5F53\u524D\u5206\u8EAB\u5F52\u5C5E", "Current avatar belongs to"), owner.alias || owner.botName || owner.id]] : [] }),
    ownerId && !currentBot && h13("p", { className: "bxf-identity-hint" }, t("\u5F53\u524D\u4EC5\u652F\u6301\u4E00\u4EFD\u5206\u8EAB\u6388\u6743\uFF1B\u8FDE\u63A5\u540E\u4F1A\u5207\u6362\u6388\u6743\u5E94\u7528\uFF0C\u5E76\u6CBF\u7528\u73B0\u6709\u76D1\u542C\u914D\u7F6E\u3002", "Only one avatar authorization is supported. Connecting switches its app and retains existing monitoring settings.")),
    pending && h13(
      "div",
      { className: "bxf-status-auth-scan" },
      h13("p", { className: "bxf-work-meta" }, t("\u626B\u7801\u540E\u5728\u98DE\u4E66\u786E\u8BA4\u3002", "Confirm in Feishu after scanning.")),
      status.connect.qrCodeDataUrl && h13(
        "div",
        { className: "bxf-identity-qr" },
        h13("img", { src: status.connect.qrCodeDataUrl, width: 180, height: 180, alt: t("\u98DE\u4E66\u6388\u6743\u4E8C\u7EF4\u7801", "Feishu authorization QR code") })
      ),
      h13("p", { className: "bxf-work-meta" }, `${t("\u4E8C\u7EF4\u7801\u5230\u671F", "QR code expires")} \xB7 ${dateText(status.connect.expiresAt)}`)
    ),
    h13(
      StatusSettings,
      { visible: settingsVisible, title: t("\u81EA\u52A8\u56DE\u590D\u8BBE\u7F6E", "Auto-reply settings") },
      h13(AvatarReplySettings, { connection, botId: bot.id, query: monitorQuery, registerSave })
    )
  );
}
function IdentityPanel({ connection, bot, active, query, monitorQuery, onStatus, saveRef, onOpenSession, workerView }) {
  const { data: status, error, refresh } = query;
  const currentBot = status?.config?.app?.botId === bot.id;
  return h13(
    "div",
    { className: "bxf-work-identity" },
    error && h13(
      "div",
      { className: "bxf-work-alert", role: "alert" },
      error,
      h13("button", { type: "button", className: "bxf-mini", onClick: () => void refresh() }, t("\u91CD\u8BD5", "Retry"))
    ),
    currentBot ? h13(AvatarWorkspace, { connection, botId: bot.id, query: monitorQuery, saveRef, onOpenSession, workerView, active }) : h13("div", { className: "bxf-work-empty" }, !status ? t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026") : h13(
      import_react14.default.Fragment,
      null,
      h13("p", null, t("\u6B64\u673A\u5668\u4EBA\u5C1A\u672A\u8FDE\u63A5\u5206\u8EAB", "This bot has no connected avatar")),
      h13("button", { type: "button", className: "bxf-mini", onClick: onStatus }, t("\u524D\u5F80\u72B6\u6001\u9875\u8FDE\u63A5", "Connect on the status page"))
    ))
  );
}

// client/bots-panel.js
var import_react15 = __toESM(require("react"), 1);
var h14 = import_react15.default.createElement;
function BotConfiguration({ connection, bot, onChanged, registerSave }) {
  const [catalog, setCatalog] = import_react15.default.useState({ models: [], presets: [], workspaces: [], permissionOptions: [] });
  const [error, setError] = import_react15.default.useState(null);
  const [retry, setRetry] = import_react15.default.useState(0);
  const botId = bot.id;
  import_react15.default.useEffect(() => {
    if (!botId) return;
    let alive = true;
    setError(null);
    void Promise.all([
      rpc(connection, API.modelsList, {}),
      rpc(connection, API.presetsList, { botId }),
      rpc(connection, API.workspacesList, {}),
      rpc(connection, API.permissionList, {})
    ]).then(([models, presets, workspaces, permissions]) => {
      if (!alive) return;
      setCatalog({
        models: (models.groups ?? []).flatMap((group) => (group.models ?? []).map((model2) => ({
          provider: group.id,
          model: model2.id,
          label: `${group.name} \xB7 ${model2.name}`,
          reasoning: model2.reasoning ?? null
        }))),
        presets: presets.presets ?? [],
        workspaces: workspaces.workspaces ?? [],
        permissionOptions: permissions.options ?? []
      });
    }).catch((failure) => {
      if (alive) setError(failure.message);
    });
    return () => {
      alive = false;
    };
  }, [connection, botId, retry]);
  return h14(
    "div",
    { className: "bxf-work-bots" },
    error && h14(
      "div",
      { className: "bxf-work-alert", role: "alert" },
      error,
      h14("button", { type: "button", style: S.btn(), onClick: () => setRetry((value) => value + 1) }, t("\u91CD\u8BD5", "Retry"))
    ),
    h14(BotSettings, { connection, bot, ...catalog, onChanged, registerSave })
  );
}

// client/bot-status.js
var h15 = import_react16.default.createElement;
function BotStatus({ connection, bot, bots, identityQuery, monitorQuery, avatarReady, registerSave, active, beforeRemove, onChanged, onRefresh, refreshing }) {
  const [diagnosis, setDiagnosis] = import_react16.default.useState(null);
  import_react16.default.useEffect(() => {
    if (bot.state === "connected" && diagnosis && !diagnosis.connected) setDiagnosis(null);
  }, [bot.state, diagnosis]);
  const { busy, error, run } = useMutation();
  const diagnose = () => run("diagnose", () => {
    setDiagnosis(null);
    return rpc(connection, API.botCheck, { botId: bot.id });
  }, setDiagnosis);
  const remove = () => run("remove", async () => {
    if (!await beforeRemove()) return;
    const name = bot.alias || bot.botName || bot.id;
    if (!window.confirm(t(`\u5220\u9664\u300C${name}\u300D\uFF1F\u672C\u673A\u5C06\u5220\u9664\u8BE5\u673A\u5668\u4EBA\u7684\u914D\u7F6E\u4E0E\u5BC6\u94A5\uFF0C\u4E0D\u5F71\u54CD\u98DE\u4E66\u5E94\u7528\u672C\u8EAB\u3002`, `Delete ${name}? Local config and secret are deleted; the Feishu app stays.`))) return;
    await rpc(connection, API.botRemove, { botId: bot.id });
    await onChanged();
  });
  const section = (title, rows) => h15(
    "section",
    { className: "bxf-status-section", "aria-label": title },
    h15("h3", null, title),
    h15(Facts, { rows })
  );
  return h15(
    "article",
    { className: "bxf-runtime-status" },
    h15(
      "section",
      { className: "bxf-status-block", "aria-label": t("\u673A\u5668\u4EBA\u72B6\u6001", "Bot status") },
      h15(BotHeader, {
        connection,
        bot,
        onChanged,
        onRefresh,
        refreshing,
        active,
        actions: h15(ActionButton, {
          active,
          hintId: `bxf-${bot.id}-diagnose-tip`,
          disabled: Boolean(busy),
          hint: t("\u6821\u9A8C\u5E94\u7528\u51ED\u8BC1\u4E0E\u957F\u8FDE\u63A5\u72B6\u6001\uFF0C\u4E0D\u53D1\u9001\u6D88\u606F\uFF0C\u4E5F\u4E0D\u81EA\u52A8\u91CD\u8FDE\u3002", "Verify app credentials and connection status without sending messages or reconnecting."),
          onClick: () => void diagnose()
        }, busy === "diagnose" ? t("\u8BCA\u65AD\u4E2D\u2026", "Diagnosing\u2026") : t("\u8FDE\u63A5\u8BCA\u65AD", "Diagnose connection")),
        extraActions: h15(ActionMenu, { disabled: Boolean(busy), active, renderActions: (close) => h15("button", {
          type: "button",
          className: "bxf-mini bxf-danger",
          disabled: Boolean(busy),
          style: { color: "var(--dsw-alias-state-error-primary)" },
          onClick: () => {
            close();
            return remove();
          }
        }, t("\u5220\u9664\u673A\u5668\u4EBA", "Delete bot")) })
      }),
      error && h15("div", { className: "bxf-work-alert", role: "alert" }, error),
      diagnosis && h15(
        "div",
        { className: "bxf-work-diagnosis", role: "status" },
        h15("span", null, diagnosis.connected ? t("\u51ED\u8BC1\u6709\u6548\uFF0C\u957F\u8FDE\u63A5\u6B63\u5E38", "Credentials verified; connection is active") : t("\u51ED\u8BC1\u6709\u6548\uFF0C\u957F\u8FDE\u63A5\u672A\u5C31\u7EEA\uFF0C\u53EF\u70B9\u51FB\u91CD\u8FDE", "Credentials verified; connection is not ready. Reconnect to retry.")),
        h15("time", { className: "bxf-work-meta" }, dateText(diagnosis.checkedAt))
      ),
      h15(
        "div",
        { className: "bxf-status-grid" },
        section(t("\u5E94\u7528\u4FE1\u606F", "Application"), [
          [t("\u5E94\u7528 ID", "App ID"), h15("code", null, bot.appId || "\u2014")],
          [t("\u673A\u5668\u4EBA", "Bot"), bot.botName],
          [t("\u673A\u5668\u4EBA Open ID", "Bot Open ID"), h15("code", null, bot.botOpenId || "\u2014")],
          [t("\u5DF2\u7ED1\u5B9A\u4F1A\u8BDD", "Bound chats"), bot.boundChats ?? 0]
        ]),
        section(t("\u8FD0\u884C\u89C2\u6D4B", "Runtime observations"), [
          [t("\u8FDE\u63A5\u65F6\u95F4", "Connected at"), dateText(bot.connectedAt)],
          [t("\u672C\u6B21\u8FDE\u63A5\u63A5\u6536", "Received this connection"), bot.inbound?.messagesReceived ?? "\u2014"],
          [t("\u6700\u8FD1\u4E8B\u4EF6", "Last event"), bot.inbound?.lastEventType],
          [t("\u4E8B\u4EF6\u65F6\u95F4", "Event time"), dateText(bot.inbound?.lastEventAt)]
        ])
      ),
      bot.lastError && h15(
        "section",
        { className: "bxf-status-error", role: "status" },
        h15(
          "div",
          { className: "bxf-work-heading" },
          h15("h3", null, t("\u6700\u8FD1\u9519\u8BEF", "Last error")),
          bot.lastError.at && h15("time", { className: "bxf-work-meta" }, dateText(bot.lastError.at))
        ),
        bot.lastError.code && h15("code", null, bot.lastError.code),
        h15("p", null, bot.lastError.message || String(bot.lastError))
      ),
      h15(
        StatusSettings,
        { visible: bot.state === "connected", title: t("\u673A\u5668\u4EBA\u8BBE\u7F6E", "Bot settings") },
        h15(BotConfiguration, { connection, bot, onChanged, registerSave })
      )
    ),
    h15(IdentityStatus, { connection, bot, bots, active, query: identityQuery, monitorQuery, settingsVisible: avatarReady, registerSave, beforeDisconnect: beforeRemove })
  );
}

// client/identity-style.js
var IDENTITY_CSS = `
.bxf-identity-hint { margin: 6px 0 0; line-height: 1.55; overflow-wrap: anywhere; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-identity-section-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.bxf-identity-section-head { margin-bottom: 8px; }
.bxf-identity-section-head .bxf-identity-setting-title { margin: 0; }
.bxf-identity-chat-controls { display: grid; min-width: 0;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-chat-meta { margin-top: 3px; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-identity-field { display: flex; flex-direction: column; min-width: 0; gap: 5px; }
.bxf-identity-field > span { font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-identity-chat-extra { grid-column: 1 / -1; }
.bxf-identity-picker { min-width: 0; }
.bxf-identity-picker-list { margin-top: 12px; }
.bxf-identity-candidate { display: flex; align-items: center; gap: 10px; padding: 8px 2px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-identity-candidate:last-child { border-bottom: 0; }
.bxf-identity-candidate-info { min-width: 0; flex: 1; }
.bxf-identity-candidate-info strong { display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-size: 12px; font-weight: 500; }
.bxf-identity-settings { display: grid; gap: 20px; }
.bxf-identity-setting { min-width: 0; }
.bxf-identity-setting-title { margin: 0 0 8px; font-size: 13px; font-weight: 600; }
.bxf-identity-field > .bxf-identity-setting-title { margin: 0; }
.bxf-identity-rules { display: block; width: 100%; max-width: 100%; margin-top: 12px; height: auto; max-height: 420px;
  resize: vertical; font-family: inherit; line-height: 1.7; overflow-wrap: anywhere; }
.bxf-identity-worker { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 12px; }
.bxf-identity-alert { font-size: 12px; padding: 9px 12px; border-radius: 8px; overflow-wrap: anywhere; background: rgba(239,68,68,.06); color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-identity-notice { font-size: 12px; padding: 9px 12px; border-radius: 8px; background: rgba(16,185,129,.08); color: var(--dsw-alias-state-success-primary, #059669); }
.bxf-identity-qr { display: inline-flex; padding: 12px; margin-top: 14px; border-radius: 12px; background: #fff; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); line-height: 0; }
@container (max-width: 440px) {
  .bxf-identity-chat-controls, .bxf-identity-worker { grid-template-columns: minmax(0, 1fr); }
}
`;

// client/workspace-style.js
var WORKSPACE_CSS = `
.bxf-work { height: 100%; min-height: 0; min-width: 0; overflow: hidden; container: feishu / inline-size;
  background: var(--dsw-alias-bg-base, #f8f9fb); color: var(--dsw-alias-label-primary, #1c1c1e); font-size: 13px; line-height: 1.5; }
.bxf-work :not(.bxf-worker-native *), .bxf-work :not(.bxf-worker-native *)::before, .bxf-work :not(.bxf-worker-native *)::after { box-sizing: border-box; }
.bxf-work :is(button, input, select):not(.bxf-worker-native *) { font: inherit; }
.bxf-work button:not(.bxf-worker-native *) { cursor: pointer; }
.bxf-work button:not(.bxf-worker-native *):disabled { opacity: .45; cursor: not-allowed; }
.bxf-work button:not(.bxf-worker-native *):focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 3px; }
.bxf-work [hidden] { display: none !important; }
.bxf-work-shell { display: flex; flex-direction: column; height: 100%; min-height: 0; min-width: 0; }
.bxf-work-header, .bxf-work-toolbar, .bxf-work-heading { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.bxf-work-header { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 20px; flex: none; padding: 12px 20px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-work-header h1 { font-size: 19px; font-weight: 650; letter-spacing: -.6px; margin: 0; }
.bxf-work-mark { display: flex; align-items: center; gap: 12px; white-space: nowrap; }
.bxf-work-logo { display: grid; place-items: center; width: 30px; height: 30px; flex: none; }
.bxf-work-tabs { display: flex; gap: 6px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); margin: 0; padding: 0 12px; flex: none; }
.bxf-work-tab { border: 0; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); padding: 11px 17px; border-bottom: 2px solid transparent; }
.bxf-work-tab[aria-selected="true"] { color: var(--dsw-alias-label-primary, #1c1c1e); border-color: var(--dsw-alias-brand-primary, #3370ff); font-weight: 650; }
.bxf-work-toolbar { margin-bottom: 14px; }
.bxf-work-toolbar input { flex: 1; min-width: 160px; max-width: 380px; }
.bxf-work-toolbar select { max-width: 210px; }
.bxf-work-filters { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; width: 360px; max-width: 100%; }
.bxf-work-filters select { min-width: 0; max-width: none; }
.bxf-work-split { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(290px, 1fr); align-items: start; gap: 18px; }
.bxf-work-list, .bxf-work-detail, .bxf-work-surface { min-width: 0; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  border-radius: 14px; overflow: hidden; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-work-listhead { padding: 12px 16px; font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-work-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; width: 100%; padding: 16px; text-align: left;
  background: transparent; color: inherit; border: 0; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-left: 3px solid transparent; }
.bxf-work-row:last-child { border-bottom: 0; }
.bxf-work-row:hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-work-row[aria-pressed="true"] { background: var(--dsw-alias-bg-layer-2, #f7f8fa); border-left-color: var(--dsw-alias-brand-primary, #3370ff); }
.bxf-work-row > div { min-width: 0; }
.bxf-work-row strong { display: block; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; font-size: 13px; }
.bxf-work-meta { color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; overflow-wrap: anywhere; }
.bxf-work-row .bxf-work-meta { margin-top: 4px; white-space: nowrap; text-overflow: ellipsis; overflow: hidden; }
.bxf-work-row-end { flex-shrink: 0; text-align: right; max-width: 42%; }
.bxf-work-detail { padding: 20px; position: sticky; top: 16px; }
.bxf-work-detail h2, .bxf-work-surface h2 { font-size: 16px; margin: 0 0 6px; overflow-wrap: anywhere; }
.bxf-work-detail h3 { margin: 22px 0 10px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); font-size: 12px; }
.bxf-work-facts { display: grid; grid-template-columns: 92px minmax(0, 1fr); gap: 9px 14px; margin: 14px 0; font-size: 12px; }
.bxf-work-facts dt { color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-work-facts dd { margin: 0; min-width: 0; overflow-wrap: anywhere; }
.bxf-work-facts code { font-size: 11px; }
.bxf-session-binding { margin-top: 18px; padding: 16px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px; }
.bxf-session-binding > p { margin: 8px 0 12px; }
.bxf-session-binding > .bxf-work-alert { margin: 12px 0 0; }
.bxf-session-options { padding: 0; margin: 12px 0; border: 0; min-width: 0; max-height: 300px; overflow: auto; overscroll-behavior: contain; }
.bxf-session-option { display: flex; align-items: start; gap: 10px; padding: 10px 8px; border-radius: 6px; cursor: pointer; }
.bxf-session-option:hover, .bxf-session-option[data-selected="true"] { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-work .bxf-session-option input { flex: none; width: 15px; height: 15px; margin: 3px 0 0; accent-color: var(--dsw-alias-brand-primary, #3370ff); }
.bxf-session-option > span { display: grid; gap: 3px; min-width: 0; overflow-wrap: anywhere; }
.bxf-session-option code { font-size: 11px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-session-option:has(input:disabled) { opacity: .6; cursor: default; }
.bxf-session-binding-actions { display: flex; justify-content: flex-end; flex-wrap: wrap; gap: 8px; }
.bxf-work-empty { color: var(--dsw-alias-label-secondary, #6b7280); padding: 44px 20px; text-align: center; }
.bxf-work-alert { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 14px; margin-bottom: 14px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb);
  border-radius: 10px; color: var(--dsw-alias-state-error-primary, #dc2626); overflow-wrap: anywhere; }
.bxf-work-bots { max-width: 1280px; min-width: 0; }
.bxf-work-identity { display: flex; flex-direction: column; height: 100%; min-height: 0; }
.bxf-work-message { padding: 12px 0; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-work-message pre { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; margin: 8px 0; }
.bxf-work-message code { font-size: 11px; overflow-wrap: anywhere; }
.bxf-work-batch { margin-top: 14px; }
.bxf-work .bxf-identity-control { width: 100%; min-width: 0; }
.bxf-work-layout { flex: 1; display: flex; min-width: 0; min-height: 0; }
.bxf-bot-nav { display: flex; align-items: center; justify-content: safe center; gap: 24px; min-width: 0; overflow-x: auto; overflow-y: hidden; padding: 4px; overscroll-behavior-x: contain; scrollbar-width: thin; }
.bxf-bot-nav-row { flex: 0 0 auto; min-width: 0; max-width: 220px; padding: 8px 0; border: 0; border-bottom: 1px solid transparent; border-radius: 0; box-shadow: none; background: transparent; color: var(--dsw-alias-label-secondary, #6b7280); text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-work .bxf-bot-nav-row { font-weight: 400; }
.bxf-work .bxf-bot-nav-row[aria-current="page"] { font-weight: 600; border-bottom-color: var(--dsw-alias-label-primary, #1c1c1e); }
.bxf-bot-nav-row:hover { border-bottom-color: var(--dsw-alias-border-l2, #d1d5db); }
.bxf-bot-nav-row[data-state="connected"] { color: var(--dsw-alias-state-success-primary, #059669); }
.bxf-bot-nav-row[data-state="error"] { color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-bot-content { flex: 1; display: flex; flex-direction: column; min-width: 0; min-height: 0; container: robot / inline-size; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-work-tabpage { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 20px; }
.bxf-work-tabpage-avatar { display: flex; flex-direction: column; overflow: hidden; padding: 0; }
.bxf-runtime-status { display: flex; flex-direction: column; gap: 24px; min-width: 0; }
.bxf-status-block { min-width: 0; padding: 20px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 12px; background: var(--dsw-alias-bg-layer-1, #fff); }
.bxf-status-summary { padding-bottom: 16px; margin-bottom: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-status-summary h2 { margin: 0; font-size: 17px; overflow-wrap: anywhere; }
.bxf-status-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 24px 32px; padding-top: 8px; }
.bxf-status-section { min-width: 0; }
.bxf-status-section h3, .bxf-status-error h3 { margin: 0; font-size: 14px; font-weight: 600; }
.bxf-status-section .bxf-work-facts { grid-template-columns: 100px minmax(0, 1fr); gap: 12px; margin: 16px 0 0; }
.bxf-status-identity-title { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 12px; min-width: 0; }
.bxf-status-avatar > .bxf-work-facts { margin: 0; }
.bxf-status-avatar > .bxf-work-facts:empty { display: none; }
.bxf-avatar-credentials { display: grid; grid-template-columns: minmax(0, 1.5fr) repeat(2, minmax(0, 1fr)); gap: 16px 32px; max-width: 1280px; margin: 0; padding: 4px 0; }
.bxf-avatar-credentials > div { min-width: 0; }
.bxf-avatar-credentials dt { margin-bottom: 6px; font-size: 12px; color: var(--dsw-alias-label-secondary, #6b7280); }
.bxf-avatar-credentials dd { margin: 0; overflow-wrap: anywhere; font-variant-numeric: tabular-nums; }
.bxf-status-avatar > .bxf-identity-alert, .bxf-status-avatar > .bxf-identity-notice { margin-bottom: 16px; }
.bxf-status-settings { min-width: 0; margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-status-settings > h3 { margin: 0 0 16px; font-size: 14px; font-weight: 600; }
.bxf-reply-settings-grid { grid-template-columns: minmax(240px, 320px) minmax(0, 1fr); gap: 32px; align-items: start; max-width: 1280px; }
.bxf-reply-options { display: grid; gap: 24px; min-width: 0; }
.bxf-reply-options .bxf-identity-worker { grid-template-columns: minmax(0, 1fr); }
.bxf-reply-options > .bxf-identity-setting:first-child .bxf-identity-field { gap: 8px; }
.bxf-reply-options > .bxf-identity-setting:first-child .bxf-identity-setting-title { display: flex; align-items: center; min-height: 28px; }
.bxf-reply-rules-setting .bxf-identity-section-head { min-height: 28px; margin-bottom: 8px; }
.bxf-reply-rules-setting .bxf-identity-rules { margin-top: 0; }
.bxf-status-settings > .bxf-save-status { margin-top: 12px; }
.bxf-status-auth-scan { margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-status-error { margin-top: 28px; padding-top: 18px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); color: var(--dsw-alias-state-error-primary, #dc2626); }
.bxf-status-error code { display: block; margin-top: 12px; }
.bxf-status-error p { margin: 8px 0 0; white-space: pre-wrap; overflow-wrap: anywhere; }
.bxf-bot-add { z-index: 10; }
.bxf-bot-settings { display: grid; gap: 12px; }
.bxf-settings-toolbar { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-settings-tabs { display: inline-flex; gap: 4px; padding: 3px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-settings-tabs button { border: 1px solid transparent; border-radius: 6px; padding: 5px 20px; color: var(--dsw-alias-label-secondary, #6b7280); background: transparent; }
.bxf-settings-tabs button:hover { color: var(--dsw-alias-label-primary, #1c1c1e); }
.bxf-settings-tabs button[aria-selected="true"] { border-color: var(--dsw-alias-border-l1, #e5e7eb); color: var(--dsw-alias-label-primary, #1c1c1e); background: var(--dsw-alias-bg-layer-1, #fff); font-weight: 600; }
.bxf-settings-pane { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; gap: 28px 40px; min-width: 0; padding-top: 8px; }
.bxf-settings-pane:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 4px; border-radius: 4px; }
.bxf-settings-group, .bxf-settings-context { min-width: 0; }
.bxf-settings-group h4 { font-size: 13px; font-weight: 600; margin: 0 0 16px; }
.bxf-settings-fields { display: grid; gap: 18px; min-width: 0; }
.bxf-bot-settings :is(input, select, textarea) { min-width: 0; font-family: inherit; }
.bxf-bot-settings select { text-overflow: ellipsis; }
.bxf-bot-settings textarea { resize: vertical; max-width: 100%; line-height: 1.6; }
.bxf-bot-settings input[type="checkbox"] { width: 16px; height: 16px; margin: 0; accent-color: var(--dsw-alias-brand-primary, #3370ff); }
.bxf-setting-toggle { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.bxf-setting-toggle > label { flex: none; }
.bxf-settings-pane-group > .bxf-settings-context { grid-column: 1 / -1; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 20px; }
@container feishu (max-width: 600px) {
  .bxf-work-header { gap: 8px; padding: 8px 12px; }
  .bxf-work-mark { gap: 6px; }
  .bxf-work-header h1 { font-size: 16px; }
  .bxf-bot-nav { gap: 16px; }
  .bxf-bot-nav-row { max-width: 160px; padding: 7px 0; }
  .bxf-bot-add > button { padding: 7px 9px !important; }
}
@container feishu (max-width: 440px) {
  .bxf-work-logo { display: none; }
}
@container robot (max-width: 880px) {
  .bxf-reply-settings-grid { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .bxf-reply-options .bxf-identity-worker { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .bxf-reply-options > .bxf-identity-setting:first-child .bxf-identity-setting-title { min-height: 0; }
}
@container robot (max-width: 760px) {
  .bxf-work-split { grid-template-columns: minmax(0, 1fr); }
  .bxf-work-detail { position: static; }
  .bxf-avatar-credentials { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 24px; }
  .bxf-avatar-credentials > div:first-child { grid-column: 1 / -1; }
}
@container robot (max-width: 700px) {
  .bxf-status-grid { grid-template-columns: minmax(0, 1fr); }
  .bxf-status-section + .bxf-status-section { padding-top: 20px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
  .bxf-settings-pane { grid-template-columns: minmax(0, 1fr); gap: 24px; }
  .bxf-settings-pane > :not(:first-child) { border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); padding-top: 20px; }
}
@container robot (max-width: 600px) {
  .bxf-chat-toolbar > input { flex-basis: 100%; max-width: none; }
  .bxf-work-filters { width: 100%; }
}
@container robot (max-width: 520px) {
  .bxf-work-tabs { padding: 0 4px; gap: 0; }
  .bxf-work-tab { flex: 1; padding: 9px 8px; }
  .bxf-work-tabpage:not(.bxf-work-tabpage-avatar) { padding: 12px; }
  .bxf-work-facts { grid-template-columns: 76px minmax(0, 1fr); }
  .bxf-runtime-status { gap: 16px; }
  .bxf-status-block { padding: 16px; }
  .bxf-status-section .bxf-work-facts { grid-template-columns: 88px minmax(0, 1fr); gap: 12px; }
  .bxf-reply-options .bxf-identity-worker, .bxf-avatar-credentials { grid-template-columns: minmax(0, 1fr); }
}

.bxf-work .bxf-work-icon { display: grid; place-items: center; width: 32px; height: 32px; padding: 0; }
.bxf-bot-more { position: relative; }
.bxf-bot-more-panel { position: absolute; z-index: 5; right: 0; top: calc(100% + 6px); min-width: 112px; padding: 6px;
  background: var(--dsw-alias-bg-layer-1, #fff); border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 10px; box-shadow: 0 6px 20px rgba(15,23,42,.12); }
.bxf-bot-more-panel .bxf-mini { width: 100%; border-color: transparent; text-align: left; }
.bxf-bot-more-panel .bxf-action-tip { width: 100%; }
.bxf-work-diagnosis { display: flex; flex-wrap: wrap; align-items: center; gap: 8px 16px; padding: 12px 0; }
.bxf-action-tip { position: relative; display: inline-flex; }
.bxf-action-tip-body { position: absolute; top: calc(100% + 8px); z-index: 20; width: min(280px, calc(100vw - 24px)); padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 8px; background: var(--dsw-alias-bg-overlay, #fff); color: var(--dsw-alias-label-primary, #1c1c1e); font-size: 12px; line-height: 1.6; white-space: normal; box-shadow: 0 6px 18px rgba(15,23,42,.12); }
.bxf-modal-dialog { padding: 0; border: 0; background: transparent; max-width: calc(100vw - 40px); overflow: visible; }
.bxf-modal-dialog::backdrop { background: rgba(15,23,42,.35); }

`;

// client/avatar-style.js
var AVATAR_CSS = `
.bxf-avatar-workspace { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; }
.bxf-avatar-split { display: grid; grid-template-columns: 260px minmax(0, 1fr); flex: 1; min-height: 0; }
.bxf-avatar-rail { display: flex; flex-direction: column; min-height: 0; min-width: 0; border-right: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-avatar-rail-head { flex: none; padding: 14px 12px 10px; display: grid; gap: 12px; }
.bxf-avatar-rail-actions { display: flex; gap: 6px; flex-wrap: wrap; }
.bxf-avatar-rail-actions .bxf-mini { font-size: 11px; padding: 5px 8px; }
.bxf-avatar-direct-toggle { appearance: none; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px 10px; border: 1px solid var(--dsw-alias-border-l1, #e5e7eb); border-radius: 8px; background: transparent; color: inherit; font: inherit; font-size: 12px; text-align: left; cursor: pointer; }
.bxf-avatar-direct-toggle:disabled { cursor: default; opacity: .55; }
.bxf-avatar-direct-toggle:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary, #3370ff); outline-offset: 2px; }
.bxf-avatar-direct-toggle::after { content: ''; flex: none; width: 28px; height: 16px; border-radius: 12px; background: radial-gradient(circle at 8px center, #fff 0 5px, transparent 5.5px) var(--dsw-alias-label-secondary, #6b7280); }
.bxf-avatar-direct-toggle[aria-checked="true"]::after { background: radial-gradient(circle at 20px center, #fff 0 5px, transparent 5.5px) var(--dsw-alias-brand-primary, #3370ff); }
.bxf-avatar-chat-list { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 6px 8px; }
.bxf-avatar-chat-section + .bxf-avatar-chat-section { margin-top: 8px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-avatar-chat-section h3 { padding: 9px 8px 6px; margin: 0; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; font-weight: 600; }
.bxf-avatar-section-empty { margin: 0; padding: 8px 8px 14px; color: var(--dsw-alias-label-secondary, #6b7280); font-size: 12px; }
.bxf-avatar-section-error { color: var(--dsw-alias-state-error-primary, #b91c1c); overflow-wrap: anywhere; }
.bxf-avatar-chat-row { display: grid; gap: 5px; width: 100%; padding: 14px 12px; border: 0; border-radius: 8px; color: inherit; background: transparent; text-align: left; }
.bxf-avatar-chat-row:hover { background: var(--dsw-alias-bg-layer-2, #f7f8fa); }
.bxf-avatar-chat-row[aria-pressed="true"] { background: color-mix(in srgb, var(--dsw-alias-brand-primary, #3370ff) 9%, transparent); box-shadow: inset 3px 0 var(--dsw-alias-brand-primary, #3370ff); }
.bxf-avatar-chat-top { display: flex; align-items: center; gap: 8px; min-width: 0; }
.bxf-avatar-chat-top strong { flex: 1; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.bxf-avatar-count { flex: none; font-size: 11px; padding: 1px 6px; border-radius: 10px; background: var(--dsw-alias-brand-primary, #3370ff); color: #fff; }
.bxf-avatar-rail-footer { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; justify-content: space-between; padding: 10px 12px; border-top: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-avatar-conversation { min-width: 0; min-height: 0; overflow: hidden; }
.bxf-worker-panel { height: 100%; min-height: 0; display: flex; flex-direction: column; }
.bxf-worker-header { flex: none; display: flex; align-items: center; gap: 12px; flex-wrap: wrap; padding: 14px 18px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-worker-title { display: grid; gap: 3px; flex: 1; min-width: 100px; }
.bxf-worker-title strong { overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.bxf-worker-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.bxf-worker-native { flex: 1; display: flex; flex-direction: column; min-height: 0; min-width: 0; overflow: hidden; }
.bxf-avatar-worker-empty { margin: auto; padding: 30px; text-align: center; }
.bxf-avatar-back { display: none; }
.bxf-avatar-delivery { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 16px; }
.bxf-avatar-chat-settings { display: flex; flex-direction: column; gap: 18px; }
.bxf-avatar-chat-settings .bxf-identity-chat-controls { display: grid; gap: 16px; grid-template-columns: minmax(0, 1fr); }
.bxf-avatar-chat-settings .bxf-identity-remove { order: 1; align-self: flex-start; margin-top: 16px; }
.bxf-message-id { margin-top: 10px; }
.bxf-message-id summary { cursor: pointer; }
.bxf-drawer { position: fixed; inset: 0; margin: 0 0 0 auto; width: min(560px, 100vw); height: 100dvh; max-width: none; max-height: none; border: 0; padding: 0; background: transparent; color: var(--dsw-alias-label-primary, #1c1c1e); overflow: hidden; font: inherit; box-shadow: -12px 0 48px rgba(15,23,42,.16); }
.bxf-drawer::backdrop { background: rgba(15,23,42,.28); }
.bxf-drawer-sheet { height: 100%; display: flex; flex-direction: column; background: var(--dsw-alias-bg-layer-1, #fff); container-type: inline-size; }
.bxf-drawer-header { flex: none; padding: 16px 22px; display: flex; align-items: center; justify-content: space-between; gap: 16px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); }
.bxf-drawer-header h2 { font-size: 16px; margin: 0; }
.bxf-drawer-body { flex: 1; min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 22px; }
.bxf-drawer-body h3 { margin: 0 0 12px; font-size: 14px; }
.bxf-drawer .bxf-identity-settings { display: grid; gap: 24px; }
.bxf-drawer .bxf-identity-setting { border: 0; border-radius: 0; padding: 0 0 22px; border-bottom: 1px solid var(--dsw-alias-border-l1, #e5e7eb); background: transparent; }
.bxf-drawer .bxf-identity-setting:last-child { border: 0; padding: 0; }
@container robot (max-width: 640px) {
  .bxf-avatar-split { grid-template-columns: minmax(0, 1fr); }
  .bxf-avatar-split[data-detail="false"] .bxf-avatar-conversation { display: none; }
  .bxf-avatar-split[data-detail="true"] .bxf-avatar-rail { display: none; }
  .bxf-avatar-rail { border-right: 0; }
  .bxf-avatar-back { display: inline-flex; }
  .bxf-worker-header { padding: 10px 12px; }
}
`;

// client/icon.js
var import_react17 = __toESM(require("react"), 1);

// icon.svg
var icon_default = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256" role="img" aria-label="Feishu">%0A  <!-- Official Feishu app icon: unchanged 256px PNG from Lark.app/Contents/Resources/app.icns (ic08); bundle name Feishu, identifier com.electron.lark. -->%0A  <image width="256" height="256" href="data:image/png;base64,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"/>%0A</svg>%0A';

// client/icon.js
function FeishuIcon({ size = 20 }) {
  return import_react17.default.createElement("img", {
    src: icon_default,
    width: size,
    height: size,
    alt: "",
    "aria-hidden": true,
    draggable: false,
    style: { display: "block", objectFit: "contain", flexShrink: 0 }
  });
}

// client/workspace.js
var h16 = import_react18.default.createElement;
var EMPTY = { bots: [], chats: [], warnings: [] };
function BotWorkspace({ connection, bot, snapshot, memory, onChanged, onRefresh, onBind, onUnbind, refreshing, openSession, workerView, leaveRef }) {
  const savedTab = memory.tabs?.[bot.id];
  const remembered = ["status", "chats", "avatar"].includes(savedTab) ? savedTab : "status";
  const [tab, setTab] = import_react18.default.useState(remembered);
  const [visited, setVisited] = import_react18.default.useState(() => /* @__PURE__ */ new Set([remembered]));
  const identityQuery = useRpcQuery(connection, API.userStatus);
  const connectingAvatar = identityQuery.data?.config?.app?.botId === bot.id && identityQuery.data?.connect?.phase === "pending";
  usePolling(identityQuery.refresh, { interval: connectingAvatar ? 1500 : 3e4, enabled: tab === "status" || tab === "avatar", scope: connection });
  const ownsAvatar = identityQuery.data?.config?.app?.botId === bot.id;
  const authorization = ownsAvatar && identityQuery.data?.authorization;
  const messageScopesSatisfied = authorization?.messageScopesSatisfied ?? authorization?.scopeSatisfied;
  const avatarReady = Boolean(authorization?.authorized && messageScopesSatisfied !== false && !(authorization.refreshTokenExpiresAt > 0 && authorization.refreshTokenExpiresAt <= Date.now()));
  const monitorQuery = useRpcQuery(connection, API.userMonitorStatus, null, { botId: bot.id });
  usePolling(monitorQuery.refresh, { interval: 1e4, enabled: ownsAvatar && (tab === "avatar" || tab === "status" && avatarReady), scope: connection });
  const saveRef = import_react18.default.useRef(null);
  const botSaves = import_react18.default.useRef(/* @__PURE__ */ new Map());
  const [saveError, setSaveError] = import_react18.default.useState(null);
  import_react18.default.useEffect(() => {
    setSaveError(null);
  }, [bot.state, avatarReady]);
  const { error, run } = useMutation();
  const registerSave = import_react18.default.useCallback((key, flush2) => {
    botSaves.current.set(key, flush2);
    return () => {
      if (botSaves.current.get(key) === flush2) botSaves.current.delete(key);
    };
  }, []);
  const chooseTab = import_react18.default.useCallback((value) => {
    (memory.tabs ??= {})[bot.id] = value;
    setTab(value);
    setVisited((previous) => /* @__PURE__ */ new Set([...previous, value]));
  }, [memory, bot.id]);
  const flush = import_react18.default.useCallback(async () => {
    setSaveError(null);
    if (saveRef.current && !await saveRef.current()) {
      chooseTab("avatar");
      return false;
    }
    for (const [key, save] of botSaves.current) {
      if (!await save()) {
        chooseTab("status");
        if (key.startsWith("bot:") ? bot.state !== "connected" : !avatarReady) {
          setSaveError(t("\u8BBE\u7F6E\u5C1A\u672A\u4FDD\u5B58\uFF0C\u8BF7\u5728\u8FDE\u63A5\u6062\u590D\u540E\u91CD\u8BD5\u3002", "Settings are not saved. Restore the connection and retry."));
        }
        return false;
      }
    }
    return true;
  }, [chooseTab, bot.state, avatarReady]);
  import_react18.default.useEffect(() => {
    leaveRef.current = flush;
    return () => {
      if (leaveRef.current === flush) leaveRef.current = null;
    };
  }, [leaveRef, flush]);
  const onOpenSession = (id) => run("open", async () => {
    if (await flush()) await openSession(id);
  });
  const tabs = [["status", t("\u72B6\u6001", "Status")], ["chats", t("\u4F1A\u8BDD", "Chats")], ["avatar", t("\u5206\u8EAB", "Avatar")]];
  const scoped = { ...snapshot, bots: [bot], chats: snapshot.chats.filter((chat) => chat.botId === bot.id) };
  const warnings = snapshot.warnings.filter((warning) => warning.source === bot.id);
  return h16(
    "div",
    { className: "bxf-bot-content" },
    h16(
      "div",
      { className: "bxf-work-tabs", role: "tablist", "aria-label": bot.alias || bot.botName || bot.id },
      tabs.map(([id, label], index) => h16("button", {
        key: id,
        type: "button",
        className: "bxf-work-tab",
        role: "tab",
        id: `bxf-tab-${id}`,
        "aria-selected": tab === id,
        "aria-controls": `bxf-page-${id}`,
        tabIndex: tab === id ? 0 : -1,
        onClick: () => chooseTab(id),
        onKeyDown: (event) => {
          const next = event.key === "ArrowRight" ? (index + 1) % tabs.length : event.key === "ArrowLeft" ? (index + tabs.length - 1) % tabs.length : event.key === "Home" ? 0 : event.key === "End" ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          chooseTab(tabs[next][0]);
          event.currentTarget.parentElement.querySelectorAll('[role="tab"]')[next]?.focus();
        }
      }, label))
    ),
    error && h16("div", { className: "bxf-work-alert", role: "alert" }, error),
    saveError && h16("div", { className: "bxf-work-alert", role: "alert" }, saveError),
    warnings.map((warning, index) => h16("div", { key: index, className: "bxf-work-alert", role: "status" }, warning.message)),
    tabs.map(([id]) => h16(
      "section",
      { key: id, className: `bxf-work-tabpage${id === "avatar" ? " bxf-work-tabpage-avatar" : ""}`, hidden: tab !== id, role: "tabpanel", id: `bxf-page-${id}`, "aria-labelledby": `bxf-tab-${id}` },
      visited.has(id) && h16(
        Boundary,
        null,
        id === "chats" ? h16(Conversations, { connection, snapshot: scoped, active: tab === id, onOpenSession, onBind, onUnbind, onBot: () => chooseTab("status") }) : id === "avatar" ? h16(IdentityPanel, { connection, bot, query: identityQuery, monitorQuery, onStatus: () => chooseTab("status"), active: tab === id, saveRef, onOpenSession, workerView }) : h16(BotStatus, { connection, bot, bots: snapshot.bots, identityQuery, monitorQuery, avatarReady, registerSave, active: tab === id, beforeRemove: flush, onChanged, refreshing, onRefresh: () => Promise.all([onRefresh(), identityQuery.refresh()]) })
      )
    ))
  );
}
function WorkspacePage({ connection, openSession, workerView, memory: suppliedMemory }) {
  const localMemory = import_react18.default.useRef({});
  const memory = suppliedMemory ?? localMemory.current;
  const query = useRpcQuery(connection, API.managementSnapshot);
  const snapshot = query.data ?? EMPTY;
  const snapshotRef = import_react18.default.useRef(snapshot);
  snapshotRef.current = snapshot;
  const [selected, setSelected] = import_react18.default.useState(memory.botId || null);
  const [addMode, setAddMode] = import_react18.default.useState(null);
  const [addOpen, setAddOpen] = import_react18.default.useState(false);
  const knownBotIdsRef = import_react18.default.useRef(null);
  const addRef = import_react18.default.useRef(null);
  const addButton = import_react18.default.useRef(null);
  const navRef = import_react18.default.useRef(null);
  const leaveRef = import_react18.default.useRef(null);
  const { busy, error, run } = useMutation();
  const bot = snapshot.bots.find((item) => item.id === selected) ?? snapshot.bots[0];
  import_react18.default.useEffect(() => {
    navRef.current?.querySelector('[aria-current="page"]')?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [bot?.id]);
  import_react18.default.useEffect(() => {
    if (!addOpen) return;
    const outside = (event) => {
      if (addRef.current && !addRef.current.contains(event.target)) setAddOpen(false);
    };
    const escape = (event) => {
      if (event.key !== "Escape") return;
      setAddOpen(false);
      addButton.current?.focus();
    };
    window.addEventListener("pointerdown", outside);
    window.addEventListener("keydown", escape);
    return () => {
      window.removeEventListener("pointerdown", outside);
      window.removeEventListener("keydown", escape);
    };
  }, [addOpen]);
  usePolling(query.refresh, { interval: 15e3, scope: connection });
  const changed = () => {
    query.invalidate();
    return query.refresh();
  };
  const bindChat = async (binding) => {
    query.invalidate();
    const result = await rpc(connection, API.chatBind, binding);
    const next = applyChatBound(snapshotRef.current, result);
    snapshotRef.current = next;
    query.accept(next);
    await query.refresh();
    return result;
  };
  const unbindChat = async (binding) => {
    query.invalidate();
    await rpc(connection, API.chatUnbind, binding);
    const next = applyChatUnbound(snapshotRef.current, binding);
    snapshotRef.current = next;
    query.accept(next);
    await query.refresh();
  };
  const selectBot = (id) => run("select", async () => {
    if (id === bot?.id || leaveRef.current && !await leaveRef.current()) return;
    memory.botId = id;
    setSelected(id);
  });
  const refreshBot = (botId) => run("refresh", async () => {
    query.invalidate();
    return rpc(connection, API.managementSnapshot, { botId, refresh: true });
  }, (update) => {
    const merged = mergeBotSnapshot(snapshotRef.current, update, botId);
    snapshotRef.current = merged;
    query.accept(merged);
  });
  const added = async () => {
    const before = knownBotIdsRef.current ?? new Set(snapshotRef.current.bots.map((item) => item.id));
    knownBotIdsRef.current = null;
    const next = await changed();
    const newBot = next?.bots.find((item) => !before.has(item.id));
    if (newBot) await selectBot(newBot.id);
  };
  const globalWarnings = snapshot.warnings.filter((warning) => !snapshot.bots.some((item) => item.id === warning.source));
  return h16(
    "div",
    { className: "bxf-page bxf-work" },
    h16("style", null, CSS, IDENTITY_CSS, WORKSPACE_CSS, AVATAR_CSS),
    h16(
      "div",
      { className: "bxf-work-shell" },
      h16(
        "header",
        { className: "bxf-work-header" },
        h16("div", { className: "bxf-work-mark" }, h16("span", { className: "bxf-work-logo" }, h16(FeishuIcon, { size: 30 })), h16("h1", null, t("\u98DE\u4E66\u673A\u5668\u4EBAIM", "Feishu Bot IM"))),
        h16(
          "nav",
          { ref: navRef, className: "bxf-bot-nav", "aria-label": t("\u673A\u5668\u4EBA", "Bots") },
          snapshot.bots.map((item) => h16("button", {
            key: item.id,
            type: "button",
            className: "bxf-bot-nav-row",
            "aria-current": item.id === bot?.id ? "page" : void 0,
            "aria-label": item.alias || item.botName || item.id,
            title: item.alias || item.botName || item.id,
            "data-state": item.state,
            "aria-description": item.state === "connected" ? t("\u8FD0\u884C\u6B63\u5E38", "Connected") : item.state === "error" ? t("\u8FDE\u63A5\u5F02\u5E38", "Error") : item.state === "reconnecting" ? t("\u6B63\u5728\u91CD\u8FDE", "Reconnecting") : item.state === "connecting" ? t("\u6B63\u5728\u8FDE\u63A5", "Connecting") : t("\u672A\u8FDE\u63A5", "Idle"),
            disabled: busy === "select",
            onClick: () => void selectBot(item.id)
          }, item.alias || item.botName || item.id))
        ),
        h16(
          "div",
          {
            className: "bxf-bot-more bxf-bot-add",
            ref: addRef,
            onBlur: (event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) setAddOpen(false);
            }
          },
          h16("button", {
            ref: addButton,
            type: "button",
            style: S.btn("primary"),
            "aria-expanded": addOpen,
            onClick: () => setAddOpen((value) => !value)
          }, t("\u6DFB\u52A0\u673A\u5668\u4EBA", "Add bot")),
          addOpen && h16(
            "div",
            { className: "bxf-bot-more-panel", role: "group", "aria-label": t("\u6DFB\u52A0\u65B9\u5F0F", "Add method") },
            [["manual", t("\u624B\u52A8\u6DFB\u52A0", "Add manually")], ["scan", t("\u626B\u7801\u6DFB\u52A0", "Add by scanning")]].map(([mode, label]) => h16("button", {
              key: mode,
              type: "button",
              className: "bxf-mini",
              onClick: () => {
                knownBotIdsRef.current = new Set(snapshotRef.current.bots.map((item) => item.id));
                setAddOpen(false);
                setAddMode(mode);
              }
            }, label))
          )
        )
      ),
      (error || query.error) && h16(
        "div",
        { className: "bxf-work-alert", role: "alert" },
        error || query.error,
        h16("button", { type: "button", className: "bxf-mini", onClick: () => void query.refresh() }, t("\u91CD\u8BD5", "Retry"))
      ),
      globalWarnings.map((warning, index) => h16("div", { key: index, className: "bxf-work-alert", role: "status" }, warning.message)),
      !query.loaded ? h16("div", { className: "bxf-work-empty", role: "status" }, t("\u6B63\u5728\u8BFB\u53D6\u2026", "Loading\u2026")) : !bot ? h16("div", { className: "bxf-work-surface bxf-work-empty" }, t("\u8FD8\u6CA1\u6709\u63A5\u5165\u673A\u5668\u4EBA", "No bots connected")) : h16(
        "div",
        { className: "bxf-work-layout" },
        h16(BotWorkspace, { key: bot.id, connection, bot, snapshot, memory, openSession, workerView, leaveRef, onChanged: changed, onBind: bindChat, onUnbind: unbindChat, onRefresh: () => refreshBot(bot.id), refreshing: busy === "refresh" })
      )
    ),
    addMode && h16(Boundary, null, h16(AddBotModal, { connection, mode: addMode, onClose: () => setAddMode(null), onAdded: added }))
  );
}

// client/index.js
var h17 = import_react19.default.createElement;
function BoundPage({ connection, locale, page: Page, ...props }) {
  import_react19.default.useSyncExternalStore(
    (callback) => locale.subscribe(callback),
    () => locale.getLocale().revision,
    () => 0
  );
  return h17(Page, { ...props, connection });
}
function createPlugin() {
  return {
    inject: ["slots", "connection", "locale", "uiWorkspace", "sessions"],
    apply(ctx) {
      const connection = ctx.connection;
      if (!connection || typeof connection.rpc?.call !== "function") {
        console.error("[im-feishu] client connection service is missing; the main panel cannot call the Host");
      }
      ctx.effect(() => ctx.locale.register(NS, dictionaries()), "im-feishu: locale");
      ctx.effect(() => configureLocale(ctx.locale), "im-feishu: locale subscription");
      const memory = {};
      ctx.slots.inject("main", () => ctx.slots.register({
        name: "main",
        key: "im-feishu",
        children: { [WORKER_CONVERSATION_SLOT]: { kind: "single", scope: "session" } }
      }, (props) => h17(BoundPage, {
        ...props,
        page: WorkspacePage,
        connection,
        locale: ctx.locale,
        memory,
        openSession: (sessionId) => ctx.uiWorkspace.openSession(sessionId),
        workerView: { sessions: ctx.sessions, SessionProvider: props.SessionProvider, renderSlot: props.renderSlot }
      })));
      ctx.slots.inject(WORKER_CONVERSATION_SLOT, () => ctx.slots.register({
        name: WORKER_CONVERSATION_SLOT
      }, WorkerConversationContent));
      ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
        name: "sidebar.panellist",
        id: "im-feishu",
        order: 22,
        label: () => ctx.locale.bind(NS)("\u98DE\u4E66\u673A\u5668\u4EBAIM")
      }, FeishuIcon));
    }
  };
}

    })(module, module.exports, require);
    return module.exports.createPlugin();
  },
});
