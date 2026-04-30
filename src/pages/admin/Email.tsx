import { useEffect, useState } from "react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, ChevronUp, RotateCcw, Eye, Save, Send } from "lucide-react";
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

function LogsTab() {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [failList, setFailList] = useState<string[]>([]);
  const [failDialogOpen, setFailDialogOpen] = useState(false);

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

  useEffect(() => { load(); }, [page]);

  async function viewFails(id: number) {
    const resp = await request<{ list: string[] }>(`/api/email/logs/${id}/fail-list`);
    setFailList(resp.list ?? []);
    setFailDialogOpen(true);
  }

  async function retry(id: number) {
    await request(`/api/email/logs/${id}/retry`, { method: "POST" });
    load();
  }

  const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
    success: { label: "成功", variant: "default" },
    partial: { label: "部分失败", variant: "secondary" },
    failed: { label: "失败", variant: "destructive" },
  };

  const totalPages = Math.ceil(total / 20);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>调度ID</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>总数</TableHead>
                <TableHead>失败</TableHead>
                <TableHead>重试</TableHead>
                <TableHead>发送时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : logs.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">暂无日志</TableCell></TableRow>
              ) : logs.map((l) => {
                const s = STATUS_MAP[l.status] ?? { label: l.status, variant: "secondary" as const };
                return (
                  <TableRow key={l.id}>
                    <TableCell className="font-mono text-xs">{l.id}</TableCell>
                    <TableCell className="font-mono text-xs">{l.scheduleId}</TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell>{l.total}</TableCell>
                    <TableCell>{l.failCount > 0 ? <span className="text-destructive font-medium">{l.failCount}</span> : 0}</TableCell>
                    <TableCell>{l.retryCount}</TableCell>
                    <TableCell className="text-xs">{l.sentAt ? new Date(l.sentAt).toLocaleString("zh-CN") : "-"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {l.failCount > 0 && (
                          <>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => viewFails(l.id)}>
                              <Eye className="h-3 w-3" /> 详情
                            </Button>
                            <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => retry(l.id)}>
                              <RotateCcw className="h-3 w-3" /> 重试
                            </Button>
                          </>
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

      <Dialog open={failDialogOpen} onOpenChange={setFailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>失败列表</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 max-h-60 overflow-auto">
            {failList.length === 0 ? (
              <p className="text-sm text-muted-foreground">无</p>
            ) : failList.map((email, i) => (
              <div key={i} className="text-sm font-mono bg-muted rounded px-2 py-1">{email}</div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
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

const TEMPLATE_VARS = [
  { key: "{{.HotelName}}", desc: "酒店名称" },
  { key: "{{.Date}}", desc: "日期" },
  { key: "{{.OccupancyRate}}", desc: "综合出租率" },
  { key: "{{.AM}}", desc: "上午出租率" },
  { key: "{{.PM}}", desc: "下午出租率" },
  { key: "{{.CompRate}}", desc: "竞对均值" },
  { key: "{{.MarketRate}}", desc: "商圈均值" },
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
    setDialogOpen(true);
  }

  function openEdit(t: MailTemplate) {
    setEditId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject);
    setFormBody(t.body);
    setFormDesc(t.description);
    setDialogOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      const body = { name: formName, subject: formSubject, body: formBody, description: formDesc };
      if (editId) {
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
        <Button size="sm" className="gap-1" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> 新建模板
        </Button>
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

export default function AdminEmail() {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold font-display">邮箱管理</h2>
      <Tabs defaultValue="smtp">
        <TabsList>
          <TabsTrigger value="smtp">发件配置</TabsTrigger>
          <TabsTrigger value="templates">邮件模板</TabsTrigger>
          <TabsTrigger value="groups">邮件组</TabsTrigger>
          <TabsTrigger value="schedules">发送调度</TabsTrigger>
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
        <TabsContent value="schedules" className="mt-4">
          <SchedulesTab />
        </TabsContent>
        <TabsContent value="logs" className="mt-4">
          <LogsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
