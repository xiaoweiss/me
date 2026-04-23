import { useEffect, useState } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchCityEvents, fetchCompetitorDetail } from "@/api/dashboardApi";
import { getThresholdColor } from "./DayCell";
import type { DayData, CityEvent, CompetitorDetail, ThresholdBand } from "@/api/types";
import { CalendarDays, MapPin, Building2 } from "lucide-react";

interface MobileDayDrawerProps {
  day: DayData | null;
  open: boolean;
  onClose: () => void;
  mode: "occupancy" | "bookings";
  thresholds: ThresholdBand[];
  hotelId: number;
  city: string;
}

const PERIODS: { key: "AM" | "PM"; label: string }[] = [
  { key: "AM", label: "上午" },
  { key: "PM", label: "下午" },
];

export function MobileDayDrawer({ day, open, onClose, mode, thresholds, hotelId, city }: MobileDayDrawerProps) {
  const [cityEvents, setCityEvents] = useState<CityEvent[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorDetail[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!day) return;
    setLoading(true);
    Promise.all([
      fetchCityEvents(day.date, city),
      hotelId ? fetchCompetitorDetail(day.date, hotelId) : Promise.resolve([]),
    ]).then(([events, comps]) => {
      setCityEvents(events);
      setCompetitors(comps);
      setLoading(false);
    });
  }, [day?.date, hotelId, city]);

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

          {cityEvents.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  城市活动
                </h3>
                <div className="space-y-1.5">
                  {cityEvents.map((e, i) => (
                    <div key={i} className="rounded-lg border bg-card p-2.5">
                      <p className="text-sm font-medium">{e.venue}：{e.name}</p>
                      <Badge variant="outline" className="mt-1 text-[10px] h-5">{e.type}</Badge>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}

          {competitors.length > 0 && (
            <>
              <Separator />
              <section>
                <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2">
                  <Building2 className="h-4 w-4 text-primary" />
                  竞对酒店群明细
                </h3>
                <div className="space-y-1.5">
                  {competitors.map((c, i) => (
                    <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-2.5">
                      <div className="text-left">
                        <p className="font-medium text-sm">{c.hotelName}</p>
                        <p className="text-xs text-muted-foreground">{c.activityType}</p>
                      </div>
                      <Badge className="font-display">×{c.count}</Badge>
                    </div>
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
