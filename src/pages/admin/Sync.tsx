import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { request } from "@/api/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import {
  RefreshCw, Clock, CheckCircle2, XCircle, Save, Bell, ShieldAlert,
  Database, MessageSquare, Smartphone, MessagesSquare, Send,
} from "lucide-react";

// ==========================================================
// Types
// ==========================================================

interface SyncStatus { lastSyncAt: string; status: string; message: string; nextRunAt: string }
interface SyncSchedule { cronExpr: string; enabled: boolean; nextRun: string }

interface UpdateCheckItem {
  hotelId: number;
  hotelName: string;
  checkDate: string;
  isUpdated: boolean;
  recordCount: number;
  notifiedChannels: string;
  notifiedAt: string;
}
interface UpdateCheckResp {
  date: string;
  list: UpdateCheckItem[];
  total: number;
  updated: number;
  missing: number;
}

type Channel = "dingtalk_robot" | "sms" | "dingtalk_ding";
interface NotificationSetting {
  channel: Channel;
  enabled: boolean;
  config: Record<string, unknown>;
  updatedAt: string;
}

// ==========================================================
// Cron helpers
// ==========================================================

type FreqType = "daily" | "weekly" | "monthly" | "interval" | "custom";
const WEEKDAYS = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function parseCronToState(cron: string) {
  const d = { freq: "daily" as FreqType, hour: 6, minute: 0, weekday: 1, monthday: 1, intervalMin: 30, custom: cron };
  if (!cron) return d;
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return { ...d, freq: "custom" as FreqType };
  const [min, hr, dom, , dow] = parts;
  if (min.startsWith("*/") && hr === "*") {
    const n = parseInt(min.slice(2));
    if (!isNaN(n)) return { ...d, freq: "interval" as FreqType, intervalMin: n };
  }
  const m = parseInt(min), h = parseInt(hr);
  if (isNaN(m) || isNaN(h)) return { ...d, freq: "custom" as FreqType };
  if (dom === "*" && dow !== "*") { const x = parseInt(dow); if (!isNaN(x)) return { ...d, freq: "weekly" as FreqType, hour: h, minute: m, weekday: x } }
  if (dom !== "*" && dow === "*") { const x = parseInt(dom); if (!isNaN(x)) return { ...d, freq: "monthly" as FreqType, hour: h, minute: m, monthday: x } }
  if (dom === "*" && dow === "*") return { ...d, freq: "daily" as FreqType, hour: h, minute: m };
  return { ...d, freq: "custom" as FreqType };
}

function buildCron(s: { freq: FreqType; hour: number; minute: number; weekday: number; monthday: number; intervalMin: number; custom: string }) {
  switch (s.freq) {
    case "daily": return `${s.minute} ${s.hour} * * *`;
    case "weekly": return `${s.minute} ${s.hour} * * ${s.weekday}`;
    case "monthly": return `${s.minute} ${s.hour} ${s.monthday} * *`;
    case "interval": return `*/${s.intervalMin} * * * *`;
    case "custom": return s.custom;
  }
}

// ==========================================================
// Components
// ==========================================================

function StatCard({ icon: Icon, label, value, tone = "default" }: { icon: React.ElementType; label: string; value: string | number; tone?: "default" | "good" | "warn" | "bad" }) {
  const tones = {
    default: "bg-muted/50 text-muted-foreground",
    good: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    warn: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    bad: "bg-red-500/10 text-red-600 dark:text-red-400",
  };
  return (
    <div className="flex items-center gap-3 rounded-xl border bg-card p-4">
      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${tones[tone]}`}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-xl font-bold font-display">{value}</div>
      </div>
    </div>
  );
}

// ==========================================================
// Main
// ==========================================================

export default function AdminSync() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold font-display">数据运营</h2>
        <p className="text-sm text-muted-foreground mt-1">同步钉钉 AI 表数据 · 检测未录入酒店 · 多渠道通知提醒</p>
      </div>

      <Tabs defaultValue="sync" className="space-y-4">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="sync" className="gap-1.5"><Database className="h-3.5 w-3.5" />数据同步</TabsTrigger>
          <TabsTrigger value="check" className="gap-1.5"><ShieldAlert className="h-3.5 w-3.5" />更新检测</TabsTrigger>
          <TabsTrigger value="notify" className="gap-1.5"><Bell className="h-3.5 w-3.5" />通知渠道</TabsTrigger>
        </TabsList>

        <TabsContent value="sync" className="space-y-4"><SyncPanel /></TabsContent>
        <TabsContent value="check" className="space-y-4"><CheckPanel /></TabsContent>
        <TabsContent value="notify" className="space-y-4"><NotifyPanel /></TabsContent>
      </Tabs>
    </div>
  );
}

// ==========================================================
// Sync panel (原 Sync 页内容，略微美化)
// ==========================================================

function SyncPanel() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [saving, setSaving] = useState(false);

  const [freq, setFreq] = useState<FreqType>("daily");
  const [hour, setHour] = useState(6);
  const [minute, setMinute] = useState(0);
  const [weekday, setWeekday] = useState(1);
  const [monthday, setMonthday] = useState(1);
  const [intervalMin, setIntervalMin] = useState(30);
  const [custom, setCustom] = useState("");

  const cronExpr = useMemo(
    () => buildCron({ freq, hour, minute, weekday, monthday, intervalMin, custom }),
    [freq, hour, minute, weekday, monthday, intervalMin, custom]
  );

  async function load() {
    const [s, sch] = await Promise.all([
      request<SyncStatus>("/api/admin/sync/status"),
      request<SyncSchedule>("/api/admin/sync/schedule"),
    ]);
    setStatus(s);
    setEnabled(sch.enabled);
    const p = parseCronToState(sch.cronExpr);
    setFreq(p.freq); setHour(p.hour); setMinute(p.minute);
    setWeekday(p.weekday); setMonthday(p.monthday); setIntervalMin(p.intervalMin); setCustom(p.custom);
  }
  useEffect(() => { load(); }, []);

  async function triggerSync() {
    setSyncing(true);
    toast.info("全量同步已触发", { description: "正在拉取钉钉 AI 表数据…" });
    try {
      await request("/api/admin/sync/trigger", { method: "POST" });
      setTimeout(() => { load(); toast.success("同步完成"); }, 2000);
    } catch (e) {
      toast.error("同步失败", { description: e instanceof Error ? e.message : "" });
    } finally {
      setTimeout(() => setSyncing(false), 3000);
    }
  }

  async function saveSchedule() {
    setSaving(true);
    try {
      await request("/api/admin/sync/schedule", { method: "PUT", body: JSON.stringify({ cronExpr, enabled }) });
      await load();
      toast.success("调度配置已保存");
    } catch (e) {
      toast.error("保存失败", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(false); }
  }

  const isSuccess = status?.status === "success";

  return (
    <>
      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={isSuccess ? CheckCircle2 : XCircle} label="上次同步" value={isSuccess ? "成功" : "失败"} tone={isSuccess ? "good" : "bad"} />
        <StatCard icon={Clock} label="最后同步时间" value={status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "—"} />
        <StatCard icon={RefreshCw} label="下次执行" value={status?.nextRunAt ? new Date(status.nextRunAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) : "—"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* 状态卡 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><Clock className="h-4 w-4 text-primary" />同步状态</CardTitle>
            <Button onClick={triggerSync} disabled={syncing} size="sm" className="gap-1.5 h-8">
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? "animate-spin" : ""}`} />
              {syncing ? "同步中…" : "立即同步"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Row label="状态" value={
              <Badge variant={isSuccess ? "default" : "destructive"} className="gap-1">
                {isSuccess ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                {status?.status ?? "—"}
              </Badge>
            } />
            <Row label="最后同步" value={status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString("zh-CN") : "—"} />
            <Row label="下次执行" value={status?.nextRunAt ? new Date(status.nextRunAt).toLocaleString("zh-CN") : "—"} />
            {status?.message && (
              <div className="rounded-md bg-muted/60 px-3 py-2 text-xs text-muted-foreground">{status.message}</div>
            )}
          </CardContent>
        </Card>

        {/* 调度卡 */}
        <Card className="lg:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-sm"><RefreshCw className="h-4 w-4 text-primary" />定时调度</CardTitle>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{enabled ? "已启用" : "已停用"}</span>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label className="text-xs">执行计划</Label>
              <div className="flex flex-wrap gap-1">
                {(["daily","weekly","monthly","interval","custom"] as FreqType[]).map((v) => {
                  const labels = { daily: "每天", weekly: "每周", monthly: "每月", interval: "每N分钟", custom: "自定义" } as const;
                  return (
                    <Button key={v} type="button" size="sm" variant={freq === v ? "default" : "outline"} className="text-xs h-7" disabled={!enabled} onClick={() => setFreq(v)}>
                      {labels[v]}
                    </Button>
                  );
                })}
              </div>
            </div>

            {enabled && (freq === "daily" || freq === "weekly" || freq === "monthly") && (
              <div className="grid gap-3 sm:grid-cols-2">
                {freq === "weekly" && (
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">星期</Label>
                    <Select value={String(weekday)} onValueChange={(v) => setWeekday(+v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{WEEKDAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {freq === "monthly" && (
                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs">日期</Label>
                    <Input type="number" min={1} max={28} value={monthday} onChange={(e) => setMonthday(Math.min(28, Math.max(1, +e.target.value)))} className="h-8" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">时</Label>
                  <Input type="number" min={0} max={23} value={hour} onChange={(e) => setHour(Math.min(23, Math.max(0, +e.target.value)))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">分</Label>
                  <Input type="number" min={0} max={59} value={minute} onChange={(e) => setMinute(Math.min(59, Math.max(0, +e.target.value)))} className="h-8" />
                </div>
              </div>
            )}

            {enabled && freq === "interval" && (
              <div className="space-y-1">
                <Label className="text-xs">间隔（分钟）</Label>
                <Input type="number" min={1} max={1440} value={intervalMin} onChange={(e) => setIntervalMin(Math.min(1440, Math.max(1, +e.target.value)))} className="h-8" />
              </div>
            )}

            {enabled && freq === "custom" && (
              <div className="space-y-1">
                <Label className="text-xs">Cron 表达式</Label>
                <Input value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="0 6 * * *" className="h-8 font-mono text-sm" />
              </div>
            )}

            <div className="rounded-lg border bg-muted/30 px-3 py-2 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">生成：</span>
              <code className="text-xs font-mono font-medium bg-background border px-1.5 py-0.5 rounded">{cronExpr}</code>
            </div>

            <Button onClick={saveSchedule} disabled={saving || !cronExpr} className="w-full gap-2" size="sm">
              <Save className="h-3.5 w-3.5" />{saving ? "保存中…" : "保存调度配置"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

// ==========================================================
// 更新检测 Panel
// ==========================================================

function CheckPanel() {
  const today = new Date().toISOString().slice(0, 10);
  const [date, setDate] = useState(today);
  const [data, setData] = useState<UpdateCheckResp | null>(null);
  const [running, setRunning] = useState(false);

  async function load(d = date) {
    const r = await request<UpdateCheckResp>(`/api/admin/update-checks?date=${d}`);
    setData(r);
  }
  useEffect(() => { load(date); }, [date]);

  async function trigger() {
    setRunning(true);
    toast.info("正在检测…");
    try {
      await request("/api/admin/update-checks/trigger", { method: "POST" });
      await load(today);
      setDate(today);
      toast.success("检测完成", { description: `${data?.missing ?? 0} 家酒店未录入` });
    } catch (e) {
      toast.error("检测失败", { description: e instanceof Error ? e.message : "" });
    } finally { setRunning(false); }
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard icon={Database} label="酒店总数" value={data?.total ?? 0} />
        <StatCard icon={CheckCircle2} label="今日已录入" value={data?.updated ?? 0} tone="good" />
        <StatCard icon={ShieldAlert} label="今日未录入" value={data?.missing ?? 0} tone={data && data.missing > 0 ? "bad" : "good"} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-3">
            <CardTitle className="text-sm">检测结果</CardTitle>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-8 w-[160px] text-xs" />
          </div>
          <Button onClick={trigger} disabled={running} size="sm" className="gap-1.5 h-8">
            <ShieldAlert className={`h-3.5 w-3.5 ${running ? "animate-pulse" : ""}`} />
            {running ? "检测中…" : "立即检测"}
          </Button>
        </CardHeader>
        <CardContent>
          {!data || data.list.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">暂无数据</div>
          ) : (
            <div className="divide-y">
              {data.list.map((h) => (
                <div key={h.hotelId} className="flex items-center justify-between py-2.5">
                  <div className="flex items-center gap-3 min-w-0">
                    {h.isUpdated ? (
                      <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                    ) : (
                      <div className="h-7 w-7 rounded-full bg-red-500/10 flex items-center justify-center shrink-0">
                        <XCircle className="h-4 w-4 text-red-500" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{h.hotelName}</div>
                      <div className="text-xs text-muted-foreground">
                        {h.isUpdated ? `已录入 ${h.recordCount} 条` : "今日未录入"}
                        {h.notifiedChannels && ` · 已通知 ${h.notifiedChannels}`}
                      </div>
                    </div>
                  </div>
                  <Badge variant={h.isUpdated ? "default" : "destructive"} className="shrink-0 text-[10px] h-5">
                    {h.isUpdated ? "已更新" : "未更新"}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}

// ==========================================================
// 通知渠道 Panel
// ==========================================================

const CHANNEL_META: Record<Channel, { label: string; icon: React.ElementType; desc: string; fields: { key: string; label: string; type?: string; placeholder?: string }[] }> = {
  dingtalk_robot: {
    label: "钉钉机器人",
    icon: MessagesSquare,
    desc: "钉钉群自定义机器人 Webhook。需要在钉钉群「智能群助手 → 添加自定义机器人」获得 webhook URL，推荐开启加签模式。",
    fields: [
      { key: "webhookUrl", label: "Webhook URL", placeholder: "https://oapi.dingtalk.com/robot/send?access_token=..." },
      { key: "secret", label: "加签 Secret（推荐）", type: "password", placeholder: "SEC..." },
    ],
  },
  sms: {
    label: "阿里云短信",
    icon: Smartphone,
    desc: "通过阿里云短信服务发送。需要 AccessKey、签名、模板。模板需要配合 Text 参数 JSON。",
    fields: [
      { key: "accessKeyId", label: "AccessKeyId" },
      { key: "accessKeySecret", label: "AccessKeySecret", type: "password" },
      { key: "signName", label: "SignName", placeholder: "会议室运营" },
      { key: "templateCode", label: "TemplateCode", placeholder: "SMS_123456789" },
    ],
  },
  dingtalk_ding: {
    label: "钉钉工作通知",
    icon: MessageSquare,
    desc: "通过企业自建应用发送工作通知（ding 消息）。复用 yaml 里 AppKey/AppSecret，需要填 AgentId。",
    fields: [
      { key: "agentId", label: "AgentId", type: "number", placeholder: "4448144289" },
    ],
  },
};

function NotifyPanel() {
  const [list, setList] = useState<NotificationSetting[]>([]);

  async function load() {
    const r = await request<{ list: NotificationSetting[] }>("/api/admin/notifications");
    setList(r.list);
  }
  useEffect(() => { load(); }, []);

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      {(["dingtalk_robot", "dingtalk_ding", "sms"] as Channel[]).map((ch) => {
        const s = list.find((x) => x.channel === ch);
        return <ChannelCard key={ch} channel={ch} setting={s} onSaved={load} />;
      })}
    </div>
  );
}

function ChannelCard({ channel, setting, onSaved }: { channel: Channel; setting?: NotificationSetting; onSaved: () => void }) {
  const meta = CHANNEL_META[channel];
  const [enabled, setEnabled] = useState(setting?.enabled ?? false);
  const [cfg, setCfg] = useState<Record<string, unknown>>(setting?.config ?? {});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [smsPhone, setSmsPhone] = useState("");

  useEffect(() => {
    setEnabled(setting?.enabled ?? false);
    setCfg(setting?.config ?? {});
  }, [setting]);

  async function save() {
    setSaving(true);
    try {
      await request(`/api/admin/notifications/${channel}`, {
        method: "PUT",
        body: JSON.stringify({ enabled, config: cfg }),
      });
      onSaved();
      toast.success(`${meta.label} 已保存`);
    } catch (e) {
      toast.error("保存失败", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(false); }
  }

  async function sendTest(body?: Record<string, unknown>) {
    setTesting(true);
    try {
      await request(`/api/admin/notifications/${channel}/test`, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      toast.success(`${meta.label} 测试消息已发送`);
    } catch (e) {
      toast.error("测试失败", { description: e instanceof Error ? e.message : "请检查配置" });
    } finally { setTesting(false); }
  }

  function handleTestClick() {
    if (channel === "sms") {
      setSmsPhone("");
      setSmsDialogOpen(true);
      return;
    }
    sendTest();
  }

  function confirmSmsTest() {
    const phone = smsPhone.trim();
    if (!/^1[3-9]\d{9}$/.test(phone)) {
      toast.error("请输入正确的 11 位手机号");
      return;
    }
    setSmsDialogOpen(false);
    sendTest({ phone });
  }

  const Icon = meta.icon;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <Icon className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-sm">{meta.label}</CardTitle>
              <p className="text-[10px] text-muted-foreground mt-0.5">{enabled ? "已启用" : "未启用"}</p>
            </div>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3">
        <p className="text-xs text-muted-foreground leading-relaxed">{meta.desc}</p>
        <div className="space-y-2 flex-1">
          {meta.fields.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label className="text-xs text-muted-foreground">{f.label}</Label>
              <Input
                type={f.type ?? "text"}
                value={String(cfg[f.key] ?? "")}
                onChange={(e) => setCfg((c) => ({ ...c, [f.key]: f.type === "number" ? Number(e.target.value) : e.target.value }))}
                placeholder={f.placeholder}
                className="h-8 text-sm font-mono"
              />
            </div>
          ))}
        </div>
        <div className="flex gap-2 pt-2 border-t">
          <Button onClick={save} disabled={saving} size="sm" className="flex-1 gap-1.5">
            <Save className="h-3.5 w-3.5" />{saving ? "保存中…" : "保存"}
          </Button>
          <Button onClick={handleTestClick} disabled={testing || !enabled} size="sm" variant="outline" className="flex-1 gap-1.5">
            <Send className="h-3.5 w-3.5" />{testing ? "发送中…" : "测试"}
          </Button>
        </div>
      </CardContent>

      {channel === "sms" && (
        <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>发送测试短信</DialogTitle>
              <DialogDescription className="text-xs">
                测试短信按量计费，请输入目标手机号后再发送。模板 TemplateParam 会用
                <code className="mx-1 rounded bg-muted px-1 py-0.5 font-mono">{`{"content": "..."}`}</code>
                格式传入。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">手机号</Label>
              <Input
                type="tel"
                inputMode="numeric"
                value={smsPhone}
                onChange={(e) => setSmsPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
                onKeyDown={(e) => { if (e.key === "Enter") confirmSmsTest(); }}
                placeholder="13800000000"
                className="h-9 font-mono"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" size="sm" onClick={() => setSmsDialogOpen(false)}>取消</Button>
              <Button size="sm" onClick={confirmSmsTest} disabled={testing} className="gap-1.5">
                <Send className="h-3.5 w-3.5" />{testing ? "发送中…" : "发送"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </Card>
  );
}
