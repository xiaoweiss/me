import type { DayData } from "@/api/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DayCellProps {
  day: DayData;
  mode: "occupancy" | "bookings";
  onClick: (date: string) => void;
  compact?: boolean;
}

function getOccupancyColor(rate: number) {
  if (rate >= 80) return "bg-occ-high/15 border-occ-high/40 hover:border-occ-high";
  if (rate >= 60) return "bg-occ-mid/15 border-occ-mid/40 hover:border-occ-mid";
  return "bg-occ-low/15 border-occ-low/40 hover:border-occ-low";
}

function getOccupancyTextColor(rate: number) {
  if (rate >= 80) return "text-occ-high";
  if (rate >= 60) return "text-occ-mid";
  return "text-occ-low";
}

export function DayCell({ day, mode, onClick, compact = false }: DayCellProps) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayNum = dateObj.getDate();
  const value = mode === "occupancy" ? day.occupancyRate : day.newBookingCount;

  return (
    <button
      onClick={() => onClick(day.date)}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border transition-all cursor-pointer",
        compact ? "p-1.5 min-h-[52px]" : "p-2 min-h-[88px]",
        mode === "occupancy" ? getOccupancyColor(day.occupancyRate) : "bg-card border-border hover:border-primary/50"
      )}
    >
      <span className={cn("font-medium text-muted-foreground", compact ? "text-[10px]" : "text-[11px]")}>{dayNum}</span>
      <span className={cn(
        "font-bold font-display leading-tight",
        compact ? "text-sm" : "text-lg",
        mode === "occupancy" ? getOccupancyTextColor(day.occupancyRate) : "text-foreground"
      )}>
        {mode === "occupancy" ? `${value}%` : value}
      </span>

      {/* Comp & Market lines — desktop only, occupancy mode */}
      {!compact && mode === "occupancy" && (
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] text-chart-comp font-medium">C:{day.competitorAvgRate}%</span>
          <span className="text-[9px] text-muted-foreground">|</span>
          <span className="text-[9px] text-chart-market font-medium">M:{day.marketAvgRate}%</span>
        </div>
      )}

      {day.cityEventCount > 0 && (
        <Badge variant="secondary" className={cn(
          "absolute font-semibold",
          compact ? "-top-1 -right-1 h-4 min-w-4 px-0.5 text-[8px]" : "-top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px]"
        )}>
          {day.cityEventCount}
        </Badge>
      )}
    </button>
  );
}
