# 邮件模板静态附件 —— 图片 / PDF 全员一致发送

**日期**:2026-05-09
**状态**:用户口头批准,直接进入实现

## 一、目标

让管理员在邮件模板上挂 N 个文件(图 / PDF),群发该模板时所有收件人都收到同一份。跟既有 `{{.DashboardImage}}`(per-recipient 动态)正交,互不干扰。

业务诉求:业务同学不想写 HTML,上传一张图直接发就行;爱排版的还能在 HTML 里用 `<img src="cid:filename">` 精确嵌入。

## 二、为什么(方案 E)

之前考虑过 A(自动嵌底部)、C(变量插入)等,最后落到 E:
- 上传 = 全部 attach(图用 Embed/inline,PDF 用 Attach/附件)
- HTML 一行不动
- 用户想嵌入正文 → 自己写 `<img src="cid:xxx">`(模板编辑器里有 cid 提示 + 一键复制)
- 用户不想 → 收件人在附件区看到,大多数客户端(Gmail / 阿里企业邮 / 钉钉邮箱)还会把 inline 图自动展示在邮件底部

两类用户互不打扰。

## 三、数据建模

### 新表 `mail_template_attachments`(migration 014)

```sql
CREATE TABLE mail_template_attachments (
  id            BIGINT UNSIGNED PRIMARY KEY AUTO_INCREMENT,
  template_id   BIGINT UNSIGNED NOT NULL,
  original_name VARCHAR(255) NOT NULL,        -- 原始文件名(展示用)
  file_path     VARCHAR(255) NOT NULL,        -- 相对路径 e.g. template-3/abc.png
  file_size     INT UNSIGNED NOT NULL,
  mime_type     VARCHAR(64) NOT NULL,         -- image/png, application/pdf, ...
  cid           VARCHAR(128) NOT NULL,        -- 邮件 Content-ID(同 template 内唯一)
  sort_order    INT NOT NULL DEFAULT 0,
  uploaded_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_template_id (template_id),
  UNIQUE KEY uk_template_cid (template_id, cid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
```

### 文件存储

- 新 config key:`Mail.AttachmentDir`(默认 `./data/mail-attachments`,prod `/data/mail-attachments`)
- 路径布局:`{AttachmentDir}/template-{template_id}/{cid}`
- 文件名 = cid(基于原始 basename 去重后)

### 限制

| 维度 | 上限 |
|---|---|
| 单文件 | 20MB |
| 模板总附件 | 50MB(soft;真超了 SMTP 报错走 email_logs.error) |
| 数量 | 不限 |
| 类型 | 不限(后端 mime sniff;前端建议图/PDF) |

## 四、HTTP 路由

| Method | Path | 说明 |
|---|---|---|
| POST | `/api/admin/mail-templates/:id/attachments` | multipart upload;返回 `{id, originalName, cid, sortOrder, size}` |
| GET | `/api/admin/mail-templates/:id/attachments` | 列表(模板编辑时拉) |
| DELETE | `/api/admin/mail-templates/:id/attachments/:attId` | 删除一条 + 物理文件 |

均走 `Auth + AdminOnly` 中间件。

## 五、Send-time 逻辑(`pkg/blast/sender.go`)

在现有 `sendBatch` 内,模板渲染完 + `recipientVars` 拿到的 inlineImages 之外,**加载模板级附件**:

```go
var atts []model.MailTemplateAttachment
e.DB.Where("template_id = ?", templateId).Order("sort_order, id").Find(&atts)
```

把每一条转成 `mail.InlineImage`(图)或 `mail.Attachment`(PDF):
- 图(mime starts with `image/`)→ Embed(inline disposition + cid)
- 非图 → Attach(attachment disposition + cid)

`mail.Sender.Send` 签名扩展:加 `attachments []Attachment` 参数。Embed 已支持,Attach 新加。gomail.Message 有 `m.Attach(...)`。

合并顺序:per-recipient `inlineImages`(快照图)先嵌入,然后模板附件追加。

## 六、Frontend(`src/pages/admin/Email.tsx`)

模板编辑对话框新增「附件」section,位于「可用变量」之上:

```
附件(图片 / PDF, 单文件 ≤ 20MB)
┌────────────────────────────────────────────┐
│ + 上传文件                                  │
├────────────────────────────────────────────┤
│ 📎 poster.png    150KB   cid:poster.png 📋 🗑 │
│ 📎 report.pdf     2MB   cid:report.pdf 📋 🗑 │
└────────────────────────────────────────────┘
小贴士:想让图片嵌在正文里,把右侧 cid 复制到 HTML
       `<img src="cid:..." />` 里;不嵌就当附件挂着,
       收件人在附件区看到。
```

操作:
- 选文件 → POST → 列表实时刷新
- 复制按钮 → `navigator.clipboard.writeText("cid:xxx")` + toast
- 删除按钮 → DELETE → 列表刷新
- 新建模板时:先 save 拿到 templateId,再允许上传(防止孤儿文件)

## 七、跟 `{{.DashboardImage}}` 的关系

完全正交。两个系统都在 send-time 走 Embed/Attach 链路:

| 来源 | 范围 | cid | 实现位置 |
|---|---|---|---|
| `{{.DashboardImage}}` | per-recipient(按对标酒店 + 当日) | `dashboard-{hotelId}-{date}-occupancy.png` | `pkg/blast/vars.go` 已有 |
| 模板附件 | per-template(所有收件人相同) | 用户上传时分配的 cid(基于原 basename) | 本期新增,`pkg/blast/sender.go` |

cid 命名空间不冲突(快照都带 `dashboard-` 前缀;模板附件用原 basename)。

## 八、测试

- 上传图 → DB 有行 + 文件落盘 + UI 列表展示
- 复制 cid → HTML 里写 `<img src="cid:xxx">` → 测试发送 → Gmail 看图嵌入正文
- 不写 `<img>` → 测试发送 → 收件人附件区还能看到该文件
- 上传 PDF → 测试发送 → 收件人附件区有 PDF 可下载
- 删除附件 → 物理文件被删
- 超 20MB 文件上传 → 后端 413 + 前端 toast
- 跟 `{{.DashboardImage}}` 共存:模板同时引用 + 上传附件 → 两类图都正确显示

## 九、不在本期范围

- 模板删除时级联清理附件(留 follow-up,数据库 ON DELETE 或定期 GC 都行)
- 拖拽排序(`sort_order` 字段已留,UI 第一版上下箭头按钮即可,或者不暴露排序)
- 全局总大小配额(用户级 / 整租户级)
- 附件版本管理 / 回滚
