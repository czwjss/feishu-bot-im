# 飞书分身：开发架构

本文描述当前源码的职责与接口。使用入口见[使用与排障](user-identity.md)，消息规则集中在[监听与派发规则](user-message-monitor-design.md)。

## 运行结构

`index.js` 在 Host 中创建一套授权服务、管理服务和监听器，注册六个全局分身工具和相应的提示词。插件不提供单独的分身子路径插件或预设。

```mermaid
flowchart TB
  UI["飞书机器人IM 机器人工作台"] --> RPC["管理 RPC"]
  RPC --> Identity["授权与配置管理"]
  RPC --> Monitor["消息监听器"]
  Identity --> Auth["用户 token 生命周期"]
  Monitor --> Auth
  Monitor --> Store["游标、正文与待处理批次"]
  Store --> Dispatch["合批与派发"]
  Dispatch --> Worker["DSH Worker"]
  Worker --> Tools["全局分身工具"]
  Tools --> Auth
  Auth --> Feishu["飞书接口"]
```

普通 DSH 会话也可以直接调用全局分身工具。自动 Worker 的区别是绑定了一个飞书会话，并获得专属动态上下文；工具本身不限制只能发送到绑定目标。

## 源码职责

路径均相对于 `src/user-identity/`，除非另有说明。

| 文件 | 职责 |
|---|---|
| `app.js` | 从机器人配置及 DSH credentials 解析应用 |
| `config.js` | 用户身份配置与默认 scope 集合 |
| `oauth.js` | Device Flow、设备码轮询、刷新 token 的协议调用 |
| `connect.js` | 设备授权状态机、轮询定时器与取消控制 |
| `auth.js` / `token-store.js` | 凭证校验、刷新合并、用户信息及持久化 |
| `manager.js` | 主面板授权操作、二维码及后台续期 |
| `api.js` / `errors.js` | 用户身份 OpenAPI、群名搜索与会话列表、消息解析、卡片与媒体发送、错误类型 |
| `tools.js` / `contributions.js` | 分身工具契约、执行与 Host 全局注册 |
| `cloud-tool.js` / `cloud-discovery.js` | 云空间工具及其操作分派、统一搜索、文件夹清单、目标校验和翻页 |
| `wiki-tool.js` / `cloud-wiki.js` | 知识库工具及其操作分派、知识空间清单、页面层级浏览和底层文档解析 |
| `cloud-document-read.js` / `cloud-document-write.js` | 云空间与知识库工具共用的文档正文读取、翻页和编辑 |
| `cloud-drive-write.js` / `cloud-upload.js` | 云空间资源管理与文件上传 |
| `monitor.js` | 手动群聊及自动发现的私聊、游标轮询、流式卡片收尾、触发判断与背景记录 |
| `monitor-store.js` | 监听和私聊开关、手动群聊配置、消息状态归一化、队列容量与 Worker 绑定 |
| `auto-reply.js` | 合批调度、Worker 复用 / 重建、消息快照投递与清队 |
| `worker-context.js` | 默认回复模板、Worker 的两块带标签动态上下文 |
| `../policy.js` | 全局飞书工具与身份约定 |
| `../rpc.js` / `../contracts.js` | 主面板接口与前后端共用的方法名 |
| `../../client/identity.js` / `../../client/avatar-reply-settings.js` | 状态页内的授权详情与操作、分身归属校验、有效授权时的自动回复设置 |
| `../../client/avatar-workspace.js` | 监听列表、内嵌 Worker 选择、设置与自动保存 |
| `../../client/drawer.js` / `../../client/monitor-detail.js` | 原生抽屉、按需消息快照和历史 Worker 入口 |
| `../management.js` | 汇总机器人、会话绑定和 Host Session 的只读状态 |
| `../../client/hooks.js` | 查询、串行保存、轮询及编辑草稿管理 |

## 授权生命周期

首次连接与重新授权使用同一套请求权限，涵盖消息、云文档、云空间管理和知识库读取。授权状态根据飞书签发的 scope 列出缺失权限，自动回复设置另外检查消息功能所需的权限。

设备授权依次取得设备码、等待用户确认、换取 token、查询用户信息，再保存凭证。`manager.js` 隔离设置保存及二维码生成的旧请求；`connect.js` 用请求代次和取消信号隔离设备流程。取消或发起新连接后，旧请求不能覆盖新状态；取消信号传递到设备请求、轮询、用户信息查询和待提交的 token 保存。

`auth.js` 在使用凭证前重新读取配置与 token，核对 appId 和授权用户。access_token 剩余不足 60 秒时按需刷新；工具遇到已知 token 失效错误码时，强制刷新并重试一次。

`manager.js` 每 15 分钟检查一次凭证：access_token 剩余不超过 10 分钟，或 refresh_token 剩余不超过 2 天时尝试续期。过期时间取 OAuth 响应，不写死 token 寿命。

刷新请求在同一进程内按 token 文件路径合并。刷新返回后会重新读取凭证，避免用旧结果覆盖已经变更的授权。新设备授权只有在应用和 open_id 都相同时，才允许沿用响应中省略的旧凭证字段。

当前没有跨进程刷新锁；不要让多个 DSH 进程共用同一份 token 文件。

## 工具与提示词的范围

| 内容 | 注册入口 | 范围 |
|---|---|---|
| `feishu_avatar_me` / `chats` / `messages` / `send` / `cloud` / `wiki` | `tools.register()` | Host 全局 |
| 飞书通用约定与本人身份能力 | `systemPrompt.section()` | 全局 |
| 会话信息 | `systemPrompt.context()` | 按持久化 Worker sessionId 匹配 |
| 自定义回复规则 | `systemPrompt.context()` | 同上；每次模型请求读取最新配置 |
| 本批正文、ID、时间与背景 | `session.prompt()` | 每次派发的用户消息快照 |

完整标签与规则来源见[Worker 输入](user-message-monitor-design.md#worker-输入)。无需等待 Agent 就绪后补挂工具，也没有 `reply` / `skip` 决策工具或批次令牌校验。

## 持久化与并发

默认数据目录为 `~/.dsh/integrations/im-feishu`，实际路径由 Host 初始化时确定。

| 文件 / 服务 | 保存内容 |
|---|---|
| `user-identity.json` | 机器人应用选择与 scope |
| `user-token.json` | appId、用户 token、有效期、scope、授权用户与授权时间 |
| `monitor.json` | 监听总开关、私聊启用时间、手动群聊及触发配置、Worker 工作区 / 预设、转人工关键词、回复规则 |
| `monitor-state.json` | 自动发现的私聊、游标、分页进度、去重 ID、正文、待处理批次、待收尾卡片、Worker 会话绑定 |
| DSH credentials | 机器人应用 App Secret |

JSON 文件以 0600 权限写入，目录按 0700 创建。`src/json-store.js` 串行执行每个 store 的更新，并通过临时文件替换实现原子写入；写成功才发布内存状态。这不是文件加密或跨文件事务。

配置更新与单聊天状态更新在写队列内基于最新状态合并；正文、游标和新批次 ID 一起提交。派发确认只移除本次快照中的 ID，保留并发到达的新消息。Worker 绑定独立于批次保存，清队、重建 Worker 或移除监听后，已接收任务仍能读取目标会话。

主面板及管理 RPC 不返回 token 明文。停止监听和断开授权分别控制调度与凭证；两者都不撤销 Host 已接收的 Worker 任务。

## 管理 RPC

方法名以 `src/contracts.js` 为准，处理入口为 `src/rpc.js`。

| 方法 | 输入 / 用途 |
|---|---|
| `user.status` | 授权、应用、缺失 scope 与设备连接状态 |
| `user.connect.begin` | `{ botId }`，发起设备授权，统一申请消息与云空间权限 |
| `user.connect.cancel` | 取消设备授权流程 |
| `user.disconnect` | 清除本地用户 token |
| `user.refresh` | 强制尝试刷新 token |
| `user.monitor.status` | 监听配置、`directEnabled` 私聊开关、`directError` 私聊发现错误、待处理数、Worker、计划派发及最近投递时间 |
| `user.monitor.detail` | `{ chatId }`，本地消息快照、待收尾卡片和历史 Worker；只读 |
| `user.monitor.chats` | 发现可手动添加的群聊 |
| `user.monitor.add` / `remove` | 添加群聊 / 按 chatId 移除群聊 |
| `user.monitor.enable` | `{ enabled }`，启停监听调度 |
| `user.monitor.direct.enable` | `{ enabled }`，设置是否自动发现并监听私聊 |
| `user.monitor.chat.set` | `{ chatId, mode?, keywords?, replyToBots? }`，配置已添加的群聊 |
| `user.monitor.worker.options` | 工作区、预设及默认工作区选项 |
| `user.monitor.worker.set` | `{ workspaceId?, workspacePath?, preset? }` |
| `user.monitor.handoff.set` | `{ keywords }`，空列表关闭转人工匹配 |
| `user.monitor.reply-rules.set` | `{ rules }`，空白恢复默认模板 |
| `user.monitor.poll` | 立即拉取；只有已启用监听时执行 |
| `user.monitor.flush` | `{ chatId? }`，指定会话或全部积压；无效 chatId 拒绝，不退回全量派发 |
| `management.snapshot` | `{ botId?, refresh? }`，全量或指定机器人的状态、可见群与已知绑定、Host Session 摘要；详见[主面板](management-panel.md) |

主面板对所有 `user.monitor.*` 以及 `user.refresh` / `user.disconnect` / `user.connect.cancel` 请求附带 `botId`。服务端在操作前校验它与当前 `config.app.botId` 一致，否则返回 `conflict`；缺少或无效的 ID 返回 `bad-request`，用于拦截无目标请求和切换机器人后的延迟保存。`user.connect.begin` 同样必须提供 `botId`，可显式选择新应用，不受当前授权归属校验限制。这里没有新增多份分身授权或修改全局工具的目标选择。

## 验证与维护

```sh
npm test
```

该命令先构建客户端，再运行测试。`test/user-identity-*.test.mjs` 覆盖授权、工具、API、监听和上下文；`test/reliability.test.mjs` 覆盖队列、并发、分页、重启与卡片收尾；`test/client-state.test.mjs` 覆盖查询和编辑状态。`test/client-workspace.test.mjs` 覆盖主面板导航、按需查询、草稿保留、历史 Worker 内嵌与失败重试；`test/client-worker.test.mjs` 覆盖原生 Factory 接入、引用释放、加载竞争和重试；`test/management.test.mjs` 覆盖只读投影、部分失败、Worker 关系和指定会话派发。

授权生命周期与取消竞争见 `test/user-identity-lifecycle.test.mjs`。这些测试使用本地模拟接口，不会向真实联系人发送消息，也不替代真实飞书环境的验证。

修改功能时同步更新对应专题文档；默认参数以 `monitor-store.js`、权限以 `config.js`、提示词以 `policy.js` 和 `worker-context.js` 为准。文档不另存测试计数、旧工作区变更清单或已经废弃的架构建议。

流程 SVG 由 `python3 scripts/build-avatar-flow.py` 生成，HTML 入口直接引用它。修改图示时调整生成脚本后重新生成，避免两份图不一致。
