# 移动端 Dashboard 重做 —— v6 双柱格子 + 抽屉与 PC 对齐

**日期**:2026-05-09
**状态**:待审阅(spec → 计划 → 实现)

## 一、目标

把当前移动端「综合 % 大字 + 上下午 2 色点 + DayDetailDrawer 一站式聚合」改成:

1. **新格子 (v6 双柱)**:M / A 双柱条形 + 柱顶本店 % + 4 个 ▲▼ 方向箭头(vs 竞对 / vs 商圈)
2. **抽屉与 PC 对齐**:取消 inline 聚合的 `DayDetailDrawer`,直接走 `CompetitorDrawer` / `CityEventDrawer` 子抽屉,数据复用 PC 已有逻辑

不在本 spec 范围:活动预订模式 (bookings mode) 的 `VenueBookingDrawer` 保持不变;阈值色 / 数据接口 / threshold band 不动。

## 二、为什么

- 当前 V2 格子(单数字)用户反馈「只显示一个数字很丑」,信息密度太低,看不到上下午分布、看不到对手对比
- 当前 `DayDetailDrawer` 是聚合页 + 「点开抽屉看一切」,跟 PC 端「per-period 直接跳子抽屉」不一致,维护两套交互
- 把抽屉对齐 PC 后,只剩两个抽屉(CompetitorDrawer / CityEventDrawer),减一个组件文件、统一交互模型

## 三、新格子 (v6) 视觉规格

### 尺寸
- 50px 宽 × 100px 高(从当前 80px 加高 20px,容下 4 行信息)

### 自上而下 4 层结构

```
+-----------+
| 15  🚩    |  ← 顶: 日期 (周末蓝) + 城市活动旗 (cityEventCount > 0 才显)
|           |
|  ▮    ▮   |
|  ▮    ▮   |  ← 中: M / A 双柱
|  78   91  |  ←     柱高 = 本店 % (periodOccupancy[p]),色 = getThresholdColor(val)
|           |  ←     柱顶绝对定位写本店 % 数字 (9px 800 字重)
|   M    A  |  ← 柱下: 7px 800 字重 M/A 标签
|           |
| C  ▲   ▲  |  ← 底: 2×2 方向箭头矩阵
| M  ▲   ▲  |  ←     上行 vs 竞对 (C),下行 vs 商圈 (M)
+-----------+  ←     左列 = 上午 (M),右列 = 下午 (A)
                     绿 ▲ = 本店赢, 红 ▼ = 本店输, 灰 ─ = 平
```

### 颜色与字体规范
- 阈值色沿用 `getThresholdColor(value, thresholds)`,3 档 hsl 色板
- 柱身背景 `hsl(${color})` 80% 不透明;柱顶 % 数字用 `hsl(${threshold-darker})` 全色
- 方向箭头:▲ → `hsl(140, 65%, 32%)`(emerald);▼ → `hsl(0, 75%, 48%)`(red);─ → `#9ca3af`(neutral 400)
- 字体保持 `font-display`(数字)+ system-ui(标签)
- 不引入 OKLCH / 现代色函数(html-to-image 兼容性)

## 四、抽屉与点击交互

> **术语澄清**:v6 格子里 "M" 字符出现在两个位置 ——
> - **柱子下方的 M / A 标签** 表示时段(M = Morning 上午,A = Afternoon 下午)
> - **箭头矩阵左侧的 C / M 行标** 表示对比源(C = Competitor 竞对,M = Market 商圈)
> 下文说"上午区"/"下午区"指箭头矩阵里**左列 / 右列**(按时段切),不是行。

### Occupancy mode (出租率模式)

| 触发点 | 触发抽屉 | 备注 |
|---|---|---|
| 🚩 旗 tap | `CityEventDrawer` | 跟 PC 一致;`cityEventCount > 0` 才显示该旗 |
| **上午区** tap(M/A 标签的 "M" 字 + 左列两个 ▲▼ 箭头组成的整块区域) | `CompetitorDrawer` (period=AM) | 新增。PC 端 C 按钮等价物,加 period filter |
| **下午区** tap(M/A 标签的 "A" 字 + 右列两个 ▲▼ 箭头组成的整块区域) | `CompetitorDrawer` (period=PM) | 同上,period=PM |
| 顶部日期、柱身、整格其他空白 | 不响应 | 跟 PC `Clicking blank space in cell does nothing` 一致 |

> **vs 商圈如何处理**:`CompetitorDrawer` 内部已聚合了「竞对活动列表」一项数据;商圈对比目前 PC 没有独立抽屉(M 字符在 PC 上是 div 不可点)。本期手机端沿用 PC 约定,商圈方向箭头也是纯视觉指示,不响应 tap —— tap 只对应 `CompetitorDrawer`。后续如果业务真要看商圈活动列表,再单独建 MarketDrawer。

### Bookings mode (活动预订模式)

| 触发点 | 触发抽屉 | 备注 |
|---|---|---|
| 整格 tap | `VenueBookingDrawer` | 与现状一致,不变 |
| 🚩 旗 tap | `CityEventDrawer` | 与 PC 一致 |

## 五、组件级改动

### 修改:`src/components/dashboard/DayCell.tsx`
- compact 分支(移动端)整体重写为 v6 双柱布局
- 柱顶 % 数字、上下午标签、方向箭头矩阵 全部由该分支负责
- 暴露新 props 或复用现有 `onCompetitorClick`:接受 `period: "AM" | "PM"` 参数
- 桌面分支 **不动**

### 修改:`src/components/dashboard/Dashboard.tsx`
- `handleDayClick`(`useIsMobile()` 分支)从「打开 DayDetailDrawer」改为「不响应」
- `onCompetitorClick(date, period)` 兼容 mobile,在 mobile 下也直接走 PC 的 CompetitorDrawer 路径(目前 PC 已有)
- 删除 mobile 专用的 DayDetailDrawer 状态 + 渲染

### 删除:`src/components/dashboard/DayDetailDrawer.tsx`
- 完全废弃。Dashboard.tsx 移除 import 和所有引用
- (Git 历史保留;真不需要这种聚合页了)

### 不变
- `CompetitorDrawer` / `CityEventDrawer` / `VenueBookingDrawer` —— 已经存在,数据接口都通,直接复用
- `useIsMobile()` 钩子
- 阈值色函数 `getThresholdColor`
- 月历整体布局 / Legend / 工具栏

## 六、数据流

格子展示需要的字段全在 `DayData` 上(`api/types.ts`):
- `day.periodOccupancy[AM/PM]` — 本店 % (柱高 + 柱顶数字)
- `day.competitorPeriodOccupancy[AM/PM]` — 竞对 (▲/▼ 方向计算)
- `day.marketPeriodOccupancy[AM/PM]` — 商圈 (▲/▼ 方向计算)
- `day.cityEventCount` — 旗显示

方向箭头逻辑(纯本地比较):
- `M·C ▲ ⇔ periodOccupancy[AM] > competitorPeriodOccupancy[AM]`
- 相等 → ─ 灰平
- 小于 → ▼ 红
- 同理 PM 和 vs 商圈

## 七、测试清单

- [ ] 桌面浏览器开 mobile viewport (375×667 / 360×640) 看 v6 格子比例
- [ ] 真机 iPhone Safari + 钉钉 H5 容器各跑一次
- [ ] 不同阈值颜色档位的格子(红/黄/绿)各看一遍
- [ ] 城市活动旗 tap 进 CityEventDrawer 数据正确
- [ ] 上午行 tap 进 CompetitorDrawer 且 period filter = AM
- [ ] 下午行 tap 进 CompetitorDrawer 且 period filter = PM
- [ ] 切换到活动预订模式,整格 tap 进 VenueBookingDrawer 不变
- [ ] PC 浏览器宽屏视角无任何变化(desktop 分支不变)

## 八、风险 / 取舍

- **场地预订列表移动端没了直接入口** (occupancy 模式下) —— 现有 DayDetailDrawer 里有该列表,删除后用户要看场地预订必须切到 bookings 模式。判断:可接受,符合 PC 一致原则;后续真有诉求再补
- **方向箭头点击区偏小** —— 整行 tap 而不只是箭头本身,扩大触摸目标到整行
- **格子加高 20px 影响月历整体高度** —— 6 周 × 20 = 120px,略变长但仍可一屏看完月份。如果要保 80px 可以挤一挤,但视觉空间紧张

## 九、实现路径(粗)

1. DayCell.tsx compact 分支 v6 重写
2. Dashboard.tsx 删除 DayDetailDrawer 引用 + 改 onCompetitorClick 签名加 period
3. CompetitorDrawer 接收 period prop(若现在没有),按 period 过滤数据
4. 删除 DayDetailDrawer.tsx
5. 真机 + 截图测试

具体步骤交给 writing-plans。
