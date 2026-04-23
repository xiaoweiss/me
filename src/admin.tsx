import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { configureTokenKey } from "@/api/client";

// 管理后台用独立的 token 存储键，与 H5 端（auth_token）完全隔离
// 必须在任何 context / request 初始化前调用
configureTokenKey("admin_token");

import { AdminAuthProvider, useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminLayout } from "@/components/admin/AdminLayout";
import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminSync from "@/pages/admin/Sync";
import AdminThresholds from "@/pages/admin/Thresholds";
import AdminEmail from "@/pages/admin/Email";
import AdminRoles from "@/pages/admin/Roles";
import AdminLogin from "@/pages/admin/Login";
import "./index.css";

const queryClient = new QueryClient();

function AdminGate({ children }: { children: React.ReactNode }) {
  const { auth } = useAdminAuth();

  if (auth.status === "loading") {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">加载中...</p>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return <AdminLogin />;
  }

  if (!auth.user.isAdmin) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-destructive">无管理员权限</p>
      </div>
    );
  }

  return <>{children}</>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AdminAuthProvider>
          <AdminGate>
            <BrowserRouter>
              <Routes>
                <Route element={<AdminLayout />}>
                  <Route index element={<AdminDashboard />} />
                  <Route path="users" element={<AdminUsers />} />
                  <Route path="sync" element={<AdminSync />} />
                  <Route path="thresholds" element={<AdminThresholds />} />
                  <Route path="email" element={<AdminEmail />} />
                  <Route path="roles" element={<AdminRoles />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AdminGate>
        </AdminAuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
