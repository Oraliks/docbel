"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2Icon,
  BookOpenIcon,
  CalculatorIcon,
  CalendarClock,
  CommandIcon,
  FileTextIcon,
  FilesIcon,
  FolderOpenIcon,
  LayoutDashboardIcon,
  type LucideIcon,
  PlusCircleIcon,
  SearchIcon,
  ShieldCheckIcon,
  UsersIcon,
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
} from "@/components/ui/sidebar";
import { NavUser } from "@/components/nav-user";
import { getProSpace, type ProIcon, type ProSegment } from "@/lib/pro-nav";

const ICONS: Record<ProIcon, LucideIcon> = {
  dashboard: LayoutDashboardIcon,
  calendar: CalendarClock,
  search: SearchIcon,
  building: Building2Icon,
  users: UsersIcon,
  file: FileTextIcon,
  plus: PlusCircleIcon,
  folder: FolderOpenIcon,
  calculator: CalculatorIcon,
  shield: ShieldCheckIcon,
  book: BookOpenIcon,
  document: FilesIcon,
};

/** Les ancres (#…) ne portent pas d'état actif ; sinon match exact ou préfixe. */
function isItemActive(pathname: string, url: string, exact?: boolean): boolean {
  if (url.includes("#")) return false;
  if (exact) return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function ProSidebar({
  segment,
  user,
  ...props
}: {
  segment: ProSegment;
  user: { name: string; email: string; avatar: string };
} & React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname() ?? "";
  const space = getProSpace(segment);

  return (
    <Sidebar collapsible="offcanvas" variant="inset" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:p-1.5!"
              render={<Link href={space.homeUrl} />}
            >
              <CommandIcon className="size-5!" />
              <span className="text-base font-semibold">Docbel</span>
              <span className="ml-auto text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {segment === "partenaire" ? "Partenaire" : "Employeur"}
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {space.groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = ICONS[item.icon];
                  return (
                    <SidebarMenuItem key={item.url}>
                      <SidebarMenuButton
                        isActive={isItemActive(pathname, item.url, item.exact)}
                        render={<Link href={item.url} />}
                      >
                        <Icon />
                        <span>{item.title}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  );
}
