import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { getThresholdColor } from "./DayCell";
import {
  fetchCityEvents,
  fetchCompetitorDetail,
  fetchVenueBookings,
} from "@/api/dashboardApi";
import type {
  CityEvent,
  CompetitorDetail,
  DayData,
  ThresholdBand,
  VenueBooking,
} from "@/api/types";
import { CalendarDays, Building2, Flag, Hotel, Clock } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface DayDetailDrawerProps {
  date: string | null;
  day: DayData | null;
  open: boolean;
  onClose: () => void;
  thresholds: ThresholdBand[];
  mode: "occupancy" | "bookings";
  hotelId: number;
  city: string;
}

const WEEKDAY_CN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const PERIOD_LABEL: Record<string, string> = { AM: "上午", PM: "下午", EV: "晚上" };

function formatDateTitle(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}月${day}日 ${WEEKDAY_CN[d.getDay()]}`;
}

interface MatrixRow {
  label: string;
  mine: number;
  competitor: number;
  market: number;
}

function ComparisonMatrix({
  rows,
  thresholds,
  suffix,
}: {
  rows: MatrixRow[];
  thresholds: ThresholdBand[];
  suffix: string;
}) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="grid grid-cols-4 bg-muted/60 text-xs font-medium text-muted-foreground">
        <div className="px-3 py-2 text-center">时段</div>
        <div className="px-3 py-2 text-center">本酒店</div>
        <div className="px-3 py-2 text-center">竞对</div>
        <div className="px-3 py-2 text-center">商圈</div>
      </div>
      {rows.map((row, idx) => {
        const myColor = getThresholdColor(row.mine, thresholds);
        const isLast = idx === rows.length - 1;
        return (
          <div
            key={row.label}
            className={
              "grid grid-cols-4 items-center text-sm" +
              (isLast ? " bg-muted/30 font-medium" : "") +
              (idx > 0 ? " border-t" : "")
            }
          >
            <div className="px-3 py-2.5 text-center text-muted-foreground">{row.label}</div>
            <div
              className="px-3 py-2.5 text-center font-bold tabular-nums"
              style={{ color: `hsl(${myColor})` }}
            >
              {row.mine}
              {suffix}
            </div>
            <div className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">
              {row.competitor}
              {suffix}
            </div>
            <div className="px-3 py-2.5 text-center text-muted-foreground tabular-nums">
              {row.market}
              {suffix}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SectionHeader({ icon: Icon, title, count }: { icon: React.ElementType; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <span className="text-xs font-medium text-muted-foreground">{title}</span>
      {typeof count === "number" && (
        <Badge variant="outline" className="text-[10px] h-4">{count}</Badge>
      )}
    </div>
  );
}

function VenueBookingList({ bookings }: { bookings: VenueBooking[] }) {
  if (bookings.length === 0) {
    return <div className="py-3 text-center text-xs text-muted-foreground">暂无预订</div>;
  }
  return (
    <div className="space-y-1.5">
      {bookings.map((b, i) => (
        <div key={i} className="flex items-center justify-between rounded-md border bg-card px-2.5 py-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Hotel className="h-3 w-3 text-primary shrink-0" />
            <span className="text-xs font-medium truncate">{b.venueName}</span>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant="outline" className="text-[10px] h-4 gap-0.5">
              <Clock className="h-2.5 w-2.5" />
              {PERIOD_LABEL[b.period] ?? b.period}
            </Badge>
            {b.isBooked && b.activityType && (
              <Badge variant="secondary" className="text-[10px] h-4">{b.activityType}</Badge>
            )}
            <Badge variant={b.isBooked ? "default" : "outline"} className="text-[10px] h-4">
              {b.isBooked ? "已订" : "空闲"}
            </Badge>
          </div>
        </div>
      ))}
    </div>
  );
}

function CompetitorList({ competitors }: { competitors: CompetitorDetail[] }) {
  if (competitors.length === 0) {
    return <div className="py-3 text-center text-xs text-muted-foreground">暂无竞对活动</div>;
  }
  return (
    <div className="space-y-1.5">
      {competitors.map((c, i) => (
        <div key={i} className="rounded-md border bg-card px-2.5 py-1.5">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium truncate">{c.hotelName}</span>
            <Badge variant="outline" className="text-[10px] h-4 shrink-0">{c.activityType} · {c.count}</Badge>
          </div>
          {c.activities.length > 0 && (
            <div className="space-y-0.5">
              {c.activities.slice(0, 3).map((a, j) => (
                <div key={j} className="text-[11px] text-muted-foreground truncate">
                  · {a.eventName} <span className="text-muted-foreground/60">({a.bookingStatus})</span>
                </div>
              ))}
              {c.activities.length > 3 && (
                <div className="text-[11px] text-muted-foreground/60">… 还有 {c.activities.length - 3} 项</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function CityEventList({ events }: { events: CityEvent[] }) {
  if (events.length === 0) {
    return <div className="py-3 text-center text-xs text-muted-foreground">暂无城市活动</div>;
  }
  return (
    <div className="space-y-1.5">
      {events.map((e, i) => (
        <div key={i} className="rounded-md border bg-card px-2.5 py-1.5">
          <div className="text-xs font-medium">{e.name}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {e.venue} · <span className="text-muted-foreground/80">{e.type}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function DetailContent({
  date,
  day,
  thresholds,
  mode,
  hotelId,
  city,
}: {
  date: string;
  day: DayData;
  thresholds: ThresholdBand[];
  mode: "occupancy" | "bookings";
  hotelId: number;
  city: string;
}) {
  const [bookings, setBookings] = useState<VenueBooking[]>([]);
  const [competitors, setCompetitors] = useState<CompetitorDetail[]>([]);
  const [events, setEvents] = useState<CityEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!date) return;
    setLoading(true);
    let cancelled = false;
    Promise.all([
      hotelId ? fetchVenueBookings(date, hotelId).catch(() => []) : Promise.resolve([]),
      hotelId ? fetchCompetitorDetail(date, hotelId).catch(() => []) : Promise.resolve([]),
      day.cityEventCount > 0 && city ? fetchCityEvents(date, city).catch(() => []) : Promise.resolve([]),
    ]).then(([b, c, e]) => {
      if (cancelled) return;
      setBookings(b as VenueBooking[]);
      setCompetitors(c as CompetitorDetail[]);
      setEvents(e as CityEvent[]);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [date, hotelId, city, day.cityEventCount]);

  const rows: MatrixRow[] =
    mode === "occupancy"
      ? [
          {
            label: "上午",
            mine: day.periodOccupancy.AM,
            competitor: day.competitorPeriodOccupancy.AM,
            market: day.marketPeriodOccupancy.AM,
          },
          {
            label: "下午",
            mine: day.periodOccupancy.PM,
            competitor: day.competitorPeriodOccupancy.PM,
            market: day.marketPeriodOccupancy.PM,
          },
          {
            label: "综合",
            mine: day.myHotelRate,
            competitor: day.competitorAvgRate,
            market: day.marketAvgRate,
          },
        ]
      : [
          {
            label: "上午",
            mine: day.periodBookings.AM,
            competitor: day.competitorPeriodBookings.AM,
            market: day.marketPeriodBookings.AM,
          },
          {
            label: "下午",
            mine: day.periodBookings.PM,
            competitor: day.competitorPeriodBookings.PM,
            market: day.marketPeriodBookings.PM,
          },
          {
            label: "全天",
            mine: day.newBookingCount,
            competitor: day.competitorSumBookings,
            market: day.marketSumBookings,
          },
        ];

  const suffix = mode === "occupancy" ? "%" : "";

  return (
    <div className="space-y-5">
      {/* 1. 出租率/活动 对比矩阵 */}
      <div>
        <SectionHeader icon={CalendarDays} title={mode === "occupancy" ? "出租率对比" : "活动预订对比"} />
        <ComparisonMatrix rows={rows} thresholds={thresholds} suffix={suffix} />
      </div>

      {/* 2. 场地预订明细 inline */}
      <div>
        <SectionHeader icon={Hotel} title="本酒店场地预订" count={loading ? undefined : bookings.length} />
        {loading ? (
          <div className="py-3 text-center text-xs text-muted-foreground">加载中…</div>
        ) : (
          <VenueBookingList bookings={bookings} />
        )}
      </div>

      {/* 3. 竞对活动 inline */}
      <div>
        <SectionHeader icon={Building2} title="竞对活动" count={loading ? undefined : competitors.length} />
        {loading ? (
          <div className="py-3 text-center text-xs text-muted-foreground">加载中…</div>
        ) : (
          <CompetitorList competitors={competitors} />
        )}
      </div>

      {/* 4. 城市活动(仅当有时显示) */}
      {day.cityEventCount > 0 && (
        <div>
          <SectionHeader icon={Flag} title="城市活动" count={loading ? undefined : events.length} />
          {loading ? (
            <div className="py-3 text-center text-xs text-muted-foreground">加载中…</div>
          ) : (
            <CityEventList events={events} />
          )}
        </div>
      )}
    </div>
  );
}

export function DayDetailDrawer({
  date,
  day,
  open,
  onClose,
  thresholds,
  mode,
  hotelId,
  city,
}: DayDetailDrawerProps) {
  const isMobile = useIsMobile();

  const titleContent = (
    <span className="flex items-center gap-2 font-display">
      <CalendarDays className="h-5 w-5 text-primary" />
      {date ? formatDateTitle(date) : ""}
    </span>
  );

  const body =
    date && day ? (
      <DetailContent
        date={date}
        day={day}
        thresholds={thresholds}
        mode={mode}
        hotelId={hotelId}
        city={city}
      />
    ) : null;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{titleContent}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">{body}</div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titleContent}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">{body}</div>
      </SheetContent>
    </Sheet>
  );
}
