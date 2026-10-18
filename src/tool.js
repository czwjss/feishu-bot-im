/**
 * `im_feishu_return_file` — the Feishu counterpart of `dsh-im:return-file`.
 *
 * The tool sends the file immediately through the chat bound to the calling
 * Session, so the model can describe it as sent once the call succeeds.
 */
export const TOOL_NAME = 'im_feishu_return_file';

export function createReturnFileTool({ send }) {
  return Object.freeze({
    name: TOOL_NAME,
    description: 'Send one local file or image to the current Feishu chat as a native attachment. '
      + 'Only meaningful in a Feishu conversation: the chat is resolved from the calling Session. '
      + 'The file is uploaded and sent before this call returns, so report it as sent only when the result says so.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        path: {
          type: 'string',
          description: 'Absolute path, or a path relative to the bot workspace.',
        },
        name: {
          type: 'string',
          description: 'Optional display name for the attachment.',
        },
      },
      required: ['path'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          fileName: { type: 'string' },
          bytes: { type: 'number' },
          chatId: { type: 'string' },
        },
        required: ['fileName', 'bytes', 'chatId'],
      },
      render: (_args, value) => [{
        type: 'text',
        text: `已把「${value.fileName}」（${value.bytes} 字节）发送到飞书会话。`,
      }],
    },
    async execute(args, exec) {
      const path = typeof args?.path === 'string' ? args.path.trim() : '';
      if (!path) throw new Error('path 不能为空');
      return send({
        sessionId: exec?.agent?.session?.id ?? null,
        path,
        name: typeof args?.name === 'string' ? args.name : undefined,
        signal: exec?.signal,
      });
    },
  });
}


export const DELIVER_TOOL_NAME = 'im_feishu_deliver';

/** Proactive delivery: push text to a chat id or a user open_id. */
export function createDeliverTool({ send }) {
  return Object.freeze({
    name: DELIVER_TOOL_NAME,
    description: 'Push a plain-text message to one Feishu conversation (a group chat id starting with oc_ '
      + 'or a user open_id starting with ou_). Use it for reminders and scheduled reports; '
      + 'delivery is confirmed before this call returns.',
    parameters: {
      type: 'object',
      additionalProperties: false,
      properties: {
        bot: {
          type: 'string',
          description: 'Bot alias or name. Needed when this Session is not a Feishu conversation '
            + '(for example a scheduled Web task); omit inside a Feishu chat.',
        },
        target: { type: 'string', description: 'Delivery target name, id, or route (chat_id / open_id).' },
        text: { type: 'string', description: 'Message text, at most 4000 characters.' },
      },
      required: ['target', 'text'],
    },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          targetId: { type: 'string' },
          sentAt: { type: 'string' },
        },
        required: ['targetId', 'sentAt'],
      },
      render: (_args, value) => [{ type: 'text', text: `已投递到 ${value.targetId}（${value.sentAt}）` }],
    },
    async execute(args, context) {
      return send({
        sessionId: context?.agent?.session?.id,
        bot: args.bot,
        target: args.target,
        text: args.text,
      });
    },
  });
}
