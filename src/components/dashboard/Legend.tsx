import type { DayData, ThresholdBand } from "@/api/types";

interface LegendProps {
  days: DayData[];
  thresholds: ThresholdBand[];
  mode: "occupancy" | "bookings";
}

export function Legend({ days, thresholds, mode }: LegendProps) {
  if (days.length === 0) return null;

  const myAvg = Math.round(days.reduce((s, d) => s + d.myHotelRate, 0) / days.length);

  const compLabel = mode === "occupancy" ? "Comp Avg" : "Comp Total";
  const marketLabel = mode === "occupancy" ? "Market Avg" : "Market Total";

  const compValue = mode === "occupancy"
    ? Math.round(days.reduce((s, d) => s + d.competitorAvgRate, 0) / days.length)
    : days.reduce((s, d) => s + d.competitorSumBookings, 0);

  const marketValue = mode === "occupancy"
    ? Math.round(days.reduce((s, d) => s + d.marketAvgRate, 0) / days.length)
    : days.reduce((s, d) => s + d.marketSumBookings, 0);

  const suffix = mode === "occupancy" ? "%" : "";

  const items = [
    { label: "My Hotel", value: myAvg, colorClass: "bg-chart-mine" },
    { label: compLabel, value: compValue, colorClass: "bg-chart-comp" },
    { label: marketLabel, value: marketValue, colorClass: "bg-chart-market" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${item.colorClass}`} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-xs font-semibold text-foreground">{item.value}{suffix}</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-3">
        {thresholds.map((t) => (
          <div key={t.label} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: `hsl(${t.color} / 0.4)` }}
            />
            <span className="text-[10px] text-muted-foreground">{t.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
