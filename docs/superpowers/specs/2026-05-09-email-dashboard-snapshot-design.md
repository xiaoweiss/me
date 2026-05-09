# 邮件附件 + 服务器留存 Dashboard 截图

**日期**:2026-05-09
**状态**:待审阅(spec → 计划 → 实现)

## 一、目标

让员工在 PC 端点「保存」(导出 PNG / PDF)时,**同步把同一份文件上传到服务器**,按"酒店 + 日期 + 模式"维度命名留存。然后:

1. 邮件模板里**新增变量** `{{.DashboardImage}}`,渲染时按收件人对标酒店 + 当天日期 + occupancy mode 找服务器上对应那张图,以 inline (cid) 方式嵌入邮件正文
2. 找不到图 → **该收件人邮件不发**(整个邮件链路对该 recipient skip)+ 在「预警群」(钉钉群机器人 webhook)发一次提醒,同 (hotel, date) 24h 内不重复

## 二、为什么(vs auto-screenshot 方案)

`docs/feasibility-email-dashboard-screenshot.md` 里评估的「服务器跑 Headless Chromium 自动截图」需要 3-5 工作日 + 服务器升级到 2c4g + 长期 Chromium 维护。

**本方案是更经济的「人工触发版」**:
- 利用前端已经在用的 `html-to-image` + `jspdf`,不引入服务器浏览器
- 截图准确性由"看板的人"负责(他知道筛选、刷新都做对了再保存),比定时截图更可靠
- 服务器只做"接收 + 存储 + 查询",简单稳定
- 缺点是依赖人工操作:每日需要有人点保存。如果忘了点 → 当天群发被打断 → 钉钉群机器人立即提醒补救

## 三、数据建模

### 新表 `dashboard_snapshots` (migration 012)

```sql
CREATE TABLE dashboard_snapshots (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  hotel_id        BIGINT UNSIGNED NOT NULL,
  snapshot_date   DATE NOT NULL,
  mode            VARCHAR(16) NOT NULL,          -- 'occupancy' | 'bookings'
  format          VARCHAR(8) NOT NULL,            -- 'png' | 'pdf'
  file_path       VARCHAR(255) NOT NULL,         -- 相对路径,e.g. snapshots/2026/05/3-2026-05-09-occupancy.png
  file_size       INT UNSIGNED NOT NULL,
  uploaded_by     BIGINT UNSIGNED NULL,          -- users.id, 可空(老数据 / 系统)
  uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_hotel_date_mode_format (hotel_id, snapshot_date, mode, format),
  INDEX idx_uploaded_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

UNIQUE 索引允许同一酒店同一天同一模式同一 format 反复保存覆盖最新版(UPSERT 语义)。

### 文件存储

- 根目录在 config: `mail.snapshotDir` (默认 `./data/snapshots`,prod 用 `/data/snapshots`)
- 路径分层避免单目录爆量:`{root}/{YYYY}/{MM}/{hotel_id}-{YYYY-MM-DD}-{mode}.{format}`
  - 例:`./data/snapshots/2026/05/3-2026-05-09-occupancy.png`
- 每文件最大 5 MB(校验上传 size)
- 保留期 30 天:每日 03:00 cron 删除 `uploaded_at < now() - 30d` 的记录 + 文件

## 四、前端改动

### `src/components/dashboard/Dashboard.tsx` (handleExport)

```ts
async function handleExport(format: "png" | "pdf") {
  // 现有: html-to-image / jspdf 生成 blob
  const blob = await generateBlob(format);

  // 新增 1: 上传到后端
  const fd = new FormData();
  fd.append("file", blob, filename);
  fd.append("hotelId", String(currentHotelId));
  fd.append("date", currentDateISO);            // 当前看板的"今日"
  fd.append("mode", currentMode);                // "occupancy" | "bookings"
  fd.append("format", format);
  await request("/api/admin/dashboard-snapshots", { method: "POST", body: fd });

  // 现有 2: 同时本地下载(用户体验不变)
  triggerLocalDownload(blob, filename);
}
```

注意:
- 上传失败不阻塞下载(用户体验优先,toast 提示「服务器留存失败,本地下载已完成」)
- 不重做 generate 逻辑,先 generate 一份 blob 复用

### 新增:管理后台「日历快照」查看(可选,非阻塞)

- 路径:`/admin/email/snapshots`
- 列表:hotel × date × mode × format,点击预览图片 / 下载 PDF
- 第一版可省略,只通过数据库查;有诉求再补

## 五、后端改动

### 新路由

| Method | Path | Purpose |
|---|---|---|
| `POST /api/admin/dashboard-snapshots` | multipart/form-data | 接收前端上传,UPSERT (hotel_id, snapshot_date, mode, format) 行 + 写文件 |
| `GET /api/admin/dashboard-snapshots?hotelId=&date=&mode=&format=` | JSON | 后台查询(预留) |
| `GET /admin/snapshots/{path}` | 静态文件 | 后台预览(走鉴权) |

POST 处理流程:
1. 鉴权:必须是已登录的 admin/operator 用户
2. 校验:size ≤ 5MB,format ∈ {png, pdf},mode ∈ {occupancy, bookings}
3. 计算文件路径,确保目录存在,写入磁盘
4. 数据库 UPSERT;旧文件路径不同时,删除旧物理文件
5. 返回 `{ id, filePath, uploadedAt }`

### `pkg/blast/vars.go` recipientVars()

加入 `DashboardImage` cid 引用变量。逻辑:
1. 解析 recipient 对标酒店(沿用现有优先级:hotelOverride → primary_hotel_id → user_hotel_perms)
2. 查询 `dashboard_snapshots WHERE hotel_id=? AND snapshot_date=? AND mode='occupancy' AND format='png'`
   - `snapshot_date` = 邮件发送时刻所在日期(亚洲/上海时区)
3. **找到** → 给 vars 加 `DashboardImage = "cid:dashboard-{hotelId}-{date}-occupancy.png"` + 在调用方上下文(返回值新增 `inlineImages []InlineImage` 列表)里把绝对文件路径带出来,后面 mail.Send 用
4. **找不到** → 返回一个 sentinel(如 `error == ErrSnapshotMissing` 或 `vars["__skipReason"] = "snapshot_missing"`)让上层 sendBatch 跳过该 recipient
5. 同步触发预警(见下文)

**函数签名调整**:
```go
// 旧
func recipientVars(db, email, when, hotelOverride) (map[string]any, error)
// 新
func recipientVars(db, email, when, hotelOverride) (vars map[string]any, inlineImages []InlineImage, skipReason string, err error)
```

**cid 命名约定**:cid 等于文件 basename(`dashboard-{hotelId}-{date}-{mode}.{format}`),gomail.Embed 自动 cid。HTML `<img src="cid:dashboard-3-2026-05-09-occupancy.png">` 直接引用,不必额外 SetHeader。

### `pkg/mail/sender.go` Send

新签名增加 `inlineImages []InlineImage` 参数:
```go
type InlineImage struct {
  CID      string  // e.g. "dashboard-3-2026-05-09"
  FilePath string  // 绝对路径
}
func (s *Sender) Send(to []string, subject, htmlBody string, inlineImages []InlineImage) error
```

实现:gomail.Message 上 `m.Embed(filePath)` + 设置 `Content-ID: <{cid}>`,HTML 里 `<img src="cid:{cid}">` 自动引用。

### `pkg/blast/sender.go` sendBatch

- 渲染每封邮件时,如果 vars 里有 `__skipReason == "snapshot_missing"`:
  - 不发该 recipient
  - 写 `email_log_recipients` 一行 status='skipped' error='dashboard image not found for hotel X on date Y'
  - 在 batch 维度 `aggregatedSkipReasons[hotelId][date] = true`
- batch 结束后,对每个 (hotelId, date) 触发一次「预警群」通知(见下文)

## 六、预警群通知(只用钉钉群机器人)

### 渠道
- 复用 `pkg/notify/dingtalk_robot` (channel = `dingtalk_robot`)
- webhook URL 已在 `notification_settings` 表里配置(管理员后台「通知设置」)

### 文案
```
⚠️ 看板图缺失,邮件已跳过
酒店:北京·三元桥
日期:2026-05-09
受影响邮件:8 封
请联系酒店对接人尽快在 PC 端点击「保存」生成今日看板图。
```

### 防抖
- 用 Redis key `notified:dashboard-missing:{hotelId}:{YYYY-MM-DD}` SETNX,TTL 24h
- 已存在则跳过本次通知(同一天最多通知 1 次,跨天重新计数)

## 七、模板变量更新(管理后台)

`src/pages/admin/Email.tsx` 的 `TEMPLATE_VARS` 列表新增:

```ts
{ key: "{{.DashboardImage}}", desc: "本月日历图(按收件人对标酒店当天)" }
```

`BUILTIN_TEMPLATES` 新增一个示例模板「带日历图的日报」:
```html
<table>
  <!-- 文字部分照旧 -->
  <tr><td>
    <img src="{{.DashboardImage}}" alt="本月日历" style="max-width:600px;width:100%;border:1px solid #e5e7eb;border-radius:8px;" />
  </td></tr>
</table>
```

## 七.五、时区约定

所有 `snapshot_date` / "今日" 判定都用 **亚洲/上海(UTC+8)** 时区。
- 前端上传时 date 字段由前端按本地时区算(`new Date().toLocaleDateString('zh-CN')` 取 YYYY-MM-DD)
- 后端 cron / 群发时 date 字段也按 Asia/Shanghai 时区算
- 不依赖服务器系统时区,代码里显式 `time.LoadLocation("Asia/Shanghai")`

## 八、数据流时序(以 8pm cron 全员群发为例)

```
20:00:00  cron 触发 RunBlast()
20:00:01  pull users.email WHERE status='active' AND email <> ''  (假设 8 个收件人,3 家酒店)
20:00:02  循环每个 recipient,调 recipientVars()
            recipient1 → primary_hotel=3 → 查 snapshot 2026-05-09 occupancy png
                         找到 → vars["DashboardImage"] = "cid:dashboard-3-2026-05-09"
                                inlineImages 列表 append { cid, filePath }
                         未找到 → vars["__skipReason"] = "snapshot_missing"
                                  跳过该 recipient
20:00:03  渲染 + Send 每封;Embed inlineImages
20:00:05  batch 完成,聚合 missing hotels
20:00:06  对每个 (hotelId, date) 走 dedupe → 发钉钉机器人提醒
20:00:07  email_logs / email_log_recipients 落库
```

## 九、Edge cases

| 场景 | 处理 |
|---|---|
| 同一天同酒店保存两次 | UPSERT 覆盖,前一份物理文件删除 |
| 上传中网络断 | 后端 transaction:文件写完才插入 DB;失败回滚删文件 |
| 模板里没用到 `{{.DashboardImage}}` | recipientVars 不去查 snapshot,完全不影响发送 |
| Hotel 没有 venues / 数据 | snapshot 仍可保存(用户保存的是空看板)。模板渲染时图照常嵌入 |
| 30 天清理删除了文件但 DB 行还在 | 清理 cron 是 file + DB 一起删,不会单边 |
| 收件人对标酒店解析失败 | vars 流程会把 OccupancyRate 等都填 "-",DashboardImage 也走 missing 路径 → skip |
| 测试发送(testTemplate) | 测试发送同样查 snapshot;不存在按 missing 处理(便于 admin 测变量是否生效) |

## 十、测试清单

- [ ] PC 保存 PNG/PDF → 上传 + 本地下载都成功
- [ ] DB 表 dashboard_snapshots 行写入正确,UNIQUE 索引覆盖生效
- [ ] 同酒店同天连续保存 2 次,DB 只 1 行 + 文件覆盖
- [ ] 邮件模板包含 `{{.DashboardImage}}`,renders 后 HTML 里有 `<img src="cid:dashboard-...">`
- [ ] 实际邮件在 Gmail / 钉钉邮箱 / Outlook 客户端里能看到嵌入的图(关键!)
- [ ] 缺图场景:发邮件触发,跳过该 recipient 写 skipped log + 钉钉群机器人收到提醒
- [ ] 缺图场景同一天再触发一次,不重复通知(dedupe 生效)
- [ ] 30 天清理 cron 删除超期文件 + DB 行
- [ ] 模板没用变量时,系统跳过 snapshot 查询(不影响)

## 十一、风险 / 取舍

- **依赖人工保存**:cron 群发前必须有人点过保存,否则当天邮件空降。规避:钉钉群机器人即时提醒
- **保存按钮只在 PC 显示**:Dashboard.tsx 现在 `hidden sm:inline-flex`,只 PC 端能保存上传 → 移动端员工没法触发上传。可接受(截图本质需要大屏看板)
- **PDF 不能 inline**:第一版只支持 PNG inline。PDF 留给 v2(可考虑当附件而不是嵌入)
- **文件存储增长**:每张图 200-600KB × 几十酒店 × 30 天 = 几百 MB,可接受。30 天清理 cron 必须可靠
- **多模式只支持 occupancy**:bookings mode 的图也会上传(format 字段区分),但模板变量第一版只指 occupancy。后续如果要,加 `{{.DashboardImageBookings}}`
- **多 admin 同时保存**:UPSERT + 文件覆盖,以最后一次为准。可接受
- **截图前端依赖中文字体**:已有 `await document.fonts.ready`,跟现有保存按钮一致

## 十二、实现路径(粗)

1. Backend:migration 012 + 模型 + 路由 + 文件写入
2. Backend:`pkg/blast/vars.go` 加 `DashboardImage`;`pkg/mail/sender.go` Send 支持 inlineImages
3. Backend:`pkg/blast/sender.go` skip 逻辑 + 钉钉机器人通知聚合
4. Backend:30 天清理 cron
5. Frontend:Dashboard.tsx handleExport 加上传逻辑
6. Frontend:Email.tsx TEMPLATE_VARS + BUILTIN_TEMPLATES 加新条目
7. 端到端测试:本地保存 → DB → 触发 testTemplate → Gmail 收件箱看图
8. 灰度上线 + 真实 cron 群发观察一周

具体步骤拆分交给 writing-plans。
