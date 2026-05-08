import type { DayData, ThresholdBand, MonthSummary } from "@/api/types";

interface LegendProps {
  days: DayData[];
  thresholds: ThresholdBand[];
  mode: "occupancy" | "bookings";
  summary?: MonthSummary;
}

export function Legend({ days, thresholds, mode, summary }: LegendProps) {
  if (days.length === 0) return null;

  // 出租率：用后端返回的 summary（按 venue 加权 ∑booked/∑total，仅统计已录入日期）
  // 活动预订：仍按天累加（数量类指标）
  const myAvg = mode === "occupancy"
    ? Math.round(summary?.hotelRate ?? 0)
    : Math.round(days.reduce((s, d) => s + d.newBookingCount, 0));

  const compLabel = mode === "occupancy" ? "竞对均值" : "竞对总值";
  const marketLabel = mode === "occupancy" ? "商圈均值" : "商圈总值";

  const compValue = mode === "occupancy"
    ? Math.round(summary?.competitorRate ?? 0)
    : days.reduce((s, d) => s + d.competitorSumBookings, 0);

  const marketValue = mode === "occupancy"
    ? Math.round(summary?.marketRate ?? 0)
    : days.reduce((s, d) => s + d.marketSumBookings, 0);

  const suffix = mode === "occupancy" ? "%" : "";

  const items = [
    { label: "本酒店", value: myAvg, colorClass: "bg-chart-mine" },
    { label: compLabel, value: compValue, colorClass: "bg-chart-comp" },
    { label: marketLabel, value: marketValue, colorClass: "bg-chart-market" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-1 sm:gap-2">
          <span className={`h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-full ${item.colorClass}`} />
          <span className="text-[11px] sm:text-xs text-muted-foreground">{item.label}</span>
          <span className="text-[11px] sm:text-xs font-semibold text-foreground">{item.value}{suffix}</span>
        </div>
      ))}
      <div className="flex items-center gap-2 sm:gap-3 sm:ml-auto">
        {thresholds.map((t) => (
          <div key={t.label} className="flex items-center gap-1">
            <span
              className="h-2 w-2 sm:h-2.5 sm:w-2.5 rounded-sm"
              style={{ backgroundColor: `hsl(${t.color} / 0.4)` }}
            />
            <span className="text-[10px] text-muted-foreground">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
