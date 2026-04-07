import type { DayData, DayDetail, Filters, ThresholdBand } from "./types";
import { generateMonthData, generateDayDetail, generateThresholds } from "./mockData";

export async function fetchMonthData(filters: Filters): Promise<DayData[]> {
  await new Promise((r) => setTimeout(r, 200));
  return generateMonthData(filters.year, filters.month);
}

export async function fetchDayDetail(date: string): Promise<DayDetail> {
  await new Promise((r) => setTimeout(r, 150));
  return generateDayDetail(date);
}

export async function fetchThresholds(_hotelId: string = "default"): Promise<ThresholdBand[]> {
  await new Promise((r) => setTimeout(r, 100));
  return generateThresholds();
}
