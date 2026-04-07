import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MonthYearSelector } from "./MonthYearSelector";
import { FilterBar } from "./FilterBar";
import { DayCell } from "./DayCell";
import { DayDrawer } from "./DayDrawer";
import { Legend } from "./Legend";
import { fetchMonthData } from "@/api/dashboardApi";
import type { DayData, VenueType, TimePeriod, Filters } from "@/api/types";
import { BarChart3, CalendarRange } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Dashboard() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [venueType, setVenueType] = useState<VenueType>("All");
  const [timePeriod, setTimePeriod] = useState<TimePeriod>("All");
  const [mode, setMode] = useState<"occupancy" | "bookings">("occupancy");
  const [days, setDays] = useState<DayData[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isMobile = useIsMobile();

  const loadData = useCallback(async () => {
    const filters: Filters = { venueType, timePeriod, month, year };
    const data = await fetchMonthData(filters);
    setDays(data);
  }, [venueType, timePeriod, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDayClick = (date: string) => {
    setSelectedDate(date);
    setDrawerOpen(true);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const gridCells: (DayData | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...days,
  ];

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="container mx-auto flex flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-display font-bold text-foreground">Meeting Room Operations</h1>
            <p className="text-sm text-muted-foreground">Monitor occupancy, bookings & competitive landscape</p>
          </div>
          <MonthYearSelector month={month} year={year} onMonthChange={setMonth} onYearChange={setYear} />
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 space-y-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={mode} onValueChange={(v) => setMode(v as "occupancy" | "bookings")} className="w-auto">
            <TabsList>
              <TabsTrigger value="occupancy" className="gap-1.5">
                <BarChart3 className="h-4 w-4" />
                <span className="hidden sm:inline">Occupancy Heatmap</span>
                <span className="sm:hidden">Occupancy</span>
              </TabsTrigger>
              <TabsTrigger value="bookings" className="gap-1.5">
                <CalendarRange className="h-4 w-4" />
                <span className="hidden sm:inline">Activity Count</span>
                <span className="sm:hidden">Bookings</span>
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <FilterBar
            venueType={venueType}
            timePeriod={timePeriod}
            onVenueTypeChange={setVenueType}
            onTimePeriodChange={setTimePeriod}
          />
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display">
              {mode === "occupancy" ? "Monthly Occupancy Rate" : "New Booking Count"}
            </CardTitle>
            {mode === "occupancy" && <Legend days={days} />}
          </CardHeader>
          <CardContent>
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
                  <DayCell key={cell.date} day={cell} mode={mode} onClick={handleDayClick} />
                ) : (
                  <div key={`empty-${i}`} />
                )
              )}
            </div>

            {/* Mobile: compact 7-column grid */}
            <div className="sm:hidden">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {DAY_NAMES.map((d) => (
                  <div key={d} className="text-center text-[10px] font-medium text-muted-foreground py-0.5">{d.charAt(0)}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {gridCells.map((cell, i) =>
                  cell ? (
                    <DayCell key={cell.date} day={cell} mode={mode} onClick={handleDayClick} compact />
                  ) : (
                    <div key={`empty-m-${i}`} />
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      <DayDrawer date={selectedDate} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
}
