import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchDayDetail } from "@/api/dashboardApi";
import { getThresholdColor } from "./DayCell";
import type { DayData, DayDetail, ThresholdBand } from "@/api/types";
import { CalendarDays, MapPin, Building2, ChevronDown } from "lucide-react";

interface MobileDayDrawerProps {
  day: DayData | null;
  open: boolean;
  onClose: () => void;
  mode: "occupancy" | "bookings";
  thresholds: ThresholdBand[];
}

const PERIODS: { key: "AM" | "PM" | "EV"; label: string }[] = [
  { key: "AM", label: "上午 Morning" },
  { key: "PM", label: "下午 Afternoon" },
  { key: "EV", label: "晚上 Evening" },
];

export function MobileDayDrawer({ day, open, onClose, mode, thresholds }: MobileDayDrawerProps) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!day) return;
    setLoading(true);
    fetchDayDetail(day.date).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [day?.date]);

  if (!day) return null;

  const dateObj = new Date(day.date + "T00:00:00");
  const formattedDate = dateObj.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  });

  const periodOcc = day.periodOccupancy;
  const periodBook = day.periodBookings;

  return (
    <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
      <DrawerContent className="max-h-[90vh]">
        <DrawerHeader className="pb-2">
          <DrawerTitle>
            <span className="flex items-center gap-2 font-display">
              <CalendarDays className="h-5 w-5 text-primary" />
              {formattedDate}
            </span>
          </DrawerTitle>
        </DrawerHeader>

        <div className="overflow-y-auto px-4 pb-6 space-y-4">
          {/* M / A / E breakdown */}
          <section className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">时段明细</h3>
            <div className="space-y-1.5">
              {PERIODS.map(({ key, label }) => {
                const myVal = mode === "occupancy" ? periodOcc[key] : periodBook[key];
                const color = getThresholdColor(myVal, thresholds);
                const compVal = mode === "occupancy" ? day.competitorAvgRate : day.competitorSumBookings;
                const mktVal = mode === "occupancy" ? day.marketAvgRate : day.marketSumBookings;
                const suffix = mode === "occupancy" ? "%" : "";

                return (
                  <div
                    key={key}
                    className="flex items-center justify-between rounded-lg p-2.5"
                    style={{ backgroundColor: `hsl(${color} / 0.12)` }}
                  >
                    <span className="text-xs font-medium text-muted-foreground w-24 shrink-0">{label}</span>
                    <div className="flex items-center gap-3">
                      <span className="font-bold font-display text-sm" style={{ color: `hsl(${color})` }}>
                        {myVal}{suffix}
                      </span>
                      <span className="text-[10px] text-chart-comp font-medium">C:{compVal}{suffix}</span>
                      <span className="text-[10px] text-chart-market font-medium">M:{mktVal}{suffix}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          {/* City Events */}
          {detail && detail.cityEvents.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  城市活动
                </h3>
                <div className="space-y-1.5">
                  {detail.cityEvents.map((e, i) => (
                    <div key={i} className="rounded-lg border bg-card p-2.5">
                      <p className="text-sm font-medium">{e.venue}：{e.name}</p>
                      <Badge variant="outline" className="mt-1 text-[10px] h-5">{e.type}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {/* Competitor details */}
          {detail && detail.competitors.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  竞对酒店群明细
                </h3>
                <div className="space-y-1.5">
                  {detail.competitors.map((c, i) => (
                    <Collapsible key={i}>
                      <CollapsibleTrigger className="w-full">
                        <div className="flex items-center justify-between rounded-lg border bg-card p-2.5 hover:bg-accent/50 transition-colors group">
                          <div className="text-left">
                            <p className="font-medium text-sm">{c.hotelName}</p>
                            <p className="text-xs text-muted-foreground">{c.activityType}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className="font-display">×{c.count}</Badge>
                            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
                          </div>
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="ml-3 border-l-2 border-border pl-3 py-1 space-y-1">
                          {c.activities.map((act, j) => (
                            <div key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground py-0.5">
                              <span className="text-border mt-0.5">{j === c.activities.length - 1 ? "└" : "├"}──</span>
                              <span className="text-foreground font-medium">{act.name}</span>
                              <span>·</span>
                              <span>{act.venue}</span>
                            </div>
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              </section>
            </>
          )}

          {loading && (
            <div className="flex items-center justify-center py-6 text-muted-foreground text-sm">Loading…</div>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
