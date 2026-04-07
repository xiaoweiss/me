import type { DayData } from "@/api/types";

interface LegendProps {
  days: DayData[];
}

export function Legend({ days }: LegendProps) {
  if (days.length === 0) return null;

  const myAvg = Math.round(days.reduce((s, d) => s + d.myHotelRate, 0) / days.length);
  const compAvg = Math.round(days.reduce((s, d) => s + d.competitorAvgRate, 0) / days.length);
  const marketAvg = Math.round(days.reduce((s, d) => s + d.marketAvgRate, 0) / days.length);

  const items = [
    { label: "My Hotel", value: myAvg, color: "bg-chart-mine" },
    { label: "Competitor Avg", value: compAvg, color: "bg-chart-comp" },
    { label: "Market Avg", value: marketAvg, color: "bg-chart-market" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${item.color}`} />
          <span className="text-xs text-muted-foreground">{item.label}</span>
          <span className="text-xs font-semibold text-foreground">{item.value}%</span>
        </div>
      ))}
      <div className="ml-auto flex items-center gap-3">
        <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-occ-low/40" /><span className="text-[10px] text-muted-foreground">&lt;60%</span></div>
        <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-occ-mid/40" /><span className="text-[10px] text-muted-foreground">60-80%</span></div>
        <div className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-occ-high/40" /><span className="text-[10px] text-muted-foreground">&gt;80%</span></div>
      </div>
    </div>
  );
}
