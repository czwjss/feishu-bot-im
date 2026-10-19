# 飞书机器人

把 DeepSeek Harness 接入飞书：在聊天里派任务、看执行过程、收结果文件。

[![npm](https://img.shields.io/npm/v/@czwjss/feishu-bot-im)](https://www.npmjs.com/package/@czwjss/feishu-bot-im)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22-brightgreen)](package.json)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek%20Harness-0.2.x-blue)](https://www.npmjs.com/package/@deepseek-ai/dsh)

## 它能做什么

- **多机器人**：一个 DSH 里接入多个飞书机器人，各自独立的连接、配置与会话绑定；
- **扫码接入**：设置页生成二维码，飞书扫码确认后自动创建应用、补齐权限并上线；也支持手动填 App ID / Secret；
- **聊天即工作**：私聊直接对话；群聊 @机器人 或引用机器人消息即可派任务；
- **卡片流式回复**：回答在卡片里实时更新，长任务也能看到进度；
- **过程可见**：折叠面板展示工具调用（耗时、参数、失败原因）与 Token 消耗（累计/本轮、缓存命中、上下文占比）；
- **话题**：一条消息开一个独立会话，适合在群里并行处理多个任务；
- **审批与提问**：飞书里直接批准/拒绝或点选答案；
- **文件收发**：图片、文件可发给机器人；机器人也能回传文件；
- **上下文注入**：每条消息带上群名、发言者等来源信息，用户气泡保持干净；
- **主动投递**：通过 `im_feishu_deliver` 把消息推到指定群或用户。

## 快速开始

**方式 A：从 npm 安装（推荐）**

在 DSH 的插件设置中安装 `@czwjss/feishu-bot-im`，或使用插件管理器：

```
@czwjss/feishu-bot-im@0.1.0
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

## 常用命令

| 命令 | 作用 |
|---|---|
| `/menu` | 选择会话 / 工作区 / 模型 / 思考强度；也可手动触发上下文压缩 |
| `/new` | 换一个全新会话 |
| `/stop` | 停止当前任务 |
| `/topic 标题` + 正文 | 开一个独立话题处理任务 |
| `/topic-sync` | 把话题结论同步回主会话 |

## 使用提示

- 群聊只有 @机器人 或引用机器人消息才会响应；
- 群里要并行做多件事，用 `/topic` 给每个任务开一个话题；
- 群内的 `/new`、`/stop`、调整配置默认需要管理白名单成员操作；
- 把飞书聊天绑定到 Web 会话时，Web 侧的任务不会向飞书推送卡片或审批。

更多话题用法见 [docs/topics.md](<docs/topics.md>)。

## License

MIT © 2026 czwjss

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=czwjss/feishu-bot-im&type=Date)](https://star-history.com/#czwjss/feishu-bot-im&Date)
