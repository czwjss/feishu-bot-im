# 飞书分身：当前授权 scope

本文列出「连接分身」与「重新授权」统一申请的 **28 个用户 scope**。配置与连接步骤见[使用与排障](user-identity.md)。

分身提供本人信息、群名搜索、消息历史、消息发送、云空间管理及知识库工具。实际可调用范围取决于飞书颁发的 scope 及本人对目标资源的访问权限。

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
docx:document.block:convert
docs:doc
drive:file:upload
space:document:retrieve
space:folder:create
space:document:move
space:document:delete
```

### 知识库

```text
wiki:space:retrieve
wiki:node:retrieve
wiki:node:create
wiki:node:move
```

## 更新已有授权

云空间和知识库权限随分身统一申请。已有授权缺少权限（例如 Wiki 移动所需的 `wiki:node:move`）时，先在飞书开发者后台开通相应的用户权限并发布应用版本，再在「状态 → 分身状态」点击「重新授权」并扫码确认。

-「分身状态」会显示缺少的权限。仅缺少上面的 `space:*` 或 `wiki:*` 权限时，已有的消息功能仍可使用。补齐权限后，云空间和知识库可执行的操作以飞书实际签发的 scope 和本人对目标资源的访问权限为准。

## 当前未申请的范围

电子表格、多维表格、日历、任务、审批、邮箱、妙记、音视频会议、考勤、OKR。

## 说明

- `im:message` / `im:message.send_as_user`：以用户身份发卡片；
- `im:message.group_msg:get_as_user` / `im:message.p2p_msg:get_as_user`：读群聊/单聊历史；
- `im:chat:read` 用于搜索本人已加入的群，并读取私聊发现和群聊添加所需的会话目录。
- `im:resource`：上传图片、文件，为后续发送媒体做准备；
- `docx:document:readonly` 和 `docs:doc` 分别用于读取新版和旧版文档正文。`docx:document:create` 和 `docx:document:write_only` 用于创建和修改新版文档，后者也用于修改新版文档标题。`docx:document.block:convert` 用于把 Markdown 转成文档块，是 `format: "markdown"` 结构化写入的前提；缺少它时可改用 `format: "plain"`，或在飞书开发者后台开通后重新授权。
- `drive:file:download` 用于下载云空间和知识库里的原始文件。`drive:file:upload` 用于上传、覆盖文件，以及重命名文件或文件夹。`drive:drive.metadata:readonly` 用于查看元数据、获取被覆盖的云空间文件原名和查询云空间异步任务。
- 飞书的文件夹清单接口接受 `space:document:retrieve`、`drive:drive:readonly` 或 `drive:drive` 中的一项。
- `space:folder:create` 用于创建文件夹。`space:document:move` 和 `space:document:delete` 分别用于移动资源和将资源移入回收站。
- `wiki:space:retrieve` 用于列出本人可访问的知识空间。`wiki:node:retrieve` 用于浏览页面层级和解析页面指向的文档。读取正文使用对应的文档读取权限，编辑 Wiki 页面对应的 Docx 正文使用 `docx:document:write_only`。
- Wiki 改名复用云空间改名接口，需要对应资源的编辑权限和适用的写入 scope，例如文件的 `drive:file:upload`。
- `wiki:node:create` 用于创建 Wiki 页面，也用于发起删除并查询删除任务。`wiki:node:move` 用于在指定父页面或知识空间之间移动节点。需要定位已有页面时，使用 `wiki:node:retrieve` 查询节点和知识空间。
- `search:docs:read` 用于飞书云文档搜索。消息工具的关键词仍只筛选已拉取的消息。

权限仍需在飞书开发者后台开通并由管理员批准；发布应用版本后重新授权才生效。
