# 飞书分身：当前授权 scope

当前默认请求 **23 个 scope**，只覆盖现有工具和近期文档能力。

## 当前默认

### 基础身份与 IM

```text
offline_access
contact:user.basic_profile:readonly
im:message
im:message.send_as_user
im:message:readonly
im:message.group_msg:get_as_user
im:message.p2p_msg:get_as_user
```

### 群、搜索、资源上传

```text
im:chat:read
im:chat.members:read
im:resource
search:message
```

### 文档与云空间

```text
docx:document:readonly
docs:doc:readonly
drive:drive.metadata:readonly
drive:file:download
search:docs:read
docx:document:create
docx:document:write_only
docs:doc
drive:file:upload
docs:permission.member:create
docs:permission.member:retrieve
docs:permission.member:update
```

## 明确不申请

```text
wiki
电子表格 sheets
多维表格 bitable / base
日历 calendar
任务 task
审批 approval
```

## 暂不申请

```text
mail
minutes
vc
attendance
okr
```

## 说明

- `im:message` / `im:message.send_as_user`：以用户身份发卡片；
- `im:message.group_msg:get_as_user` / `im:message.p2p_msg:get_as_user`：读群聊/单聊历史；
- `im:resource`：上传图片、文件，为后续发送媒体做准备；
- `docx:*` / `docs:*` / `drive:*`：文档读写和云空间文件；
- `search:*`：消息和文档搜索。

权限仍需在飞书开发者后台开通并由管理员批准；发布应用版本后重新授权才生效。

旧版 `user-identity.json` 会在启动时自动迁移到当前 23 个 scope，不会继续请求已删除的 Wiki、表格、日历等权限。
