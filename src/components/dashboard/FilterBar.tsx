import { useState } from "react";
import type { VenueType, TimePeriod } from "@/api/types";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, X } from "lucide-react";

interface FilterBarProps {
  venueType: VenueType;
  timePeriod: TimePeriod;
  onVenueTypeChange: (v: VenueType) => void;
  onTimePeriodChange: (v: TimePeriod) => void;
}

const venueOptions: { value: VenueType; label: string }[] = [
  { value: "All", label: "全部" },
  { value: "Ballroom", label: "宴会厅" },
  { value: "Conference Room", label: "会议室" },
];
const timeOptions: { value: TimePeriod; label: string }[] = [
  { value: "All", label: "全部" },
  { value: "AM", label: "上午" },
  { value: "PM", label: "下午" },
];

export function FilterBar({ venueType, timePeriod, onVenueTypeChange, onTimePeriodChange }: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:flex flex-wrap items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">场地类型</span>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {venueOptions.map((v) => (
              <Button
                key={v.value}
                size="sm"
                variant={venueType === v.value ? "default" : "ghost"}
                className={cn("h-7 px-3 text-xs", venueType !== v.value && "text-muted-foreground")}
                onClick={() => onVenueTypeChange(v.value)}
              >
                {v.label}
              </Button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">时段</span>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {timeOptions.map((t) => (
              <Button
                key={t.value}
                size="sm"
                variant={timePeriod === t.value ? "default" : "ghost"}
                className={cn("h-7 px-3 text-xs", timePeriod !== t.value && "text-muted-foreground")}
                onClick={() => onTimePeriodChange(t.value)}
              >
                {t.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Mobile: collapsible with horizontal scroll chips */}
      <div className="sm:hidden">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          {mobileOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          筛选
          {(venueType !== "All" || timePeriod !== "All") && (
            <span className="ml-1 h-2 w-2 rounded-full bg-primary" />
          )}
        </Button>
        {mobileOpen && (
          <div className="mt-3 rounded-lg border bg-card p-3 space-y-3">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">场地类型</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {venueOptions.map((v) => (
                  <Button
                    key={v.value}
                    size="sm"
                    variant={venueType === v.value ? "default" : "outline"}
                    className={cn(
                      "h-7 px-3 text-xs shrink-0 rounded-full",
                      venueType !== v.value && "text-muted-foreground"
                    )}
                    onClick={() => onVenueTypeChange(v.value)}
                  >
                    {v.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">时段</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {timeOptions.map((t) => (
                  <Button
                    key={t.value}
                    size="sm"
                    variant={timePeriod === t.value ? "default" : "outline"}
                    className={cn(
                      "h-7 px-3 text-xs shrink-0 rounded-full",
                      timePeriod !== t.value && "text-muted-foreground"
                    )}
                    onClick={() => onTimePeriodChange(t.value)}
                  >
                    {t.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
