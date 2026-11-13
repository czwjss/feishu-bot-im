# 飞书分身：当前授权 scope

本文列出 `src/user-identity/config.js` 当前默认请求的 **23 个 scope**。配置与连接步骤见[使用与排障](user-identity.md)。

授权范围与已实现工具不是同一回事：当前模型工具只有本人信息、消息历史和消息发送。下表中的搜索、文档及云空间权限已在配置中申请，但本插件没有对应工具；本次文档整理不改变权限配置。

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

## 当前未申请的范围

Wiki、电子表格、多维表格、日历、任务、审批、邮箱、妙记、音视频会议、考勤、OKR。

## 说明

- `im:message` / `im:message.send_as_user`：以用户身份发卡片；
- `im:message.group_msg:get_as_user` / `im:message.p2p_msg:get_as_user`：读群聊/单聊历史；
- `im:resource`：上传图片、文件，为后续发送媒体做准备；
- `docx:*` / `docs:*` / `drive:*`：已申请的文档与云空间权限，未提供对应工具；
- `search:*`：已申请的消息和文档搜索权限；现有消息工具仍只做拉取结果内的本地关键词筛选。

权限仍需在飞书开发者后台开通并由管理员批准；发布应用版本后重新授权才生效。

旧版 `user-identity.json` 会在启动时自动迁移到当前 23 个 scope，不会继续请求已删除的 Wiki、表格、日历等权限。
迁移只改变下次授权请求，已有 token 不会自动扩权；状态接口比较期望与实际 scope，设置页提示缺少的权限。
