import type { DayData, ThresholdBand, TimePeriod } from "@/api/types";
import { cn } from "@/lib/utils";
import { Flag, ArrowUp, ArrowDown } from "lucide-react";

interface DayCellProps {
  day: DayData;
  mode: "occupancy" | "bookings";
  onClick: (date: string) => void;
  onCityEventClick?: (date: string) => void;
  onCompetitorClick?: (date: string, period: "AM" | "PM") => void;
  compact?: boolean;
  thresholds: ThresholdBand[];
  highlightPeriod: TimePeriod;
}

const PERIODS: ("AM" | "PM")[] = ["AM", "PM"];
const PERIOD_LABELS = { AM: "M", PM: "A" };

// 「本酒店该天漏录」灰色 token (hsl, html-to-image 兼容; 不用 OKLCH)
const MUTED_HSL = "0 0% 60%";
const DASH = "—"; // em dash

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
  // 本酒店当天无 meeting_records — 整格灰显 + 虚线描边「该补录入」
  const noHotel = !day.hasHotelRecord;

  const periodValues = mode === "occupancy" ? day.periodOccupancy : day.periodBookings;

  if (compact) {
    const isWeekend = dateObj.getDay() === 0 || dateObj.getDay() === 6;

    // 顶部日期 + 旗(两种 mode 共用)
    const topRow = (
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
    );

    if (mode === "occupancy") {
      // === v6 双柱布局: M/A 双柱 + 柱顶本店 % + 2x2 vs C / vs M 方向矩阵 ===
      const amVal = day.periodOccupancy.AM;
      const pmVal = day.periodOccupancy.PM;
      const amColor = getThresholdColor(amVal, thresholds);
      const pmColor = getThresholdColor(pmVal, thresholds);

      const cmpDir = (my: number, other: number): "win" | "lose" | "tie" =>
        my > other ? "win" : my < other ? "lose" : "tie";

      const amVsC = cmpDir(amVal, day.competitorPeriodOccupancy.AM);
      const amVsM = cmpDir(amVal, day.marketPeriodOccupancy.AM);
      const pmVsC = cmpDir(pmVal, day.competitorPeriodOccupancy.PM);
      const pmVsM = cmpDir(pmVal, day.marketPeriodOccupancy.PM);

      const arrowChar = (d: "win" | "lose" | "tie") => d === "win" ? "▲" : d === "lose" ? "▼" : "─";
      const arrowColor = (d: "win" | "lose" | "tie") =>
        d === "win" ? "hsl(140, 65%, 32%)" :
        d === "lose" ? "hsl(0, 75%, 48%)" :
        "#9ca3af";

      const amDim = highlightPeriod !== "All" && highlightPeriod !== "AM";
      const pmDim = highlightPeriod !== "All" && highlightPeriod !== "PM";

      // 本酒店漏录时:柱高 1px 灰底 + 顶部 dash 数字 + 灰色标签;2x2 矩阵全显 ─
      const renderColumn = (
        val: number, color: string, lbl: string, dim: boolean,
      ) => (
        <div className={cn("flex-1 flex flex-col items-stretch min-w-0", dim && "opacity-30")}>
          <div
            className="text-[9px] font-extrabold leading-none text-center"
            style={{ color: noHotel ? `hsl(${MUTED_HSL})` : `hsl(${color})` }}
          >
            {noHotel ? DASH : `${val}%`}
          </div>
          <div className="flex-1 flex items-end pt-1">
            <div
              className={cn("w-full rounded-sm", noHotel && "border border-dashed")}
              style={noHotel ? {
                height: "4px",
                minHeight: "4px",
                backgroundColor: `hsl(${MUTED_HSL} / 0.15)`,
                borderColor: `hsl(${MUTED_HSL} / 0.4)`,
              } : {
                height: `${Math.max(val, 0)}%`,
                minHeight: "4px",
                backgroundColor: `hsl(${color} / 0.8)`,
              }}
            />
          </div>
          <div
            className="text-[7px] font-extrabold leading-none text-center pt-0.5"
            style={{ color: noHotel ? `hsl(${MUTED_HSL})` : undefined }}
          >
            <span className={noHotel ? "" : "text-muted-foreground"}>{lbl}</span>
          </div>
        </div>
      );

      return (
        <div
          className={cn(
            "relative flex flex-col rounded-md overflow-hidden border bg-card cursor-pointer",
            noHotel ? "border-dashed" : "border-border/50",
          )}
          style={{
            minHeight: "100px",
            borderColor: noHotel ? `hsl(${MUTED_HSL} / 0.5)` : undefined,
          }}
          onClick={() => onClick(day.date)}
        >
          {topRow}

          {/* 中部: M / A 双柱(数字 + 柱身 + 标签) */}
          <div className="flex-1 flex px-1.5 pb-0.5 gap-1 min-h-0">
            {renderColumn(amVal, amColor, "M", amDim)}
            {renderColumn(pmVal, pmColor, "A", pmDim)}
          </div>

          {/* 底部: 行标 C/M + 上午区/下午区 两个按钮 */}
          <div className="flex pb-1 px-1 gap-1 items-stretch">
            <div className="flex flex-col gap-0.5 justify-around py-0.5">
              <span className="text-[7px] font-bold leading-none text-muted-foreground">C</span>
              <span className="text-[7px] font-bold leading-none text-muted-foreground">M</span>
            </div>
            <button
              type="button"
              title={noHotel ? "本酒店未录入 · 查看竞对上午活动" : "上午对比明细"}
              className={cn(
                "flex-1 flex flex-col gap-0.5 py-0.5 rounded items-center justify-around transition-colors active:bg-accent/60",
                amDim && "opacity-30",
              )}
              onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date, "AM"); }}
            >
              {noHotel ? (
                <>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: arrowColor(amVsC) }}>{arrowChar(amVsC)}</span>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: arrowColor(amVsM) }}>{arrowChar(amVsM)}</span>
                </>
              )}
            </button>
            <button
              type="button"
              title={noHotel ? "本酒店未录入 · 查看竞对下午活动" : "下午对比明细"}
              className={cn(
                "flex-1 flex flex-col gap-0.5 py-0.5 rounded items-center justify-around transition-colors active:bg-accent/60",
                pmDim && "opacity-30",
              )}
              onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date, "PM"); }}
            >
              {noHotel ? (
                <>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: arrowColor(pmVsC) }}>{arrowChar(pmVsC)}</span>
                  <span className="text-[10px] font-extrabold leading-none" style={{ color: arrowColor(pmVsM) }}>{arrowChar(pmVsM)}</span>
                </>
              )}
            </button>
          </div>
        </div>
      );
    }

    // === bookings mode: 综合数字大字 + 上下午色点 ===
    const overallVal = day.newBookingCount;
    const overallColor = getThresholdColor(overallVal, thresholds);

    return (
      <div
        className={cn(
          "relative flex flex-col rounded-md cursor-pointer overflow-hidden border",
          noHotel ? "border-dashed" : "border-border/50",
        )}
        style={{
          backgroundColor: noHotel ? `hsl(${MUTED_HSL} / 0.08)` : `hsl(${overallColor} / 0.18)`,
          borderColor: noHotel ? `hsl(${MUTED_HSL} / 0.5)` : undefined,
          minHeight: "80px",
        }}
        onClick={() => onClick(day.date)}
      >
        {topRow}
        <div className="flex-1 flex items-center justify-center">
          <span
            className="text-xl font-bold font-display leading-none"
            style={{ color: noHotel ? `hsl(${MUTED_HSL})` : `hsl(${overallColor})` }}
          >
            {noHotel ? DASH : overallVal}
          </span>
        </div>
        <div className="flex justify-center items-center gap-2 pb-1">
          {PERIODS.map((p) => {
            const v = periodValues[p];
            const c = getThresholdColor(v, thresholds);
            const dim = highlightPeriod !== "All" && highlightPeriod !== p;
            return (
              <span
                key={p}
                className={cn("h-1.5 w-1.5 rounded-full transition-opacity", dim && "opacity-30")}
                style={{ backgroundColor: noHotel ? `hsl(${MUTED_HSL} / 0.4)` : `hsl(${c})` }}
              />
            );
          })}
        </div>
      </div>
    );
  }

  // Desktop
  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border bg-card transition-all cursor-pointer overflow-hidden min-h-[100px]",
        noHotel && "border-dashed",
      )}
      style={{ borderColor: noHotel ? `hsl(${MUTED_HSL} / 0.5)` : undefined }}
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
              className={cn(
                "flex flex-col items-center justify-center rounded-sm transition-opacity",
                !isHighlighted && "opacity-30",
              )}
              style={{
                backgroundColor: noHotel
                  ? `hsl(${MUTED_HSL} / 0.1)`
                  : `hsl(${color} / 0.18)`,
              }}
            >
              <span
                className="text-[8px] font-medium"
                style={{ color: noHotel ? `hsl(${MUTED_HSL})` : undefined }}
              >
                <span className={noHotel ? "" : "text-muted-foreground"}>{PERIOD_LABELS[p]}</span>
              </span>
              <span
                className="font-bold font-display leading-tight text-xs"
                style={{ color: noHotel ? `hsl(${MUTED_HSL})` : `hsl(${color})` }}
              >
                {noHotel ? DASH : (mode === "occupancy" ? `${val}%` : val)}
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
                    title={noHotel ? "本酒店未录入 · 查看竞对活动" : "查看竞对活动明细"}
                    className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1 hover:bg-chart-comp/10 active:bg-chart-comp/20 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date, p); }}
                  >
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-comp/20 text-chart-comp text-[8px] font-bold leading-none">C</span>
                    {noHotel ? (
                      <span className="text-[8px] font-medium" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                    ) : (
                      <CompareValue myVal={myVal} otherVal={compVal} label={`${compVal}%`} prefix="" />
                    )}
                  </button>
                  <div className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1">
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-market/20 text-chart-market text-[8px] font-bold leading-none">M</span>
                    {noHotel ? (
                      <span className="text-[8px] font-medium" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                    ) : (
                      <CompareValue myVal={myVal} otherVal={mktVal} label={`${mktVal}%`} prefix="" />
                    )}
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
                    title={noHotel ? "本酒店未录入 · 查看竞对活动" : "查看竞对活动明细"}
                    className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1 hover:bg-chart-comp/10 active:bg-chart-comp/20 transition-colors cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); onCompetitorClick?.(day.date, p); }}
                  >
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-comp/20 text-chart-comp text-[8px] font-bold leading-none">C</span>
                    {noHotel ? (
                      <span className="text-[8px] font-medium" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                    ) : (
                      <CompareValue myVal={myVal} otherVal={compVal} label={`${compVal}`} prefix="" />
                    )}
                  </button>
                  <div className="w-full flex items-center justify-center gap-0.5 rounded px-0.5 py-1">
                    <span className="inline-flex items-center justify-center h-3.5 w-3.5 rounded-full bg-chart-market/20 text-chart-market text-[8px] font-bold leading-none">M</span>
                    {noHotel ? (
                      <span className="text-[8px] font-medium" style={{ color: `hsl(${MUTED_HSL})` }}>{DASH}</span>
                    ) : (
                      <CompareValue myVal={myVal} otherVal={mktVal} label={`${mktVal}`} prefix="" />
                    )}
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
