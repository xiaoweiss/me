import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { request } from "@/api/client";
import { Users, Hotel, Database, Clock } from "lucide-react";

interface Stats {
  hotelCount: number;
  userCount: number;
  recordCount: number;
  lastSync: string;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    Promise.all([
      request<{ list: unknown[] }>("/api/admin/hotels").then((r) => r.list?.length ?? 0),
      request<{ list: unknown[] }>("/api/admin/users").then((r) => r.list?.length ?? 0),
      request<{ lastSyncAt: string; status: string; message: string }>("/api/admin/sync/status"),
    ]).then(([hotelCount, userCount, syncStatus]) => {
      setStats({
        hotelCount: hotelCount as number,
        userCount: userCount as number,
        recordCount: 0,
        lastSync: syncStatus.lastSyncAt,
      });
    }).catch(() => {});
  }, []);

  const cards = [
    { title: "酒店数", value: stats?.hotelCount ?? "-", icon: Hotel, color: "text-blue-500" },
    { title: "用户数", value: stats?.userCount ?? "-", icon: Users, color: "text-green-500" },
    { title: "最后同步", value: stats?.lastSync ? new Date(stats.lastSync).toLocaleString("zh-CN") : "-", icon: Clock, color: "text-orange-500" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">概览</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold font-display">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
