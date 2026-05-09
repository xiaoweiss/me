import { useState, useEffect, useCallback, useRef } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { Download, Image as ImageIcon, FileText } from "lucide-react";
import { MonthYearSelector } from "./MonthYearSelector";
import { FilterBar } from "./FilterBar";
import { DayCell } from "./DayCell";
import { CityEventDrawer } from "./CityEventDrawer";
import { CompetitorDrawer } from "./CompetitorDrawer";
import { VenueBookingDrawer } from "./VenueBookingDrawer";
import { Legend } from "./Legend";
import { fetchMonthData, fetchThresholds } from "@/api/dashboardApi";
import { getToken } from "@/api/client";
import { useAuth } from "@/contexts/AuthContext";
import type { DayData, Filters, ThresholdBand, MonthSummary } from "@/api/types";
import { BarChart3, CalendarRange } from "lucide-react";

const MONTH_NAMES = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

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
  const calendarRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState<"png" | "pdf" | null>(null);
  // 城市活动按当前选中酒店的所在城市过滤
  const city = hotels.find((h) => h.id === hotelId)?.city || "";

  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const [year, setYear] = useState(now.getFullYear());
  const [venueType, setVenueType] = useState("All");
  const [mode, setMode] = useState<"occupancy" | "bookings">("occupancy");
  const [days, setDays] = useState<DayData[]>([]);
  const [summary, setSummary] = useState<MonthSummary>({ hotelRate: 0, competitorRate: 0, marketRate: 0 });
  const [thresholds, setThresholds] = useState<ThresholdBand[]>([]);
  const [cityEventDate, setCityEventDate] = useState<string | null>(null);
  const [cityEventOpen, setCityEventOpen] = useState(false);
  const [compDate, setCompDate] = useState<string | null>(null);
  const [compOpen, setCompOpen] = useState(false);
  const [compPeriod, setCompPeriod] = useState<"AM" | "PM" | undefined>(undefined);
  const [venueBookingDate, setVenueBookingDate] = useState<string | null>(null);
  const [venueBookingOpen, setVenueBookingOpen] = useState(false);

  useEffect(() => {
    if (hotelId) fetchThresholds(hotelId).then(setThresholds);
  }, [hotelId]);

  const loadData = useCallback(async () => {
    if (hotelIds.length === 0) return;
    const filters: Filters = { venueType, timePeriod: "All", month, year };
    const queryIds = selectedHotelId === 0 ? hotelIds : selectedHotelId;
    const data = await fetchMonthData(queryIds, filters);
    setDays(data.days);
    setSummary(data.summary);
  }, [selectedHotelId, hotelIds, venueType, month, year]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 点击格子背景:
  // - 活动预订模式: 打开当天活动明细 drawer
  // - 出租率模式: 跟 PC 对齐 —— 格子内部已有上下午区/旗的独立 tap 区,空白格子只在无数据时给 toast 提示
  const handleDayClick = (date: string) => {
    if (mode === "bookings") {
      setVenueBookingDate(date);
      setVenueBookingOpen(true);
      return;
    }
    const d = days.find((x) => x.date === date);
    if (!d || !dayHasData(d)) {
      toast.info(`${formatDateCN(date)}暂无数据`);
    }
  };

  const currentHotelName = hotels.find((h) => h.id === hotelId)?.name || "本酒店";
  const exportFilename = `${currentHotelName}-${MONTH_NAMES[month]}-${year}-${mode === "occupancy" ? "出租率" : "活动预订"}`;

  // 当日 ISO 日期(Asia/Shanghai),不论用户在看哪个历史月份。
  // 服务器留存的"今日看板图"必须是真正的今天,不是 selected month/year。
  function todayISOInShanghai(): string {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Shanghai",
      year: "numeric", month: "2-digit", day: "2-digit",
    });
    return fmt.format(new Date()); // YYYY-MM-DD
  }

  // 上传文件到服务器留存(失败不阻塞本地下载)。
  async function uploadSnapshotToServer(blob: Blob, format: "png" | "pdf") {
    const fd = new FormData();
    fd.append("file", blob, `${exportFilename}.${format}`);
    fd.append("hotelId", String(hotelId));
    fd.append("date", todayISOInShanghai());
    fd.append("mode", mode);
    fd.append("format", format);
    const token = getToken();
    const headers: Record<string, string> = {};
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const apiBase = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL as string || "");
    const res = await fetch(`${apiBase}/api/admin/dashboard-snapshots`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  // 把日历卡导出成 PNG / PDF。html-to-image 用 foreignObject 渲染，对 Tailwind / hsl() 兼容性好。
  // 导出范围 = calendarRef 包住的 Card（含标题 + Legend + 日历网格），不包含工具栏。
  async function handleExport(format: "png" | "pdf") {
    const el = calendarRef.current;
    if (!el) return;
    setExporting(format);
    try {
      // 等字体加载完，否则截图里中文可能变方块
      if (typeof document !== "undefined" && document.fonts && (document.fonts as unknown as { ready: Promise<unknown> }).ready) {
        await (document.fonts as unknown as { ready: Promise<unknown> }).ready;
      }
      const { toPng } = await import("html-to-image");
      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        cacheBust: true,
      });

      // dataURL → Blob,后续既本地下载也上传服务器
      const blobResp = await fetch(dataUrl);
      const pngBlob = await blobResp.blob();

      if (format === "png") {
        // 先尝试上传服务器留存,失败时仅 toast 不阻塞下载
        try {
          await uploadSnapshotToServer(pngBlob, "png");
        } catch (e) {
          toast.error("服务器留存失败,本地下载已完成", {
            description: e instanceof Error ? e.message : "",
          });
        }
        const a = document.createElement("a");
        a.href = dataUrl;
        a.download = `${exportFilename}.png`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        toast.success("已下载 PNG");
        return;
      }

      // PDF: 把 PNG 嵌进 jsPDF
      const img = new Image();
      img.src = dataUrl;
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("图片加载失败"));
      });
      const { default: jsPDF } = await import("jspdf");
      const pdf = new jsPDF({
        orientation: img.width >= img.height ? "landscape" : "portrait",
        unit: "px",
        format: [img.width, img.height],
        compress: true,
      });
      pdf.addImage(dataUrl, "PNG", 0, 0, img.width, img.height);
      // 上传 PDF 二进制(模板第一版只用 PNG inline,但 PDF 也留存便于后续)
      try {
        const pdfBlob = pdf.output("blob");
        await uploadSnapshotToServer(pdfBlob, "pdf");
      } catch (e) {
        toast.error("服务器留存失败,本地下载已完成", {
          description: e instanceof Error ? e.message : "",
        });
      }
      pdf.save(`${exportFilename}.pdf`);
      toast.success("已下载 PDF");
    } catch (e) {
      toast.error("导出失败", { description: e instanceof Error ? e.message : "" });
    } finally {
      setExporting(null);
    }
  }

  const handleCityEventClick = (date: string) => {
    setCityEventDate(date);
    setCityEventOpen(true);
  };

  const handleCompetitorClick = (date: string, period?: "AM" | "PM") => {
    setCompDate(date);
    setCompPeriod(period);
    setCompOpen(true);
  };

  const firstDayOfWeek = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const zeroPeriod: DayData["periodOccupancy"] = { AM: 0, PM: 0, EV: 0 };
  const dayMap = new Map(days.map((d) => [d.date, d]));
  const allDays: DayData[] = Array.from({ length: daysInMonth }, (_, i) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
    return (
      dayMap.get(dateStr) ?? {
        date: dateStr,
        occupancyRate: 0,
        periodOccupancy: zeroPeriod,
        cityEventCount: 0,
        newBookingCount: 0,
        periodBookings: zeroPeriod,
        myHotelRate: 0,
        competitorAvgRate: 0,
        marketAvgRate: 0,
        competitorPeriodOccupancy: zeroPeriod,
        marketPeriodOccupancy: zeroPeriod,
        competitorSumBookings: 0,
        marketSumBookings: 0,
        competitorPeriodBookings: zeroPeriod,
        marketPeriodBookings: zeroPeriod,
      }
    );
  });
  const gridCells: (DayData | null)[] = [
    ...Array(firstDayOfWeek).fill(null),
    ...allDays,
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
          <div className="flex items-center gap-3">
            <FilterBar
              venueType={venueType}
              onVenueTypeChange={setVenueType}
              hotels={hotels}
              selectedHotelId={selectedHotelId}
              onHotelChange={setSelectedHotelId}
            />
            {/* 保存按钮：只 PC 显示。下拉选 PNG / PDF，截 calendarRef 包的 Card */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="hidden sm:inline-flex gap-1.5 h-8"
                  disabled={exporting !== null}
                >
                  <Download className={`h-3.5 w-3.5 ${exporting !== null ? "animate-pulse" : ""}`} />
                  {exporting === "png" ? "导出 PNG…" : exporting === "pdf" ? "导出 PDF…" : "保存"}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[140px]">
                <DropdownMenuItem onClick={() => handleExport("png")} className="gap-2">
                  <ImageIcon className="h-3.5 w-3.5" />导出为 PNG 图片
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("pdf")} className="gap-2">
                  <FileText className="h-3.5 w-3.5" />导出为 PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        <Card ref={calendarRef}>
          <CardHeader className="pb-2 px-3 pt-3 sm:pb-3 sm:px-6 sm:pt-6">
            <CardTitle className="text-sm sm:text-base font-display">
              {mode === "occupancy" ? "月度出租率" : "活动预订"}
            </CardTitle>
            <Legend days={days} thresholds={thresholds} mode={mode} summary={summary} />
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
      <CompetitorDrawer date={compDate} open={compOpen} onClose={() => setCompOpen(false)} hotelId={hotelId} period={compPeriod} />
      <VenueBookingDrawer date={venueBookingDate} open={venueBookingOpen} onClose={() => setVenueBookingOpen(false)} hotelId={hotelId} />
    </div>
  );
}
