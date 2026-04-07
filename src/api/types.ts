export type VenueType = "All" | "Ballroom" | "Conference Room";
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
  competitorSumBookings: number;
  marketSumBookings: number;
}

export interface CityEvent {
  name: string;
  venue: string;
  type: string;
}

export interface CompetitorActivity {
  name: string;
  date: string;
  venue: string;
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
}

export interface DayDetail {
  date: string;
  cityEvents: CityEvent[];
  competitors: CompetitorDetail[];
  venueBookings: VenueBooking[];
}

export interface Filters {
  venueType: VenueType;
  timePeriod: TimePeriod;
  month: number; // 0-11
  year: number;
}
