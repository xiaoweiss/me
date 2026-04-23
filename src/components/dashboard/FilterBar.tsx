import { useState } from "react";
import type { VenueType } from "@/api/types";
import type { UserHotel } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { SlidersHorizontal, X, ChevronsUpDown, Check } from "lucide-react";

interface FilterBarProps {
  venueType: VenueType;
  onVenueTypeChange: (v: VenueType) => void;
  hotels: UserHotel[];
  selectedHotelId: number;
  onHotelChange: (id: number) => void;
}

const venueOptions: { value: VenueType; label: string }[] = [
  { value: "All", label: "全部" },
  { value: "宴会厅 Ballroom", label: "宴会厅" },
  { value: "多功能厅 Function Room", label: "多功能厅" },
  { value: "小型会议室 Meeting Room", label: "会议室" },
];

function Chip({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "ghost"}
      className={cn("h-7 px-3 text-xs shrink-0", !active && "text-muted-foreground")}
      onClick={onClick}
    >
      {label}
    </Button>
  );
}

function HotelCombobox({ hotels, selectedHotelId, onHotelChange }: { hotels: UserHotel[]; selectedHotelId: number; onHotelChange: (id: number) => void }) {
  const [open, setOpen] = useState(false);
  const selectedName = selectedHotelId === 0
    ? "全部酒店"
    : hotels.find((h) => h.id === selectedHotelId)?.name ?? "选择酒店";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 justify-between gap-1 text-xs min-w-[140px] max-w-[220px]">
          <span className="truncate">{selectedName}</span>
          <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="搜索酒店..." className="h-9" />
          <CommandList>
            <CommandEmpty>未找到酒店</CommandEmpty>
            <CommandGroup>
              <CommandItem value="all-hotels" onSelect={() => { onHotelChange(0); setOpen(false); }}>
                <Check className={cn("mr-2 h-4 w-4", selectedHotelId === 0 ? "opacity-100" : "opacity-0")} />
                全部酒店
              </CommandItem>
              {hotels.map((h) => (
                <CommandItem key={h.id} value={h.name} onSelect={() => { onHotelChange(h.id); setOpen(false); }}>
                  <Check className={cn("mr-2 h-4 w-4", selectedHotelId === h.id ? "opacity-100" : "opacity-0")} />
                  {h.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function FilterBar({ venueType, onVenueTypeChange, hotels, selectedHotelId, onHotelChange }: FilterBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const hasActiveFilter = venueType !== "All" || selectedHotelId !== 0;

  return (
    <>
      {/* Desktop */}
      <div className="hidden sm:flex flex-wrap items-center gap-4">
        {hotels.length > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-muted-foreground shrink-0">酒店</span>
            <HotelCombobox hotels={hotels} selectedHotelId={selectedHotelId} onHotelChange={onHotelChange} />
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground shrink-0">场地类型</span>
          <div className="flex gap-1 rounded-lg bg-muted p-1">
            {venueOptions.map((v) => (
              <Chip key={v.value} active={venueType === v.value} label={v.label} onClick={() => onVenueTypeChange(v.value)} />
            ))}
          </div>
        </div>
      </div>

      {/* Mobile */}
      <div className="sm:hidden">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
          筛选
          {hasActiveFilter && <span className="ml-1 h-2 w-2 rounded-full bg-primary" />}
        </Button>
        {mobileOpen && (
          <div className="mt-3 rounded-lg border bg-card p-3 space-y-3">
            {hotels.length > 1 && (
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground">酒店</span>
                <HotelCombobox hotels={hotels} selectedHotelId={selectedHotelId} onHotelChange={onHotelChange} />
              </div>
            )}
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">场地类型</span>
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar">
                {venueOptions.map((v) => (
                  <Chip key={v.value} active={venueType === v.value} label={v.label} onClick={() => onVenueTypeChange(v.value)} />
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
