import type { DayData, DayDetail, CityEvent, CompetitorDetail, ThresholdBand, VenueBooking } from "./types";

const eventNames = [
  "Tech Summit 2026", "Annual Charity Gala", "Medical Conference",
  "Wedding Expo", "Corporate Retreat", "Product Launch",
  "Industry Awards Night", "Trade Fair", "Board Meeting Series",
  "Regional Sales Kickoff",
];

const venues = ["Grand Ballroom", "Sapphire Hall", "Conference Room A", "Conference Room B", "Executive Suite", "Crystal Pavilion"];
const eventTypes = ["Conference", "Gala", "Expo", "Corporate", "Social", "Training"];
const competitorHotels = ["Marriott Grand", "Hilton Central", "Hyatt Regency", "IHG Suites", "Radisson Blu"];
const activityTypes = ["Meetings", "Conferences", "Banquets", "Workshops", "Social Events"];
const activityNames = ["婚宴", "年会", "培训", "产品发布会", "董事会", "研讨会", "鸡尾酒会", "颁奖典礼"];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateThresholds(): ThresholdBand[] {
  return [
    { min: 0, max: 60, color: "0 72% 51%", label: "<60%" },
    { min: 60, max: 80, color: "40 90% 50%", label: "60-80%" },
    { min: 80, max: 100, color: "142 64% 42%", label: ">80%" },
  ];
}

export function generateMonthData(year: number, month: number): DayData[] {
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const rand = seededRandom(year * 100 + month);
  const days: DayData[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dayOfWeek = new Date(year, month, d).getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const baseOcc = isWeekend ? 40 + rand() * 40 : 55 + rand() * 40;
    const occ = Math.round(Math.min(100, Math.max(10, baseOcc)));

    const amOcc = Math.round(Math.min(100, Math.max(5, occ + (rand() - 0.5) * 30)));
    const pmOcc = Math.round(Math.min(100, Math.max(5, occ + (rand() - 0.5) * 25)));
    const evOcc = Math.round(Math.min(100, Math.max(5, occ + (rand() - 0.5) * 35)));

    const myRate = occ;
    const compRate = Math.round(Math.min(100, Math.max(10, occ + (rand() - 0.5) * 20)));
    const marketRate = Math.round(Math.min(100, Math.max(10, occ + (rand() - 0.5) * 15)));

    const bookings = Math.floor(rand() * 12);
    const amBook = Math.floor(rand() * 5);
    const pmBook = Math.floor(rand() * 5);
    const evBook = Math.floor(rand() * 4);

    const compSumBookings = Math.floor(rand() * 40) + 5;
    const marketSumBookings = Math.floor(rand() * 60) + 10;

    days.push({
      date: dateStr,
      occupancyRate: occ,
      periodOccupancy: { AM: amOcc, PM: pmOcc, EV: evOcc },
      cityEventCount: Math.floor(rand() * 5),
      newBookingCount: bookings,
      periodBookings: { AM: amBook, PM: pmBook, EV: evBook },
      myHotelRate: myRate,
      competitorAvgRate: compRate,
      marketAvgRate: marketRate,
      competitorSumBookings: compSumBookings,
      marketSumBookings: marketSumBookings,
    });
  }
  return days;
}

export function generateDayDetail(dateStr: string): DayDetail {
  const seed = dateStr.split("-").reduce((a, b) => a + parseInt(b), 0);
  const rand = seededRandom(seed);
  const numEvents = 1 + Math.floor(rand() * 4);
  const cityEvents: CityEvent[] = Array.from({ length: numEvents }, () => ({
    name: eventNames[Math.floor(rand() * eventNames.length)],
    venue: venues[Math.floor(rand() * venues.length)],
    type: eventTypes[Math.floor(rand() * eventTypes.length)],
  }));

  const numComp = 2 + Math.floor(rand() * 4);
  const competitors: CompetitorDetail[] = Array.from({ length: numComp }, () => {
    const count = 1 + Math.floor(rand() * 8);
    const activities = Array.from({ length: count }, () => {
      const dayOffset = Math.floor(rand() * 28);
      const parts = dateStr.split("-");
      const dd = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1 + dayOffset);
      const actDate = `${dd.getFullYear()}-${String(dd.getMonth() + 1).padStart(2, "0")}-${String(dd.getDate()).padStart(2, "0")}`;
      return {
        name: activityNames[Math.floor(rand() * activityNames.length)],
        date: actDate,
        venue: venues[Math.floor(rand() * venues.length)],
      };
    });
    return {
      hotelName: competitorHotels[Math.floor(rand() * competitorHotels.length)],
      activityType: activityTypes[Math.floor(rand() * activityTypes.length)],
      count,
      activities,
    };
  });

  const periods: ("AM" | "PM" | "EV")[] = ["AM", "PM", "EV"];
  const venueBookings: VenueBooking[] = [];
  const numBookings = 3 + Math.floor(rand() * 6);
  for (let i = 0; i < numBookings; i++) {
    venueBookings.push({
      venueName: venues[Math.floor(rand() * venues.length)],
      period: periods[Math.floor(rand() * 3)],
      activityType: activityTypes[Math.floor(rand() * activityTypes.length)],
    });
  }

  return { date: dateStr, cityEvents, competitors, venueBookings };
}
