# 模型工具契约

插件全局注册 11 个工具。`feishu_bot_*` 使用所选机器人的身份，`feishu_avatar_*` 使用当前授权用户身份。管理页的连接诊断、解绑和设置等 RPC 不属于模型工具。

| 工具 | 用途 | 目标与主要结果 |
|---|---|---|
| `feishu_bot_chats` | 查询机器人可见群和已知绑定会话 | 可按 `bot` 过滤；返回 `botId`、名称、`chatId`、`chatType`、绑定 `sessionId` |
| `feishu_bot_people` | 查询群成员姓名或 open_id | `query` 必填；返回最多 10 个候选及 `matched`、`hasMore` |
| `feishu_bot_messages` | 读取机器人可见历史 | 会话或 thread；返回 `messages`、`scanned`、`matched`、`hasMore`、`pageToken` |
| `feishu_bot_send` | 机器人发送独立卡片、图片或文件 | `text` / `path` 二选一；返回 `messageId`、`chatId`、`kind`，文件另带名称、字节数 |
| `feishu_bot_recall` | 撤回所选机器人自己发送的消息 | `messageId` 必填；核对发送者后撤回，返回 `recalled`、`messageId` |
| `feishu_avatar_me` | 查看授权用户身份 | 返回姓名、英文名、open_id、union_id、邮箱、头像；飞书未提供的字段为空字符串 |
| `feishu_avatar_chats` | 按群名搜索本人已加入的群 | `query` 必填，可传 `limit` 和 `pageToken`。返回候选群 `items`、`hasMore` 和 `pageToken` |
| `feishu_avatar_messages` | 以本人身份读取历史 | 显式 `chatId`；返回 `items`、`scanned`、本页匹配数 `total`、`hasMore`、`pageToken` |
| `feishu_avatar_send` | 本人发送卡片、图片或文件 | `chatId` / `openId` / `email` 三选一；返回 `messageId`、`chatId`、`kind`、时间等信息 |
| `feishu_avatar_cloud` | 统一搜索飞书文档，管理云空间资源 | 按 `action` 选择文档、文件与目录操作，支持下载和覆盖普通文件 |
| `feishu_avatar_wiki` | 管理知识库节点和附件 | 支持浏览、查询详情、读写正文、新建页面、改名、移动、删除及附件操作 |

## 身份与目标解析

机器人写入、历史和成员工具的 `bot` 可传内部 `botId`、应用 ID、名称或旧别名。稳定 ID 精确匹配优先；同名机器人有多个时必须使用 ID，不会静默选择第一台。省略 `bot` 时优先使用当前 DSH Session 绑定的机器人，其次使用唯一的机器人；仍有歧义时报错。`feishu_bot_chats` 省略 `bot` 则查询全部机器人。

机器人工具省略 `chatId` 时使用当前 Session 在所选机器人下的绑定；无绑定则报错。显式 `chatId` 可指向其他会话。机器人目录包含可见群与已知绑定，不等于用户的完整私聊目录；`chatType` 为 `group`、`p2p` 或 `unknown`。

分身工具使用全局的当前授权，不由模型选择机器人。自动 Worker 的目标约束仍由动态提示词提供，发送工具接受其他显式目标。引用回复时必须同时提供 `replyToMessageId`、所属 `chatId` 和 `text`；发送前读取原消息核对会话，不匹配则不发送。

## 分身按群名查找

`feishu_avatar_chats` 使用现有 `im:chat:read` 用户权限，在飞书端只按群名搜索授权用户已加入的群。`query` 为 1–64 字符的群名或关键词，`limit` 为 1–100，默认 20。继续查询时沿用相同的 `query` 和 `limit`，传回 `pageToken`。

每个候选含 `chatId`、`name`、`description`、`external` 和 `chatStatus`，接口返回提示时附带 `notice`。核对群名后可把 `chatId` 传给 `feishu_avatar_messages` 或 `feishu_avatar_send`。同名或仅有模糊匹配时，先请用户确认候选群。

## 历史查询与翻页

两种身份使用同一套参数：

| 参数 | 约定 |
|---|---|
| `limit` | 1–50，默认 20；机器人是匹配结果上限，分身是本页读取条数上限 |
| `order` | `newest` 倒序（默认），`oldest` 正序 |
| `query` | 仅对读到的正文和发送者名称做本地包含匹配；忽略大小写并做 NFKC 规范化 |
| `startTime` / `endTime` | ISO 8601（建议明确时区）或秒级时间戳字符串；两者都有时开始必须早于结束 |
| `pageToken` | 原样传回上次返回的游标；保持身份、会话、时间、排序、关键词一致 |
| `threadId` | 仅机器人支持；不能同时使用时间范围，仍需显式或绑定的 `chatId` 校验机器人是否在会话中 |
| `scanLimit` | 仅机器人支持；1–500，默认 200；一次最多读取 10 页 |

模型工具只接受 `limit`、`order`、`query`，不再提供旧字段 `pageSize`、`sort`、`keyword`。飞书 SDK 和内部监听 API 的分页字段不属于模型工具参数。

关键词不是飞书全文搜索。机器人在扫描预算内读取多页，分身每次读取一页再过滤；因此“本次没有匹配”不表示历史里没有匹配。只要 `hasMore` 为 true，就应使用实际 `pageToken` 继续读取。机器人每页最多读取剩余结果容量，消费完这一页才推进游标，不会因匹配数达到上限而丢掉页内剩余消息。

消息正文与卡片文本不再由工具截断。图片、文件等非文本消息仍返回类型占位符，历史工具不负责下载附件。时间保留时区，Native 工具内容与 PTC 返回对象都包含完整的消息 ID、字段和游标；不会只渲染前 20 条或只提示“还有更多”。

## 云空间与云文档

`feishu_avatar_cloud` 按 `action` 执行一次操作。只传该操作接受的字段。

| `action` | 参数 | 结果 |
|---|---|---|
| `search` | `query` 为 1–30 字的关键词。`limit` 默认 10，最多 20 | 搜索本人可见的云文档和知识库页面。知识库结果的 `target` 传给 `feishu_avatar_wiki` |
| `list` | `target` 为云空间文件夹链接或 token。`limit` 默认 20，最多 50 | 返回文件夹的直接子项。省略 `target` 列出「我的空间」根目录 |
| `read` | `target` 为飞书 Doc/Docx 链接或新版文档 ID。旧版文档 ID 用 `doc:<id>` | 返回一页纯文本，每页最多 8,000 字符 |
| `create` | `name` 为标题，可选 `folder` 和纯文本 `text` | 创建新版文档，返回文档 ID。省略 `folder` 时建在根目录 |
| `append` | 新版文档 `target` 和纯文本 `text` | 将文本追加到文档末尾，每次最多 20,000 字符且不超过 50 行 |
| `edit` | 新版文档 `target`、原文 `find` 和替换内容 `text` | 替换唯一匹配的原文。`text` 为空字符串时删除匹配文字 |
| `create_folder` | 文件夹 `name`，可选父目录 `folder` | 新建文件夹，返回文件夹 ID。省略 `folder` 时建在根目录 |
| `download` | 普通文件 `target` 和本地 `path` | 下载完整原文件，返回实际保存路径和大小 |
| `upload` | 本地 `path`、目标 `folder`，可选 `name` | 上传不超过 20 MiB 的文件，返回文件 ID、文件名和大小 |
| `replace` | 已有普通文件 `target` 和本地 `path` | 覆盖原文件内容，最多 20 MiB，保留文件 ID 和原名 |
| `rename` | 文件、文件夹或新版文档 `target` 和新名称 `name` | 重命名指定资源。普通文件的 `name` 要包含完整扩展名 |
| `move` | `target` 和目标 `folder`。用 `root` 指定根目录 | 移动资源，文件夹可能返回异步任务 |
| `delete` | `target` | 将资源移入回收站，文件夹可能返回异步任务 |
| `task` | 上次操作返回的 `taskId` | 查询异步移动或删除任务。`status` 为 `pending`、`completed` 或 `failed` |

`search`、`list` 和 `read` 使用 `hasMore` 与 `pageToken` 翻页。沿用原操作和目标或关键词，把返回的 `pageToken` 原样传回。读取大文档时按需翻页，避免一次把完整正文带入模型上下文。翻页期间正文发生变化时，从第一页重新读取。授权和资源权限不足时会保留飞书接口错误。

云空间根目录由飞书服务决定是否分页，快捷方式也可能不出现在根目录结果中。浏览知识空间或使用 Wiki 页面链接时，调用下节的 `feishu_avatar_wiki`。

`folder` 接受文件夹链接或 token。`append` 和 `edit` 的 `target` 接受新版文档链接或 ID。`rename`、`move` 和 `delete` 的 `target` 使用能识别资源类型的飞书链接或 `类型:ID`，例如 `docx:abc123`。`download` 和 `replace` 接受普通文件链接、`file:文件ID` 或文件 ID。

文件操作的相对 `path` 基于当前会话工作区解析。云空间和 Wiki 下载以流式写入工作区内的新文件，父目录须已存在，已有同名文件时请另选路径。取消或下载失败会清理未完成的文件。

`edit` 只替换同一个文本片段内唯一匹配的原文。如果匹配缺失或重复，重新选取能唯一定位的原文。跨文本片段时，缩小替换范围。`create` 如果已创建文档但写入正文未成功确认，会返回 `status: "partial"` 和已创建的文档 ID。先按这个 ID 检查正文，再补写缺失内容。`move` 或 `delete` 返回 `status: "pending"` 时，用 `task` 查询同一个 `taskId`，避免重复发起操作。

## 知识库

`feishu_avatar_wiki` 用 Wiki 链接或 `wiki:<node_token>` 标识页面。`feishu_avatar_cloud.search` 返回的 Wiki 结果可以直接提供 `target`。

| `action` | 参数 | 结果 |
|---|---|---|
| `list` | `target` 见下表。`limit` 默认 20，最多 50，可传 `pageToken` | 返回可访问的知识空间，或指定目录的直接子项 |
| `inspect` | 节点 `target` | 返回标题、空间 ID、父节点 ID、节点类型、底层对象类型和 ID，以及可继续传入的 `target` |
| `read` | 页面 `target`，可传 `pageToken` | 读取页面对应的 Docx 或 Doc 正文，每页最多 8,000 字符 |
| `create` | 父页面或知识空间 `target`、标题 `name`，可选纯文本 `text` | 在指定父页面下或空间顶层新建 Docx 页面，返回节点详情 |
| `append` | 页面 `target`、纯文本 `text` | 向页面对应的 Docx 追加正文，每次最多 20,000 字符且不超过 50 行 |
| `edit` | 页面 `target`、原文 `find` 和替换内容 `text` | 替换页面对应的 Docx 内唯一匹配的原文。`text` 为空字符串时删除匹配文字 |
| `download` | 文件节点 `target` 和本地 `path` | 下载 HTML、PDF 等完整原文件，返回保存路径和大小 |
| `upload` | 父页面 `target`、本地 `path`，可选文件名 `name` | 在指定页面下新上传普通文件，最多 20 MiB，返回底层文件 ID |
| `replace` | 原始文件节点 `target` 和本地 `path` | 覆盖已有附件内容，最多 20 MiB，保留原文件名和文件 ID |
| `rename` | 节点 `target` 和新名称 `name` | 按 Wiki 链接或 `wiki:<node_token>` 改名。HTML 等文件节点请传带原扩展名的完整名称 |
| `move` | 要移动的节点 `target` 和目标 `destination` | 将节点及其子页面移到目标父页面下，或移到指定知识空间顶层。同步返回移动后的节点详情 |
| `delete` | 页面 `target`、`confirm: true`，可选 `includeChildren` | 删除指定页面。默认将直属子页面移到上一级，`includeChildren: true` 时删除整棵子树 |
| `task` | 删除返回的 `taskId` | 查询异步删除结果。`status` 为 `pending`、`completed` 或 `failed` |

| `list` 的 `target` | 返回内容 |
|---|---|
| 省略或 `wiki` | 本人可访问的知识空间 |
| `wiki_space:<space_id>` 或 `/wiki/space/<space_id>` 格式的飞书链接 | 指定知识空间的顶层页面 |
| `wiki:<node_token>` 或知识库页面链接 | 指定页面的直接子页面 |

用返回的 `target` 继续浏览或打开页面。页面条目的 `hasChildren` 标明有无子页面，`objectType` 标明底层资源类型，例如 `docx` 或 `doc`。`list` 和 `read` 返回 `hasMore: true` 时，沿用同一个目标并传回 `pageToken`。

`inspect` 返回的 `id` 是 Wiki 节点 ID，`objectId` 是底层文件或文档 ID。`upload` 返回的 `id` 是底层文件 ID。需要操作新附件的 Wiki 节点时，可用父页面的 `list` 查找它的 `target`。使用 `replace` 时，传原始文件节点的链接。

`create` 的 `target` 和 `move` 的 `destination` 均接受父页面链接、`wiki:<node_token>`、知识空间链接或 `wiki_space:<space_id>`。`create` 返回 `status: "partial"` 表示页面已创建，初始正文写入尚未确认。用结果返回的 `target` 检查页面，再补写缺失内容。Wiki 正文写入沿用云文档的追加和精准替换规则，需要对对应 Docx 的编辑权限。

删除用页面链接或 `wiki:<node_token>`，仅在用户明确要求删除该页时传 `confirm: true`。用户明确要求连同子页面一起删时才传 `includeChildren: true`。删除返回 `status: "pending"` 时，用同一工具的 `task` 查询返回的 `taskId`，避免重复发起删除。

删除需要对页面的操作权限。页面开启了删除审批时，在飞书知识库页面申请删除。两项工具复用分身授权，请参阅[权限清单](feishu-scopes.md#更新已有授权)。

## 参数定义与上下文

输入和输出都使用本机 DSH 支持的 JSON Schema 子集。PTC 遇到不支持的输入关键字会把整个参数类型退化成 `unknown`（Python 为 `Any`），模型会失去字段信息。因此不在输入 schema 中使用 `minimum` / `maximum`，范围写在参数描述里并在执行前校验。

所有工具共用按已声明字段校验的执行入口：拒绝未知字段，检查标量类型、枚举和必填项；互斥关系、目标和取值范围由对应执行逻辑校验。错误会指出字段或列出可用参数，在调用飞书 API 前失败。参数定义可用不代表模型永远不会填错；测试覆盖的是声明、生成与执行的一致性。

Native 注入工具名称、描述和输入定义；PTC 注入生成的输入及输出类型。工具参数与示例不额外写入系统提示词；通用发送要求统一注册在 `im-feishu:policy`，不在各工具中重复维护。业务代码、校验实现和文档不会自动进入提示词。

工具结果使用紧凑 JSON，去掉缩进而保留全部数据。历史查询默认 20 条、最多 50 条；长消息和大量结果仍会增加上下文，应按需指定时间范围、关键词和条数。PTC 中间结果不自动进入对话，只有程序打印或返回的内容才进入对话；Native 会呈现完整的工具返回内容。

## 发送、撤回与错误

机器人、分身发送工具及飞书自动回复共用 `src/policy.js` 中的全局发送内容与排版规则，通过 `systemPrompt.section()` 注册。默认只发送结论、关键信息和必要的下一步，保留必要事实与限制；仅在用户明确要求详情或完整原文时展开。禁止添加无关细节、冗长铺垫、重复内容或未经要求的长篇分析、过程流水账，也禁止拆成多条消息规避精简要求。

不同信息段之间必须保留一个空行（连续两个换行）；正文内的小标题、列表与相邻正文之间同样留空行，禁止仅用单次换行堆叠多个信息段。同一列表内的简短条目可连续排列，单句短回复不强行分段，禁止连续插入多个空行。Worker 自定义规则可以调整语气、标题及引用，但不能放宽发送内容与排版规则。

这是模型发送前遵守的内容要求，不做机械字符截断，也不改写用户保存的自定义规则。下面的字符上限属于工具执行边界，不是建议的消息篇幅。

| 限制 | 机器人 | 分身 |
|---|---|---|
| 卡片正文 | 最多 4,000 字符 | 最多 8,000 字符 |
| 标题 | 最多 100 字符 | 最多 100 字符 |
| 图片 / 文件 | 10 MiB / 30 MiB | 10 MiB / 30 MiB |
| 相对路径 | 当前 Session 工作区；缺失时退回机器人默认工作区，再退回进程目录 | 当前 Session 工作区；缺失时退回进程目录 |

正文或标题超限直接报错，不会截断后发送。媒体类型按发送文件名的扩展名判断。发送成功必须取得 `messageId`；接口没有回执 ID 时会明确报错，不能当作已确认成功后自动重发。

撤回继承当前 Session 的机器人选择，只允许所选机器人本人的消息。权限和可撤回时限仍由飞书决定。飞书 HTTP 成功但业务码失败时，工具会返回真实错误；后台界面消息清理仍保留失败返回 false 的宽容行为。

机器人目录和群成员各缓存 6 小时，`refresh: true` 绕过缓存。目录读取失败会报错，不能伪装成空目录；一次最多读取 20 页、约 2,000 项，超出时明确报错且不缓存不完整结果。成员匹配超过 10 个时返回 `hasMore: true`，应缩小关键词。

工具传递取消信号到读取、上传、发送和重试。机器人 SDK 通过请求作用域将信号传到底层 HTTP（含取 token 与上传），并发请求互不影响；校验目标或上传后也会检查取消。分身在授权查询后及每次请求前检查取消。已经被飞书接收的消息无法通过取消撤销，应使用撤回工具处理机器人消息。

## 实现与验证

- 工具定义：`src/tool.js`、`src/user-identity/tools.js`、`src/user-identity/cloud-tool.js`、`src/user-identity/wiki-tool.js`。
- 共用参数、渲染与校验：`src/tool-contract.js`。
- 机器人运行与 SDK：`src/runtime.js`、`src/feishu.js`、`src/feishu-http.js`。
- 分身 API：`src/user-identity/api.js`。
- 回归测试：`test/tool-input.test.mjs`、`test/tool-reliability.test.mjs`，配合各工具、运行时和 API 测试；`npm test` 先构建客户端再执行完整测试。全部使用模拟接口，不发送真实飞书消息。
- 宿主集成检查：`node scripts/check-tool-contracts.mjs /path/to/installed/@deepseek-ai/dsh`。直接使用安装版 DSH 校验全部工具的输入和输出 schema，检查 TypeScript / Python 参数投影，并输出 Native、PTC 定义的字符量（不是 token 数，不包含其他插件）。PTC 字符量扣除了宿主公共代码执行说明。
