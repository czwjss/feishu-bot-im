# 用户身份（飞书分身）

架构与本地变更分析见 [user-identity-architecture.md](user-identity-architecture.md)；完整权限清单见 [feishu-scopes.md](feishu-scopes.md)。

以**你本人**的飞书身份读消息、发消息。和机器人身份的区别：

```text
机器人身份  tenant_access_token   im_feishu_*   群里显示「小金刚」
用户身份    user_access_token     feishu_user_* 群里显示「陈志文」
```

用户身份能力并进了飞书机器人插件，不再单独建包；工具只在挂了 `user-identity`
子插件的预设里出现，群聊 Agent 看不到。

## 1. 开通权限

用户身份复用某个机器人的飞书应用，不需要新建应用，也不需要配置重定向 URL。
只需要在飞书开发者后台给这个应用开通用户权限：

| 权限 | scope | 用途 |
|---|---|---|
| 离线访问已授权数据 | `offline_access` | 拿 refresh_token |
| 用户基础信息 | `contact:user.basic_profile:readonly` | 本人身份信息 |
| 获取与发送单聊、群组消息 | `im:message` | 以用户身份发送 |
| 以用户身份发送消息 | `im:message.send_as_user` | 卡片发送必需 |
| 获取单聊、群组消息 | `im:message:readonly` | 读消息 |
| 读群聊/单聊补充权限 | `im:message.group_msg:get_as_user` / `im:message.p2p_msg:get_as_user` | 读历史 |
| 群信息、资源上传、搜索 | `im:chat:*` / `im:resource` / `search:*` | 群、媒体、搜索 |
| 文档与云空间 | `docx:*` / `docs:*` / `drive:*` | 文档读写 |

开通后发布应用版本。

## 2. 在设置页连接

1. 设置 → **飞书机器人**；
2. 在对应机器人的卡片右上角点「分身」；
3. 弹层会显示该机器人的应用和授权二维码；
4. 用飞书扫码，或在打开的授权页里确认；
5. 成功后卡片按钮变成「分身：姓名」。

当前实现只保存一份用户身份授权。切换另一个机器人应用授权时，会覆盖当前授权，需要重新连接。

当前固定请求 23 个 scope：基础身份与 IM、文档与云空间。
不包含 Wiki、电子表格、多维表格、日历、任务、审批。

完整清单见 [feishu-scopes.md](feishu-scopes.md)。这些 scope 必须先在飞书开发者后台给应用开通并发布版本，否则授权会失败。

token 说明：

- `access_token` 约 2 小时；
- 当前设备授权返回的 `refresh_token` 约 7 天；
- Host 每 15 分钟检查一次；access_token 剩余不足 10 分钟或 refresh_token 剩余不足 2 天时自动刷新；
- DSH 停用超过 refresh_token 有效期，或达到飞书 365 天强制重授权限制时，需要重新扫码。

连接走飞书**设备授权（Device Flow）**：

```text
POST accounts.feishu.cn/oauth/v1/device_authorization
  → 返回 verification_uri_complete + user_code
用户在飞书确认
POST accounts.feishu.cn/oauth/v3/token
  → user_access_token + refresh_token
```

**不需要重定向 URL，也不需要本机回调端口。**

## 3. 挂到预设

工具在子插件 `@czwjss/feishu-bot-im/user-identity` 里，默认不加载。
用 Creator 模式新建一个预设，或在 profile patch 里追加一行：

```yaml
- id: im-feishu-user-identity
  name: '@czwjss/feishu-bot-im/user-identity'
```

例如 Creator 模式里说：

```text
新建一个预设「我的飞书分身」：在 standard 预设基础上，
额外挂载 @czwjss/feishu-bot-im/user-identity。
```

结果：

```text
普通群聊 Agent         没有 feishu_user_*
我的飞书分身           只有 feishu_user_*
```

## 4. 工具

| 工具 | 说明 |
|---|---|
| `feishu_user_me` | 授权用户本人信息（姓名、open_id、union_id、邮箱、头像） |
| `feishu_user_messages` | 以本人身份读群历史；chatId 必须是 `oc_` 开头 |
| `feishu_user_send` | 以本人身份发送交互卡片、图片或文件到群 `chatId` 或联系人 `openId` / 邮箱；文本卡片支持 Markdown、标题/颜色 |

未授权时会明确报错，不会伪造身份。

## 5. 数据与安全

| 内容 | 位置 | 权限 |
|---|---|---|
| 用户身份配置 | `<dataDir>/user-identity.json` | 0600 |
| user token | `<dataDir>/user-token.json` | 0600 |
| App Secret | 复用机器人的 DSH credentials | 由 DSH 管理 |

`dataDir` 默认是 `~/.dsh/integrations/im-feishu`。

- 设置页和 RPC 不回传 token 明文；
- token 过期前 60 秒自动用 refresh_token 刷新；
- 设备授权链接和 user_code 只保存在 Host 内存里，重启后失效；
- 用户身份工具只在专门预设里出现，群成员无法通过群聊 Agent 调用。

## 6. 常见错误

| 现象 | 原因 | 处理 |
|---|---|---|
| 连接时报 `App Secret` 缺失 | 所选机器人没有保存 Secret | 在机器人设置里重新保存 |
| 授权页报 `20027` | scope 没有在应用后台开通 | 开通权限并发布应用 |
| `99991679` | token 缺 scope | 补 scope 后重新连接 |
| `20037` / `20073` | refresh_token 过期/已用 | 重新连接 |
| 工具不存在 | 预设没挂 `user-identity` | 在预设里加入子插件 |
