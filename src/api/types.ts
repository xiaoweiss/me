export type VenueType = "All" | "Ballroom" | "Conference Room";
export type TimePeriod = "All" | "AM" | "PM" | "EV";

export interface DayData {
  date: string; // YYYY-MM-DD
  occupancyRate: number; // 0-100
  cityEventCount: number;
  newBookingCount: number;
  myHotelRate: number;
  competitorAvgRate: number;
  marketAvgRate: number;
}

export interface CityEvent {
  name: string;
  venue: string;
  type: string;
}

export interface CompetitorDetail {
  hotelName: string;
  activityType: string;
  count: number;
}

export interface DayDetail {
  date: string;
  cityEvents: CityEvent[];
  competitors: CompetitorDetail[];
}

export interface Filters {
  venueType: VenueType;
  timePeriod: TimePeriod;
  month: number; // 0-11
  year: number;
}
