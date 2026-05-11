import { useEffect, useMemo, useRef, useState } from "react";
import { request } from "@/api/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp, RotateCcw, Eye, Save, Send, FileText, Clock, Mails, Paperclip, Upload, Copy } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

// ---- Types ----

interface EmailGroup {
  id: number;
  name: string;
  hotelId: number;
  hotelName: string;
  scene: string;
  memberCount: number;
}

interface EmailGroupMember {
  userId: number;
  name: string;
  email: string;
}

interface EmailSchedule {
  id: number;
  groupId: number;
  groupName?: string;
  cronExpr: string;
  enabled: boolean;
}

interface EmailLog {
  id: number;
  scheduleId: number;
  templateId: number;
  templateName: string;
  source: string;
  sourceLabel: string;
  status: string;
  total: number;
  failCount: number;
  retryCount: number;
  sentAt: string;
}


interface Hotel {
  id: number;
  name: string;
}

interface AdminUser {
  id: number;
  name: string;
  email: string;
  status: string;
  hotelIds: number[];
}

// ---- Groups Tab ----

const PAGE_SIZE = 10;

function GroupsTab() {
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [members, setMembers] = useState<EmailGroupMember[]>([]);
  const [sendingKey, setSendingKey] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<EmailGroup | null>(null);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [allUsers, setAllUsers] = useState<AdminUser[]>([]);

  const [formName, setFormName] = useState("");
  const [formHotelId, setFormHotelId] = useState("0");
  const [formScene, setFormScene] = useState("");
  const [formMembers, setFormMembers] = useState<{ userId: number; name: string; email: string }[]>([]);

  // 群发本组
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [sendTargetGroup, setSendTargetGroup] = useState<EmailGroup | null>(null);
  const [sendTemplateId, setSendTemplateId] = useState("0");
  const [sendTemplates, setSendTemplates] = useState<{ id: number; name: string; subject: string }[]>([]);
  const [sendingGroup, setSendingGroup] = useState(false);

  async function openSendDialog(g: EmailGroup) {
    setSendTargetGroup(g);
    setSendTemplateId("0");
    if (sendTemplates.length === 0) {
      const r = await request<{ list: { id: number; name: string; subject: string }[] }>("/api/admin/mail-templates");
      setSendTemplates(r.list ?? []);
    }
    setSendDialogOpen(true);
  }

  async function confirmSendGroup() {
    if (!sendTargetGroup || sendTemplateId === "0") {
      toast.error("请选择邮件模板");
      return;
    }
    setSendingGroup(true);
    try {
      const resp = await request<{ message: string }>(`/api/email/groups/${sendTargetGroup.id}/send`, {
        method: "POST",
        body: JSON.stringify({ templateId: Number(sendTemplateId) }),
      });
      toast.success(resp.message || "已开始异步发送");
      setSendDialogOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "发送失败");
    } finally {
      setSendingGroup(false);
    }
  }

  async function load(p = page, kw = keyword) {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        pageSize: String(PAGE_SIZE),
      });
      if (kw.trim()) params.set("keyword", kw.trim());
      const resp = await request<{ list: EmailGroup[]; total: number } | null>(
        `/api/email/groups?${params.toString()}`,
      );
      setGroups(resp?.list ?? []);
      setTotal(resp?.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(page, keyword); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  async function toggleExpand(id: number) {
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    const resp = await request<{ list: EmailGroupMember[] } | null>(`/api/email/groups/${id}/members`);
    setMembers(resp?.list ?? []);
    setExpandedId(id);
  }

  async function openDialog(group?: EmailGroup) {
    if (hotels.length === 0) {
      const [h, u] = await Promise.all([
        request<{ list: Hotel[] }>("/api/admin/hotels"),
        request<{ list: AdminUser[] }>("/api/admin/users"),
      ]);
      setHotels(h.list ?? []);
      setAllUsers((u.list ?? []).filter((u) => u.status === "active"));
    }

    if (group) {
      setEditGroup(group);
      setFormName(group.name);
      setFormHotelId(String(group.hotelId));
      setFormScene(group.scene);
      const resp = await request<{ list: EmailGroupMember[] } | null>(`/api/email/groups/${group.id}/members`);
      setFormMembers(resp?.list ?? []);
    } else {
      setEditGroup(null);
      setFormName("");
      setFormHotelId("0");
      setFormScene("");
      setFormMembers([]);
    }
    setDialogOpen(true);
  }

  async function saveGroup() {
    const body = {
      name: formName,
      hotelId: Number(formHotelId),
      scene: formScene,
      members: formMembers.map((m) => ({ userId: m.userId, name: m.name, email: m.email })),
    };
    if (editGroup) {
      await request(`/api/email/groups/${editGroup.id}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await request("/api/email/groups", { method: "POST", body: JSON.stringify(body) });
    }
    setDialogOpen(false);
    load(page, keyword);
  }

  async function deleteGroup(id: number) {
    if (!confirm("确定删除该邮件组？")) return;
    await request(`/api/email/groups/${id}`, { method: "DELETE" });
    load(page, keyword);
  }

  function addMember(user: AdminUser) {
    if (formMembers.some((m) => m.userId === user.id)) return;
    setFormMembers((prev) => [...prev, { userId: user.id, name: user.name, email: user.email || "" }]);
  }

  function removeMember(userId: number) {
    setFormMembers((prev) => prev.filter((m) => m.userId !== userId));
  }

  async function sendTestTo(member: EmailGroupMember) {
    if (!member.email) {
      toast.error("该成员未设置邮箱");
      return;
    }
    if (!confirm(`确定向 ${member.email} 发送一封测试邮件？`)) return;
    const key = `${member.userId}-${member.email}`;
    setSendingKey(key);
    try {
      const body: Record<string, unknown> = { email: member.email, name: member.name };
      if (member.userId > 0) body.userId = member.userId;
      const resp = await request<{ message: string }>("/api/email/send-to-user", {
        method: "POST",
        body: JSON.stringify(body),
      });
      toast.success(resp.message || "已发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    } finally {
      setSendingKey(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索名称/场景"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                setPage(1);
                load(1, keyword);
              }
            }}
            className="h-8 w-64 text-sm"
          />
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setPage(1);
              load(1, keyword);
            }}
          >
            搜索
          </Button>
        </div>
        <Button size="sm" className="gap-1" onClick={() => openDialog()}>
          <Plus className="h-3.5 w-3.5" /> 新建邮件组
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>名称</TableHead>
                <TableHead>酒店</TableHead>
                <TableHead>场景</TableHead>
                <TableHead>成员数</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : groups.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">暂无邮件组</TableCell></TableRow>
              ) : groups.map((g) => (
                <>
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell>{g.hotelName || "-"}</TableCell>
                    <TableCell><Badge variant="outline">{g.scene || "-"}</Badge></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="gap-1 h-7 text-xs" onClick={() => toggleExpand(g.id)}>
                        {g.memberCount}
                        {expandedId === g.id ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      </Button>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="default" size="sm" className="h-7 text-xs gap-1" onClick={() => openSendDialog(g)} disabled={g.memberCount === 0}>
                          <Send className="h-3 w-3" /> 发送
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openDialog(g)}>编辑</Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteGroup(g.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                  {expandedId === g.id && (
                    <TableRow key={`${g.id}-members`}>
                      <TableCell colSpan={5} className="bg-muted/50 px-6 py-3">
                        {members.length === 0 ? (
                          <span className="text-xs text-muted-foreground">无成员</span>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {members.map((m) => {
                              const key = `${m.userId}-${m.email}`;
                              return (
                                <div
                                  key={key}
                                  className="inline-flex items-center gap-1 rounded-md border bg-background pl-2 pr-1 py-0.5 text-xs"
                                >
                                  <span className="font-medium">{m.name}</span>
                                  <span className="text-muted-foreground">({m.email || "无邮箱"})</span>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-muted-foreground hover:text-primary"
                                    disabled={!m.email || sendingKey === key}
                                    title={m.email ? "发送测试邮件" : "该成员未设置邮箱"}
                                    onClick={() => sendTestTo(m)}
                                  >
                                    <Send className="h-3 w-3" />
                                  </Button>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))}
            </TableBody>
          </Table>
        </CardContent>
        <div className="flex items-center justify-between px-4 py-3 border-t text-xs text-muted-foreground">
          <span>共 {total} 条 · 第 {page} / {totalPages} 页</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              上一页
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              下一页
            </Button>
          </div>
        </div>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editGroup ? "编辑邮件组" : "新建邮件组"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>名称</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="如：日报收件人" />
            </div>
            <div className="space-y-1">
              <Label>酒店</Label>
              <Select value={formHotelId} onValueChange={setFormHotelId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">不限</SelectItem>
                  {hotels.map((h) => <SelectItem key={h.id} value={String(h.id)}>{h.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>场景</Label>
              <Input value={formScene} onChange={(e) => setFormScene(e.target.value)} placeholder="如：daily_report" />
            </div>
            <div className="space-y-2">
              <Label>成员</Label>
              <div className="flex flex-wrap gap-1 min-h-[32px] rounded-md border p-2">
                {formMembers.map((m) => (
                  <Badge key={m.userId} variant="secondary" className="gap-1 text-xs">
                    {m.name}
                    <button type="button" className="ml-0.5 hover:text-destructive" onClick={() => removeMember(m.userId)}>&times;</button>
                  </Badge>
                ))}
              </div>
              <Select onValueChange={(v) => { const u = allUsers.find((u) => u.id === +v); if (u) addMember(u); }}>
                <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="添加成员..." /></SelectTrigger>
                <SelectContent>
                  {allUsers.filter((u) => !formMembers.some((m) => m.userId === u.id)).map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>{u.name} ({u.email || "无邮箱"})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={saveGroup} disabled={!formName}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 群发邮件 dialog */}
      <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-4 w-4 text-primary" />
              群发邮件 — {sendTargetGroup?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              将发送给该组 {sendTargetGroup?.memberCount ?? 0} 位成员，邮箱去重后并发投递（最多 6 个 SMTP 连接同时打开）。
              结果会异步落到「发送日志」tab，无需在此等待。
            </div>
            <div className="space-y-1">
              <Label className="text-xs">选择发件模板</Label>
              <Select value={sendTemplateId} onValueChange={setSendTemplateId}>
                <SelectTrigger className="h-8"><SelectValue placeholder="请选择邮件模板" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">未选择</SelectItem>
                  {sendTemplates.map((t) => (
                    <SelectItem key={t.id} value={String(t.id)}>{t.name} —— {t.subject}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDialogOpen(false)}>取消</Button>
            <Button onClick={confirmSendGroup} disabled={sendingGroup || sendTemplateId === "0"} className="gap-1.5">
              <Send className="h-3.5 w-3.5" />
              {sendingGroup ? "发送中…" : "确定发送"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Schedules Tab ----

function SchedulesTab() {
  const [schedules, setSchedules] = useState<EmailSchedule[]>([]);
  const [groups, setGroups] = useState<EmailGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formGroupId, setFormGroupId] = useState("");
  const [formCron, setFormCron] = useState("0 8 * * *");
  const [formEnabled, setFormEnabled] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    try {
      const [gResp, sResp] = await Promise.all([
        request<{ list: EmailGroup[] } | null>("/api/email/groups?page=1&pageSize=100"),
        request<{ list: EmailSchedule[] } | null>("/api/email/schedules"),
      ]);
      setGroups(gResp?.list ?? []);
      setSchedules(sResp?.list ?? []);
    } catch { /* ignore */ }
    setLoading(false);
  }

  async function remove(id: number) {
    if (!confirm("确定删除该调度？")) return;
    await request(`/api/email/schedules/${id}`, { method: "DELETE" });
    load();
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setFormGroupId(groups[0]?.id ? String(groups[0].id) : "");
    setFormCron("0 8 * * *");
    setFormEnabled(true);
    setDialogOpen(true);
  }

  function openEdit(s: EmailSchedule) {
    setEditId(s.id);
    setFormGroupId(String(s.groupId));
    setFormCron(s.cronExpr);
    setFormEnabled(s.enabled);
    setDialogOpen(true);
  }

  async function save() {
    const body = { groupId: Number(formGroupId), cronExpr: formCron, enabled: formEnabled };
    if (editId) {
      await request(`/api/email/schedules/${editId}`, { method: "PUT", body: JSON.stringify(body) });
    } else {
      await request("/api/email/schedules", { method: "POST", body: JSON.stringify(body) });
    }
    setDialogOpen(false);
    load();
  }

  const groupName = (gid: number) => groups.find((g) => g.id === gid)?.name ?? `#${gid}`;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button size="sm" className="gap-1" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> 新建调度
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>邮件组</TableHead>
                <TableHead>Cron 表达式</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : schedules.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">暂无调度</TableCell></TableRow>
              ) : schedules.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-mono text-xs">{s.id}</TableCell>
                  <TableCell>{s.groupName || groupName(s.groupId)}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{s.cronExpr}</code></TableCell>
                  <TableCell><Badge variant={s.enabled ? "default" : "secondary"}>{s.enabled ? "启用" : "停用"}</Badge></TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(s)}>编辑</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => remove(s.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑调度" : "新建调度"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>邮件组</Label>
              <Select value={formGroupId} onValueChange={setFormGroupId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {groups.map((g) => <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Cron 表达式</Label>
              <Input value={formCron} onChange={(e) => setFormCron(e.target.value)} placeholder="0 8 * * *" className="font-mono text-sm" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
              <Label>{formEnabled ? "启用" : "停用"}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={save} disabled={!formGroupId || !formCron}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Logs Tab ----

interface RecipientItem {
  id: number;
  email: string;
  status: "sent" | "failed" | string;
  error: string;
  retryCount: number;
  sentAt: string;
}

function LogsTab() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [retryAllRunning, setRetryAllRunning] = useState(false);

  // 抽屉：当前查看的 log 详情（收件人列表）
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeLog, setActiveLog] = useState<EmailLog | null>(null);
  const [recList, setRecList] = useState<RecipientItem[]>([]);
  const [recTotal, setRecTotal] = useState(0);
  const [recPage, setRecPage] = useState(1);
  const recPageSize = 20;
  const [recStatus, setRecStatus] = useState<"" | "sent" | "failed">("");
  const [recLoading, setRecLoading] = useState(false);
  const [retryingRec, setRetryingRec] = useState<number | null>(null);

  async function load(p = page) {
    setLoading(true);
    try {
      const resp = await request<{ list: EmailLog[]; total: number }>(`/api/email/logs?page=${p}&pageSize=20`);
      setLogs(resp.list ?? []);
      setTotal(resp.total ?? 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [page]);

  async function loadRecipients(logId: number, p: number, status: typeof recStatus) {
    setRecLoading(true);
    try {
      const params = new URLSearchParams({ page: String(p), pageSize: String(recPageSize) });
      if (status) params.set("status", status);
      const resp = await request<{ list: RecipientItem[]; total: number }>(`/api/email/logs/${logId}/recipients?${params}`);
      setRecList(resp.list ?? []);
      setRecTotal(resp.total ?? 0);
    } finally { setRecLoading(false); }
  }

  async function openDrawer(l: EmailLog) {
    setActiveLog(l);
    setRecPage(1);
    setRecStatus("");
    setDrawerOpen(true);
    await loadRecipients(l.id, 1, "");
  }

  async function retryRecipient(rec: RecipientItem) {
    if (!activeLog) return;
    setRetryingRec(rec.id);
    try {
      const resp = await request<{ message: string }>(`/api/email/logs/${activeLog.id}/recipients/${rec.id}/retry`, { method: "POST" });
      toast.success(resp.message || "已发起重发");
      // 等后端 goroutine 跑完再刷一下抽屉数据
      setTimeout(() => loadRecipients(activeLog.id, recPage, recStatus), 1500);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重发失败");
    } finally {
      setRetryingRec(null);
    }
  }

  async function retryOne(l: EmailLog) {
    if (!confirm(`重发 ${l.failCount} 个失败邮箱？将使用模板「${l.templateName || `#${l.templateId}`}」`)) return;
    setRetryingId(l.id);
    try {
      await request(`/api/email/logs/${l.id}/retry`, { method: "POST" });
      toast.success("已发起重发，刷新查看新日志");
      await load(1);
      setPage(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重发失败");
    } finally {
      setRetryingId(null);
    }
  }

  async function retryAll() {
    const failedCount = logs.filter((l) => l.failCount > 0 && l.templateId > 0).length;
    if (failedCount === 0) {
      toast.info("当前页没有可重发的失败日志");
      return;
    }
    if (!confirm(`一键重发当前所有 status 为「失败 / 部分失败」的日志？(后端会按 status + template_id > 0 + fail_count > 0 拉取所有，可能不止当前页这 ${failedCount} 条)`)) return;
    setRetryAllRunning(true);
    try {
      const resp = await request<{ message: string }>("/api/email/logs/retry-all-failed", { method: "POST" });
      toast.success(resp.message || "已开始异步重发");
      setTimeout(() => load(1), 1500);
      setPage(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "重发失败");
    } finally {
      setRetryAllRunning(false);
    }
  }

  const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    success: { label: "成功", variant: "default" },
    partial: { label: "部分失败", variant: "secondary" },
    failed: { label: "失败", variant: "destructive" },
  };

  const totalPages = Math.max(1, Math.ceil(total / 20));
  const hasFailedAny = logs.some((l) => l.failCount > 0 && l.templateId > 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-sm text-muted-foreground">
          共 {total} 条日志，当前第 {page}/{totalPages} 页
        </div>
        <Button onClick={retryAll} disabled={retryAllRunning || !hasFailedAny} size="sm" className="gap-1.5" variant="outline">
          <RotateCcw className={`h-3.5 w-3.5 ${retryAllRunning ? "animate-spin" : ""}`} />
          {retryAllRunning ? "重发中…" : "一键重发所有失败"}
        </Button>
      </div>
      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">#</TableHead>
                <TableHead>来源</TableHead>
                <TableHead>模板</TableHead>
                <TableHead>状态</TableHead>
                <TableHead className="text-right">总数</TableHead>
                <TableHead className="text-right">失败</TableHead>
                <TableHead className="text-right">重试</TableHead>
                <TableHead>发送时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">暂无日志</TableCell></TableRow>
              ) : logs.map((l) => {
                const s = STATUS_MAP[l.status] ?? { label: l.status, variant: "secondary" as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{l.id}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-[10px]">{l.sourceLabel || "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      {l.templateName ? (
                        <span className="inline-flex items-center gap-1"><FileText className="h-3 w-3 text-muted-foreground" />{l.templateName}</span>
                      ) : (
                        <span className="text-muted-foreground italic">未知</span>
                      )}
                    </TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell className="text-right tabular-nums">{l.total}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {l.failCount > 0 ? <span className="text-destructive font-medium">{l.failCount}</span> : <span className="text-muted-foreground">0</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{l.retryCount > 0 ? l.retryCount : "—"}</TableCell>
                    <TableCell className="text-xs">{l.sentAt ? new Date(l.sentAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openDrawer(l)}>
                          <Eye className="h-3 w-3" /> 详情
                        </Button>
                        {l.failCount > 0 && l.templateId > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1"
                            disabled={retryingId === l.id}
                            onClick={() => retryOne(l)}
                          >
                            <RotateCcw className={`h-3 w-3 ${retryingId === l.id ? "animate-spin" : ""}`} /> 重发失败
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>上一页</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>下一页</Button>
        </div>
      )}

      {/* 详情抽屉：展示某条 log 的全部收件人 */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              发送详情 {activeLog ? `#${activeLog.id}` : ""}
            </SheetTitle>
            <SheetDescription>
              {activeLog && (
                <>
                  来源 {activeLog.sourceLabel} · 模板「{activeLog.templateName || "—"}」 ·
                  共 {activeLog.total} 封 / 失败 {activeLog.failCount} ·
                  {activeLog.sentAt && ` ${new Date(activeLog.sentAt).toLocaleString("zh-CN")}`}
                </>
              )}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-4 flex gap-1">
            {(["", "sent", "failed"] as const).map((s) => (
              <Button
                key={s || "all"}
                size="sm"
                variant={recStatus === s ? "default" : "outline"}
                className="text-xs h-7"
                onClick={() => {
                  setRecStatus(s);
                  setRecPage(1);
                  if (activeLog) loadRecipients(activeLog.id, 1, s);
                }}
              >
                {s === "" ? "全部" : s === "sent" ? "成功" : "失败"}
              </Button>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {recLoading ? (
              <p className="py-8 text-center text-sm text-muted-foreground">加载中…</p>
            ) : recList.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">暂无</p>
            ) : recList.map((rec) => (
              <div key={rec.id || rec.email} className="rounded border bg-card px-3 py-2 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-mono truncate">{rec.email}</span>
                    <Badge variant={rec.status === "sent" ? "default" : "destructive"} className="text-[10px] h-4">
                      {rec.status === "sent" ? "成功" : "失败"}
                    </Badge>
                    {rec.retryCount > 0 && (
                      <Badge variant="outline" className="text-[10px] h-4">已重发 {rec.retryCount}</Badge>
                    )}
                  </div>
                  {rec.error && <div className="text-xs text-destructive break-all">{rec.error}</div>}
                  {rec.sentAt && (
                    <div className="text-[10px] text-muted-foreground">{new Date(rec.sentAt).toLocaleString("zh-CN")}</div>
                  )}
                </div>
                {rec.id > 0 && activeLog && activeLog.templateId > 0 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 shrink-0"
                    disabled={retryingRec === rec.id}
                    onClick={() => retryRecipient(rec)}
                  >
                    <RotateCcw className={`h-3 w-3 ${retryingRec === rec.id ? "animate-spin" : ""}`} />
                    重发
                  </Button>
                )}
              </div>
            ))}
          </div>

          {recTotal > recPageSize && (
            <div className="mt-4 flex items-center justify-center gap-2">
              <Button variant="outline" size="sm" disabled={recPage <= 1} onClick={() => {
                const p = recPage - 1;
                setRecPage(p);
                if (activeLog) loadRecipients(activeLog.id, p, recStatus);
              }}>上一页</Button>
              <span className="text-xs text-muted-foreground">
                {recPage} / {Math.ceil(recTotal / recPageSize)}（共 {recTotal} 条）
              </span>
              <Button variant="outline" size="sm" disabled={recPage * recPageSize >= recTotal} onClick={() => {
                const p = recPage + 1;
                setRecPage(p);
                if (activeLog) loadRecipients(activeLog.id, p, recStatus);
              }}>下一页</Button>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ---- SMTP Settings Tab ----

interface MailSetting {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  fromName: string;
}

function SmtpTab() {
  const [setting, setSetting] = useState<MailSetting>({ smtpHost: "", smtpPort: 465, username: "", password: "", fromName: "" });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    request<MailSetting>("/api/admin/mail-setting")
      .then((s) => setSetting({ ...s, password: "" }))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, []);

  async function save() {
    setSaving(true);
    try {
      await request("/api/admin/mail-setting", { method: "PUT", body: JSON.stringify(setting) });
      toast.success("发件配置已保存");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function testSelf() {
    if (!setting.username) {
      toast.error("请先填写用户名（发件邮箱）");
      return;
    }
    setTesting(true);
    try {
      const resp = await request<{ message: string }>("/api/email/send-to-user", {
        method: "POST",
        body: JSON.stringify({ email: setting.username, name: setting.fromName || setting.username }),
      });
      toast.success(resp.message || "已发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    } finally {
      setTesting(false);
    }
  }

  if (!loaded) return <p className="text-sm text-muted-foreground py-8 text-center">加载中...</p>;

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle className="text-sm">SMTP 发件配置</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label>SMTP 服务器</Label>
            <Input value={setting.smtpHost} onChange={(e) => setSetting((s) => ({ ...s, smtpHost: e.target.value }))} placeholder="smtp.qiye.aliyun.com" />
          </div>
          <div className="space-y-1">
            <Label>端口</Label>
            <Input type="number" value={setting.smtpPort} onChange={(e) => setSetting((s) => ({ ...s, smtpPort: +e.target.value }))} placeholder="465" />
          </div>
        </div>
        <div className="space-y-1">
          <Label>用户名（发件邮箱）</Label>
          <Input value={setting.username} onChange={(e) => setSetting((s) => ({ ...s, username: e.target.value }))} placeholder="noreply@example.com" />
        </div>
        <div className="space-y-1">
          <Label>密码 / 授权码</Label>
          <Input type="password" value={setting.password} onChange={(e) => setSetting((s) => ({ ...s, password: e.target.value }))} placeholder="留空则不修改" />
        </div>
        <div className="space-y-1">
          <Label>发件人名称</Label>
          <Input value={setting.fromName} onChange={(e) => setSetting((s) => ({ ...s, fromName: e.target.value }))} placeholder="会议室运营平台" />
        </div>
        <div className="flex gap-2">
          <Button onClick={save} disabled={saving} className="flex-1 gap-2">
            <Save className="h-3.5 w-3.5" />
            {saving ? "保存中..." : "保存配置"}
          </Button>
          <Button onClick={testSelf} disabled={testing} variant="outline" className="gap-2">
            <Send className="h-3.5 w-3.5" />
            {testing ? "发送中..." : "发测试邮件给自己"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          使用当前<strong>已保存</strong>的配置，发送一封测试邮件到上面填写的发件邮箱。
          如果报 526/535 等错误，通常是授权码/密码不对，或邮箱未开启 SMTP 服务。
        </p>
      </CardContent>
    </Card>
  );
}

// ---- Templates Tab ----

interface MailTemplate {
  id: number;
  name: string;
  subject: string;
  body: string;
  description: string;
}

interface TemplateAttachment {
  id: number;
  originalName: string;
  cid: string;
  size: number;
  mimeType: string;
  sortOrder: number;
}

const TEMPLATE_VARS = [
  { key: "{{.HotelName}}", desc: "酒店名称" },
  { key: "{{.Date}}", desc: "日期" },
  { key: "{{.OccupancyRate}}", desc: "综合出租率" },
  { key: "{{.AM}}", desc: "上午出租率" },
  { key: "{{.PM}}", desc: "下午出租率" },
  { key: "{{.CompRate}}", desc: "竞对均值" },
  { key: "{{.MarketRate}}", desc: "商圈均值" },
  { key: "{{.DashboardImage}}", desc: "本月日历图(PNG, 嵌入正文; 用 <img src=\"{{.DashboardImage}}\">)" },
  { key: "{{.DashboardPDF}}", desc: "本月日历 PDF(当附件发, 模板里写一句即触发,文本展开为空)" },
];

const BUILTIN_TEMPLATES: Array<{ name: string; description: string; subject: string; body: string }> = [
  {
    name: "daily_report",
    description: "会议室运营日报（含 KPI 卡片 + 市场对标）",
    subject: "【{{.HotelName}}】{{.Date}} 会议室运营日报",
    body: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f7fa;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2937;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:28px 32px;background:#1e3a8a;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:0.5px;opacity:0.85;">STI Report · 会议室运营日报</div>
          <div style="font-size:22px;font-weight:600;margin-top:4px;">{{.HotelName}}</div>
          <div style="font-size:13px;margin-top:8px;opacity:0.85;">报告日期：{{.Date}}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 32px 8px 32px;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:12px;">综合表现</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
            <tr>
              <td width="33%" align="center" style="padding:18px 8px;background:#eff6ff;border-radius:8px;">
                <div style="font-size:12px;color:#6b7280;">综合出租率</div>
                <div style="font-size:26px;font-weight:700;color:#1e40af;margin-top:4px;">{{.OccupancyRate}}</div>
              </td>
              <td width="2%">&nbsp;</td>
              <td width="32%" align="center" style="padding:18px 8px;background:#fef9c3;border-radius:8px;">
                <div style="font-size:12px;color:#6b7280;">上午</div>
                <div style="font-size:22px;font-weight:600;color:#b45309;margin-top:4px;">{{.AM}}</div>
              </td>
              <td width="2%">&nbsp;</td>
              <td width="31%" align="center" style="padding:18px 8px;background:#dcfce7;border-radius:8px;">
                <div style="font-size:12px;color:#6b7280;">下午</div>
                <div style="font-size:22px;font-weight:600;color:#047857;margin-top:4px;">{{.PM}}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 32px 8px 32px;">
          <div style="font-size:13px;color:#6b7280;margin-bottom:12px;">市场对标</div>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="border:1px solid #e5e7eb;border-radius:8px;">
            <tr>
              <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">本酒店综合出租率</td>
              <td align="right" style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;font-weight:600;color:#1e40af;">{{.OccupancyRate}}</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:13px;color:#374151;">竞对均值</td>
              <td align="right" style="padding:14px 16px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#374151;">{{.CompRate}}</td>
            </tr>
            <tr>
              <td style="padding:14px 16px;font-size:13px;color:#374151;">商圈均值</td>
              <td align="right" style="padding:14px 16px;font-size:14px;color:#374151;">{{.MarketRate}}</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 32px;font-size:13px;line-height:1.7;color:#4b5563;">
          <p style="margin:0;">{{.UserName}} 您好，</p>
          <p style="margin:10px 0 0 0;">以上为 <strong>{{.HotelName}}</strong> 在 <strong>{{.Date}}</strong> 的会议室运营数据。综合出租率为 <strong style="color:#1e40af;">{{.OccupancyRate}}</strong>，请关注与竞对／商圈均值的差距，及时调整销售策略。</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
          本邮件由会议室运营平台自动发送，请勿直接回复
        </td>
      </tr>
    </table>
    <div style="font-size:11px;color:#9ca3af;margin-top:12px;">© STI Report · {{.Date}}</div>
  </td></tr>
</table>`,
  },
  {
    name: "daily_report_with_image",
    description: "带日历图的日报(图片由 PC 看板「保存」上传)",
    subject: "【{{.HotelName}}】{{.Date}} 看板日报",
    body: `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background:#f5f7fa;padding:24px 0;font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;color:#1f2937;">
  <tr><td align="center">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" style="max-width:600px;background:#ffffff;border-radius:12px;overflow:hidden;">
      <tr>
        <td style="padding:24px 28px;background:#1e3a8a;color:#ffffff;">
          <div style="font-size:13px;letter-spacing:0.5px;opacity:0.85;">STI Report · 看板日报</div>
          <div style="font-size:20px;font-weight:600;margin-top:4px;">{{.HotelName}} · {{.Date}}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:20px 28px;text-align:center;">
          <img src="{{.DashboardImage}}" alt="本月日历看板" style="max-width:100%;height:auto;border:1px solid #e5e7eb;border-radius:8px;" />
        </td>
      </tr>
      <tr>
        <td style="padding:8px 28px 20px 28px;font-size:13px;line-height:1.7;color:#4b5563;">
          <p style="margin:0;">{{.UserName}} 您好,以上为 <strong>{{.HotelName}}</strong> 在 <strong>{{.Date}}</strong> 的看板截图。综合出租率 <strong style="color:#1e40af;">{{.OccupancyRate}}</strong>(竞对 {{.CompRate}} / 商圈 {{.MarketRate}})。</p>
        </td>
      </tr>
      <tr>
        <td style="padding:18px 28px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#9ca3af;text-align:center;">
          本邮件由会议室运营平台自动发送,图片由酒店对接人在 PC 端「保存」生成
        </td>
      </tr>
    </table>
  </td></tr>
</table>`,
  },
];

function TemplatesTab() {
  const [templates, setTemplates] = useState<MailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [saving, setSaving] = useState(false);
  const [attachments, setAttachments] = useState<TemplateAttachment[]>([]);
  const [uploadingAtt, setUploadingAtt] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadAttachments(tplId: number) {
    try {
      const resp = await request<{ list: TemplateAttachment[] }>(`/api/admin/mail-templates/${tplId}/attachments`);
      setAttachments(resp.list ?? []);
    } catch {
      setAttachments([]);
    }
  }

  // 给新建模板自动 silent-save 拿到 id;返回 templateId 或 null
  async function ensureTemplateId(): Promise<number | null> {
    if (editId) return editId;
    if (!formName.trim()) {
      toast.error("请先填写「模板标识」");
      return null;
    }
    if (!formSubject.trim()) {
      toast.error("请先填写「邮件主题」");
      return null;
    }
    try {
      const body = { name: formName, subject: formSubject, body: formBody, description: formDesc };
      await request("/api/admin/mail-templates", { method: "POST", body: JSON.stringify(body) });
      const resp = await request<{ list: MailTemplate[] }>("/api/admin/mail-templates");
      const created = (resp.list ?? []).find((t) => t.name === formName);
      if (!created) {
        toast.error("自动保存模板失败,请手动点保存后再上传");
        return null;
      }
      setEditId(created.id);
      setAttachments([]);
      load(); // 刷新外层列表
      return created.id;
    } catch (err) {
      toast.error(err instanceof Error ? `保存模板失败: ${err.message}` : "保存模板失败");
      return null;
    }
  }

  async function uploadAttachment(file: File) {
    if (file.size > 20 * 1024 * 1024) {
      toast.error(`${file.name} 超过 20MB 上限`);
      return;
    }
    setUploadingAtt(true);
    try {
      const tplId = await ensureTemplateId();
      if (!tplId) return;
      const fd = new FormData();
      fd.append("file", file);
      const token = localStorage.getItem("auth_token");
      const apiBase = import.meta.env.DEV ? "" : (import.meta.env.VITE_API_BASE_URL as string || "");
      const res = await fetch(`${apiBase}/api/admin/mail-templates/${tplId}/attachments`, {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: fd,
      });
      if (!res.ok) throw new Error(await res.text() || `HTTP ${res.status}`);
      await loadAttachments(tplId);
      toast.success(`已上传 ${file.name}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "上传失败");
    } finally {
      setUploadingAtt(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function deleteAttachment(attId: number, name: string) {
    if (!editId) return;
    if (!confirm(`确认删除附件「${name}」?`)) return;
    try {
      await request(`/api/admin/mail-templates/${editId}/attachments/${attId}`, { method: "DELETE" });
      await loadAttachments(editId);
      toast.success("已删除");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  function copyCid(cid: string) {
    const ref = `cid:${cid}`;
    navigator.clipboard.writeText(ref);
    toast.success(`已复制 ${ref}`);
  }

  function formatBytes(n: number): string {
    if (n < 1024) return `${n}B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
    return `${(n / 1024 / 1024).toFixed(1)}MB`;
  }

  async function load() {
    setLoading(true);
    try {
      const resp = await request<{ list: MailTemplate[] }>("/api/admin/mail-templates");
      setTemplates(resp.list ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setFormName("");
    setFormSubject("");
    setFormBody("");
    setFormDesc("");
    setAttachments([]);
    setDialogOpen(true);
  }

  function openFromBuiltin(t: typeof BUILTIN_TEMPLATES[number]) {
    setEditId(null);
    setFormName(t.name);
    setFormDesc(t.description);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setAttachments([]);
    setDialogOpen(true);
  }

  function openEdit(t: MailTemplate) {
    setEditId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setFormDesc(t.description);
    setAttachments([]);
    loadAttachments(t.id);
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = { name: formName, subject: formSubject, body: formBody, description: formDesc };
      if (editId) {
        // 已存在(可能是初次上传附件时 silent-save 进的) → PUT 更新所有字段
        await request(`/api/admin/mail-templates/${editId}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await request("/api/admin/mail-templates", { method: "POST", body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      toast.success("模板已保存");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  }

  async function deleteTpl(id: number) {
    if (!confirm("确定删除该模板？")) return;
    try {
      await request(`/api/admin/mail-templates/${id}`, { method: "DELETE" });
      toast.success("模板已删除");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "删除失败");
    }
  }

  async function testConnectivity() {
    const email = prompt("发送一封不带模板的连通性测试邮件到：", "");
    if (email === null) return;
    const target = email.trim();
    if (!target) {
      toast.error("请输入收件邮箱");
      return;
    }
    try {
      const resp = await request<{ message: string }>("/api/email/send-to-user", {
        method: "POST",
        body: JSON.stringify({ email: target }),
      });
      toast.success(resp.message || "已发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    }
  }

  async function testTemplate(t: MailTemplate) {
    const email = prompt(`使用模板 [${t.name}] 发送测试邮件到：`, "");
    if (email === null) return;
    const target = email.trim();
    if (!target) {
      toast.error("请输入收件邮箱");
      return;
    }
    try {
      const resp = await request<{ message: string }>("/api/email/send-to-user", {
        method: "POST",
        body: JSON.stringify({ email: target, templateName: t.name }),
      });
      toast.success(resp.message || "已发送");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "发送失败");
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Button size="sm" variant="outline" className="gap-1" onClick={testConnectivity}>
          <Send className="h-3.5 w-3.5" /> 测试 SMTP 连通性
        </Button>
        <div className="flex gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1">
                <FileText className="h-3.5 w-3.5" /> 从示例创建 <ChevronDown className="h-3 w-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {BUILTIN_TEMPLATES.map((t) => (
                <DropdownMenuItem key={t.name} onClick={() => openFromBuiltin(t)}>
                  {t.description}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" className="gap-1" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> 新建模板
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>标识</TableHead>
                <TableHead>邮件主题</TableHead>
                <TableHead>说明</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : templates.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">暂无模板</TableCell></TableRow>
              ) : templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{t.name}</code></TableCell>
                  <TableCell className="text-sm">{t.subject}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{t.description || "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => testTemplate(t)} title="使用此模板发送测试邮件">
                        <Send className="h-3 w-3" /> 测试
                      </Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => openEdit(t)}>编辑</Button>
                      <Button variant="ghost" size="sm" className="h-7 text-xs text-destructive" onClick={() => deleteTpl(t.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑模板" : "新建模板"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>模板标识</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="daily_report" disabled={!!editId} />
              </div>
              <div className="space-y-1">
                <Label>说明</Label>
                <Input value={formDesc} onChange={(e) => setFormDesc(e.target.value)} placeholder="每日运营日报模板" />
              </div>
            </div>
            <div className="space-y-1">
              <Label>邮件主题</Label>
              <Input value={formSubject} onChange={(e) => setFormSubject(e.target.value)} placeholder="【{{.HotelName}}】{{.Date}} 会议室运营日报" className="font-mono text-sm" />
            </div>
            <div className="space-y-1">
              <Label>邮件正文（HTML）</Label>
              <textarea
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                value={formBody}
                onChange={(e) => setFormBody(e.target.value)}
                placeholder="<h2>{{.HotelName}} 运营日报</h2>..."
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1">
                  <Paperclip className="h-3.5 w-3.5" /> 附件(图片 / PDF, 单文件 ≤ 20MB,总和 ≤ 50MB)
                </Label>
                <div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadAttachment(f); }}
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1 h-7 text-xs"
                    disabled={uploadingAtt}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-3 w-3" />
                    {uploadingAtt ? "上传中..." : "上传文件"}
                  </Button>
                </div>
              </div>
              {attachments.length === 0 ? (
                <p className="text-xs text-muted-foreground italic">
                  {editId
                    ? "暂无附件。上传后:图片可在 HTML 里用 "
                    : "暂无附件。点上传时会自动保存模板,然后上传文件;图片可在 HTML 里用 "}
                  <code className="px-1 bg-muted rounded">cid:文件名</code> 引用;不引用就当附件挂着
                </p>
              ) : (
                <div className="space-y-1 rounded-md border p-2 bg-card">
                  {attachments.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 text-xs py-1">
                      <Paperclip className="h-3 w-3 text-muted-foreground shrink-0" />
                      <span className="truncate flex-1 min-w-0" title={a.originalName}>{a.originalName}</span>
                      <span className="text-muted-foreground shrink-0 tabular-nums">{formatBytes(a.size)}</span>
                      <code
                        className="px-1 bg-muted rounded font-mono cursor-pointer hover:bg-muted-foreground/10 shrink-0"
                        title="点击复制"
                        onClick={() => copyCid(a.cid)}
                      >
                        cid:{a.cid}
                      </code>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => copyCid(a.cid)} title="复制 cid 引用">
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button type="button" variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteAttachment(a.id, a.originalName)} title="删除附件">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-md bg-muted p-3">
              <p className="text-xs font-medium mb-2">可用变量：</p>
              <div className="flex flex-wrap gap-2">
                {TEMPLATE_VARS.map((v) => (
                  <Badge key={v.key} variant="outline" className="text-xs font-mono cursor-pointer" onClick={() => {
                    navigator.clipboard.writeText(v.key);
                  }}>
                    {v.key} <span className="ml-1 text-muted-foreground font-sans">{v.desc}</span>
                  </Badge>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving || !formName || !formSubject}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---- Main Page ----

// ---- Blast (全员群发) Tab ----

type BlastFreq = "daily" | "weekly" | "monthly" | "custom";
const WEEKDAY_LABEL = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

function parseBlastCron(cron: string) {
  const def = { freq: "daily" as BlastFreq, second: 0, minute: 0, hour: 8, weekday: 1, monthday: 1, custom: cron };
  if (!cron) return def;
  const p = cron.trim().split(/\s+/);
  let sec: string, min: string, hr: string, dom: string, dow: string;
  if (p.length === 6) [sec, min, hr, dom, , dow] = p;
  else if (p.length === 5) { [min, hr, dom, , dow] = p; sec = "0"; }
  else return { ...def, freq: "custom" as BlastFreq };
  const s = +sec, m = +min, h = +hr;
  if (isNaN(s) || isNaN(m) || isNaN(h)) return { ...def, freq: "custom" as BlastFreq };
  if (dom === "*" && dow !== "*") { const x = +dow; if (!isNaN(x)) return { ...def, freq: "weekly", second: s, minute: m, hour: h, weekday: x }; }
  if (dom !== "*" && dow === "*") { const x = +dom; if (!isNaN(x)) return { ...def, freq: "monthly", second: s, minute: m, hour: h, monthday: x }; }
  if (dom === "*" && dow === "*") return { ...def, freq: "daily", second: s, minute: m, hour: h };
  return { ...def, freq: "custom" as BlastFreq };
}
function buildBlastCron(s: { freq: BlastFreq; second: number; minute: number; hour: number; weekday: number; monthday: number; custom: string }) {
  switch (s.freq) {
    case "daily": return `${s.second} ${s.minute} ${s.hour} * * *`;
    case "weekly": return `${s.second} ${s.minute} ${s.hour} * * ${s.weekday}`;
    case "monthly": return `${s.second} ${s.minute} ${s.hour} ${s.monthday} * *`;
    case "custom": return s.custom;
  }
}

interface BlastSchedule {
  id: number;
  name: string;
  cronExpr: string;
  templateId: number;
  enabled: boolean;
  nextRun: string;
  lastRunAt: string;
}

function BlastTab() {
  const [schedules, setSchedules] = useState<BlastSchedule[]>([]);
  const [templates, setTemplates] = useState<{ id: number; name: string; subject: string }[]>([]);
  const [recipientCount, setRecipientCount] = useState<number>(0);
  const [loading, setLoading] = useState(false);

  // dialog state (新建 + 编辑共用)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formEnabled, setFormEnabled] = useState(true);
  const [formTemplateId, setFormTemplateId] = useState("0");
  const [formFreq, setFormFreq] = useState<BlastFreq>("daily");
  const [formSecond, setFormSecond] = useState(0);
  const [formMinute, setFormMinute] = useState(0);
  const [formHour, setFormHour] = useState(9);
  const [formWeekday, setFormWeekday] = useState(1);
  const [formMonthday, setFormMonthday] = useState(1);
  const [formCustom, setFormCustom] = useState("");
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<number | null>(null);

  const formCronExpr = useMemo(
    () => buildBlastCron({ freq: formFreq, second: formSecond, minute: formMinute, hour: formHour, weekday: formWeekday, monthday: formMonthday, custom: formCustom }),
    [formFreq, formSecond, formMinute, formHour, formWeekday, formMonthday, formCustom]
  );

  async function load() {
    setLoading(true);
    try {
      const [list, tpls, users] = await Promise.all([
        request<{ list: BlastSchedule[] }>("/api/admin/mail-blast/schedules"),
        request<{ list: { id: number; name: string; subject: string }[] }>("/api/admin/mail-templates"),
        request<{ list: { id: number; email: string; status: string }[] }>("/api/admin/users"),
      ]);
      setSchedules(list.list ?? []);
      setTemplates(tpls.list ?? []);
      const recipients = (users.list ?? []).filter((u) => u.email && u.status === "active");
      setRecipientCount(recipients.length);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setFormName("");
    setFormEnabled(true);
    setFormTemplateId("0");
    setFormFreq("daily");
    setFormSecond(0); setFormMinute(0); setFormHour(9);
    setFormWeekday(1); setFormMonthday(1); setFormCustom("0 0 9 * * *");
    setDialogOpen(true);
  }

  function openEdit(s: BlastSchedule) {
    setEditId(s.id);
    setFormName(s.name);
    setFormEnabled(s.enabled);
    setFormTemplateId(String(s.templateId || 0));
    const p = parseBlastCron(s.cronExpr || "0 0 9 * * *");
    setFormFreq(p.freq); setFormSecond(p.second); setFormMinute(p.minute); setFormHour(p.hour);
    setFormWeekday(p.weekday); setFormMonthday(p.monthday); setFormCustom(p.custom);
    setDialogOpen(true);
  }

  async function save() {
    if (!formName.trim()) { toast.error("请填写任务名"); return; }
    if (formEnabled && Number(formTemplateId) === 0) { toast.error("启用前请先选择邮件模板"); return; }
    setSaving(true);
    try {
      const body = {
        name: formName.trim(),
        cronExpr: formCronExpr,
        templateId: Number(formTemplateId),
        enabled: formEnabled,
      };
      if (editId) {
        await request(`/api/admin/mail-blast/schedules/${editId}`, { method: "PUT", body: JSON.stringify(body) });
        toast.success("已保存");
      } else {
        await request("/api/admin/mail-blast/schedules", { method: "POST", body: JSON.stringify(body) });
        toast.success("已新建");
      }
      setDialogOpen(false);
      load();
    } catch (e) {
      toast.error("保存失败", { description: e instanceof Error ? e.message : "" });
    } finally { setSaving(false); }
  }

  async function del(s: BlastSchedule) {
    if (!confirm(`确定删除任务「${s.name}」?`)) return;
    try {
      await request(`/api/admin/mail-blast/schedules/${s.id}`, { method: "DELETE" });
      toast.success("已删除");
      load();
    } catch (e) {
      toast.error("删除失败", { description: e instanceof Error ? e.message : "" });
    }
  }

  async function trigger(s: BlastSchedule) {
    if (s.templateId === 0) { toast.error("该任务未选模板,无法触发"); return; }
    setRunning(s.id);
    try {
      const res = await request<{ status: string; total: number; failCount: number }>(`/api/admin/mail-blast/schedules/${s.id}/trigger`, { method: "POST" });
      toast.success(`「${s.name}」群发完成: 共 ${res.total} / 失败 ${res.failCount} / ${res.status}`);
      load();
    } catch (e) {
      toast.error("群发失败", { description: e instanceof Error ? e.message : "" });
    } finally { setRunning(null); }
  }

  const tplName = (id: number) => templates.find((t) => t.id === id)?.name || (id ? `#${id}` : "未选择");

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground flex items-center justify-between flex-wrap gap-2">
        <span>
          收件人:所有 status=active 且填写了邮箱的用户(去重)。当前匹配 <span className="text-foreground font-medium">{recipientCount}</span> 人。
          每条任务独立 cron + 模板;30 秒同一任务防抖。
        </span>
        <Button size="sm" className="gap-1 h-7 text-xs" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> 新增定时任务
        </Button>
      </div>

      {loading && schedules.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">加载中...</CardContent></Card>
      ) : schedules.length === 0 ? (
        <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">还没有定时任务,点右上「新增定时任务」创建</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {schedules.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3 flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      <Mails className="h-4 w-4 text-primary" /> {s.name || `#${s.id}`}
                    </CardTitle>
                    <Badge variant={s.enabled ? "default" : "secondary"} className="text-[10px]">
                      {s.enabled ? "已启用" : "已停用"}
                    </Badge>
                    {s.nextRun && (
                      <Badge variant="outline" className="text-[10px] gap-1">
                        <Clock className="h-3 w-3" />下次:{new Date(s.nextRun).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    )}
                    {s.lastRunAt && (
                      <Badge variant="secondary" className="text-[10px]">
                        上次:{new Date(s.lastRunAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>模板:<span className="text-foreground">{tplName(s.templateId)}</span></span>
                    <code className="font-mono bg-muted px-1.5 py-0.5 rounded">{s.cronExpr}</code>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" disabled={running === s.id} onClick={() => trigger(s)}>
                    <Send className={`h-3 w-3 ${running === s.id ? "animate-pulse" : ""}`} /> {running === s.id ? "发送中" : "试发"}
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => openEdit(s)}>编辑</Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={() => del(s)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑定时任务" : "新增定时任务"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-xs">任务名 *</Label>
              <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="如:9am 看板图日报" className="h-8" />
            </div>

            <div className="space-y-1">
              <Label className="text-xs">邮件模板 *</Label>
              <Select value={formTemplateId} onValueChange={setFormTemplateId}>
                <SelectTrigger className="h-8"><SelectValue placeholder="选择模板" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">未选择</SelectItem>
                  {templates.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name} —— {t.subject}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">执行计划</Label>
              <div className="flex flex-wrap gap-1">
                {(["daily", "weekly", "monthly", "custom"] as BlastFreq[]).map((v) => {
                  const lbl = { daily: "每天", weekly: "每周", monthly: "每月", custom: "自定义" } as const;
                  return (
                    <Button key={v} type="button" size="sm" variant={formFreq === v ? "default" : "outline"} className="text-xs h-7" onClick={() => setFormFreq(v)}>
                      {lbl[v]}
                    </Button>
                  );
                })}
              </div>
            </div>

            {(formFreq === "daily" || formFreq === "weekly" || formFreq === "monthly") && (
              <div className="grid gap-3 sm:grid-cols-3">
                {formFreq === "weekly" && (
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">星期</Label>
                    <Select value={String(formWeekday)} onValueChange={(v) => setFormWeekday(+v)}>
                      <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                      <SelectContent>{WEEKDAY_LABEL.map((d, i) => <SelectItem key={i} value={String(i)}>{d}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                )}
                {formFreq === "monthly" && (
                  <div className="space-y-1 sm:col-span-3">
                    <Label className="text-xs">日期</Label>
                    <Input type="number" min={1} max={28} value={formMonthday} onChange={(e) => setFormMonthday(Math.min(28, Math.max(1, +e.target.value)))} className="h-8" />
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">时</Label>
                  <Input type="number" min={0} max={23} value={formHour} onChange={(e) => setFormHour(Math.min(23, Math.max(0, +e.target.value)))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">分</Label>
                  <Input type="number" min={0} max={59} value={formMinute} onChange={(e) => setFormMinute(Math.min(59, Math.max(0, +e.target.value)))} className="h-8" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">秒</Label>
                  <Input type="number" min={0} max={59} value={formSecond} onChange={(e) => setFormSecond(Math.min(59, Math.max(0, +e.target.value)))} className="h-8" />
                </div>
              </div>
            )}

            {formFreq === "custom" && (
              <div className="space-y-1">
                <Label className="text-xs">Cron 表达式(5 段或 6 段都支持,6 段第一位是秒)</Label>
                <Input value={formCustom} onChange={(e) => setFormCustom(e.target.value)} placeholder="0 0 8 * * *" className="h-8 font-mono text-sm" />
              </div>
            )}

            <div className="rounded-md bg-muted px-2 py-1.5 flex items-center gap-2">
              <span className="text-xs text-muted-foreground">生成:</span>
              <code className="text-xs font-mono bg-background border px-1.5 py-0.5 rounded">{formCronExpr}</code>
            </div>

            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <Label className="text-xs">启用此任务</Label>
              <Switch checked={formEnabled} onCheckedChange={setFormEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={save} disabled={saving} className="gap-1">
              <Save className="h-3.5 w-3.5" /> {saving ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function AdminEmail() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">邮箱管理</h2>
      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp">发件配置</TabsTrigger>
          <TabsTrigger value="templates">邮件模板</TabsTrigger>
          <TabsTrigger value="groups">邮件组</TabsTrigger>
          <TabsTrigger value="blast">全员群发</TabsTrigger>
          <TabsTrigger value="logs">发送日志</TabsTrigger>
        </TabsList>
        <TabsContent value="smtp" className="mt-4">
          <SmtpTab />
        </TabsContent>
        <TabsContent value="templates" className="mt-4">
          <TemplatesTab />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <GroupsTab />
        </TabsContent>
        <TabsContent value="blast" className="mt-4">
          <BlastTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
