# 模型工具契约

插件按需激活注册 **14 个工具**（通过 DSH `tools.register(def, { when })` 按机器人配置、分身授权状态与已授予权限动态启用）。`feishu_bot_*` 与 `feishu_avatar_*` 在 IM 侧保持 5 项能力完全对称；历史消息图片读取与文件附件下载合并为共享的 `feishu_message_attachment`；云文档与知识库按只读 / 远端写管理 / 本地文件传输划分为 3 个工具。已授权分身的基础身份（姓名 / `openId` / 邮箱）通过 `<feishu_avatar_identity>` 动态上下文提供。

| 工具 | 域 | 只读并发 | 按需激活条件 | 职责与核心结果 |
|---|---|---|---|---|
| `feishu_bot_chats` | 机器人 IM | ✅ | 已配置机器人 | 列出可见群和绑定会话；支持 `bot`/`query`/`limit`（默认 30），返回 `items`、`total`、`hasMore` |
| `feishu_bot_people` | 机器人 IM | ✅ | 已配置机器人 | 模糊查群成员 `open_id`；`query` 必填，最多返回 10 个候选及 `matched`、`hasMore` |
| `feishu_bot_messages` | 机器人 IM | ✅ | 已配置机器人 | 读历史消息（群聊/私聊/thread）或按 `messageId` 精确查单条消息，返回统一 `items` |
| `feishu_bot_send` | 机器人 IM | — | 已配置机器人 | 发送独立卡片、图片、文件或引用回复（`replyToMessageId`），返回统一回执 |
| `feishu_bot_recall` | 机器人 IM | — | 已配置机器人 | 撤回机器人自己发送的消息；返回 `recalled`、`messageId` |
| `feishu_avatar_chats` | 分身 IM | ✅ | 分身已授权 | 传 `query` 按群名搜索已加入群，省略 `query` 按活跃度列出最近会话；返回 `items`、`hasMore`、`pageToken` |
| `feishu_avatar_people` | 分身 IM | ✅ | 分身已授权 | 模糊查本人所在群成员 `open_id`；`chatId`、`query` 必填，最多返回 10 个候选 |
| `feishu_avatar_messages` | 分身 IM | ✅ | 分身已授权 | 读历史消息（群聊/私聊/thread）或按 `messageId` 精确查单条消息，支持 `scanLimit` 多页筛选 |
| `feishu_avatar_send` | 分身 IM | — | 分身已授权 | 以本人身份发卡片、图片、文件或引用回复；`chatId`/`openId`/`email` 三选一，返回统一回执 |
| `feishu_avatar_recall` | 分身 IM | — | 分身已授权 | 以本人身份撤回自己发出的消息（先核对发送者归属）；返回 `recalled`、`messageId` |
| `feishu_message_attachment` | 共享消息附件 | `read_image` ✅ / `download_file` — | 机器人或分身可用 | 合并查看历史消息原图（`read_image`）与下载历史文件附件到工作区（`download_file`，只读沙箱拒绝） |
| `feishu_avatar_doc_read` | 云文档/知识库（只读） | ✅ | 已授文档/Wiki 读权限 | 统一 `search` / `list` / `inspect` / `read`，屏蔽 Drive 与 Wiki 差异 |
| `feishu_avatar_doc_write` | 云文档/知识库（写管理） | — | 已授文档/Wiki 写权限 | 统一 `create` / `append` / `edit` / `create_folder` / `rename` / `move` / `delete` / `task`；`create`/`append` 支持 `format: "plain" \| "markdown"`；父级统一用 `parent`；`delete` 强制 `confirm: true`；短异步任务自动收敛 |
| `feishu_avatar_doc_file` | 云文档/知识库（本地 I/O） | — | 已授云文件收发权限 | 统一 `download` / `upload` / `replace`，隔离工作区本地磁盘 I/O 与只读沙箱边界 |

## 飞书 API 契约要点

- **统一契约**：全部工具声明 `timeoutMs` 与 `presentCall`，只读工具声明 `isConcurrencySafe`；输入输出均为闭合 JSON Schema 子集，无 `oneOf` 联合输出。
- **跨身份字段一致**：`feishu_bot_messages` 与 `feishu_avatar_messages` 共享消息项字段；`feishu_bot_send` 与 `feishu_avatar_send` 共享回执结构；`feishu_bot_chats` 与 `feishu_avatar_chats` 统一返回 `items[].{ chatId, name, chatType, ... }`。
- **按 `messageId` 精查**：两个 `*_messages` 工具都支持只传 `chatId` + `messageId` 查单条，与列表参数互斥。合并转发（`merge_forward`）会完整展开子消息，返回的 `scanned`/`matched` 为实际条目数。
- **发件人姓名回填**：单条消息接口通常只返回 `open_id`，工具会用已有的群成员缓存补齐 `senderName`，不会额外发请求。
- **群成员上限**：分页最多 20 页（2000 人）。超出时明确报错且**不缓存残缺名单**，避免大群里长期搜不到人。
- **`inspect` 双通道**：Wiki 目标走 `wiki/v2/spaces/node_by_token`；云空间目标走 `drive/v1/metas/batch_query`，两者都只需已申请的读权限。
- **Markdown 写入**：`format: "markdown"` 走 `docx/v1/documents/blocks/convert` + `descendant`，需要 `docx:document.block:convert`；缺少权限时提示改用 `format: "plain"`。一级块按 50 个、子树按 1000 块分批提交，单块超限会明确报错请拆分。
- **删除与异步任务**：`delete` 一律要求 `confirm: true`；`move`/`delete` 的短耗时任务内部轮询收敛，超时仍未完成时返回带 `drive:` / `wiki:` 前缀的 `taskId` 供 `action: "task"` 复查。
- **本地落盘**：`feishu_message_attachment(download_file)` 与 `feishu_avatar_doc_file(download)` 都不覆盖已有文件，并受敏感目录黑名单与只读沙箱约束。
- **路径随权限档位**：`read-only` 拒绝下载写入；`workspace-write` 要求路径落在会话工作区内；`danger-full-access` 放开工作区限制（相对路径按 Host 进程目录解析），但敏感目录黑名单**始终生效**。无法确定档位时按最严格的 `workspace-write` 处理。
