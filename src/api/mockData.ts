import type { DayData, DayDetail, CityEvent, CompetitorDetail } from "./types";

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
    const myRate = occ;
    const compRate = Math.round(Math.min(100, Math.max(10, occ + (rand() - 0.5) * 20)));
    const marketRate = Math.round(Math.min(100, Math.max(10, occ + (rand() - 0.5) * 15)));

    days.push({
      date: dateStr,
      occupancyRate: occ,
      cityEventCount: Math.floor(rand() * 5),
      newBookingCount: Math.floor(rand() * 12),
      myHotelRate: myRate,
      competitorAvgRate: compRate,
      marketAvgRate: marketRate,
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
      const d = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1 + dayOffset);
      const actDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  return { date: dateStr, cityEvents, competitors };
}
