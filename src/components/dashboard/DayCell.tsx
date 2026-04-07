import type { DayData } from "@/api/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DayCellProps {
  day: DayData;
  mode: "occupancy" | "bookings";
  onClick: (date: string) => void;
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

export function DayCell({ day, mode, onClick }: DayCellProps) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayNum = dateObj.getDate();
  const value = mode === "occupancy" ? day.occupancyRate : day.newBookingCount;

  return (
    <button
      onClick={() => onClick(day.date)}
      className={cn(
        "relative flex flex-col items-center justify-center rounded-lg border p-2 transition-all cursor-pointer min-h-[72px]",
        mode === "occupancy" ? getOccupancyColor(day.occupancyRate) : "bg-card border-border hover:border-primary/50"
      )}
    >
      <span className="text-[11px] font-medium text-muted-foreground">{dayNum}</span>
      <span className={cn(
        "text-lg font-bold font-display",
        mode === "occupancy" ? getOccupancyTextColor(day.occupancyRate) : "text-foreground"
      )}>
        {mode === "occupancy" ? `${value}%` : value}
      </span>
      {day.cityEventCount > 0 && (
        <Badge variant="secondary" className="absolute -top-1.5 -right-1.5 h-5 min-w-5 px-1 text-[10px] font-semibold">
          {day.cityEventCount}
        </Badge>
      )}
    </button>
  );
}
