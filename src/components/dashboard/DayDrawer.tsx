import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchDayDetail } from "@/api/dashboardApi";
import type { DayDetail } from "@/api/types";
import { CalendarDays, Building2, MapPin } from "lucide-react";

interface DayDrawerProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
}

export function DayDrawer({ date, open, onClose }: DayDrawerProps) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchDayDetail(date).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [date]);

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 font-display">
            <CalendarDays className="h-5 w-5 text-primary" />
            {formattedDate}
          </SheetTitle>
        </SheetHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>
        ) : detail ? (
          <div className="mt-6 space-y-6">
            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <MapPin className="h-4 w-4 text-primary" />
                City Events
              </h3>
              <div className="space-y-2">
                {detail.cityEvents.map((e, i) => (
                  <div key={i} className="rounded-lg border bg-card p-3">
                    <p className="font-medium text-sm">{e.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs text-muted-foreground">{e.venue}</span>
                      <Badge variant="outline" className="text-[10px] h-5">{e.type}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <Separator />

            <section>
              <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
                <Building2 className="h-4 w-4 text-primary" />
                Competitor Hotels
              </h3>
              <div className="space-y-2">
                {detail.competitors.map((c, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-3">
                    <div>
                      <p className="font-medium text-sm">{c.hotelName}</p>
                      <p className="text-xs text-muted-foreground">{c.activityType}</p>
                    </div>
                    <Badge className="font-display">{c.count}</Badge>
                  </div>
                ))}
              </div>
            </section>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
