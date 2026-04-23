import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { fetchCityEvents, fetchCompetitorDetail, fetchVenueBookings } from "@/api/dashboardApi";
import type { CityEvent, CompetitorDetail, VenueBooking } from "@/api/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CalendarDays, Building2, MapPin, Hotel, Clock, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface DayDrawerProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
  hotelId: number;
  city: string;
}

const PERIOD_LABEL: Record<string, string> = { AM: "上午", PM: "下午", EV: "晚上" };

function DetailContent({
  bookings,
  cityEvents,
  competitors,
  loading,
}: {
  bookings: VenueBooking[];
  cityEvents: CityEvent[];
  competitors: CompetitorDetail[];
  loading: boolean;
}) {
  if (loading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
          <Hotel className="h-4 w-4 text-primary" />
          本酒店场地预订
        </h3>
        {bookings.length === 0 ? (
          <p className="text-sm text-muted-foreground">当日无预订记录</p>
        ) : (
          <div className="space-y-2">
            {bookings.map((b, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border bg-card p-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{b.venueName}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px] h-5 gap-1">
                    <Clock className="h-3 w-3" />
                    {PERIOD_LABEL[b.period] ?? b.period}
                  </Badge>
                  {b.isBooked ? (
                    <Badge variant="default" className="text-[10px] h-5">
                      {b.activityType || "已预订"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] h-5">空闲</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {cityEvents.length > 0 && (
        <>
          <Separator />
          <section>
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <MapPin className="h-4 w-4 text-primary" />
              城市活动
            </h3>
            <div className="space-y-2">
              {cityEvents.map((e, i) => (
                <div key={i} className="rounded-lg border bg-card p-3">
                  <p className="font-medium text-sm">{e.venue}：{e.name}</p>
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
            <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-3">
              <Building2 className="h-4 w-4 text-primary" />
              竞对酒店活动
            </h3>
            <div className="space-y-2">
              {competitors.map((c, i) => (
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
                    <div className="ml-3 border-l-2 border-border pl-3 py-1 space-y-1.5">
                      {(c.activities ?? []).map((act, j) => (
                        <div key={j} className="flex items-start gap-1.5 text-xs py-0.5">
                          <span className="text-border mt-0.5">{j === c.activities.length - 1 ? "└" : "├"}──</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-foreground font-medium truncate">
                              {act.eventName || act.eventType || "（无活动名称）"}
                            </div>
                            <div className="text-muted-foreground mt-0.5 flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                              <span>{act.date}</span>
                              {act.venueName && <><span>·</span><span>{act.venueName}</span></>}
                              {act.period && <><span>·</span><span>{act.period}</span></>}
                              {act.bookingStatus && (
                                <Badge variant="outline" className="h-4 text-[10px] px-1">{act.bookingStatus}</Badge>
                              )}
                            </div>
                          </div>
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
    </div>
  );
}

export function DayDrawer({ date, open, onClose, hotelId, city }: DayDrawerProps) {
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [cityEvents, setCityEvents] = useState<CityEvent[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!date || !hotelId) return;
    setLoading(true);
    Promise.all([
      fetchVenueBookings(date, hotelId),
      fetchCityEvents(date, city),
      fetchCompetitorDetail(date, hotelId),
    ]).then(([b, events, comps]) => {
      setBookings(b);
      setCityEvents(events);
      setCompetitors(comps);
      setLoading(false);
    });
  }, [date, hotelId, city]);

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
            <DetailContent bookings={bookings} cityEvents={cityEvents} competitors={competitors} loading={loading} />
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
          <DetailContent bookings={bookings} cityEvents={cityEvents} competitors={competitors} loading={loading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
