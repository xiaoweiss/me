import type { DayData, DayDetail, Filters } from "./types";
import { generateMonthData, generateDayDetail } from "./mockData";

export async function fetchMonthData(filters: Filters): Promise<DayData[]> {
  // Simulate network delay
  await new Promise((r) => setTimeout(r, 200));
  return generateMonthData(filters.year, filters.month);
}

export async function fetchDayDetail(date: string): Promise<DayDetail> {
  await new Promise((r) => setTimeout(r, 150));
  return generateDayDetail(date);
}
