import { useEffect, useState } from "react";
import { request } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";

interface ThresholdItem {
  metricType: string;
  level: string;
  minValue: number;
  maxValue: number;
  color: string;
}

interface Hotel {
  id: number;
  name: string;
}

const LEVEL_LABELS: Record<string, string> = { low: "低", medium: "中", high: "高" };
const METRIC_LABELS: Record<string, string> = { occupancy: "出租率", activity: "活动" };

export default function AdminThresholds() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [hotelId, setHotelId] = useState(0);
  const [items, setItems] = useState<ThresholdItem[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    request<{ list: Hotel[] }>("/api/admin/hotels").then((r) => setHotels(r.list ?? []));
  }, []);

  useEffect(() => { load(); }, [hotelId]);

  async function load() {
    const resp = await request<{ list: ThresholdItem[] }>(`/api/admin/thresholds/${hotelId}`);
    setItems(resp.list ?? []);
  }

  function updateItem(idx: number, field: keyof ThresholdItem, value: string | number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, [field]: value } : item));
  }

  async function save() {
    setSaving(true);
    try {
      await request(`/api/admin/thresholds/${hotelId}`, {
        method: "PUT",
        body: JSON.stringify({ hotelId, list: items }),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">阈值配置</h2>
        <Button onClick={save} disabled={saving} className="gap-2">
          <Save className="h-4 w-4" />
          {saving ? "保存中..." : "保存"}
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <Label className="text-sm whitespace-nowrap">选择酒店</Label>
        <Select value={String(hotelId)} onValueChange={(v) => setHotelId(Number(v))}>
          <SelectTrigger className="w-56">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="0">全局默认</SelectItem>
            {hotels.map((h) => (
              <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hotelId !== 0 && (
          <span className="text-xs text-muted-foreground">未单独配置时使用全局默认值</span>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">
            {hotelId === 0 ? "全局默认阈值" : `${hotels.find((h) => h.id === hotelId)?.name ?? ""} 专属阈值`}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>类型</TableHead>
                <TableHead>级别</TableHead>
                <TableHead>最小值</TableHead>
                <TableHead>最大值</TableHead>
                <TableHead>颜色</TableHead>
                <TableHead>预览</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无配置</TableCell></TableRow>
              ) : items.map((item, i) => (
                <TableRow key={i}>
                  <TableCell><Badge variant="outline">{METRIC_LABELS[item.metricType] ?? item.metricType}</Badge></TableCell>
                  <TableCell>{LEVEL_LABELS[item.level] ?? item.level}</TableCell>
                  <TableCell><Input type="number" className="h-8 w-20" value={item.minValue} onChange={(e) => updateItem(i, "minValue", Number(e.target.value))} /></TableCell>
                  <TableCell><Input type="number" className="h-8 w-20" value={item.maxValue} onChange={(e) => updateItem(i, "maxValue", Number(e.target.value))} /></TableCell>
                  <TableCell><Input className="h-8 w-24 font-mono text-xs" value={item.color} onChange={(e) => updateItem(i, "color", e.target.value)} /></TableCell>
                  <TableCell><div className="h-6 w-12 rounded" style={{ backgroundColor: item.color }} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
