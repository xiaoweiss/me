import { useMemo } from "react";
import { Outlet, NavLink, useLocation } from "react-router-dom";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Users, RefreshCw, Palette, LogOut, LayoutDashboard, Mail, Shield } from "lucide-react";

const allNavItems = [
  { to: "/", icon: LayoutDashboard, label: "概览", end: true, menuKey: "dashboard" },
  { to: "/users", icon: Users, label: "用户管理", menuKey: "users" },
  { to: "/sync", icon: RefreshCw, label: "数据同步", menuKey: "sync" },
  { to: "/thresholds", icon: Palette, label: "阈值配置", menuKey: "thresholds" },
  { to: "/email", icon: Mail, label: "邮箱管理", menuKey: "email" },
  { to: "/roles", icon: Shield, label: "角色管理", menuKey: "roles" },
];

export function AdminLayout() {
  const { auth, logout } = useAdminAuth();
  const location = useLocation();
  const userName = auth.status === "authenticated" ? auth.user.name : "";
  const userMenus = auth.status === "authenticated" ? auth.user.menus : [];

  const navItems = useMemo(() => {
    if (!userMenus || userMenus.length === 0) return allNavItems;
    return allNavItems.filter((item) => userMenus.includes(item.menuKey));
  }, [userMenus]);

  return (
    <div className="flex h-screen bg-background">
      <aside className="hidden md:flex w-56 flex-col border-r bg-card">
        <div className="px-4 py-5 border-b">
          <h1 className="text-base font-bold font-display">会议室运营</h1>
          <p className="text-xs text-muted-foreground">管理后台</p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {navItems.map((item) => {
            const isActive = item.end
              ? location.pathname === item.to
              : location.pathname.startsWith(item.to);
            return (
              <NavLink key={item.to} to={item.to} end={item.end}>
                <div className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}>
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </div>
              </NavLink>
            );
          })}
        </nav>
        <div className="border-t px-3 py-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground truncate">{userName}</span>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={logout}>
              <LogOut className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="md:hidden flex items-center justify-between border-b bg-card px-4 py-3">
          <h1 className="text-sm font-bold font-display">管理后台</h1>
          <div className="flex items-center gap-2">
            {navItems.map((item) => {
              const isActive = item.end
                ? location.pathname === item.to
                : location.pathname.startsWith(item.to);
              return (
                <NavLink key={item.to} to={item.to} end={item.end}>
                  <Button variant={isActive ? "default" : "ghost"} size="icon" className="h-8 w-8">
                    <item.icon className="h-4 w-4" />
                  </Button>
                </NavLink>
              );
            })}
          </div>
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
