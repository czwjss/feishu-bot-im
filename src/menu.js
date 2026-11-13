/** Menu drafts and model choices are owned by the menu, independently of message routing. */
import { newSessionCard, adjustCard, noticeCard } from './cards.js';
import { buildMenuCard, collectMenuData, currentMenuValue, menuOptionLabel } from './commands.js';
import { sendNotice } from './notify.js';

const PICKERS = new Set(['session_pick', 'workspace_pick', 'model_pick', 'reasoning_pick']);
const DRAFT_PICKERS = new Set(['ns_workspace', 'ns_model', 'ns_reasoning', 'ns_preset']);
const ACTIONS = new Set([...PICKERS, ...DRAFT_PICKERS, 'menu_apply', 'menu_cancel',
  'new_session', 'new_session_create', 'new_session_cancel', 'compact', 'stats_toggle', 'tools_toggle', 'menu_close']);

export class MenuController {
  #bot;
  #harness;
  #state;
  #services;
  #canManage;
  #forgetSession;
  #sessionModels = new Map();
  #menuPending = new Map();
  #newSessionDraft = new Map();

  constructor({ bot, harness, state, services, canManage, forgetSession }) {
    this.#bot = bot;
    this.#harness = harness;
    this.#state = state;
    this.#services = services;
    this.#canManage = canManage;
    this.#forgetSession = forgetSession;
  }

  handles(action) { return ACTIONS.has(action); }
  modelFor(sessionId) { return this.#sessionModels.get(sessionId) ?? null; }

  async handle(action, event) {
    try { return await this.#handle(action, event); }
    catch (error) { return { toast: { type: 'warning', content: `调整失败：${error.message}` } }; }
  }

  dispose() {
    this.#menuPending.clear();
    this.#newSessionDraft.clear();
    this.#sessionModels.clear();
  }

  #optionOf(event) {
    const option = event?.action?.option ?? event?.action?.value?.option;
    if (typeof option === 'string') return option;
    if (Array.isArray(option) && typeof option[0] === 'string') return option[0];
    if (option && typeof option === 'object' && typeof option.value === 'string') return option.value;
    return null;
  }

  /** Current model selection from the durable projection, with menu-map fallback. */
  async #modelSelectionFor(sessionId) {
    if (!sessionId) return null;
    if (typeof this.#harness.sessionProjections !== 'function') return this.#sessionModels.get(sessionId) ?? null;
    const projections = await this.#harness.sessionProjections(sessionId).catch(() => null);
    const projected = projections?.modelSelection?.next ?? projections?.modelSelection?.lastUsed ?? null;
    if (projected) {
      this.#sessionModels.set(sessionId, projected);
      if (this.#sessionModels.size > 500) this.#sessionModels.delete(this.#sessionModels.keys().next().value);
      return projected;
    }
    return this.#sessionModels.get(sessionId) ?? null;
  }

  async #handle(action, event) {
    const chatId = event?.context?.open_chat_id ?? null;
    const messageId = event?.context?.open_message_id ?? null;
    if (!chatId) return { toast: { type: 'info', content: '会话信息缺失' } };
    const chatKey = `chat:${chatId}`;
    const option = this.#optionOf(event);
    const operator = event?.operator?.open_id ?? event?.operator?.operator_id?.open_id ?? null;
    const services = this.#services();
    if (!this.#canManage(chatKey, operator)) {
      return { toast: { type: 'warning', content: '只有管理员可以在群里执行这个操作' } };
    }
    if (action === 'menu_cancel') {
      this.#menuPending.delete(chatKey);
      return { toast: { type: 'info', content: '已取消待应用的变更' } };
    }

    if (PICKERS.has(action)) {
      if (!option) return { toast: { type: 'info', content: '没有选择任何值' } };
      const data = await collectMenuData(services, chatKey);
      if (option === currentMenuValue(data, action)) {
        this.#menuPending.get(chatKey)?.delete(action);
        return undefined;
      }
      const label = menuOptionLabel(data, action, option);
      const pending = this.#menuPending.get(chatKey) ?? new Map();
      pending.set(action, { action, value: option, label });
      this.#menuPending.set(chatKey, pending);
      // 静默记录：下拉每次选择都会回调，提示音会变成噪音，点「调整」时才反馈
      return undefined;
    }

    if (action === 'menu_apply') {
      const pending = this.#menuPending.get(chatKey);
      if (!pending || pending.size === 0) {
        return { toast: { type: 'info', content: '没有待应用的变更' } };
      }
      // 顺序：工作区会解绑会话，先做；随后再绑定会话、切换模型与强度。
      const order = ['workspace_pick', 'session_pick', 'model_pick', 'reasoning_pick'];
      const items = [];
      for (const kind of order) {
        const item = pending.get(kind);
        if (!item) continue;
        const result = await this.#applyMenuChoice(item, { chatKey });
        if (!result?.ok) return { toast: result?.toast ?? { type: 'warning', content: '切换失败' } };
        pending.delete(kind);
        items.push({ title: item.label, detail: result.detail ?? '' });
      }
      if (pending.size === 0) this.#menuPending.delete(chatKey);
      if (items.length > 0) {
        await this.#bot.sendCard(chatId, adjustCard({ items }))
          .catch(() => this.#bot.sendText(chatId, `已调整：${items.map((item) => item.title).join('、')}`));
      }
      return { toast: { type: 'success', content: `已应用 ${items.length} 项变更` } };
    }

    if (action === 'new_session') {
      const data = await collectMenuData(services, chatKey);
      const draft = this.#newSessionDraft.get(chatKey) ?? {};
      const model = draft.model ?? data.model ?? null;
      await this.#bot.sendCard(chatId, newSessionCard({
        workspaces: data.workspaces,
        models: data.models.map((item) => ({
          ...item,
          current: model ? item.value === `${model.provider}/${model.model}` : item.current,
        })),
        efforts: (data.efforts ?? []).map((item) => ({
          ...item,
          current: model?.reasoningEffort ? item.value === model.reasoningEffort : item.current,
        })),
        presets: data.presets,
        draft: { workspace: draft.workspace ?? data.currentWorkspace },
      }));
      return { toast: { type: 'info', content: '请在新卡片里设置后点「创建」' } };
    }
    if (DRAFT_PICKERS.has(action)) {
      if (!option) return undefined;
      const draft = { ...(this.#newSessionDraft.get(chatKey) ?? {}) };
      if (action === 'ns_workspace') draft.workspace = option;
      if (action === 'ns_preset') draft.preset = option;
      if (action === 'ns_model') {
        const [provider, ...rest] = option.split('/');
        draft.model = { provider, model: rest.join('/') };
      }
      if (action === 'ns_reasoning') {
        draft.model = { ...(draft.model ?? {}), reasoningEffort: option };
      }
      this.#newSessionDraft.set(chatKey, draft);
      return undefined;
    }
    if (action === 'new_session_create') {
      const draft = this.#newSessionDraft.get(chatKey) ?? {};
      this.#newSessionDraft.delete(chatKey);
      const previous = this.#state.sessionFor(chatKey);
      await this.#state.unbindSession(chatKey);
      this.#forgetSession(previous, chatKey);
      await this.#state.setOverride?.(chatKey, {
        workspace: draft.workspace ?? null,
        model: draft.model ?? null,
        preset: draft.preset ?? null,
      });
      const readyText = '已按所选配置准备新会话，发送任意消息即可开始。';
      return {
        toast: { type: 'success', content: '新会话已就绪' },
        card: { type: 'raw', data: noticeCard(readyText, '新会话已就绪') },
      };
    }
    if (action === 'compact') {
      const sessionId = this.#state.sessionFor(chatKey);
      if (!sessionId) return { toast: { type: 'info', content: '当前还没有可压缩的会话' } };
      try {
        const value = await this.#harness.compact?.(sessionId);
        const result = value?.result ?? value ?? {};
        if (result.kind === 'error') {
          return { toast: { type: 'warning', content: result.text ?? '压缩失败' } };
        }
        const text = result.text === 'No compactable history yet.' ? '没有可压缩的历史。' : (result.text ?? '已触发压缩');
        await sendNotice(this.#bot, chatId, `上下文压缩：${text}`, '上下文压缩');
        return { toast: { type: 'success', content: '压缩完成' } };
      } catch (error) {
        return { toast: { type: 'warning', content: `压缩失败：${error.message}` } };
      }
    }
    if (action === 'new_session_cancel') {
      this.#newSessionDraft.delete(chatKey);
      if (messageId) await this.#bot.deleteMessage?.(messageId).catch(() => undefined);
      return undefined;
    }
    if (action === 'stats_toggle' || action === 'tools_toggle') {
      const isStats = action === 'stats_toggle';
      const enabled = isStats
        ? this.#state.statsFor?.(chatKey) === true
        : this.#state.toolsFor?.(chatKey) === true;
      if (isStats) await this.#state.setStats?.(chatKey, !enabled);
      else await this.#state.setTools?.(chatKey, !enabled);
      // The rebuilt menu shows current values; drop hidden pending picks.
      this.#menuPending.delete(chatKey);
      const card = await buildMenuCard(services, { chatKey });
      return {
        toast: { type: 'success', content: `${isStats ? 'Token 统计' : '工具调用'}已${enabled ? '关闭' : '开启'}` },
        card: { type: 'raw', data: card },
      };
    }
    if (action === 'menu_close') {
      // Closing discards unapplied dropdown picks and any new-session draft.
      this.#menuPending.delete(chatKey);
      this.#newSessionDraft.delete(chatKey);
      if (messageId) await this.#bot.deleteMessage?.(messageId).catch(() => undefined);
      return undefined;
    }
    return undefined;
  }

  /** Apply one pending menu choice; returns { ok, detail, toast }. */
  async #applyMenuChoice(pending, { chatKey }) {
    const sessionId = this.#state.sessionFor(chatKey);
    if (pending.action === 'session_pick') {
      const sessions = await this.#harness.listSessions().catch(() => []);
      if (!sessions.some((item) => item.sessionId === pending.value)) {
        return { ok: false, toast: { type: 'warning', content: '这个会话已不存在' } };
      }
      const previous = this.#state.sessionFor(chatKey);
      await this.#state.bindSession(chatKey, pending.value);
      if (previous && previous !== pending.value) {
        this.#forgetSession(previous, chatKey);
      }
      return { ok: true, detail: '后续消息进入该会话' };
    }
    if (pending.action === 'workspace_pick') {
      await this.#state.setOverride?.(chatKey, { workspace: pending.value });
      await this.#state.unbindSession(chatKey);
      this.#forgetSession(sessionId, chatKey);
      return { ok: true, detail: '下一条消息会在该目录新建会话' };
    }
    if (pending.action === 'model_pick') {
      const [provider, ...rest] = pending.value.split('/');
      const selection = { provider, model: rest.join('/') };
      if (sessionId) {
        await this.#harness.selectModel(sessionId, selection);
        this.#sessionModels.set(sessionId, selection);
        if (this.#sessionModels.size > 500) this.#sessionModels.delete(this.#sessionModels.keys().next().value);
        return { ok: true, detail: '当前会话立即生效' };
      }
      await this.#state.setOverride?.(chatKey, { model: selection });
      return { ok: true, detail: '下一条消息的新会话生效' };
    }
    if (pending.action === 'reasoning_pick') {
      const current = sessionId
        ? (await this.#modelSelectionFor(sessionId))
          ?? this.#state.overrideFor?.(chatKey).model
          ?? this.#services().config().model
          ?? null
        : (this.#state.overrideFor?.(chatKey).model ?? this.#services().config().model ?? null);
      if (!current?.provider || !current?.model) {
        return { ok: false, toast: { type: 'warning', content: '先选择模型，再调整思考强度' } };
      }
      const selection = { ...current, reasoningEffort: pending.value };
      if (sessionId) {
        await this.#harness.selectModel(sessionId, selection);
        this.#sessionModels.set(sessionId, selection);
        if (this.#sessionModels.size > 500) this.#sessionModels.delete(this.#sessionModels.keys().next().value);
      } else {
        await this.#state.setOverride?.(chatKey, { model: selection });
      }
      return { ok: true, detail: sessionId ? '当前会话立即生效' : '下一条消息的新会话生效' };
    }
    return { ok: false, toast: { type: 'info', content: '没有待切换项' } };
  }

}
