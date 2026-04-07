import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { fetchDayDetail } from "@/api/dashboardApi";
import type { VenueBooking } from "@/api/types";
import { Hotel, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface VenueBookingDrawerProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
}

const PERIOD_LABEL: Record<string, string> = { AM: "上午", PM: "下午", EV: "晚上" };

function BookingContent({ bookings, loading }: { bookings: VenueBooking[]; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (bookings.length === 0) return <div className="py-8 text-center text-muted-foreground text-sm">暂无预订记录</div>;

  return (
    <div className="space-y-2">
      {bookings.map((b, i) => (
        <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-3">
          <div className="flex items-center gap-2">
            <Hotel className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">{b.venueName}</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-[10px] h-5 gap-1">
              <Clock className="h-3 w-3" />
              {PERIOD_LABEL[b.period] ?? b.period}
            </Badge>
            <Badge variant="secondary" className="text-[10px] h-5">{b.activityType}</Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

export function VenueBookingDrawer({ date, open, onClose }: VenueBookingDrawerProps) {
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    fetchDayDetail(date).then((d) => {
      setBookings(d.venueBookings);
      setLoading(false);
    });
  }, [date]);

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
    : "";

  const titleContent = (
    <span className="flex items-center gap-2 font-display">
      <Hotel className="h-5 w-5 text-primary" />
      {formattedDate} · 本酒店场地预订
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
            <BookingContent bookings={bookings} loading={loading} />
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
          <BookingContent bookings={bookings} loading={loading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
