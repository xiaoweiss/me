import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchDayDetail } from "@/api/dashboardApi";
import type { DayDetail } from "@/api/types";
import { CalendarDays, Building2, MapPin, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface DayDrawerProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
}

function DetailContent({ detail, loading }: { detail: DayDetail | null; loading: boolean }) {
  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  }
  if (!detail) return null;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <MapPin className="h-4 w-4 text-primary" />
          城市活动 City Events
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
          竞对酒店活动明细
        </h3>
        <div className="space-y-2">
          {detail.competitors.map((c, i) => (
            <Collapsible key={i}>
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group">
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
                    <div key={j} className="flex items-start gap-1.5 text-xs text-muted-foreground py-1">
                      <span className="text-border mt-0.5">{j === c.activities.length - 1 ? "└" : "├"}──</span>
                      <span className="text-foreground font-medium">{act.name}</span>
                      <span>·</span>
                      <span>{act.date}</span>
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
    </div>
  );
}

export function DayDrawer({ date, open, onClose }: DayDrawerProps) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchDayDetail(date).then((d) => {
      setDetail(d);
      setLoading(false);
    });
  }, [date]);

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric", year: "numeric" })
    : "";

  const titleContent = (
    <span className="flex items-center gap-2 font-display">
      <CalendarDays className="h-5 w-5 text-primary" />
      {formattedDate}
    </span>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{titleContent}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <DetailContent detail={detail} loading={loading} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titleContent}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <DetailContent detail={detail} loading={loading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
