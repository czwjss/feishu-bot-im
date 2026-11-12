# 飞书机器人

把 DeepSeek Harness 接入飞书：在聊天里派任务、看执行过程、收结果文件。

[![npm](https://img.shields.io/npm/v/@czwjss/feishu-bot-im)](https://www.npmjs.com/package/@czwjss/feishu-bot-im)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-blue)](https://www.npmjs.com/package/@deepseek-ai/dsh)

## 它能做什么

- **多机器人**：一个 DSH 里接入多个飞书机器人，各自独立的连接、配置与会话绑定；
- **新会话默认权限**：设置通用面板可选择新会话使用的权限档位（跟随 Host 默认 / 仅可查看 / 工作区内修改 / 完全权限等）；
- **扫码接入**：设置页生成二维码，飞书扫码确认后自动创建应用、补齐权限并上线；也支持手动填 App ID / Secret；
- **聊天即工作**：私聊直接对话；群聊 @机器人 或引用机器人消息即可派任务；引用消息会抓取原文作为上下文；引用图片和卡片内嵌图片会下载为原生图片附件；
- **卡片流式回复**：回答卡通过 CardKit 打字机式输出，工具调用/Token 面板在流式期间按组件更新；CardKit 不可用时自动回退普通卡片；
- **过程可见**：回复卡片可分别显示工具调用（耗时、参数、失败原因）与 Token/上下文统计，两者默认关闭；菜单常驻展示当前会话的 Token/上下文统计，并可在菜单里分别开启这两类卡片面板；
- **话题**：一条消息开一个独立会话，适合在群里并行处理多个任务；
- **群聊旁听**：默认开启；记录未 @ 你的最近 20 条消息作为上下文（可调，最大 500），下次 @ 时自动补上；图片/文件只留占位符，需要时模型会请你重发；
- **at 人**：默认开启；涉及需要某人决策、批准、确认或选择时用 at 提及当事人，纯信息同步和闲聊不要 at，不确定具体当事人也不要 at；模型直接输出 `<at id=[open_id]></at>` 并替换成完整 open_id，插件校验后保留或擦除，at 所有人默认禁止；
- **审批与提问**：飞书里直接批准/拒绝或点选答案；
- **文件收发**：图片、文件可发给机器人；机器人也能回传文件；
- **上下文注入**：每条消息带上群名、发言者等来源信息，用户气泡保持干净；
- **主动投递**：先用 `feishu_bot_chats` 查机器人所在群和精确 chat id，再用 `feishu_bot_send` 发送独立卡片或文件；文本卡片可通过 `title` 设置标题、`color` 设置标题颜色，省略 `chatId` 时发当前 Session 绑定的飞书群。
- **Web 发飞书**：Web turn 通过 `feishu_bot_send` 发送独立卡片/文件；Web 轮次不生成飞书流式卡片。
- **人物查询**：`feishu_bot_people` 按姓名模糊查询群成员并返回精确 open_id；群成员缓存 6 小时，可主动 refresh。
- **历史查询**：`feishu_bot_messages` 按群、话题和时间范围读取历史；可选本地关键词筛选，不是飞书全文搜索。
- **用户身份（飞书分身）**：Host 默认挂载 `feishu_avatar_*` 工具，以你本人身份读群历史、按群或联系人发卡片/图片/文件；复用机器人应用，设备授权连接，不需要重定向 URL。
- **分身消息监听**：在「分身」弹层选择会话后，以你本人身份轮询新消息，攒批交给 Worker 会话处理；Worker 用 `feishu_avatar_send` 回复（可带 `replyToMessageId` 引用原消息、`title` 按需设置标题）。流式卡片收尾后才入库；群聊默认只处理 @我 / 回复我，可改关键词。

## 快速开始

**方式 A：从 npm 安装（推荐）**

在 DSH 的插件设置中安装 `@czwjss/feishu-bot-im`，或使用插件管理器：

```
@czwjss/feishu-bot-im
```

**方式 B：从源码启用**

```bash
git clone https://github.com/czwjss/feishu-bot-im.git
cd feishu-bot-im
pnpm install    # 或 npm install
```

然后在 DSH Web 的插件设置中启用本地目录。

**接入飞书：**

1. 打开插件设置页，点「添加机器人」；
2. 用飞书扫码确认（或手动填写 App ID / Secret）；
3. 扫码会自动申请所需权限（消息收发、资源上传、群信息读取等）；
4. 在飞书私聊里发一条消息，或在群里 @机器人 开始。


## 用户身份（飞书分身）

除了机器人身份，插件还会以你本人身份操作飞书：

```text
feishu_avatar_me / feishu_avatar_messages / feishu_avatar_send
  复用某个机器人的 App ID / App Secret
  设备授权（Device Flow）连接，不需要重定向 URL
```

这些工具由 Host 的 `feishu-bot-im` 插件**默认注册**，和其他 Host 工具一样
无需修改 Agent 预设。旧预设里的 `@czwjss/feishu-bot-im/user-identity`
子插件仍可保留，但已经是 no-op，不会重复注册。

配置步骤、权限清单和错误码见 [docs/user-identity.md](docs/user-identity.md)。
消息接入与回复的完整链路见 [docs/message-flow-architecture.html](docs/message-flow-architecture.html)。

## 常用命令

| 命令 | 作用 |
|---|---|
| `/menu` | 四个下拉选择会话 / 工作区 / 模型 / 思考强度；常驻展示当前会话的 Token 用量与上下文占用；两个独立开关分别控制回复卡片的 Token 统计与工具调用（默认关闭）；按钮：新会话、压缩、调整、关闭 |
| `/new` | 换一个全新会话 |
| `/stop` | 停止当前任务 |
| `/topic 标题` + 正文 | 开一个独立话题处理任务 |
| `/topic-sync` | 把话题结论同步回主会话 |

## 使用提示

- 群聊里只有 @机器人 或引用机器人消息才会触发回复；旁听默认开启，只补充上下文、不触发回复；
- 群内 @ 能力默认开启、@所有人默认禁止，可在群聊设置里调整；未知或非法的 open_id 会被擦除；
- 群里要并行做多件事，用 `/topic` 给每个任务开一个话题；
- 群内的 `/new`、`/stop`、调整配置与**审批按钮**默认需要管理白名单成员操作；普通任务和提问选择不受限制；
- 把飞书聊天绑定到 Web 会话时，Web 侧任务不会向飞书推送卡片或审批；需要发消息时使用 `feishu_bot_send`。

### 群聊旁听

旁听**默认开启**，在设置 → 群聊里可以取消勾选。开启后，机器人会记录群里**没有 @ 它**的消息，下一次被 @ 时作为上下文注入（只注入上次之后的新消息，不会重复）。

- 需要 `im:message.group_msg` 权限：可在飞书开发者后台开通，或点设置页的「补齐权限」扫码授权；未授权时机器人收不到非 @ 消息，旁听不会生效；
- 默认保留最近 20 条，可设为 1-500；旁听缓冲按群聊和话题分别维护，只存在内存里，重启或重连后清空；
- 注入格式为 `[2026-10-19 15:33:33.820 +08:00] 名称：内容`（时间自带时区，模型可直接引用）；需要 at 某人时先调用 `feishu_bot_people` 查 open_id；
- **图片/文件只记占位符**（`[图片]`、`[文件：报告.pdf]`），不会下载任何媒体；旁听块会告诉模型“需要内容时请用户 @ 机器人重新发送”，模型会在回复里向你索取；
- 旁听内容来自群成员，属于不可信输入；块头会提示模型只当背景信息，仍建议只把机器人放在可信群里使用。

### 查询历史消息

- 用 `feishu_bot_messages` 按群、话题、时间范围读取历史；
- 支持分页，单次最多返回 50 条；
- 可选 `query` 在本次拉取范围内做本地关键词筛选，不是飞书全文搜索；
- 机器人需要有 `im:message.group_msg` 权限；
- 更早的消息通过历史工具回查，旁听只负责最近的实时上下文。

### 让机器人 at 人

- 默认开启；涉及需要某人决策、批准、确认或选择时用 at 提及当事人，纯信息同步和闲聊不要 at，不确定具体当事人也不要 at；
- 模型先调用 `feishu_bot_people` 按姓名查询，拿到完整 open_id 后输出 `<at id=[open_id]></at>`，并完整替换占位符；禁止截断或保留占位符；
- 旁听记录里的发送者只注入**名字**，不再携带 open_id；当前消息也不再注入 people 块；需要 at 时由 `feishu_bot_people` 查精确 ID；
- 卡片里保持 `<at id=ou_xxx></at>`；文本降级时转成 `<at user_id="ou_xxx">名称</at>`；
- 未知/非法 open_id、at 能力关闭、at 所有人被禁止时，标签会被**整段擦除**，不会误 at；
- `at 所有人` 默认禁止，可在群聊设置里放开；提示词只说明“按需 at”，不写 at 所有人的禁令，是否允许由插件强制执行。

更多话题用法见 [docs/topics.md](<docs/topics.md>)。

## License

MIT © 2026 czwjss

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=czwjss/feishu-bot-im&type=Date)](https://star-history.com/#czwjss/feishu-bot-im&Date)

## 开发 / 构建

Client 源码按功能拆分在 `client/`，用 esbuild 生成单文件 `client.js`：

```bash
pnpm run build:client
```

`npm test` 会先自动构建；发布前 `prepublishOnly` 也会构建。
