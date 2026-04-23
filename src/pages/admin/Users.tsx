import { useEffect, useState } from "react";
import { request } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Building2, Plus, Mail } from "lucide-react";
import { toast } from "sonner";

interface AdminUser {
  id: number;
  name: string;
  email: string;
  status: string;
  hotelIds: number[];
  roleId: number;
}

interface Hotel {
  id: number;
  name: string;
}

interface Role {
  id: number;
  name: string;
  label: string;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  active: { label: "已激活", variant: "default" },
  pending: { label: "待激活", variant: "secondary" },
  disabled: { label: "已禁用", variant: "destructive" },
};

export default function AdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [hotelDialogOpen, setHotelDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<number | null>(null);
  const [selectedHotelIds, setSelectedHotelIds] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);

  const [createOpen, setCreateOpen] = useState(false);
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newRoleId, setNewRoleId] = useState("0");
  const [creating, setCreating] = useState(false);

  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [editEmailUserId, setEditEmailUserId] = useState<number | null>(null);
  const [editEmailValue, setEditEmailValue] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [uResp, hResp, rResp] = await Promise.all([
        request<{ list: AdminUser[] }>("/api/admin/users"),
        request<{ list: Hotel[] }>("/api/admin/hotels"),
        request<{ list: Role[] }>("/api/admin/roles"),
      ]);
      setUsers(uResp.list ?? []);
      setHotels(hResp.list ?? []);
      setRoles(rResp.list ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function updateStatus(userId: number, status: string) {
    await request(`/api/admin/users/${userId}/status`, {
      method: "PUT",
      body: JSON.stringify({ status }),
    });
    load();
  }

  async function updateRole(userId: number, roleId: string) {
    await request(`/api/admin/users/${userId}/role`, {
      method: "PUT",
      body: JSON.stringify({ roleId: Number(roleId) }),
    });
    load();
  }

  function openHotelDialog(user: AdminUser) {
    setEditUserId(user.id);
    setSelectedHotelIds(user.hotelIds ?? []);
    setHotelDialogOpen(true);
  }

  function toggleHotel(hotelId: number) {
    setSelectedHotelIds((prev) =>
      prev.includes(hotelId) ? prev.filter((id) => id !== hotelId) : [...prev, hotelId]
    );
  }

  async function saveHotels() {
    if (editUserId === null) return;
    setSaving(true);
    try {
      await request(`/api/admin/users/${editUserId}/hotels`, {
        method: "PUT",
        body: JSON.stringify({ hotelIds: selectedHotelIds }),
      });
      setHotelDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  function openEmailDialog(user: AdminUser) {
    setEditEmailUserId(user.id);
    setEditEmailValue(user.email || "");
    setEmailDialogOpen(true);
  }

  async function saveEmail() {
    if (editEmailUserId === null) return;
    setSavingEmail(true);
    try {
      await request(`/api/admin/users/${editEmailUserId}/email`, {
        method: "PUT",
        body: JSON.stringify({ email: editEmailValue.trim() }),
      });
      toast.success("邮箱已更新");
      setEmailDialogOpen(false);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "更新失败");
    } finally {
      setSavingEmail(false);
    }
  }

  async function createAdmin() {
    setCreating(true);
    try {
      await request("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ username: newUsername, password: newPassword, email: newEmail, roleId: Number(newRoleId) }),
      });
      toast.success("管理员账号已创建");
      setCreateOpen(false);
      setNewUsername(""); setNewPassword(""); setNewEmail(""); setNewRoleId("0");
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "创建失败");
    } finally {
      setCreating(false);
    }
  }

  const hotelName = (id: number) => hotels.find((h) => h.id === id)?.name ?? `#${id}`;
  const editUserName = users.find((u) => u.id === editUserId)?.name ?? "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">用户管理</h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">{users.length} 个用户</Badge>
          <Button size="sm" className="gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> 创建管理员
          </Button>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>姓名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>关联酒店</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : users.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">暂无用户</TableCell></TableRow>
              ) : users.map((u) => {
                const s = STATUS_MAP[u.status] ?? { label: u.status, variant: "secondary" as const };
                return (
                  <TableRow key={u.id}>
                    <TableCell className="font-mono text-xs">{u.id}</TableCell>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs gap-1 font-normal"
                        onClick={() => openEmailDialog(u)}
                      >
                        <Mail className="h-3 w-3" />
                        <span className={u.email ? "" : "text-muted-foreground italic"}>
                          {u.email || "未设置"}
                        </span>
                      </Button>
                    </TableCell>
                    <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                    <TableCell>
                      <Select value={String(u.roleId || 0)} onValueChange={(v) => updateRole(u.id, v)}>
                        <SelectTrigger className="h-8 w-28 text-xs">
                          <SelectValue placeholder="未分配" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="0">未分配</SelectItem>
                          {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openHotelDialog(u)}>
                        <Building2 className="h-3 w-3" />
                        {u.hotelIds?.length ?? 0} 个酒店
                      </Button>
                    </TableCell>
                    <TableCell>
                      <Select value={u.status} onValueChange={(v) => updateStatus(u.id, v)}>
                        <SelectTrigger className="h-8 w-24 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">激活</SelectItem>
                          <SelectItem value="disabled">禁用</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={hotelDialogOpen} onOpenChange={setHotelDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>编辑酒店绑定 — {editUserName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-60 overflow-auto">
            {hotels.length === 0 ? (
              <p className="text-sm text-muted-foreground">暂无酒店</p>
            ) : hotels.map((h) => (
              <label key={h.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent cursor-pointer">
                <Checkbox
                  checked={selectedHotelIds.includes(h.id)}
                  onCheckedChange={() => toggleHotel(h.id)}
                />
                <span className="text-sm">{h.name}</span>
              </label>
            ))}
          </div>
          <div className="text-xs text-muted-foreground">
            已选 {selectedHotelIds.length} 个：{selectedHotelIds.map((id) => hotelName(id)).join("、") || "无"}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setHotelDialogOpen(false)}>取消</Button>
            <Button onClick={saveHotels} disabled={saving}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              编辑邮箱 — {users.find((u) => u.id === editEmailUserId)?.name ?? ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>邮箱地址</Label>
            <Input
              type="email"
              value={editEmailValue}
              onChange={(e) => setEditEmailValue(e.target.value)}
              placeholder="user@example.com（留空即清除）"
              autoFocus
            />
            <p className="text-xs text-muted-foreground pt-1">
              留空可清除邮箱；邮箱用于接收日报等系统通知。
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEmailDialogOpen(false)}>取消</Button>
            <Button onClick={saveEmail} disabled={savingEmail}>
              {savingEmail ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>创建管理员账号</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>用户名</Label>
              <Input value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="admin" />
            </div>
            <div className="space-y-1">
              <Label>密码</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="至少6位" />
            </div>
            <div className="space-y-1">
              <Label>邮箱（可选）</Label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="admin@example.com" />
            </div>
            <div className="space-y-1">
              <Label>角色</Label>
              <Select value={newRoleId} onValueChange={setNewRoleId}>
                <SelectTrigger><SelectValue placeholder="选择角色" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">不分配</SelectItem>
                  {roles.map((r) => <SelectItem key={r.id} value={String(r.id)}>{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
            <Button onClick={createAdmin} disabled={creating || !newUsername || !newPassword}>
              {creating ? "创建中..." : "创建"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
