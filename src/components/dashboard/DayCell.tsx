import type { DayData, ThresholdBand, TimePeriod } from "@/api/types";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface DayCellProps {
  day: DayData;
  mode: "occupancy" | "bookings";
  onClick: (date: string) => void;
  onMyHotelClick?: (date: string) => void;
  onCityEventClick?: (date: string) => void;
  onCompetitorClick?: (date: string) => void;
  compact?: boolean;
  thresholds: ThresholdBand[];
  highlightPeriod: TimePeriod;
}

const PERIODS: ("AM" | "PM" | "EV")[] = ["AM", "PM", "EV"];
const PERIOD_LABELS = { AM: "M", PM: "A", EV: "E" };

function getThresholdColor(value: number, thresholds: ThresholdBand[]): string {
  for (const t of thresholds) {
    if (value >= t.min && value < t.max) return t.color;
  }
  // fallback to last band for max boundary
  const last = thresholds[thresholds.length - 1];
  if (last && value >= last.min) return last.color;
  return thresholds[0]?.color ?? "0 0% 50%";
}

export function DayCell({ day, mode, onClick, onMyHotelClick, onCityEventClick, onCompetitorClick, compact = false, thresholds, highlightPeriod }: DayCellProps) {
  const dateObj = new Date(day.date + "T00:00:00");
  const dayNum = dateObj.getDate();

  const periodValues = mode === "occupancy" ? day.periodOccupancy : day.periodBookings;

  return (
    <div
      className={cn(
        "relative flex flex-col rounded-lg border bg-card transition-all cursor-pointer overflow-hidden",
        compact ? "min-h-[60px]" : "min-h-[100px]"
      )}
      onClick={() => onClick(day.date)}
    >
      {/* Day number + event badge */}
      <div className="flex items-center justify-between px-1.5 pt-1">
        <span className={cn("font-medium text-muted-foreground", compact ? "text-[9px]" : "text-[10px]")}>{dayNum}</span>
        {day.cityEventCount > 0 && (
          <Badge
            variant="secondary"
            className={cn(
              "font-semibold cursor-pointer hover:bg-secondary/80",
              compact ? "h-3.5 min-w-3.5 px-0.5 text-[7px]" : "h-4 min-w-4 px-0.5 text-[9px]"
            )}
            onClick={(e) => {
              e.stopPropagation();
              onCityEventClick?.(day.date);
            }}
          >
            {day.cityEventCount}
          </Badge>
        )}
      </div>

      {/* Three-column M/A/E grid */}
      <div className="flex-1 grid grid-cols-3 gap-px px-0.5 pb-0.5">
        {PERIODS.map((p) => {
          const val = periodValues[p];
          const color = getThresholdColor(val, thresholds);
          const isHighlighted = highlightPeriod === "All" || highlightPeriod === p;

          return (
            <div
              key={p}
              className={cn(
                "flex flex-col items-center justify-center rounded-sm transition-opacity",
                !isHighlighted && "opacity-30"
              )}
              style={{ backgroundColor: `hsl(${color} / 0.18)` }}
            >
              <span className={cn("font-medium text-muted-foreground", compact ? "text-[7px]" : "text-[8px]")}>
                {PERIOD_LABELS[p]}
              </span>
              <span
                className={cn("font-bold font-display leading-tight", compact ? "text-[10px]" : "text-xs")}
                style={{ color: `hsl(${color})` }}
              >
                {mode === "occupancy" ? `${val}%` : val}
              </span>
            </div>
          );
        })}
      </div>

      {/* My Hotel clickable row + Comp/Market — desktop only */}
      {!compact && (
        <div className="border-t px-1.5 py-0.5 space-y-px">
          <button
            type="button"
            className="w-full text-left hover:bg-accent/50 rounded-sm px-0.5 -mx-0.5 transition-colors"
            onClick={(e) => {
              e.stopPropagation();
              onMyHotelClick?.(day.date);
            }}
          >
            <span className="text-[9px] font-semibold text-foreground">
              My: {mode === "occupancy" ? `${day.myHotelRate}%` : day.newBookingCount}
            </span>
          </button>
          <div className="flex items-center gap-1">
            <button
              type="button"
              className="text-[8px] text-chart-comp font-medium hover:underline cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onCompetitorClick?.(day.date);
              }}
            >
              C:{mode === "occupancy" ? `${day.competitorAvgRate}%` : day.competitorSumBookings}
            </button>
            <span className="text-[8px] text-muted-foreground">|</span>
            <span className="text-[8px] text-chart-market font-medium">
              M:{mode === "occupancy" ? `${day.marketAvgRate}%` : day.marketSumBookings}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
