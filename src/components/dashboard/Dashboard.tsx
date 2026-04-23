import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthYearSelector } from "./MonthYearSelector";
import { FilterBar } from "./FilterBar";
import { DayCell } from "./DayCell";
import { CityEventDrawer } from "./CityEventDrawer";
import { CompetitorDrawer } from "./CompetitorDrawer";
import { Legend } from "./Legend";
import { fetchMonthData, fetchThresholds } from "@/api/dashboardApi";
import { useAuth } from "@/contexts/AuthContext";
import type { DayData, Filters, ThresholdBand } from "@/api/types";
import { BarChart3, CalendarRange } from "lucide-react";

const DAY_NAMES = ["日", "一", "二", "三", "四", "五", "六"];

function dayHasData(d: DayData): boolean {
  return (
    d.cityEventCount > 0 ||
    d.newBookingCount > 0 ||
    d.competitorSumBookings > 0 ||
    d.marketSumBookings > 0 ||
    d.myHotelRate > 0 ||
    d.competitorAvgRate > 0 ||
    d.marketAvgRate > 0
  );
}

function formatDateCN(dateStr: string): string {
  // "2026-04-14" → "4月14日"
  const [, m, d] = dateStr.split("-");
  return `${parseInt(m)}月${parseInt(d)}日`;
}

export function Dashboard() {
  const { auth } = useAuth();
  const hotels = auth.status === "authenticated" ? auth.user.hotels ?? [] : [];
  const hotelIds = auth.status === "authenticated" ? auth.user.hotelIds ?? [] : [];
  const [selectedHotelId, setSelectedHotelId] = useState<number>(0);
  const hotelId = selectedHotelId || hotelIds[0] || 0;
  const city = "苏州";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [venueType, setVenueType] = useState("All");
  const [mode, setMode] = useState<"occupancy" | "bookings">("occupancy");
  const [days, setDays] = useState<DayData[]>([]);
  const [thresholds, setThresholds] = useState<ThresholdBand[]>([]);
  const [cityEventDate, setCityEventDate] = useState<string | null>(null);
  const [cityEventOpen, setCityEventOpen] = useState(false);
  const [compDate, setCompDate] = useState<string | null>(null);
  const [compOpen, setCompOpen] = useState(false);

  useEffect(() => {
    if (hotelId) fetchThresholds(hotelId).then(setThresholds);
  }, [hotelId]);

  const loadData = useCallback(async () => {
    if (hotelIds.length === 0) return;
    const filters: Filters = { venueType, timePeriod: "All", month, year };
    const queryIds = selectedHotelId === 0 ? hotelIds : selectedHotelId;
    const data = await fetchMonthData(queryIds, filters);
    setDays(data);
  }, [selectedHotelId, hotelIds, venueType, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 点击格子背景：按需求仅在「当天完全无数据」时 toast
  // 有数据时什么都不做（用户应点击 🚩 或 C 徽标进入具体 drawer）
  const handleDayClick = (date: string) => {
    const d = days.find((x) => x.date === date);
    if (!d || !dayHasData(d)) {
      toast.info(`${formatDateCN(date)}暂无数据`);
    }
  };

  const handleCityEventClick = (date: string) => {
    setCityEventDate(date);
    setCityEventOpen(true);
  };

  const handleCompetitorClick = (date: string) => {
    setCompDate(date);
    setCompOpen(true);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const gridCells: (DayData | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...days,
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-5">
          <div className="hidden sm:block">
            <h1 className="text-xl font-display font-bold text-foreground">会议室运营</h1>
            <p className="text-sm text-muted-foreground">出租率与竞对数据监控</p>
          </div>
          <div className="flex items-center justify-between sm:justify-end">
            <h1 className="sm:hidden text-base font-display font-bold text-foreground">会议室运营</h1>
            <MonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-2 py-3 space-y-3 sm:px-4 sm:py-6 sm:space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "occupancy" | "bookings")} className="w-auto">
            <TabsList>
              <TabsTrigger value="occupancy" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                出租率
              </TabsTrigger>
              <TabsTrigger value="bookings" className="gap-1.5">
                <CalendarRange className="h-4 w-4" />
                活动预订
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <FilterBar
            venueType={venueType}
            onVenueTypeChange={setVenueType}
            hotels={hotels}
            selectedHotelId={selectedHotelId}
            onHotelChange={setSelectedHotelId}
          />
        </div>

        <Card>
          <CardHeader className="pb-2 px-3 pt-3 sm:pb-3 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-display">
              {mode === "occupancy" ? "月度出租率" : "活动预订"}
            </CardTitle>
            <Legend days={days} thresholds={thresholds} mode={mode} />
          </CardHeader>
          <CardContent className="px-2 pb-3 sm:px-6 sm:pb-6">
            {/* Day headers */}
            <div className="hidden sm:grid grid-cols-7 gap-2 mb-2">
              {DAY_NAMES.map((d) => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1">{d}</div>
              ))}
            </div>

            {/* Desktop grid */}
            <div className="hidden sm:grid grid-cols-7 gap-2">
              {gridCells.map((cell, i) =>
                cell ? (
                  <DayCell
                    key={cell.date}
                    day={cell}
                    mode={mode}
                    onClick={handleDayClick}
                    onCityEventClick={handleCityEventClick}
                    onCompetitorClick={handleCompetitorClick}
                    thresholds={thresholds}
                    highlightPeriod="All"
                  />
                ) : (
                  <div key={`empty-${i}`} />
                )
              )}
            </div>

            {/* Mobile grid */}
            <div className="sm:hidden">
              <div className="grid grid-cols-7 gap-0.5 mb-0.5">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground">{d.charAt(0)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {gridCells.map((cell, i) =>
                  cell ? (
                    <DayCell
                      key={cell.date}
                      day={cell}
                      mode={mode}
                      onClick={handleDayClick}
                      onCityEventClick={handleCityEventClick}
                      onCompetitorClick={handleCompetitorClick}
                      compact
                      thresholds={thresholds}
                      highlightPeriod="All"
                    />
                  ) : (
                    <div key={`empty-m-${i}`} />
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <CityEventDrawer date={cityEventDate} open={cityEventOpen} onClose={() => setCityEventOpen(false)} city={city} />
      <CompetitorDrawer date={compDate} open={compOpen} onClose={() => setCompOpen(false)} hotelId={hotelId} />
    </div>
  );
}
