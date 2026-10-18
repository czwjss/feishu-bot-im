# 飞书机器人（@czwjss/feishu-bot-im）

DeepSeek Harness 的飞书 IM 插件：一个飞书聊天绑定一个 DSH 会话，支持多机器人、扫码/手动接入、卡片流式回复、话题、上下文注入，以及工具调用与 Token 用量展示。

- 运行环境：Node.js ≥ 22，DeepSeek Harness 0.2.x
- 依赖：`@larksuiteoapi/node-sdk`、`qrcode`

## 功能

### 接入与生命周期

- **多机器人**：每个机器人独立的 App Secret、状态文件、长连接、设置与会话绑定；
- **扫码接入**：飞书设备授权流，Host 生成二维码（5 分钟倒计时），确认后自动创建应用、补齐权限并连接；
- **手动接入**：填写 App ID / App Secret，Host 校验后写入凭据库；
- **重连 / 删除**：删除只清理本机配置与密钥，不影响飞书应用本身；
- **连接自愈**：定时轮询 WebSocket 状态并记录 `state / inbound / lastError`。

### 消息收发

- 私聊直接对话；群聊**只响应 @机器人 或引用/回复机器人消息**；
- 卡片流式更新，更新失败时回退为文本气泡；
- 消息状态表情：处理中「在做了」、完成「完成」、停止/失败「晕」；
- 图片、文件入站；工具 `im_feishu_return_file` 按扩展名回传图片或文件；
- 工具 `im_feishu_deliver({ target, text, bot? })` 主动投递到 `oc_…`（群）或 `ou_…`（用户）。

### 过程与用量展示

正文下方有两个可折叠面板（默认收起，点标题展开）：

- **🤖 工具调用**：标题为 `总耗时 · 首字 · 思考耗时 · 工具调用数 · 失败数`；展开是最近 20 条有序列表（编号 001 起，参数截断 30 字，失败带原因）；
- **🪙 Token**：标题为 `累计 · 本轮 · 缓存命中 · 上下文`，消耗 = 输入 + 输出；展开是最近 20 条明细，子智能体聚合为一行并标注步数。

面板内容最多每 10 秒刷新一次，答案文字仍按流式更新；终稿强制刷新。「过程详细度」可在通用设置中切换详细/简要。

### 命令与会话

| 命令 | 说明 |
|---|---|
| `/menu` | 卡片菜单：会话 / 工作区 / 模型 / 思考强度，改动只作用于本聊天 |
| `/new` | 解除当前会话绑定，下一条消息新建会话 |
| `/stop` | 停止当前轮 |
| `/topic 标题` + 换行正文 | 以你的消息为根创建独立话题会话；不带参数时列出话题 |
| `/topic-sync` | 话题内使用：生成结论并同步回主会话 |

- 群内管理白名单 `access.managers`：`/new`、`/stop`、菜单调整、新会话仅名单内成员可执行，**留空 = 无人可执行**；私聊不受限制；
- 绑定已有会话时：**Web 侧触发的轮次不会推送到飞书**（答案卡片、审批与提问都留在 Web）；当前轮不是飞书发起时，飞书消息强制排队，不插入 Web 轮次；
- 忙碌策略私聊/群聊各自可设：排队，或插入为补充指令。

### 上下文注入

- 每条入站消息注入一份 `<feishu_bot_source>`，字段：`senderId`、`senderName`、`botId`、`sentAt`，群聊可加 `conversationTitle`；
- 注入内容作为前置消息行，**不进入用户气泡**；
- guidance 通过会话级 `systemPrompt.context` 注入；
- 话题结论通过 `/topic-sync` 写入主会话上下文。

## 安装与启用

1. 将本仓库放到 DSH 可访问的 profile/工作区目录；
2. 安装依赖：

   ```bash
   pnpm install    # 或 npm install
   ```

3. 在 DSH Web 的插件设置中启用 `@czwjss/feishu-bot-im`（本地目录可通过 `plugin_manager` 以 `include:` 方式启用）；
4. 打开插件设置页，添加机器人。

## 首次接入

- **扫码（推荐）**：设置页点「添加机器人」→ 二维码 → 飞书扫码确认。Host 会自动创建应用、写入所需 scope/事件并连接；
- **手动**：填写 App ID / App Secret，Host 校验凭据后保存。

扫码补齐会写入以下权限：

- scopes：`im:message.p2p_msg:readonly`、`im:message.group_at_msg:readonly`、`im:message:send_as_bot`、`im:resource`、`contact:user.base:readonly`、`im:chat:readonly`、`cardkit:card:write`
- events：`im.message.receive_v1`

## 使用提示

- 群聊必须 @机器人 或引用机器人消息才会响应；「响应其它机器人消息」开启后仍需 @/引用；
- 群里需要并行处理多个任务时，用 `/topic` 为每个任务开独立会话；
- 更多话题细节见 [docs/topics.md](<docs/topics.md>)。

## 数据与安全

- 机器人配置、状态、日志：`~/.dsh/integrations/im-feishu/`；
- App Secret 保存在 DSH 凭据库（`~/.dsh/.credentials.yaml`），**不写入本仓库**；
- 仓库中的测试与示例只使用合成的 App ID / open_id / chat_id，可安全提交；
- 提交前请确认没有把本机凭据、状态文件或真实会话 ID 带进版本库（`.gitignore` 已排除依赖、日志与本地环境文件）。

## 架构

| 文件 | 职责 |
|---|---|
| `index.js` | 插件入口：Host 钩子、RPC、工具注册 |
| `client.js` | 设置页（React，多机器人卡片、扫码弹层） |
| `src/runtime.js` | `BotRuntime`（单机器人）+ `RuntimeManager`（多机器人路由） |
| `src/bridge.js` | 入站分派、命令、审批/提问、话题、轮次来源判定 |
| `src/turn.js` | 单轮生命周期：进度、答案卡、工具/Token 面板、回复 |
| `src/cards.js` | 卡片构造（答案、审批、提问、菜单、新会话、调整结果） |
| `src/feishu.js` | 飞书 SDK 封装：收发消息、上传下载、长连接 |
| `src/access.js` | 准入规则：私聊、群聊 @/引用、白名单 |
| `src/commands.js` | 斜杠命令实现 |
| `src/context-enhancement.js` | 注入字段白名单、guidance 渲染与转义 |
| `src/injected-context.js` | `<feishu_bot_source>` 拆分为独立消息行 |
| `src/progress.js` | 工具与 Token 面板的格式化 |
| `src/inbound.js` | 图片/文件入站构建 |
| `src/message-text.js` | 消息取文（text/post） |
| `src/registration.js` | 扫码设备授权状态机 |
| `src/rpc.js` | `/api/im-feishu` 管理接口 |
| `src/slash-commands.js` | 原生斜杠命令对账 |
| `src/tool.js` | 文件回传与主动投递工具 |
| `src/config.js` | 多机器人配置与状态存储 |

## 开发与测试

```bash
npm test   # 离线，107 条场景/断言，无需任何飞书凭据
```

测试分布：bridge 34 · rpc 13 · tool 9 · runtime 10 · context 5 · injected-context 6 · feishu-e2e 7 · registration 12 · slash 4 · progress 7。

测试使用合成的飞书客户端与 Host 接口，不会访问真实飞书 API。

## 已知限制

- 一个聊天默认一个会话；需要并行时使用话题（每个话题独立会话）；
- 话题根消息（你的原消息）无法被机器人修改；
- 预设只能在新建会话时选择；
- 子智能体的审批/提问会回落到 Web 端处理，不会出现在飞书；
- 飞书卡片按钮颜色、组件能力有限（仅支持白/蓝/红等）；
- 子智能体在父轮结束后才返回的用量不会被计入。
