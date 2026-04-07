import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { fetchDayDetail } from "@/api/dashboardApi";
import type { CityEvent } from "@/api/types";
import { MapPin } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CityEventDrawerProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
}

function EventContent({ events, loading }: { events: CityEvent[]; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (events.length === 0) return <div className="py-8 text-center text-muted-foreground text-sm">暂无城市活动</div>;

  return (
    <div className="space-y-2">
      {events.map((e, i) => (
        <div key={i} className="rounded-lg border bg-card p-3">
          <p className="text-sm font-medium">{e.venue}：{e.name}</p>
          <Badge variant="outline" className="mt-1 text-[10px] h-5">{e.type}</Badge>
        </div>
      ))}
    </div>
  );
}

export function CityEventDrawer({ date, open, onClose }: CityEventDrawerProps) {
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchDayDetail(date).then((d) => {
      setEvents(d.cityEvents);
      setLoading(false);
    });
  }, [date]);

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
    : "";

  const titleContent = (
    <span className="flex items-center gap-2 font-display">
      <MapPin className="h-5 w-5 text-primary" />
      {formattedDate} · 城市活动
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
            <EventContent events={events} loading={loading} />
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
          <EventContent events={events} loading={loading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
