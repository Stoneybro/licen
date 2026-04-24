import type React from "react";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app/app-sidebar";
import { AuthGuard } from "@/components/app/auth-guard";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </SidebarProvider>
    </AuthGuard>
  );
}
