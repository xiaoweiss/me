import { useEffect, useState } from "react";
import { request } from "@/api/client";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";

interface Role {
  id: number;
  name: string;
  label: string;
  menus: string[];
  apis: string[];
}

const ALL_MENUS = [
  { key: "dashboard", label: "概览" },
  { key: "users", label: "用户管理" },
  { key: "sync", label: "数据同步" },
  { key: "thresholds", label: "阈值配置" },
  { key: "email", label: "邮箱管理" },
  { key: "roles", label: "角色管理" },
];

const ALL_APIS = [
  { pattern: "/api/admin/*", label: "全部管理接口" },
  { pattern: "/api/email/*", label: "全部邮箱接口" },
  { pattern: "/api/admin/hotels", label: "酒店列表" },
  { pattern: "/api/admin/users", label: "用户列表" },
  { pattern: "/api/admin/thresholds/*", label: "阈值配置" },
  { pattern: "/api/admin/sync/*", label: "同步管理" },
  { pattern: "/api/admin/roles", label: "角色列表" },
];

export default function AdminRoles() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);

  const [formName, setFormName] = useState("");
  const [formLabel, setFormLabel] = useState("");
  const [formMenus, setFormMenus] = useState<string[]>([]);
  const [formApis, setFormApis] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const resp = await request<{ list: Role[] }>("/api/admin/roles");
      setRoles(resp.list ?? []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  function openCreate() {
    setEditId(null);
    setFormName("");
    setFormLabel("");
    setFormMenus(["dashboard"]);
    setFormApis([]);
    setDialogOpen(true);
  }

  function openEdit(role: Role) {
    setEditId(role.id);
    setFormName(role.name);
    setFormLabel(role.label);
    setFormMenus(role.menus ?? []);
    setFormApis(role.apis ?? []);
    setDialogOpen(true);
  }

  function toggleItem(list: string[], item: string, setter: (v: string[]) => void) {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  async function save() {
    setSaving(true);
    try {
      const body = { name: formName, label: formLabel, menus: formMenus, apis: formApis };
      if (editId) {
        await request(`/api/admin/roles/${editId}`, { method: "PUT", body: JSON.stringify(body) });
      } else {
        await request("/api/admin/roles", { method: "POST", body: JSON.stringify(body) });
      }
      setDialogOpen(false);
      load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold font-display">角色管理</h2>
        <Button size="sm" className="gap-1" onClick={openCreate}>
          <Plus className="h-3.5 w-3.5" /> 新建角色
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>标识</TableHead>
                <TableHead>名称</TableHead>
                <TableHead>菜单权限</TableHead>
                <TableHead>API 权限</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">加载中...</TableCell></TableRow>
              ) : roles.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">暂无角色</TableCell></TableRow>
              ) : roles.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.id}</TableCell>
                  <TableCell><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{r.name}</code></TableCell>
                  <TableCell className="font-medium">{r.label}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.menus ?? []).map((m) => (
                        <Badge key={m} variant="secondary" className="text-xs">
                          {ALL_MENUS.find((am) => am.key === m)?.label ?? m}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(r.apis ?? []).map((a) => (
                        <Badge key={a} variant="outline" className="text-xs font-mono">{a}</Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={() => openEdit(r)}>
                      <Pencil className="h-3 w-3" /> 编辑
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editId ? "编辑角色" : "新建角色"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>标识（英文）</Label>
                <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder="operator" disabled={!!editId} />
              </div>
              <div className="space-y-1">
                <Label>显示名称</Label>
                <Input value={formLabel} onChange={(e) => setFormLabel(e.target.value)} placeholder="运营管理" />
              </div>
            </div>

            <div className="space-y-2">
              <Label>菜单权限</Label>
              <div className="grid grid-cols-2 gap-1">
                {ALL_MENUS.map((m) => (
                  <label key={m.key} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer">
                    <Checkbox checked={formMenus.includes(m.key)} onCheckedChange={() => toggleItem(formMenus, m.key, setFormMenus)} />
                    <span className="text-sm">{m.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>API 权限</Label>
              <div className="space-y-1">
                {ALL_APIS.map((a) => (
                  <label key={a.pattern} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer">
                    <Checkbox checked={formApis.includes(a.pattern)} onCheckedChange={() => toggleItem(formApis, a.pattern, setFormApis)} />
                    <span className="text-sm">{a.label}</span>
                    <code className="text-xs text-muted-foreground ml-auto">{a.pattern}</code>
                  </label>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>取消</Button>
            <Button onClick={save} disabled={saving || !formName || !formLabel}>{saving ? "保存中..." : "保存"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
