import type { VenueType, TimePeriod } from "@/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FilterBarProps {
  venueType: VenueType;
  timePeriod: TimePeriod;
  onVenueTypeChange: (v: VenueType) => void;
  onTimePeriodChange: (v: TimePeriod) => void;
}

const venueOptions: VenueType[] = ["All", "Ballroom", "Conference Room"];
const timeOptions: TimePeriod[] = ["All", "AM", "PM", "EV"];

export function FilterBar({ venueType, timePeriod, onVenueTypeChange, onTimePeriodChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Venue</span>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {venueOptions.map((v) => (
            <Button
              key={v}
              size="sm"
              variant={venueType === v ? "default" : "ghost"}
              className={cn("h-7 px-3 text-xs", venueType !== v && "text-muted-foreground")}
              onClick={() => onVenueTypeChange(v)}
            >
              {v}
            </Button>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-muted-foreground">Period</span>
        <div className="flex gap-1 rounded-lg bg-muted p-1">
          {timeOptions.map((t) => (
            <Button
              key={t}
              size="sm"
              variant={timePeriod === t ? "default" : "ghost"}
              className={cn("h-7 px-3 text-xs", timePeriod !== t && "text-muted-foreground")}
              onClick={() => onTimePeriodChange(t)}
            >
              {t}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}
