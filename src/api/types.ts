export type VenueType = string;
export type TimePeriod = "All" | "AM" | "PM" | "EV";

export interface ThresholdBand {
  min: number;
  max: number;
  color: string; // HSL string like "0 72% 51%"
  label: string;
}

export interface PeriodValues {
  AM: number;
  PM: number;
  EV: number;
}

export interface DayData {
  date: string; // YYYY-MM-DD
  occupancyRate: number; // overall 0-100
  periodOccupancy: PeriodValues;
  cityEventCount: number;
  newBookingCount: number;
  periodBookings: PeriodValues;
  myHotelRate: number;
  competitorAvgRate: number;
  marketAvgRate: number;
  competitorPeriodOccupancy: PeriodValues;
  marketPeriodOccupancy: PeriodValues;
  competitorSumBookings: number;
  marketSumBookings: number;
}

export interface CityEvent {
  name: string;
  venue: string;
  type: string;
}

export interface CompetitorActivity {
  venueName: string;
  period: string;
  date: string;
  eventName: string;     // 活动名称（来自 Hotel Event 表）
  eventType: string;     // 活动类型
  bookingStatus: string; // 预订状态（已出租 / ...）
}

export interface CompetitorDetail {
  hotelName: string;
  activityType: string;
  count: number;
  activities: CompetitorActivity[];
}

export interface VenueBooking {
  venueName: string;
  period: "AM" | "PM" | "EV";
  activityType: string;
  isBooked: boolean;
}

export interface Filters {
  venueType: VenueType;
  timePeriod: TimePeriod;
  month: number; // 0-11
  year: number;
}

// ---- Backend API response shapes ----

export interface ApiPeriodData {
  m: number;
  a: number;
  e: number;
}

export interface ApiDailyOccupancy {
  date: string;
  hotel: ApiPeriodData;
  competitorAvg: ApiPeriodData;
  marketAvg: ApiPeriodData;
  cityEventCount: number;
}

export interface ApiDailyActivity {
  date: string;
  hotel: ApiPeriodData;
  competitorTotal: ApiPeriodData;
  marketTotal: ApiPeriodData;
  cityEventCount: number;
}

export interface ApiThresholdItem {
  metricType: string;
  level: string;
  minValue: number;
  maxValue: number;
  color: string;
}
