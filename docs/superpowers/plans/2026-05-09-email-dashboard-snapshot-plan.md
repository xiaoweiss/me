# 邮件附件 + 服务器留存 Dashboard 截图 —— 实施计划

**日期**:2026-05-09
**对应 Spec**:`docs/superpowers/specs/2026-05-09-email-dashboard-snapshot-design.md`
**仓库**:跨双仓库(后端 `meeting/` + 前端 `occupancy-insights/`)

---

## 总体策略

后端先行(model + migration + 路由 + 渲染逻辑 + 通知 + cron),前端后跟(上传 + 模板变量 + 内置示例)。任务序号按合并顺序排列;**每个序号 = 一个独立 commit**。

---

## 任务 1:后端 migration `013_dashboard_snapshots.sql`

**仓库**:`/Users/xiaowei/Workspace/go-project/meeting/`
**文件**:`migrations/013_dashboard_snapshots.sql` (新增,migrations 目录最新是 `012_users_primary_hotel_id.sql`,下一序号是 013)

```sql
-- 看板截图留存表:PC 端用户点「保存」时同步上传一份,
-- 群发邮件时按 (hotel_id, date, mode='occupancy', format='png') 取来 inline 嵌入。
-- UNIQUE 索引允许同一酒店同一天同一模式同一 format 反复保存覆盖最新版(UPSERT)。

CREATE TABLE IF NOT EXISTS dashboard_snapshots (
  id              BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  hotel_id        BIGINT UNSIGNED NOT NULL,
  snapshot_date   DATE NOT NULL,
  mode            VARCHAR(16) NOT NULL,           -- 'occupancy' | 'bookings'
  format          VARCHAR(8)  NOT NULL,           -- 'png' | 'pdf'
  file_path       VARCHAR(255) NOT NULL,          -- 相对路径,e.g. 2026/05/dashboard-3-2026-05-09-occupancy.png
  file_size       INT UNSIGNED NOT NULL,
  uploaded_by     BIGINT UNSIGNED NULL,           -- users.id, 可空
  uploaded_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uk_hotel_date_mode_format (hotel_id, snapshot_date, mode, format),
  INDEX idx_uploaded_at (uploaded_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 同时扩 email_log_recipients.status 枚举,补 'skipped'(详见任务 7)
ALTER TABLE email_log_recipients
  MODIFY COLUMN status ENUM('sent','failed','skipped') NOT NULL;
```

**验证**:本地 `mysql -uroot ding < migrations/013_dashboard_snapshots.sql`;`SHOW INDEX FROM dashboard_snapshots`,`SHOW COLUMNS FROM email_log_recipients LIKE 'status'`。

---

## 任务 2:Model 定义 `DashboardSnapshot`

**文件**:`internal/model/model.go`(在文件末尾追加,模型风格参照该文件已有结构,例如 `EmailLogRecipient`)

需要新增 struct:
- `DashboardSnapshot` 字段:`Id int64 (pk)`、`HotelId int64`、`SnapshotDate time.Time (type:date)`、`Mode string (size:16)`、`Format string (size:8)`、`FilePath string (size:255)`、`FileSize int64`、`UploadedBy *int64`、`UploadedAt time.Time`
- `TableName() string { return "dashboard_snapshots" }`

---

## 任务 3:Config 增加 `Mail.SnapshotDir`

**文件**:`internal/config/config.go`,在 `Mail struct {}` 内追加:

```go
SnapshotDir string `json:",default=./data/snapshots"`
```

**对应 yaml 文档**:`etc/meeting-api.yaml.example` 在 `Mail:` 段添加:
```yaml
  SnapshotDir: "./data/snapshots"   # prod 用 /data/snapshots
```

**验证**:启动服务,确认 yaml 没设时 default 生效。

---

## 任务 4:上传 + 查询 Handler(后端核心)

**新增 Handler 文件**:`internal/handler/admin/dashboardSnapshotHandler.go`

提供 3 个 handler 函数:
1. `UploadDashboardSnapshotHandler(svcCtx) http.HandlerFunc` —— `POST /api/admin/dashboard-snapshots`
2. `ListDashboardSnapshotsHandler(svcCtx) http.HandlerFunc` —— `GET /api/admin/dashboard-snapshots`(预留,管理后台浏览用)
3. `ServeDashboardSnapshotHandler(svcCtx) http.HandlerFunc` —— `GET /admin/snapshots/...`(预览;路径校验防穿越)

`UploadDashboardSnapshotHandler` 处理流程:
1. 校验:`r.ParseMultipartForm(6 << 20)`(6MB 上限,留 1MB buffer)
2. 解析 form 字段 `hotelId`(int64)、`date`(YYYY-MM-DD)、`mode`(occupancy/bookings)、`format`(png/pdf)
3. 拒绝非法 mode/format
4. 拿到 file:`r.FormFile("file")`,size > 5MB 报 413
5. 当前 user id 从 `r.Header.Get("X-User-Id")` 取(中间件已塞)
6. 计算相对路径:`{YYYY}/{MM}/dashboard-{hotelId}-{YYYY-MM-DD}-{mode}.{format}`(YYYY/MM 取 snapshot_date,Asia/Shanghai)
7. 拼绝对目录 = `Cfg.Mail.SnapshotDir + relativePath`,`os.MkdirAll(filepath.Dir(...), 0o755)`
8. 写文件(临时名 + rename 保证原子性);失败回滚
9. **DB UPSERT**:先查现有行 → 若存在且 file_path 不同,删旧物理文件;然后 `ON DUPLICATE KEY UPDATE` 或 GORM `Clauses(clause.OnConflict{...})`
10. 返回 `{ id, filePath: relativePath, uploadedAt }`

**route 注册**:文件 `internal/handler/routes.go` 第 17-198 行的 `RegisterHandlers` 第一组 `WithMiddlewares([Auth, AdminOnly])` route 列表里追加(在 `TriggerMailBlastHandler` 之后,即 line 196 后):

```go
{
    Method:  http.MethodPost,
    Path:    "/api/admin/dashboard-snapshots",
    Handler: admin.UploadDashboardSnapshotHandler(serverCtx),
},
{
    Method:  http.MethodGet,
    Path:    "/api/admin/dashboard-snapshots",
    Handler: admin.ListDashboardSnapshotsHandler(serverCtx),
},
{
    Method:  http.MethodGet,
    Path:    "/admin/snapshots/:year/:month/:filename",
    Handler: admin.ServeDashboardSnapshotHandler(serverCtx),
},
```

**注意**:go-zero `rest.Route.Path` 不支持 ant-style 通配符;改用 path param 三段 `:year/:month/:filename`。

---

## 任务 5:扩展 `pkg/mail/sender.go` 支持 inline 图片

**文件**:`/Users/xiaowei/Workspace/go-project/meeting/pkg/mail/sender.go`

新增类型:
```go
type InlineImage struct {
    CID      string  // gomail 自动生成,这里只用文件 basename(也就是 cid 值)
    FilePath string  // 绝对路径
}
```

**Send 签名变更**:
- 旧:`func (s *Sender) Send(to []string, subject, htmlBody string) error`
- 新:`func (s *Sender) Send(to []string, subject, htmlBody string, inlineImages []InlineImage) error`

实现:在 `m.SetBody(...)` 之后、`d.DialAndSend(m)` 之前:
```go
for _, img := range inlineImages {
    m.Embed(img.FilePath)   // gomail 自动设 Content-ID = filename
}
```

`gomail.Embed` 默认把 `Content-Disposition: inline` + `Content-ID: <filename>` 都设好;HTML `<img src="cid:filename">` 直接引用即可。

**所有 Send 调用方需要更新**(grep `\.Send(\[\]string` 发现 3 处):
1. `pkg/blast/sender.go:96` —— 改为 `mailer.Send([]string{addr}, subject, body, inlineImages)`
2. `internal/logic/email/sendToUserLogic.go:99` —— 改为 `sender.Send([]string{u.Email}, subject, body, nil)`(测试发送暂传 nil,任务 6 会补)
3. `pkg/notify/email.go:46` —— 改为 `mailer.Send(msg.Emails, subject, body, nil)`(系统通知不嵌图)

---

## 任务 6:重构 `pkg/blast/vars.go` —— recipientVars 新签名

**文件**:`/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/vars.go`

**当前签名**:
```go
func recipientVars(db *gorm.DB, email string, when time.Time, hotelOverride int64) map[string]interface{}
```

**新签名**:
```go
func recipientVars(db *gorm.DB, cfg config.Config, email string, when time.Time, hotelOverride int64) (
    vars map[string]interface{},
    inlineImages []mail.InlineImage,
    skipReason string,
    hotelId int64,
)
```

(返回 `hotelId` 是为了 sender.go 聚合钉钉提醒时知道哪个酒店)

逻辑要点:
1. 渲染原有 `Date` / `HotelName` / `OccupancyRate` 等(保持兼容)
2. 决定 `hotelId` 后,**只有当模板里用到 `{{.DashboardImage}}` 时才查 snapshot**——为节流,在 sender.go 处先 `strings.Contains(tpl.Body, "{{.DashboardImage}}")` 判断,然后传一个 bool 进来,本函数仅在 bool=true 时才查;现实里也可以无脑查(查询很轻),设计取决于偏好。**计划采用「无脑查」简化代码**
3. 当 `hotelId == 0`(收件人对标酒店解析失败) → `skipReason = "snapshot_missing"`(同 missing 逻辑)
4. 时区:`loc, _ := time.LoadLocation("Asia/Shanghai"); dateStr := when.In(loc).Format("2006-01-02")`(替换原 `when.Format(...)`)
5. 查 `dashboard_snapshots WHERE hotel_id=? AND snapshot_date=? AND mode='occupancy' AND format='png'`
6. 命中 → cid = basename = `dashboard-{hotelId}-{date}-occupancy.png`
7. 拼绝对路径 = `cfg.Mail.SnapshotDir + "/" + row.FilePath`
8. `vars["DashboardImage"] = "cid:" + cid`,append `inlineImages`
9. 未命中 → `skipReason = "snapshot_missing"`,**仍然写 `vars["DashboardImage"] = ""`** 以免 Go template 报 `<no value>`(对 testTemplate 路径友好)

**所有调用方**(grep `recipientVars(` 命中只有 1 处):
- `pkg/blast/sender.go:90` —— `vars := recipientVars(e.DB, addr, now, hotelOverride)` 需要拆成 4 返回值

---

## 任务 7:`pkg/blast/sender.go` —— skip 逻辑 + 钉钉聚合通知

**文件**:`/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/sender.go`

修改点:
1. `sendBatch` 函数顶部加一个并发安全的 missing 聚合 map:`type missingKey struct{ HotelId int64; Date string }; missing := sync.Map{}`(键 = (hotelId, date),值 = atomic.Int64 计数)
2. 第 88-101 行的 goroutine 内部:
   ```go
   vars, inlineImages, skipReason, hotelId := recipientVars(e.DB, e.Cfg, addr, now, hotelOverride)
   if skipReason == "snapshot_missing" {
       results[i].Err = fmt.Sprintf("dashboard image missing for hotel=%d date=%s", hotelId, now.In(loc).Format("2006-01-02"))
       results[i].Status = "skipped"
       k := missingKey{HotelId: hotelId, Date: now.In(loc).Format("2006-01-02")}
       v, _ := missing.LoadOrStore(k, new(atomic.Int64))
       v.(*atomic.Int64).Add(1)
       return  // 跳过该 recipient
   }
   if err := mailer.Send([]string{addr}, subject, body, inlineImages); err != nil { ... }
   ```
3. `email_log_recipients` 写入 status `"skipped"`(任务 1 migration 已扩枚举)
4. batch 结束后(`wg.Wait()` 之后)遍历 `missing` map,对每个 key 调用新增的 `notifyDashboardMissing(ctx, e.DB, e.Redis, hotelId, date, count)`;此函数走 dedupe(任务 8 实现)

---

## 任务 8:钉钉机器人聚合通知 + Redis dedupe

**新增文件**:`/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/notify_missing.go`(放在 blast 包内,不污染 notify 包,因为这是 blast 的下游副作用)

伪代码:
```go
package blast

import (
    "context"
    "fmt"
    "time"
    "github.com/redis/go-redis/v9"
    "gorm.io/gorm"
    "meeting/pkg/notify"
)

func notifyDashboardMissing(ctx context.Context, db *gorm.DB, rdb *redis.Client,
    hotelId int64, date string, affectedCount int64) error {

    key := fmt.Sprintf("notified:dashboard-missing:%d:%s", hotelId, date)
    ok, err := rdb.SetNX(ctx, key, "1", 24*time.Hour).Result()
    if err != nil { return err }   // Redis 故障别阻塞主流程
    if !ok { return nil }          // 24h 内已通知过,跳过

    // 查酒店名
    var hotelName string
    db.Raw("SELECT name FROM hotels WHERE id = ?", hotelId).Scan(&hotelName)
    if hotelName == "" { hotelName = fmt.Sprintf("hotel #%d", hotelId) }

    text := fmt.Sprintf(
        "⚠️ 看板图缺失,邮件已跳过\n酒店:%s\n日期:%s\n受影响邮件:%d 封\n请联系酒店对接人尽快在 PC 端点击「保存」生成今日看板图。",
        hotelName, date, affectedCount,
    )
    sender := &notify.DingTalkRobotSender{DB: db}
    return sender.Send(ctx, notify.Message{
        Title: "看板图缺失提醒",
        Text:  text,
    })
}
```

**注意**:`Engine` struct 当前不持有 Redis 句柄。需要在 `blast.NewEngine` 增加 `rdb *redis.Client` 参数,并在 `internal/svc/servicecontext.go:75` 改为 `blast.NewEngine(db, rdb, c)`。

---

## 任务 9:30 天清理 Cron

**新增文件**:`/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/cleanup_scheduler.go`(放 blast 包,因为只此处用)

仿照 `pkg/blast/scheduler.go` 写一个 `CleanupScheduler`:
```go
type CleanupScheduler struct {
    cron    *cron.Cron
    db      *gorm.DB
    cfg     config.Config
    entryID cron.EntryID
}

func NewCleanupScheduler(db *gorm.DB, cfg config.Config) *CleanupScheduler {
    return &CleanupScheduler{cron: cronx.New(), db: db, cfg: cfg}
}

func (s *CleanupScheduler) Start() error {
    expr := "0 0 3 * * *"  // 每天 03:00
    id, err := s.cron.AddFunc(expr, func() {
        s.runOnce(context.Background())
    })
    if err != nil { return err }
    s.entryID = id
    s.cron.Start()
    return nil
}

func (s *CleanupScheduler) runOnce(ctx context.Context) {
    var rows []model.DashboardSnapshot
    s.db.Where("uploaded_at < ?", time.Now().Add(-30*24*time.Hour)).Find(&rows)
    for _, r := range rows {
        os.Remove(filepath.Join(s.cfg.Mail.SnapshotDir, r.FilePath))
    }
    s.db.Where("uploaded_at < ?", time.Now().Add(-30*24*time.Hour)).
        Delete(&model.DashboardSnapshot{})
    logx.Infof("[SnapshotCleanup] 删除 %d 条过期截图", len(rows))
}
```

**接入 main.go**:在 `meeting.go` 第 76 行附近(blast 调度器启动后)追加:
```go
{
    cs := blast.NewCleanupScheduler(ctx.DB, c)
    if err := cs.Start(); err != nil {
        logx.Errorf("[SnapshotCleanup] 启动失败: %v", err)
    }
}
```

**Cron 表达式**:`0 0 3 * * *`(秒 分 时 日 月 周 - 每天 03:00:00 跑)。

---

## 任务 10:Frontend Dashboard.tsx —— handleExport 上传步骤

**文件**:`/Users/xiaowei/Workspace/react/occupancy-insights/src/components/dashboard/Dashboard.tsx`

修改 `handleExport`(line 119-168)。在 `toPng` 拿到 `dataUrl` 之后、`document.createElement("a")` 触发本地下载之前,**插入上传逻辑**:

```ts
// 把 data URL 转回 Blob
const blob = await (await fetch(dataUrl)).blob();
const fd = new FormData();
fd.append("file", blob, `${exportFilename}.${format}`);
fd.append("hotelId", String(hotelId));
// 当前 dashboard 的"今日"按 Asia/Shanghai
const now = new Date();
const dateISO = now.toLocaleDateString("zh-CN", { timeZone: "Asia/Shanghai" })
                   .replace(/\//g, "-")
                   .split("-")
                   .map((s, i) => i === 0 ? s : s.padStart(2, "0"))
                   .join("-");
fd.append("date", dateISO);
fd.append("mode", mode);
fd.append("format", format);

try {
    const token = localStorage.getItem("auth_token");  // 用 client.ts 的 TOKEN_KEY
    const res = await fetch(`${import.meta.env.DEV ? "" : import.meta.env.VITE_API_BASE_URL || ""}/api/admin/dashboard-snapshots`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
    });
    if (!res.ok) throw new Error(await res.text());
} catch (e) {
    toast.error("服务器留存失败,本地下载已完成", {
        description: e instanceof Error ? e.message : "",
    });
    // 不阻断:继续走本地下载
}
```

**关键**:不能用 `request()` helper —— 它默认 `Content-Type: application/json`,会破坏 FormData 边界。直接 `fetch` 加 Authorization header。
**注意**:Dashboard 的「保存」按钮目前只在 PC 显示(line 248 `hidden sm:inline-flex`),移动端无影响,符合 spec 设计。

⚠️ **关键约束**:`dateISO` 必须取 `new Date()` 当前真实日期,**不能用 selected month/year**(用户可以看历史月份;若用 selected,4 月历史看板上传会被存成 4 月日期,与"今日"语义冲突)。

---

## 任务 11:Frontend Email.tsx —— TEMPLATE_VARS + BUILTIN_TEMPLATES

**文件**:`/Users/xiaowei/Workspace/react/occupancy-insights/src/pages/admin/Email.tsx`

**Line 1032-1040** `TEMPLATE_VARS` 数组追加一项:
```ts
{ key: "{{.DashboardImage}}", desc: "本月日历图(按收件人对标酒店当天)" },
```

**Line 1042-1115** `BUILTIN_TEMPLATES` 数组追加一个对象:`name: "daily_report_with_image"`,`description: "带日历图的日报(图片由 PC 看板「保存」上传)"`,`subject: "【{{.HotelName}}】{{.Date}} 看板日报"`,`body` 用 spec 第 173-179 行的示例 HTML 包一层 table,核心是 `<img src="{{.DashboardImage}}" style="max-width:600px;width:100%;border:1px solid #e5e7eb;border-radius:8px;" />`。

---

## 任务 12:端到端测试

详见下文「测试计划」。

---

## 任务 13:部署 + 灰度

详见下文「部署说明」。

---

# 测试计划

## 本地 SMTP 测试

1. `cp etc/meeting-api.yaml.example etc/meeting-api.yaml`,把阿里企业邮 SMTP 凭证填进去(也可在管理后台「邮件设置」填)
2. `mysql -uroot ding < migrations/013_dashboard_snapshots.sql`
3. `mkdir -p ./data/snapshots`
4. 启动后端:`go run meeting.go`
5. 启动前端:`pnpm dev`
6. PC 浏览器登录,选定一家酒店,点「保存」→ PNG;DevTools 看 `/api/admin/dashboard-snapshots` 返回 201,本地 .png 也下载下来
7. `mysql -e "SELECT * FROM dashboard_snapshots"` 应有一行
8. `ls ./data/snapshots/2026/05/`,文件存在
9. 后台「邮件 → 模板」新建模板,body 用 `<img src="{{.DashboardImage}}">`
10. 把该模板设为群发模板,触发一次 `POST /api/admin/mail-blast/trigger`
11. Gmail / 钉钉邮箱 / 阿里企业邮 收件箱里**真的看到图**(关键!某些客户端会拦 cid)

## 缺图场景验证

1. 删除 `dashboard_snapshots` 行 + 物理文件:`DELETE FROM dashboard_snapshots WHERE id=1; rm ./data/snapshots/2026/05/dashboard-3-2026-05-09-occupancy.png`
2. 触发 `POST /api/admin/mail-blast/trigger`
3. 该酒店所有收件人:邮件不发出(收件箱无信);`email_log_recipients.status='skipped'`,`error` 字段写明 `dashboard image missing for hotel=3 date=2026-05-09`
4. 钉钉群机器人收到一条「⚠️ 看板图缺失」通知
5. **同一天再触发一次**:`redis-cli GET notified:dashboard-missing:3:2026-05-09` 返回 `"1"`,钉钉群无新通知(dedupe 生效)
6. `redis-cli DEL notified:dashboard-missing:3:2026-05-09` 模拟跨天后,再触发,通知会再发一次

## cid 嵌入验证(关键!)

不同邮件客户端 cid 支持参差:
- Gmail Web:**支持**,自动展示;但若 HTML 太宽会折叠 → 测试用 600px 容器
- 钉钉邮箱:支持
- 阿里企业邮 Web:支持
- Outlook(桌面/Win):支持但偶发把 inline 图当附件,**测试时一定要在真实 Outlook 上看**
- 安卓 Outlook:支持
- iOS Mail:支持

测试方法:在收件箱原文(View Source)里看 `<img src="cid:..." >` 是否被替换成 base64 / 是否有对应的 multipart attachment 段。

## 30 天清理 cron 测试

1. 手工插入一条 `INSERT INTO dashboard_snapshots (..., uploaded_at) VALUES (..., '2026-04-01 00:00:00');` 配一个对应的物理文件
2. 临时改 cron 为 `*/30 * * * * *` 跑一次,文件 + DB 行都应该被清掉
3. 改回 `0 0 3 * * *`

---

# 部署说明

## prod 上线步骤(按顺序)

1. **DB 迁移**:`ssh root@39.107.86.13 'mysql -h... -u... -p... ding'` < `migrations/013_dashboard_snapshots.sql`
2. **建快照目录**:`ssh prod 'sudo mkdir -p /data/snapshots && sudo chown meeting-api:meeting-api /data/snapshots && sudo chmod 755 /data/snapshots'`
3. **更新配置**:`scp etc/meeting-api.yaml prod:/opt/meeting-api/etc/meeting-api.yaml`,确保 `Mail.SnapshotDir: "/data/snapshots"`(prod 的绝对路径,跟 dev 不同)
4. **后端服务重启**:`scp meeting-api prod:/opt/meeting-api/`(已编译好的二进制),`ssh prod 'sudo systemctl restart meeting-api'`
5. **前端发布**:`pnpm build`,把 `dist/` rsync 到 nginx 静态目录
6. **冒烟测试**:登录后台,触发一次「邮件设置 → 测试发送」走 sendToUserLogic(应仍能跑,因为传 nil inlineImages),确认旧通路没坏
7. **真实保存测试**:`PC` 端真实点保存,看后端 log + 截图目录
8. **群发观察**:把生产 cron 拉到第二天 8pm,留意钉钉群是否报 missing(灰度第一周必有人忘点)

## 回滚

- DB:`DROP TABLE dashboard_snapshots;` + `ALTER TABLE email_log_recipients MODIFY status ENUM('sent','failed') NOT NULL;`
- 二进制:回退到上一版 `meeting-api`
- 前端:回退 `dist/`
- 物理文件:`/data/snapshots` 留着无害,等下次清理

---

# 风险 / 调研中发现的不一致

1. **`email_log_recipients.status` 枚举不含 `skipped`**:migration `011` 定义 `ENUM('sent','failed')`。Spec 五-3 要 `status='skipped'`,需要在 013 里同步 ALTER。已在任务 1 处理。
2. **Spec 文件路径与 cid 命名不一致**:Spec 三描述路径 `{hotel_id}-{date}-{mode}.png`(无前缀),Spec 五描述 cid `dashboard-{hotelId}-{date}-occupancy.png`(有 `dashboard-` 前缀)。`gomail.Embed` 自动取 basename 作 cid,**两者必须一致**。计划统一加 `dashboard-` 前缀,文件路径改为 `2026/05/dashboard-3-2026-05-09-occupancy.png`。
3. **`recipientVars` 当前没传 `cfg`**:加签需要 `cfg.Mail.SnapshotDir` 拼绝对路径,所以函数签名要多吃一个 `config.Config` 参数。已在任务 6 列出。
4. **Engine 没有 Redis 句柄**:钉钉 dedupe 需要 Redis,任务 8 里要改 `blast.NewEngine` 签名 + svc/servicecontext.go 第 75 行的实例化。
5. **go-zero 路由通配符**:`/admin/snapshots/*` 这种 ant-style 写法不被 go-zero 支持;计划 fallback 到三段 path param `/admin/snapshots/:year/:month/:filename`。
6. **DashboardImage 为空时模板渲染**:HTML `{{.DashboardImage}}` 模板若变量值为 `cid:xxx` 还好;若 missing 路径里我们已经 skip,本质上不会进入渲染。但若有人不 skip(例如 testTemplate 测试发送),需要在 missing 路径也给个空字符串以免 Go template 报 `<no value>`。计划:miss 时仍写 `vars["DashboardImage"] = ""`(Go template 默认会替换为空字符串),并在 sendBatch 里保留 skip 行为。
7. **Mode 字段在 v1 仅用 occupancy**:bookings mode 也允许保存上传(format=png/pdf),但 `recipientVars` 第一版只查 `mode='occupancy'`。后续若加 `{{.DashboardImageBookings}}`,可能要拆出 `recipientVarsForMode(mode)`。
8. **前端 `dateISO` 必须取真实今天**:Dashboard 里 `month`/`year` 是用户选的(可看历史月份),"今日"必须强制取 `new Date()` 当前日期,**不能**用 selected month/year(否则用户看 4 月历史时上传就成 4 月的截图,逻辑混乱)。已在任务 10 用 `new Date().toLocaleDateString(..., { timeZone: "Asia/Shanghai" })` 处理。
9. **5MB 上限校验**:前端不限,如果用户屏幕特别大(高 DPI + 长日历),pixelRatio:2 出来可能逼近 2-3MB;需要监控告警,有用户超 5MB 时降级到 pixelRatio:1。
10. **PDF 不能 inline**:gomail.Embed 不挑文件类型,但 HTML `<img src="cid:xxx.pdf">` 浏览器渲染不出来。Spec 也说 v1 仅 PNG inline。前端 PDF 仍上传 DB,但模板默认不引用。

---

# 关键实现文件清单

- `/Users/xiaowei/Workspace/go-project/meeting/migrations/013_dashboard_snapshots.sql`
- `/Users/xiaowei/Workspace/go-project/meeting/internal/handler/admin/dashboardSnapshotHandler.go`(新增)
- `/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/vars.go`
- `/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/sender.go`
- `/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/notify_missing.go`(新增)
- `/Users/xiaowei/Workspace/go-project/meeting/pkg/blast/cleanup_scheduler.go`(新增)
- `/Users/xiaowei/Workspace/go-project/meeting/pkg/mail/sender.go`
- `/Users/xiaowei/Workspace/go-project/meeting/internal/handler/routes.go`
- `/Users/xiaowei/Workspace/react/occupancy-insights/src/components/dashboard/Dashboard.tsx`
- `/Users/xiaowei/Workspace/react/occupancy-insights/src/pages/admin/Email.tsx`
