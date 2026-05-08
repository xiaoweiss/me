import type { DayData, ThresholdBand, TimePeriod } from "@/api/types";
import { cn } from "@/lib/utils";
import { Flag, ArrowUp, ArrowDown } from "lucide-react";

interface DayCellProps {
  day: DayData;
  mode: "occupancy" | "bookings";
  onClick: (date: string) => void;
  onCityEventClick?: (date: string) => void;
  onCompetitorClick?: (date: string) => void;
  compact?: boolean;
  thresholds: ThresholdBand[];
  highlightPeriod: TimePeriod;
}

const PERIODS: ("AM" | "PM")[] = ["AM", "PM"];
const PERIOD_LABELS = { AM: "M", PM: "A" };

export function getThresholdColor(value: number, thresholds: ThresholdBand[]): string {
  for (const t of thresholds) {
    if (value >= t.min && value < t.max) return t.color;
  }
  const last = thresholds[thresholds.length - 1];
  if (last && value >= last.min) return last.color;
  return thresholds[0]?.color ?? "0 0% 50%";
}

function CompareValue({ myVal, otherVal, label, prefix }: { myVal: number; otherVal: number; label: string; prefix: string }) {
  const isWin = myVal > otherVal;
  const isTie = myVal === otherVal;
  return (
    <span className={cn("inline-flex items-center gap-px text-[8px] font-medium", isTie ? "text-muted-foreground" : isWin ? "text-emerald-600" : "text-red-500")}>
      {prefix}{label}
      {!isTie && (isWin
        ? <ArrowUp className="h-2 w-2" strokeWidth={3} />
        : <ArrowDown className="h-2 w-2" strokeWidth={3} />
      )}
    </span>
  );
}

export function DayCell({ day, mode, onClick, onCityEventClick, onCompetitorClick, compact = false, thresholds, highlightPeriod }: DayCellProps) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayNum = dateObj.getDate();

  const periodValues = mode === "occupancy" ? day.periodOccupancy : day.periodBookings;

  if (compact) {
    // 移动端格子：上下两条色块（M/A 本酒店），底部 2×2（每个时段独立的 C / M 差值），跟桌面版信息量对齐
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;
    const suffix = mode === "occupancy" ? "%" : "";
    const fmtDiff = (n: number) => (n > 0 ? "+" : "") + n + suffix;
    const diffClass = (n: number) =>
      n === 0 ? "text-muted-foreground" : n > 0 ? "text-emerald-600" : "text-red-500";

    return (
      <div
        className="relative flex flex-col rounded-md cursor-pointer overflow-hidden bg-card border border-border/50"
        style={{ minHeight: "100px" }}
        onClick={() => onClick(day.date)}
      >
        {/* 顶部：日期 + 城市活动旗 */}
        <div className="flex items-center justify-between px-1 pt-0.5 min-h-[14px]">
          <span className={cn(
            "text-[10px] leading-none",
            isWeekend ? "text-primary font-semibold" : "text-muted-foreground font-medium",
          )}>
            {dayNum}
          </span>
          {day.cityEventCount > 0 && (
            <button
              type="button"
              title={`${day.cityEventCount} 项城市活动`}
              className="inline-flex items-center gap-0.5 rounded-full px-0.5 py-px text-red-500 active:bg-red-100 transition-colors"
              onClick={(e) => { e.stopPropagation(); onCityEventClick?.(day.date); }}
            >
              <Flag className="h-2.5 w-2.5 fill-current" />
              {day.cityEventCount > 1 && (
                <span className="text-[8px] font-bold leading-none">{day.cityEventCount}</span>
              )}
            </button>
          )}
        </div>

        {/* 中部：M / A 两条色块（本酒店各时段出租率） */}
        <div className="flex flex-col gap-px px-0.5 py-px">
          {PERIODS.map((p) => {
            const v = periodValues[p];
            const c = getThresholdColor(v, thresholds);
            const dim = highlightPeriod !== "All" && highlightPeriod !== p;
            return (
              <div
                key={p}
                className={cn(
                  "flex items-center justify-between rounded-sm px-1 py-0.5 transition-opacity",
                  dim && "opacity-30",
                )}
                style={{ backgroundColor: `hsl(${c} / 0.2)` }}
              >
                <span className="text-[8px] font-medium text-muted-foreground leading-none">
                  {PERIOD_LABELS[p]}
                </span>
                <span
                  className="font-bold font-display text-[11px] leading-none"
                  style={{ color: `hsl(${c})` }}
                >
                  {mode === "occupancy" ? `${v}%` : v}
                </span>
              </div>
            );
          })}
        </div>

        {/* 底部：每个时段独立显示 vs 竞对(C) / vs 商圈(M) 的差值，2 列 × 2 行 */}
        {mode === "occupancy" ? (
          <div className="mt-auto grid grid-cols-2 border-t border-border/40">
            {PERIODS.map((p) => {
              const myV = day.periodOccupancy[p];
              const compV = day.competitorPeriodOccupancy[p];
              const mktV = day.marketPeriodOccupancy[p];
              const cd = myV - compV;
              const md = myV - mktV;
              return (
                <div key={p} className="flex flex-col border-l border-border/40 first:border-l-0">
                  <button
                    type="button"
                    title="查看竞对活动"
                    className="flex items-center justify-center gap-0.5 px-0.5 py-px active:bg-chart-comp/10 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date); }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-chart-comp shrink-0" />
                    <span className={cn("text-[8px] font-medium leading-none tabular-nums", diffClass(cd))}>
                      {fmtDiff(cd)}
                    </span>
                  </button>
                  <div className="flex items-center justify-center gap-0.5 px-0.5 py-px border-t border-border/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-chart-market shrink-0" />
                    <span className={cn("text-[8px] font-medium leading-none tabular-nums", diffClass(md))}>
                      {fmtDiff(md)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          // 活动预订模式：本酒店是数量，竞对/商圈是总值；显示绝对值更直观
          <div className="mt-auto grid grid-cols-2 border-t border-border/40">
            {PERIODS.map((p) => {
              const cV = day.competitorPeriodBookings[p];
              const mV = day.marketPeriodBookings[p];
              return (
                <div key={p} className="flex flex-col border-l border-border/40 first:border-l-0">
                  <button
                    type="button"
                    title="查看竞对活动"
                    className="flex items-center justify-center gap-0.5 px-0.5 py-px active:bg-chart-comp/10 transition-colors"
                    onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date); }}
                  >
                    <span className="h-1.5 w-1.5 rounded-full bg-chart-comp shrink-0" />
                    <span className="text-[8px] font-medium leading-none tabular-nums">{cV}</span>
                  </button>
                  <div className="flex items-center justify-center gap-0.5 px-0.5 py-px border-t border-border/40">
                    <span className="h-1.5 w-1.5 rounded-full bg-chart-market shrink-0" />
                    <span className="text-[8px] font-medium leading-none tabular-nums">{mV}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // Desktop
  return (
    <div
      className="relative flex flex-col rounded-lg border bg-card transition-all cursor-pointer overflow-hidden min-h-[100px]"
      onClick={() => onClick(day.date)}
    >
      <div className="flex items-center justify-between px-1.5 pt-1 min-h-[16px]">
        <span className="text-[10px] font-medium text-muted-foreground">{dayNum}</span>
        {day.cityEventCount > 0 && (
          <button
            type="button"
            title={`${day.cityEventCount} 项城市活动`}
            className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-1 py-px text-red-600 hover:bg-red-100 transition-colors"
            onClick={(e) => { e.stopPropagation(); onCityEventClick?.(day.date); }}
          >
            <Flag className="h-2.5 w-2.5 fill-current" />
            {day.cityEventCount > 1 && <span className="text-[8px] font-bold leading-none">{day.cityEventCount}</span>}
          </button>
        )}
      </div>

      {/* M/A grid - hotel */}
      <div className="flex-1 grid grid-cols-2 gap-px px-0.5 pb-0.5">
        {PERIODS.map((p) => {
          const val = periodValues[p];
          const color = getThresholdColor(val, thresholds);
          const isHighlighted = highlightPeriod === "All" || highlightPeriod === p;

          return (
            <div
              key={p}
              className={cn("flex flex-col items-center justify-center rounded-sm transition-opacity", !isHighlighted && "opacity-30")}
              style={{ backgroundColor: `hsl(${color} / 0.18)` }}
            >
              <span className="text-[8px] font-medium text-muted-foreground">{PERIOD_LABELS[p]}</span>
              <span className="font-bold font-display leading-tight text-xs" style={{ color: `hsl(${color})` }}>
                {mode === "occupancy" ? `${val}%` : val}
              </span>
            </div>
          );
        })}
      </div>

      {/* Bottom: C/M 对齐到上方 M/A 两列 —— 整行可点击，不止是徽标 */}
      <div className="border-t px-0.5 py-0.5">
        {mode === "occupancy" ? (
          <div className="grid grid-cols-2 gap-px">
            {PERIODS.map((p) => {
              const myVal = day.periodOccupancy[p];
              const compVal = day.competitorPeriodOccupancy[p];
              const mktVal = day.marketPeriodOccupancy[p];
              return (
                <div key={p} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    title="查看竞对活动明细"
                    className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1 hover:bg-chart-comp/10 active:bg-chart-comp/20 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date); }}
                  >
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-comp/20 text-chart-comp text-[8px] font-bold leading-none">C</span>
                    <CompareValue myVal={myVal} otherVal={compVal} label={`${compVal}%`} prefix="" />
                  </button>
                  <div className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1">
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-market/20 text-chart-market text-[8px] font-bold leading-none">M</span>
                    <CompareValue myVal={myVal} otherVal={mktVal} label={`${mktVal}%`} prefix="" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-px">
            {PERIODS.map((p) => {
              const myVal = day.periodBookings[p];
              const compVal = day.competitorPeriodBookings[p];
              const mktVal = day.marketPeriodBookings[p];
              return (
                <div key={p} className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    title="查看竞对活动明细"
                    className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1 hover:bg-chart-comp/10 active:bg-chart-comp/20 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date); }}
                  >
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-comp/20 text-chart-comp text-[8px] font-bold leading-none">C</span>
                    <CompareValue myVal={myVal} otherVal={compVal} label={`${compVal}`} prefix="" />
                  </button>
                  <div className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1">
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-market/20 text-chart-market text-[8px] font-bold leading-none">M</span>
                    <CompareValue myVal={myVal} otherVal={mktVal} label={`${mktVal}`} prefix="" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
