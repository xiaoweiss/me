import { request } from "./client";
import type {
  DayData,
  Filters,
  ThresholdBand,
  CityEvent,
  CompetitorDetail,
  VenueBooking,
  ApiDailyOccupancy,
  ApiDailyActivity,
  ApiThresholdItem,
  ApiPeriodData,
} from "./types";

function avg(p: ApiPeriodData): number {
  const vals = [p.m, p.a, p.e].filter((v) => v > 0);
  return vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
}

function sum(p: ApiPeriodData): number {
  return p.m + p.a + p.e;
}

function toPeriodValues(p: ApiPeriodData) {
  return { AM: Math.round(p.m), PM: Math.round(p.a), EV: Math.round(p.e) };
}

async function fetchForHotel(hotelId: number, filters: Filters) {
  const q = new URLSearchParams({
    hotelId: String(hotelId),
    year: String(filters.year),
    month: String(filters.month + 1),
    venueType: filters.venueType === "All" ? "" : filters.venueType,
  });
  const [occResp, actResp] = await Promise.all([
    request<{ list: ApiDailyOccupancy[] }>(`/api/dashboard/occupancy?${q}`),
    request<{ list: ApiDailyActivity[] }>(`/api/dashboard/activity?${q}`),
  ]);
  return { occ: occResp.list ?? [], act: actResp.list ?? [] };
}

export async function fetchMonthData(
  hotelIdOrIds: number | number[],
  filters: Filters,
): Promise<DayData[]> {
  const ids = Array.isArray(hotelIdOrIds) ? hotelIdOrIds : [hotelIdOrIds];

  const results = await Promise.all(ids.map((id) => fetchForHotel(id, filters)));

  const occMap = new Map<string, ApiPeriodData[]>();
  const compOccMap = new Map<string, ApiPeriodData[]>();
  const mktOccMap = new Map<string, ApiPeriodData[]>();
  const actMap = new Map<string, ApiPeriodData[]>();
  const compActMap = new Map<string, ApiPeriodData[]>();
  const mktActMap = new Map<string, ApiPeriodData[]>();
  const eventMap = new Map<string, number>();

  for (const { occ, act } of results) {
    for (const d of occ) {
      if (!occMap.has(d.date)) occMap.set(d.date, []);
      occMap.get(d.date)!.push(d.hotel);
      if (!compOccMap.has(d.date)) compOccMap.set(d.date, []);
      compOccMap.get(d.date)!.push(d.competitorAvg);
      if (!mktOccMap.has(d.date)) mktOccMap.set(d.date, []);
      mktOccMap.get(d.date)!.push(d.marketAvg);
      eventMap.set(d.date, Math.max(eventMap.get(d.date) ?? 0, d.cityEventCount));
    }
    for (const d of act) {
      if (!actMap.has(d.date)) actMap.set(d.date, []);
      actMap.get(d.date)!.push(d.hotel);
      if (!compActMap.has(d.date)) compActMap.set(d.date, []);
      compActMap.get(d.date)!.push(d.competitorTotal);
      if (!mktActMap.has(d.date)) mktActMap.set(d.date, []);
      mktActMap.get(d.date)!.push(d.marketTotal);
      eventMap.set(d.date, Math.max(eventMap.get(d.date) ?? 0, d.cityEventCount));
    }
  }

  const zero: ApiPeriodData = { m: 0, a: 0, e: 0 };
  const daysInMonth = new Date(filters.year, filters.month + 1, 0).getDate();
  const days: DayData[] = [];

  function avgPeriods(ps: ApiPeriodData[]): ApiPeriodData {
    if (ps.length === 0) return zero;
    return {
      m: ps.reduce((s, p) => s + p.m, 0) / ps.length,
      a: ps.reduce((s, p) => s + p.a, 0) / ps.length,
      e: ps.reduce((s, p) => s + p.e, 0) / ps.length,
    };
  }
  function sumPeriods(ps: ApiPeriodData[]): ApiPeriodData {
    return {
      m: ps.reduce((s, p) => s + p.m, 0),
      a: ps.reduce((s, p) => s + p.a, 0),
      e: ps.reduce((s, p) => s + p.e, 0),
    };
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const date = `${filters.year}-${String(filters.month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const hotel = avgPeriods(occMap.get(date) ?? []);
    const compOcc = avgPeriods(compOccMap.get(date) ?? []);
    const mktOcc = avgPeriods(mktOccMap.get(date) ?? []);
    const hotelAct = sumPeriods(actMap.get(date) ?? []);
    const compAct = sumPeriods(compActMap.get(date) ?? []);
    const mktAct = sumPeriods(mktActMap.get(date) ?? []);

    days.push({
      date,
      occupancyRate: avg(hotel),
      periodOccupancy: toPeriodValues(hotel),
      cityEventCount: eventMap.get(date) ?? 0,
      newBookingCount: sum(hotelAct),
      periodBookings: toPeriodValues(hotelAct),
      myHotelRate: avg(hotel),
      competitorAvgRate: avg(compOcc),
      marketAvgRate: avg(mktOcc),
      competitorPeriodOccupancy: toPeriodValues(compOcc),
      marketPeriodOccupancy: toPeriodValues(mktOcc),
      competitorSumBookings: sum(compAct),
      marketSumBookings: sum(mktAct),
    });
  }

  return days;
}

export async function fetchCityEvents(date: string, city: string): Promise<CityEvent[]> {
  const q = new URLSearchParams({ date, city });
  const resp = await request<{
    list: { venueName: string; eventName: string; eventType: string }[];
  }>(`/api/dashboard/city-events?${q}`);

  return (resp.list ?? []).map((e) => ({
    name: e.eventName,
    venue: e.venueName,
    type: e.eventType,
  }));
}

export async function fetchCompetitorDetail(
  date: string,
  hotelId: number,
): Promise<CompetitorDetail[]> {
  const q = new URLSearchParams({ date, hotelId: String(hotelId) });
  const resp = await request<{ list: CompetitorDetail[] }>(`/api/dashboard/competitor-detail?${q}`);
  return resp.list ?? [];
}

export async function fetchVenueBookings(
  date: string,
  hotelId: number,
  venueType?: string,
): Promise<VenueBooking[]> {
  const q = new URLSearchParams({ date, hotelId: String(hotelId) });
  if (venueType && venueType !== "All") q.set("venueType", venueType);
  const resp = await request<{
    list: { venueName: string; period: string; activityType: string; isBooked: boolean }[];
  }>(`/api/dashboard/hotel-detail?${q}`);

  return (resp.list ?? []).map((b) => ({
    venueName: b.venueName,
    period: b.period as "AM" | "PM" | "EV",
    activityType: b.activityType,
    isBooked: b.isBooked,
  }));
}

function hexToHsl(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16) / 255;
  const g = parseInt(h.substring(2, 4), 16) / 255;
  const b = parseInt(h.substring(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return `0 0% ${Math.round(l * 100)}%`;
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let hue = 0;
  if (max === r) hue = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) hue = ((b - r) / d + 2) / 6;
  else hue = ((r - g) / d + 4) / 6;
  return `${Math.round(hue * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function toHslColor(color: string): string {
  if (color.startsWith("#")) return hexToHsl(color);
  return color;
}

export async function fetchThresholds(hotelId?: number): Promise<ThresholdBand[]> {
  const q = hotelId ? `?hotelId=${hotelId}` : "";
  const resp = await request<{ list: ApiThresholdItem[] }>(`/api/config/thresholds${q}`);

  const items = (resp.list ?? []).filter((t) => t.metricType === "occupancy");
  if (items.length === 0) {
    return [
      { min: 0, max: 60, color: "0 72% 51%", label: "<60%" },
      { min: 60, max: 80, color: "40 90% 50%", label: "60-80%" },
      { min: 80, max: 100, color: "142 64% 42%", label: ">80%" },
    ];
  }

  return items
    .sort((a, b) => a.minValue - b.minValue)
    .map((t) => ({
      min: t.minValue,
      max: t.maxValue,
      color: toHslColor(t.color),
      label: `${t.minValue}-${t.maxValue}%`,
    }));
}
