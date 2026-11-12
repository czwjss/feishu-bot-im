/**
 * Worker 专属工具的作用域挂载。
 *
 * `feishu_avatar_reply` / `feishu_avatar_skip` 只注册到自动回复 Worker 那个
 * Agent 自己的 scope 里：其他会话的 Agent 既看不到也调不到，插件卸载或
 * Agent 销毁时注册随 scope 一起回收。
 */
import { createReplyTool, createSkipTool } from './tools.js';

/** Worker 专用工具定义（每次挂载复用同一组，闭包指向同一 monitor）。 */
export function createWorkerTools({ monitor }) {
  if (!monitor) throw new TypeError('createWorkerTools 需要 monitor');
  return Object.freeze([
    createReplyTool({ monitor }),
    createSkipTool({ monitor }),
  ]);
}

/**
 * 监听 Agent 创建，把 Worker 工具挂到对应 Agent 的 scope 上。
 *
 * @param {object} ctx Host 上下文。
 * @param {object} monitor 消息监听。
 * @param {object|null} logger 日志。
 * @returns {{ ensure: (sessionId: string, options?: object) => Promise<boolean>, attach: (agent: object) => boolean, dispose: () => void }}
 */
export function installWorkerTools(ctx, monitor, logger = null) {
  const tools = createWorkerTools({ monitor });
  const disposers = new Map();

  const attach = (agent) => {
    const sessionId = agent?.session?.id;
    if (!sessionId || !monitor.isAutoReplySession?.(sessionId)) return false;
    if (disposers.has(sessionId)) return true;
    const list = [];
    for (const tool of tools) {
      try {
        const dispose = agent.ctx.tools.register(tool);
        list.push(typeof dispose === 'function' ? dispose : null);
      } catch (error) {
        logger?.warn?.('[im-feishu] Worker 工具挂载失败', tool.name, error?.message ?? error);
      }
    }
    disposers.set(sessionId, list);
    return list.length > 0;
  };

  ctx.effect(() => {
    const off = ctx.on('agent/created', ({ agent }) => {
      attach(agent);
    });
    return () => {
      try {
        off?.();
      } catch {
        // 监听可能已随 scope 一起释放
      }
      try {
        dispose();
      } catch (error) {
        logger?.warn?.('[im-feishu] Worker 工具卸载失败', error?.message ?? error);
      }
    };
  }, 'feishu-bot: worker tools');

  /** 等待 Agent 就绪后挂载；会话还没起来时最多等 timeoutMs。 */
  const ensure = async (sessionId, { timeoutMs = 3_000 } = {}) => {
    if (!sessionId) return false;
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      const agent = ctx.agents?.get?.(sessionId);
      if (agent) return attach(agent);
      if (ctx.agents?.get === undefined) return false;
      if (Date.now() >= deadline) return false;
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 50);
        timer?.unref?.();
      });
    }
  };

  const dispose = () => {
    for (const list of disposers.values()) {
      for (const disposeTool of list) {
        try {
          disposeTool?.();
        } catch {
          // Agent scope 可能已经销毁
        }
      }
    }
    disposers.clear();
  };

  return { attach, ensure, dispose };
}
