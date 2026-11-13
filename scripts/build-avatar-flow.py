from pathlib import Path
from html import escape
import xml.etree.ElementTree as ET

OUT = Path(__file__).resolve().parent.parent / 'docs' / 'feishu-avatar-message-flow.svg'
W, H = 1920, 2230
parts = [f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}" role="img" aria-labelledby="title desc">
<title id="title">飞书分身：当前消息处理流程</title>
<desc id="desc">依据当前仓库源码绘制。轮询和合批等待各三十秒；完整保留消息文本，本人及未触发消息仅作上下文；删除按文案清理消息的分支。机器人处理开启时与真人统一处理，关闭时排除。会话信息和自定义回复规则分别通过 Worker 专属动态上下文注入，批次与背景作为用户消息。保留派发成功清队、单批转人工和提示词会话约束。宿主需重载生效。</desc>
<defs>
  <marker id="arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L8 4.5L0 9Z" fill="#6c839b"/></marker>
  <marker id="red-arrow" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto"><path d="M0 0L8 4.5L0 9Z" fill="#c34446"/></marker>
  <style>
    text {{ font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Noto Sans CJK SC', 'Microsoft YaHei', sans-serif; }}
    .mono {{ font-family: 'SFMono-Regular', Menlo, monospace; }}
  </style>
</defs>''']

def rect(x,y,w,h,fill='#ffffff',stroke='none',r=18,sw=1):
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}" stroke-width="{sw}"/>')

def text(x,y,value,size=22,color='#33465a',weight=400,anchor='start'):
    parts.append(f'<text x="{x}" y="{y}" font-size="{size}" fill="{color}" font-weight="{weight}" text-anchor="{anchor}">{escape(value)}</text>')

def lines(x,y,values,size=22,color='#33465a',step=32):
    for i, value in enumerate(values):
        if isinstance(value, tuple):
            text(x,y+i*step,value[0],size,value[1])
        else: text(x,y+i*step,value,size,color)

def path(d,color='#6c839b',arrow=True,dashed=False,width=2):
    marker = 'red-arrow' if color == '#c34446' else 'arrow'
    parts.append(f'<path d="{d}" fill="none" stroke="{color}" stroke-width="{width}" stroke-linejoin="round"'+
                 (' stroke-dasharray="7 6"' if dashed else '')+
                 (f' marker-end="url(#{marker})"' if arrow else '')+'/>' )

def arrow(x,y1,y2,label=None):
    path(f'M{x} {y1} V{y2-5}')
    if label: text(x+14,(y1+y2)/2+6,label,18,'#62768a')

def card(x,y,h,n,title,body,kind='normal',small=False):
    colors={'normal':('#ffffff','#d7e0e9','#176b80'), 'warn':('#fff9ed','#edc36d','#976218'),
            'error':('#fff1f1','#e4a3a6','#b9343e'), 'info':('#eff7fb','#b5d4e2','#176b80')}
    fill,stroke,accent=colors[kind]
    rect(x,y,520,h,fill,stroke,r=16)
    rect(x+20,y+20,38,34,accent,r=9)
    text(x+39,y+44,n,19,'#fff',650,'middle')
    text(x+72,y+45,title,25,'#142c42',650)
    lines(x+22,y+74,body,20 if small else 22,step=28 if small else 32)

rect(0,0,W,H,'#f3f6fa',r=0)
rect(0,0,W,164,'#122a3b',r=0)
text(64,55,'FEISHU AVATAR / MESSAGE PIPELINE',19,'#84d9da',600)
text(64,112,'飞书分身 · 消息到回复的完整流程',44,'#ffffff',650)
text(1856,66,'当前源码 · 模块流程',20,'#c7d7e4',400,'end')
text(1856,109,'修改代码后需重载宿主',20,'#c7d7e4',400,'end')

rect(64,192,1792,132,'#e5f3f2','#a3cecb')
text(88,229,'30 秒轮询 + 30 秒合批 · 正文完整保留 · 会话与回复规则分块注入',27,'#145d63',650)
text(88,268,'本人回复、未命中触发条件的消息保留为背景；文本内容不用于猜测临时状态或删除消息。',22)
text(88,302,'机器人处理开启时与真人一致；关闭时从批次与背景排除。保持派发成功清队、单批转人工及提示词目标约束。',22)

for x,num,title,sub in [(64,'01','拉取与筛选','monitor.js · 用户身份读取'),(680,'02','合批与派发','auto-reply.js · 插件策略'),(1296,'03','Worker 与发送','harness.js / tools.js · DSH 与飞书')]:
    rect(x,354,560,88,'#e4eef5',r=16)
    text(x+22,389,num,22,'#176b80',650)
    text(x+68,389,title,27,'#142c42',650)
    text(x+22,423,sub,20,'#526a80')
    rect(x,470,560,1480,'#eaf0f6',r=22)
path('M628 398 H672')
path('M1244 398 H1288')

# Stage 1. Acquisition: each arrow is the accepted path; alternate outcomes stay in the card.
card(84,492,138,'1.1','监听入口与授权',[
    '启动 / 开启监听 / 手动「立即检查」',
    '取得用户 token；过期时尝试刷新',
    '未启用、无会话或授权失败 → 本轮结束'],small=True)
arrow(344,630,660)
card(84,660,172,'1.2','按会话串行拉取',[
    '默认每 30 秒一次；每页 50 条、每轮 2 页',
    '按时间升序；回看至少 120 秒以发现刷新',
    '分页未完 → 保存 pageToken，下轮续读',
    '请求失败 → 记录错误，后续轮询再尝试'],small=True)
arrow(344,832,862)
card(84,862,172,'1.3','去重与基础过滤',[
    '跳过：删除、系统、旧消息、seen',
    '已入库的同一 ID → 仅更新文本，不再入批',
    '不根据「已收到 / 正在处理」等文案删消息',
    '本人消息保留为上下文，不单独触发回复'],small=True)
arrow(344,1034,1064)
card(84,1064,172,'1.4','识别会话触发条件',[
    'all：全部消息',
    'mention：@我 或回复我',
    'keyword：关键词、@我 或回复我',
    '未命中的流式卡片仍等收尾后重判'],small=True)
arrow(344,1236,1266)
card(84,1266,204,'1.5','等待流式卡片收尾',[
    '普通消息 / 已收尾卡片 → 直接继续',
    '流式卡片 → pendingCards；每轮查详情',
    '收尾 → 按完整内容重判触发，再补入记录',
    ('创建超过 10 分钟仍挂起 → 丢弃', '#976218'),
    '此处是卡片收尾超时，不是发送者限流'],kind='warn',small=True)
arrow(344,1470,1500)
card(84,1500,202,'1.6','保存正文与待处理队列',[
    'monitor-state.json：正文、游标、seen、批次',
    '新消息 ID 按 2.1 筛选后，与正文一起提交',
    '完整保留文本；每条携带 ID 和秒级时间',
    '待处理正文保留；普通最近记录最多 50 条',
    '队列满 500 / 卡片满 20 → 保留进度后重试'],small=True)
arrow(344,1702,1732)
rect(104,1732,480,58,'#176b80',r=14)
text(344,1770,'合格消息 → 阶段 02 的批次队列',23,'#fff',600,'middle')
lines(106,1832,['新增监听从当前时间开始，不回补旧历史。','输入与默认回复约定详见监听专题文档；','已接收任务继续执行，不跟随开关撤销。'],20,'#526a80',30)

# Stage 2. One sender policy, shared batching and dispatch.
card(700,492,172,'2.1','按开关筛选发送者',[
    '开启 → 符合触发条件的真人与机器人入批',
    '关闭 → 排除机器人消息，只让真人入批',
    '监听记录可保留；被排除的消息不影响合批',
    '筛选后为空 → 不创建、不派发 Worker'],kind='info',small=True)
arrow(960,664,694,'有待处理消息')
card(700,694,172,'2.2','按会话统一合并批次',[
    '新消息入队后等待 30 秒；新到消息可重置',
    '从首条入队起最多等 3 分钟',
    '满 10 条立即派发；每次最多取 10 条',
    '余下继续排队；「处理待办」可立即触发'],small=True)
arrow(960,866,896)
card(700,896,172,'2.3','派发前复查当前开关',[
    '对已积压消息再次应用 2.1 的发送者规则',
    '关闭后，原已入队的机器人消息也会排除',
    '保留消息的原有顺序；不区分混合或纯批次',
    '没有机器人专属冷却时间或派发频率限制'],kind='info',small=True)
arrow(960,1068,1098,'有待处理消息')
card(700,1098,204,'2.4','转人工检查与批次截取',[
    '仅对筛选后的全部积压消息检查转人工',
    '命中 → 清空整批，不交给 Worker',
    '未命中 → 按原顺序取最多 10 条',
    '机器人开启时也遵守同一转人工规则',
    '机器人关闭时，其文本不会影响真人任务'],kind='warn',small=True)
arrow(960,1302,1332,'未命中转人工')
card(700,1332,172,'2.5','复用或创建专属 Worker',[
    '一个飞书会话对应一个 DSH Worker 会话',
    '会话不存在 / 已归档 → 新建',
    '工作区或预设配置变化 → 新建',
    '持久化会话绑定，清队后仍保留上下文'],small=True)
arrow(960,1504,1534)
card(700,1534,172,'2.6','投递 DSH 任务队列',[
    '用户消息快照 → session.prompt(mode=queue)',
    '请求 ID 由 chatId + 消息 ID 生成，供去重',
    '同一会话并发派发合并为一次请求',
    'Host 接收成功后 → 阶段 03'],small=True)
arrow(960,1706,1766)
rect(720,1766,480,58,'#176b80',r=14)
text(960,1804,'请求返回成功 → DSH 接收任务',23,'#fff',600,'middle')
lines(722,1866,['创建 / 投递失败：保留批次，延迟重试。','重启或重新启用监听时恢复尚未派发的积压。'],20,'#526a80',30)

# Stage 3. Host acceptance must not be mistaken for a sent reply.
card(1316,492,172,'3.1','插件确认“已派发”',[
    'Host 接收任务 → 从 batch 移除本次 ID',
    '更新 lastDispatchAt；并发新到消息保留',
    ('此时模型可能还未开始，更不代表已回复', '#976218'),
    'Worker 后续失败，插件不会自动补派发'],kind='warn',small=True)
arrow(1576,664,694)
card(1316,694,204,'3.2','会话、规则与消息分开输入',[
    '动态块 1：名称 / chatId / 私聊或群聊',
    '动态块 2：回复规则（设置页自定义）',
    '用户消息：本批正文 / ID / 时间 / 背景',
    '两块 context 仅注入对应分身 Worker',
    '全局 section 保留主动发送能力'],small=True)
arrow(1576,898,928)
card(1316,928,172,'3.3','按动态规则判断与回复',[
    '默认：原会话、简短自然、同批最多一次',
    '默认：私聊不引用；群聊单人引用、多人点名',
    '规则保存后，下次模型请求读取最新值',
    '无需回复则结束；目标仍由提示词约束'],small=True)
arrow(1576,1100,1130,'需要回复')
card(1316,1130,204,'3.4','以本人身份调用飞书 API',[
    'feishu_avatar_send 校验目标与内容参数',
    '使用用户 token 发送卡片 / 引用回复',
    '工具也支持图片、文件等媒体发送',
    'token 过期错误 → 刷新后重试一次',
    '其他错误 → 返回 Worker，插件无完成追踪'],small=True)
arrow(1576,1334,1364)
card(1316,1364,140,'3.5','飞书接收回复',[
    '工具返回消息 ID 与发送结果给 Worker',
    '模型完成本轮；收件人看到回复',
    '插件没有“已回复”的独立确认状态'],small=True)
arrow(1576,1504,1534)
card(1316,1534,140,'3.6','回流到下一次监听',[
    '自己发送的回复 → 保留为背景，不触发任务',
    '对方的新消息 → 再走完整流程',
    '对方为机器人 → 按 2.1 的开关决定是否入批'],kind='info',small=True)
rect(1336,1720,480,184,'#ffffff','#c5d6e4',r=14)
text(1356,1756,'开关与可见性',23,'#142c42',600)
lines(1356,1792,['关闭监听会取消待派发任务，','已被 Host 接收的任务不随开关撤销。','设置页主要显示待处理数、检查时间和错误；','目前不显示每条消息的跳过原因。'],20,'#526a80',30)

# Stable behavior summary; incident-specific message logs belong outside reference docs.
rect(64,1982,1792,168,'#e5f3f2','#a3cecb',r=20)
text(88,2024,'Worker 的两块动态上下文',27,'#145d63',650)
lines(88,2064,[
    '会话信息标签：feishu_avatar_reply_task_chat；回复规则标签：feishu_avatar_reply_task_rules。',
    '标签由程序包裹，规则在设置页编辑；本批正文、消息 ID、时间及背景保持为用户消息快照。',
    '派发成功即清队；转人工只作用于当前批次；发送目标由提示词约束，工具仍接受显式目标。',
],22,'#23565e',32)
text(64,2188,'源码：monitor.js · monitor-store.js · auto-reply.js · worker-context.js · harness.js · tools.js · auth.js',18,'#62768a')
parts.append('</svg>')
OUT.write_text('\n'.join(parts), encoding='utf-8')
ET.parse(OUT)
print(f'SVG saved: {OUT} ({OUT.stat().st_size} bytes)')
