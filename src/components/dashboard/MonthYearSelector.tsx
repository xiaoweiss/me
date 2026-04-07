import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MonthYearSelectorProps {
  month: number;
  year: number;
  onMonthChange: (m: number) => void;
  onYearChange: (y: number) => void;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthYearSelector({ month, year, onMonthChange, onYearChange }: MonthYearSelectorProps) {
  return (
    <div className="flex items-center gap-3">
      <Select value={String(month)} onValueChange={(v) => onMonthChange(Number(v))}>
        <SelectTrigger className="w-[140px] bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => (
            <SelectItem key={i} value={String(i)}>{m}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={String(year)} onValueChange={(v) => onYearChange(Number(v))}>
        <SelectTrigger className="w-[100px] bg-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[2024, 2025, 2026].map((y) => (
            <SelectItem key={y} value={String(y)}>{y}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
