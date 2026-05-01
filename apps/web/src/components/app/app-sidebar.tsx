"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboardIcon,
  DatabaseIcon,
  BookOpenIcon,
  BriefcaseIcon,
  SettingsIcon,
  FlaskConicalIcon,
  ShieldCheckIcon,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";

export function AppSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/app" ? pathname === "/app" : pathname.startsWith(href);
  const isPublisherHome = pathname === "/app";
  const headerButtonClass =
    "!bg-transparent hover:!bg-transparent active:!bg-transparent data-[active=true]:!bg-transparent";
  const menuButtonClass =
    "!bg-transparent hover:!bg-sidebar-accent/55 active:!bg-sidebar-accent/70 data-[active=true]:!bg-sidebar-accent/70 data-[active=true]:text-sidebar-foreground";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild className={headerButtonClass}>
              <Link href="/app">
                <div className="flex size-8 items-center justify-center rounded-md bg-foreground shrink-0">
                  <Image
                    src="/licen-logo-light.svg"
                    alt="LICEN"
                    width={16}
                    height={10}
                    className="invert"
                  />
                </div>
                <div className="flex flex-col leading-tight">
                  <span className="font-semibold text-sm tracking-tight">LICEN</span>
                  <span className="text-xs text-muted-foreground">Data Licensing</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {/* Publish */}
        <SidebarGroup>
          <SidebarGroupLabel>Publish</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isPublisherHome} tooltip="Publisher Home" className={menuButtonClass}>
                  <Link href="/app">
                    <LayoutDashboardIcon />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app/datasets")} tooltip="My Datasets" className={menuButtonClass}>
                  <Link href="/app/datasets">
                    <DatabaseIcon />
                    <span>My Datasets</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Research */}
        <SidebarGroup>
          <SidebarGroupLabel>Research</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app/research")} tooltip="Researcher Home" className={menuButtonClass}>
                  <Link href="/app/research">
                    <FlaskConicalIcon />
                    <span>Home</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app/sessions")} tooltip="My Sessions" className={menuButtonClass}>
                  <Link href="/app/sessions">
                    <BriefcaseIcon />
                    <span>My Sessions</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app/marketplace")} tooltip="Browse Datasets" className={menuButtonClass}>
                  <Link href="/app/marketplace">
                    <BookOpenIcon />
                    <span>Browse Datasets</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        {/* Protocol */}
        <SidebarGroup>
          <SidebarGroupLabel>Protocol</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton asChild isActive={isActive("/app/audit")} tooltip="Audit Log" className={menuButtonClass}>
                  <Link href="/app/audit">
                    <ShieldCheckIcon />
                    <span>Audit</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu className="gap-1">
          <SidebarMenuItem>
            <SidebarMenuButton asChild isActive={isActive("/app/settings")} tooltip="Settings" className={menuButtonClass}>
              <Link href="/app/settings">
                <SettingsIcon />
                <span>Settings</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
