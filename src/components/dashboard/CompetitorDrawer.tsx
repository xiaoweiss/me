import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Badge } from "@/components/ui/badge";
import { fetchCompetitorDetail } from "@/api/dashboardApi";
import type { CompetitorDetail, TimePeriod } from "@/api/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Building2, Clock, ChevronDown } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";

interface CompetitorDrawerProps {
  date: string | null;
  open: boolean;
  onClose: () => void;
  hotelId: number;
  // 可选 period 过滤：若传 "AM"/"PM"，前端按 activity.period 过滤
  // count 跟着重算，count===0 的酒店整条隐藏；undefined 不过滤
  period?: TimePeriod;
}

const PERIOD_LABEL: Record<string, string> = { AM: "上午", PM: "下午", EV: "晚上" };

function CompetitorContent({ competitors, loading }: { competitors: CompetitorDetail[]; loading: boolean }) {
  if (loading) return <div className="flex items-center justify-center py-12 text-muted-foreground">Loading…</div>;
  if (competitors.length === 0) return <div className="py-8 text-center text-muted-foreground text-sm">暂无竞对数据</div>;

  return (
    <div className="space-y-2">
      {competitors.map((c, i) => (
        <Collapsible key={i}>
          <CollapsibleTrigger className="w-full">
            <div className="flex items-center justify-between rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors group">
              <div className="text-left">
                <p className="font-medium text-sm">{c.hotelName}</p>
                <p className="text-xs text-muted-foreground">{c.activityType || "活动"}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="font-display">×{c.count}</Badge>
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="ml-3 border-l-2 border-border pl-3 py-1 space-y-1">
              {(c.activities ?? []).length === 0 ? (
                <p className="text-xs text-muted-foreground py-1">无详细记录</p>
              ) : (c.activities ?? []).map((act, j) => (
                <div key={j} className="flex items-center gap-2 text-xs py-1.5">
                  <span className="text-foreground font-medium">{act.venueName}</span>
                  <Badge variant="outline" className="text-[10px] h-5 gap-1">
                    <Clock className="h-3 w-3" />
                    {PERIOD_LABEL[act.period] ?? act.period}
                  </Badge>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </Collapsible>
      ))}
    </div>
  );
}

export function CompetitorDrawer({ date, open, onClose, hotelId, period }: CompetitorDrawerProps) {
  const [competitors, setCompetitors] = useState<CompetitorDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!date || !hotelId) return;
    setLoading(true);
    fetchCompetitorDetail(date, hotelId).then((d) => {
      setCompetitors(d);
      setLoading(false);
    });
  }, [date, hotelId]);

  // period 过滤（client-side）：activities 按 period 过滤，count 重算，空酒店剔除
  const filtered = period && (period === "AM" || period === "PM")
    ? competitors
        .map((c) => ({ ...c, activities: (c.activities ?? []).filter((a) => a.period === period) }))
        .map((c) => ({ ...c, count: c.activities.length }))
        .filter((c) => c.count > 0)
    : competitors;

  const formattedDate = date
    ? new Date(date + "T00:00:00").toLocaleDateString("zh-CN", { month: "long", day: "numeric" })
    : "";

  const periodSuffix = period && PERIOD_LABEL[period] ? ` · ${PERIOD_LABEL[period]}` : "";

  const titleContent = (
    <span className="flex items-center gap-2 font-display">
      <Building2 className="h-5 w-5 text-primary" />
      {formattedDate} · 竞对酒店群明细{periodSuffix}
    </span>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && onClose()}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{titleContent}</DrawerTitle>
          </DrawerHeader>
          <div className="overflow-y-auto px-4 pb-6">
            <CompetitorContent competitors={filtered} loading={loading} />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{titleContent}</SheetTitle>
        </SheetHeader>
        <div className="mt-6">
          <CompetitorContent competitors={filtered} loading={loading} />
        </div>
      </SheetContent>
    </Sheet>
  );
}
