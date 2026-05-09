# 移动端 Dashboard 重做 —— 实现计划

**日期**:2026-05-09
**对应 spec**:`docs/superpowers/specs/2026-05-09-mobile-dashboard-redesign-design.md`
**状态**:待执行

> 本计划严格遵循 spec。术语沿用 spec 第四节的澄清:
> - 柱下 **M / A** 标签 = 时段(Morning / Afternoon)
> - 箭头矩阵左侧 **C / M** 行标 = 对比源(Competitor / Market)
> - "上午区 / 下午区" = 箭头矩阵的**左列 / 右列**(按时段切),tap 触发 `CompetitorDrawer(period=AM/PM)`

## 一、现状摸底结论

代码勘察后,以下事实需在动手前明确:

1. **`CompetitorDrawer` 当前不接收 period prop**
   - `src/components/dashboard/CompetitorDrawer.tsx:11-16` props = `{ date, open, onClose, hotelId }`
   - `src/components/dashboard/CompetitorDrawer.tsx:69` 调用 `fetchCompetitorDetail(date, hotelId)`,接口签名 `src/api/dashboardApi.ts:157-164` 也只收 `date + hotelId`
   - 但 `CompetitorDetail.activities[].period`(`src/api/types.ts:48-55`)在每条活动上有 `period` 字段 → **可在前端按 period 过滤,不需要改 API**
   - 计划:给抽屉加可选 `period?: TimePeriod` prop,在 `CompetitorContent` 渲染前 client-side 过滤 `activities`(并按过滤结果重算 `count`,`count === 0` 的酒店整条隐藏)
2. **`onCompetitorClick` 当前签名是 `(date: string) => void`**
   - `src/components/dashboard/DayCell.tsx:10`、`src/components/dashboard/Dashboard.tsx:175` 都用单参形式
   - **桌面分支调用点**(`DayCell.tsx:169` 与 `:194`)位于按 PERIODS 迭代的 `<button>` 内,迭代变量 `p` 即 "AM" 或 "PM"——升级签名为 `(date, period)` 时,这两处天然能补上 `p`,**视觉与行为零变化**(spec 要求桌面分支不动,这不算视觉改动,只是事件 payload 多带一个值)
3. **`DayData` 字段齐全**(`src/api/types.ts:24-40`):`periodOccupancy / competitorPeriodOccupancy / marketPeriodOccupancy / cityEventCount` 都在,新格子无需扩字段
4. **`getThresholdColor` 已从 `DayCell` 导出**(`DayCell.tsx:19`),且只被 `DayDetailDrawer.tsx:5` 在外部 import → 删除 DayDetailDrawer 后函数仍由 DayCell 自用,无需迁移
5. **dev 端口 = 8210**(`vite.config.ts`),非 Vite 默认 5173

## 二、任务清单(每条 = 一次 commit)

按顺序执行。每步可独立通过 `npm run lint && npm run build` 与肉眼回归。

### 任务 1:为 `CompetitorDrawer` 增加 `period` prop(client-side 过滤)

**改动文件**:`src/components/dashboard/CompetitorDrawer.tsx`

- props 接口加 `period?: TimePeriod`(从 `@/api/types` import `TimePeriod`,只用 `"AM" | "PM"`,留 undefined = 不过滤)
- 在 `CompetitorContent` 之前(`useEffect` 之后)按 period 过滤:
  ```ts
  const filtered = period
    ? competitors
        .map((c) => ({ ...c, activities: c.activities.filter((a) => a.period === period) }))
        .map((c) => ({ ...c, count: c.activities.length }))
        .filter((c) => c.count > 0)
    : competitors;
  ```
- 标题(`titleContent`)在 `period` 存在时追加上下午 chip,例如 `5月9日 · 竞对酒店群明细 · 上午`(直接在已有标题后拼字符串即可,沿用 `PERIOD_LABEL`)
- **不动**:fetch 逻辑、`hotelId` 依赖、Drawer/Sheet 切换。Spec 第三节"数据复用 PC 已有逻辑"明确允许仅前端过滤

### 任务 2:`DayCell` 升级 `onCompetitorClick` 签名,桌面分支补上 period 参数

**改动文件**:`src/components/dashboard/DayCell.tsx`

- `DayCellProps.onCompetitorClick` 改为 `(date: string, period: "AM" | "PM") => void`
- 桌面分支的两个 `onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date); }}`(`DayCell.tsx:169` occupancy / `:194` bookings)各自改为 `onCompetitorClick?.(day.date, p)`(`p` 已在闭包里)
- **本任务桌面分支只改这两个事件 payload,视觉/DOM/className 全部不动**——spec 严格禁止动桌面外观,事件 payload 不属于"外观"
- compact 分支暂不动(任务 4 整体重写)

### 任务 3:`Dashboard.tsx` `handleCompetitorClick` 接收 period 并下发到 `CompetitorDrawer`

**改动文件**:`src/components/dashboard/Dashboard.tsx`

- 加状态 `const [compPeriod, setCompPeriod] = useState<"AM" | "PM" | undefined>(undefined);`(放到现有 `compDate / compOpen` 旁,~ line 66-67)
- `handleCompetitorClick`(line 175-178)签名改为 `(date: string, period: "AM" | "PM")`,函数内 `setCompPeriod(period)` + 现有的 setCompDate/setCompOpen
- `<CompetitorDrawer ...>`(line 340)新增 `period={compPeriod}`
- 关闭时无需重置 period,Drawer 关了后下次打开会被 setter 覆盖

### 任务 4:`DayCell` compact 分支按 v6 双柱重写

**改动文件**:`src/components/dashboard/DayCell.tsx`

- 删除现有 compact 分支(line 48-110)的「综合大字 + 上下午迷你色点」实现,整段替换
- 容器:`min-h: 100px`(spec 加高 20px)、宽度仍随 grid;移除原先按 `overallColor / 0.18` 涂底,改为白底/卡片底,只在柱身上着阈值色
- 自上而下 4 层:
  1. 顶 14px:日期(周末蓝)+ 城市活动旗。复用现有的 `Flag` 按钮逻辑(`onCityEventClick?.(day.date)` 不变),保留 `e.stopPropagation()` 以免冒泡到容器
  2. 中部双柱区(约 50px 高):flex row,左 M / 右 A,每柱身高度 = `${val}%` of 容器高,`backgroundColor: hsl(${color} / 0.8)`;柱顶绝对定位 9px / font-weight 800 的本店 % 数字,色 `hsl(${color})`;柱下 7px / font-weight 800 的 `M` 或 `A` 标签
  3. 底部箭头矩阵(约 22px 高):2 列 × 2 行 grid,左列对应 AM、右列对应 PM。每列上行 `C ▲/▼/─`、下行 `M ▲/▼/─`(行标 `C` / `M`,对比源——spec 第四节术语澄清)
- 方向计算抽小函数 `compareDirection(myVal, otherVal): "win" | "lose" | "tie"`(放到 `CompareValue` 附近),映射到 `▲ / ▼ / ─`
- 颜色硬编码 spec 第三节给定的三色:`hsl(140, 65%, 32%)` / `hsl(0, 75%, 48%)` / `#9ca3af`——直接 inline style,**不引 OKLCH**(spec 强调 html-to-image 兼容性)
- **整列 tap 命中区**:把"M 标签 + 左列两箭头"包成一个 `<button>`、右列同理;`onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date, p); }}`。柱身本身**不**带 onClick,顶部空白区也不带——spec 明确"格子背景不响应"
- `highlightPeriod` 处理:沿用桌面 `!isHighlighted && "opacity-30"` 逻辑,同时降透明度的应用对象 = 该列(柱 + 标签 + 箭头矩阵列)
- **桌面分支(`if (compact)` 之后整段)一行不动**
- 复用 `getThresholdColor`,**不**重新定义阈值色

### 任务 5:`Dashboard.tsx` 移除 `DayDetailDrawer` 状态、import、渲染,保留兜底 toast

**改动文件**:`src/components/dashboard/Dashboard.tsx`

- 删除 `import { DayDetailDrawer } from "./DayDetailDrawer";`(line 14)
- 删除 `dayDetailDate / dayDetailOpen` 两个 useState(line 70-71)
- 删除整段 `<DayDetailDrawer ... />` JSX(line 342-351)
- 改 `handleDayClick`(line 95-112):
  - `mode === "bookings"` 分支不动(VenueBookingDrawer)
  - 删除原来 mobile + dayHasData 后打开 DayDetailDrawer 的两行
  - 但**保留** `if (!d || !dayHasData(d)) toast.info(...)` 这条兜底 toast——spec 没说删 toast,继续提示"暂无数据"在 mobile 上仍有用(用户 tap 空白格子时反馈一下,虽 spec 第四节说"不响应",但 toast 提示仍属合理 UX)
  - 如果你倾向**完全静默**(更严格遵循 spec "不响应"),可在本任务直接把 `mode === "occupancy"` 分支整个 `return;` 掉——这条由 reviewer 与 spec 作者再确认。**默认实现:保留 toast 兜底,删抽屉打开**

### 任务 6:删除 `DayDetailDrawer.tsx`

**改动文件**:`src/components/dashboard/DayDetailDrawer.tsx`(删)

- `git rm src/components/dashboard/DayDetailDrawer.tsx`
- 任务 5 已经清完所有 import/引用,本步只是真正删文件
- 跑 `npm run build` 确认无悬挂 import

### 任务 7:回归测试 + 截图

**不改代码**,仅执行 spec 第七节测试清单。详见下文「五、验证策略」。

### (可选)任务 8:flag 死文件,但本计划不动

- `src/components/dashboard/MobileDayDrawer.tsx` 与 `src/components/dashboard/DayDrawer.tsx` 当前**没有 import**(全仓 grep 仅自引用)
- 它们不在 spec 范围内 → 本计划**不动**它们,只在 commit message 或 PR 描述里 flag 一下,留给后续清理。这点见下文「六、风险」

## 三、`CompetitorDrawer` period 处理结论

**结论:抽屉当前不支持 period,需要加一个 `period?: TimePeriod` prop。**(任务 1)

- API 不动:`fetchCompetitorDetail(date, hotelId)` 已经返回带 `period` 的活动列表
- 过滤层只在前端做:`activities.filter((a) => a.period === period)`,过滤后 `count` 跟着重算,空酒店整条隐藏
- `period === undefined`(桌面端无 period 上下文/或将来想看全天)= 不过滤,显示原始数据
- 标题尾部追加 `· 上午 / · 下午` 让用户感知当前过滤态

## 四、验证策略

### dev 启动

```bash
npm run dev   # 起 vite,默认 http://localhost:8210
```

### Mobile viewport 回归

打开 Chrome DevTools → device toolbar,切到 iPhone SE(375×667)和 Pixel 5(393×851)。

### 任务 4 完成后逐项检视

- [ ] 格子高度从 80px → 100px,月历总高度增加 ≈ 120px(6 周×20),仍能一屏看完一个月
- [ ] 双柱:不同阈值档(红/黄/绿)各看一格,柱身色与柱顶数字色都来自 `getThresholdColor`(注意红/黄/绿的对比度)
- [ ] 柱顶 % 数字 9px、M/A 标签 7px,字号小但仍能看清
- [ ] 城市活动旗:`cityEventCount > 0` 才显;tap 后开 `CityEventDrawer`,**不**会同时冒泡到上午/下午区
- [ ] 上午区 tap → `CompetitorDrawer` 标题尾部 "· 上午",下午区同理 "· 下午"
- [ ] 抽屉打开后,只有该 period 的活动展示;`count` ≠ 原始 count
- [ ] 切换到「活动预订」tab → 整格 tap 弹 `VenueBookingDrawer`,旗仍可独立 tap,**没有**进 CompetitorDrawer 路径(spec 第四节 bookings mode 表)
- [ ] 切换 hotel / month → 数据正常 reload(无 stale)
- [ ] **桌面端宽屏**(>= sm):格子样式与之前**完全一致**——这是 spec 红线
- [ ] `highlightPeriod="All"` 之外的 dim 效果在 mobile 表现合理(目前 Dashboard 永远传 "All",所以视觉无差,但代码路径要对)

### 截图对比

任务 4 完成后,截一张 mobile 视图(各阈值色至少出现 1 格);任务 6 完成后,在「保存 → PNG」(桌面)走一遍,确认导出图未受连带影响(虽然桌面分支没动,但 react re-render 树变了)。

### 控制台

- 注意 `react/no-unused-imports`、tsc warning(任务 5 后 `DayDetailDrawer` 引用已清)
- 控制台不应出现 `Cannot read properties of undefined`——`compact` 分支重写后所有字段都来自 `day.*`,与现状字段集一致

## 五、风险与值得 flag 的事

只**记录**,不在本期解决:

1. **桌面分支的 `onCompetitorClick(date, p)` 签名变化**——虽然 payload 多了一参,事件视觉无变。但 `onCompetitorClick?.()` 的可选语法保证 safety,任何老的调用点(目前没有)不会崩。**无对外破坏**,不需 deprecation
2. **mobile occupancy mode 失去"场地预订"入口**——spec 第八节已明确接受。本计划不补
3. **方向箭头的 `vs 商圈` 行不响应 tap**——spec 第四节"vs 商圈如何处理"明说,本期沿用。视觉上箭头还在,但只是指示
4. **死文件 `MobileDayDrawer.tsx` / `DayDrawer.tsx`**——全仓未被引用,但 spec 没列入删除范围。**本计划不动**,在 PR 描述里提 follow-up
5. **`handleDayClick` 的 toast 兜底是否保留**——spec "格子背景不响应"与现有 "暂无数据" toast 略冲突;计划默认**保留 toast**,理由见任务 5。如 reviewer 觉得 spec 优先,改成 `return` 即可,改动量 < 5 行
6. **`fetchCompetitorDetail` 不接 period,前端 filter**——若后端将来加 period query 支持,可平滑切到服务端过滤,不影响本期改动
7. **格子加高后 PNG/PDF 导出**(桌面端 `handleExport`)——`calendarRef` 包的是整 Card,桌面分支没动,但 mobile cell 高度变化在桌面浏览器宽屏视角下根本不渲染(`hidden sm:grid` / `sm:hidden` 二选一),导出截图无影响。**verified by code reading**(`Dashboard.tsx:289-334`)
8. **`fetchCompetitorDetail` 已经在 `<CompetitorDrawer>` 内部 useEffect 触发,不依赖 period**——任务 1 的 client-side 过滤不动 fetch,不会双 fetch、不会丢 cache

## 六、关键实现文件

- `/Users/xiaowei/Workspace/react/occupancy-insights/src/components/dashboard/DayCell.tsx`
- `/Users/xiaowei/Workspace/react/occupancy-insights/src/components/dashboard/Dashboard.tsx`
- `/Users/xiaowei/Workspace/react/occupancy-insights/src/components/dashboard/CompetitorDrawer.tsx`
- `/Users/xiaowei/Workspace/react/occupancy-insights/src/components/dashboard/DayDetailDrawer.tsx`(删)
- `/Users/xiaowei/Workspace/react/occupancy-insights/src/api/types.ts`(只读引用 `TimePeriod`,不改)
