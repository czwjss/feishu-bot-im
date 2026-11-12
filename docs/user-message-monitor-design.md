# 飞书分身：消息监听与自动回复

当前状态：已实现。轮询指定会话，流式卡片收尾后入库，`回复方式=自动回复` 的会话由 Worker 会话处理批次。

机器人侧的入站流程见 [bot-inbound-flow.html](bot-inbound-flow.html)；权限清单见 [feishu-scopes.md](feishu-scopes.md)。

## 1. 边界

能做：

- 以用户身份读取私聊、群聊消息；
- 按游标轮询新消息，识别私聊 / 群聊 / @我 / 回复我 / 关键词；
- 流式卡片等收尾后再入库；
- 把一批消息交给 Worker 会话，由 Worker 以用户身份回复。

不能做：

- 收不到飞书个人收件箱的实时事件，只能轮询；
- 没有可靠的“未读数”，这里只按游标记录新消息；
- 无法保证离线期间一条不漏。

## 2. 数据流

```text
GET /im/v1/messages（用户 token）
  start_time = min(游标 - 1s, now - 120s)
  page_size = 50，按 create_time 升序，card_msg_content_type=user_card_content
      │
      ▼
逐条判定
  ├─ 流式卡片（streaming_mode=true）→ pendingCards，不入库
  ├─ 命中触发规则 → 记录并计入批次
  └─ 其余 → 记 seen、推进游标
      │
      ▼
新消息 → 攒批（防抖 45s / 最长 3min / 最多 10 条）
      │
      ▼
Worker 会话（一个会话一个 Worker，工作区/预设可配）
      │
      ▼
feishu_avatar_send / feishu_avatar_messages（用户身份）
```

## 3. 流式卡片

飞书只在卡片创建时推一次事件，之后每次刷新都不推送，所以只能主动查：

```text
listMessages 发现 streaming_mode=true
  → 记入 pendingCards（不可见、不记录）
  → 每轮轮询 getMessage 复查
      ├─ streaming_mode=false → 补进消息列表 → 按需入批
      ├─ 仍在流式 → 刷新文本，继续等
      └─ 创建超 10 分钟 → 静默丢弃（平台 10 分钟自动关流式模式）
```

## 4. 触发与回复

触发规则（每个会话独立）：

| 值 | 含义 |
|---|---|
| `all` | 全部消息 |
| `mention` | @我 或 回复我 |
| `keyword` | 关键词、@我 或 回复我 |

回复范围：

| 选项 | 含义 |
|---|---|
| 回复真人消息（默认） | 只有机器人消息的批次跳过 |
| 机器人消息也回复 | 机器人批次也处理，10 分钟内最多一次 |

## 5. 状态与并发

- 每个会话保存游标、seen 集合（500 条）、最近 50 条消息；
- 同一条消息只记一次；卡片原地刷新只更新文本；
- 轮询串行执行，避免同一 token 并发；
- Worker 会话复用；工作区/预设变更、会话归档或丢失时重建。

## 6. 已知边界

- `pendingCards` 上限 20 条，超出按归一化截断；
- 游标不越过挂起卡片，每轮会重复拉到它（一条，开销可忽略）；
- Worker 会话内的失败不会重试，消息已标记为已派发；
- 卡片收尾重放可能晚于期间到达的新消息。
