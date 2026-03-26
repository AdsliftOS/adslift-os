import { LayoutDashboard, FolderKanban, Users, DollarSign, Clock, BarChart3, Megaphone, Calendar, ListTodo, FolderOpen, GraduationCap, Settings, LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { NavLink } from "@/components/NavLink";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Finances", url: "/finances", icon: DollarSign },
  { title: "Sales", url: "/sales", icon: BarChart3 },
  { title: "Meta Ads", url: "/meta-ads", icon: Megaphone },
  { title: "Kalender", url: "/calendar", icon: Calendar },
  { title: "Aufgaben", url: "/tasks", icon: ListTodo },
  { title: "Dateien", url: "/files", icon: FolderOpen },
  { title: "Time Tracking", url: "/time", icon: Clock },
  { title: "Academy", url: "/academy-admin", icon: GraduationCap },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="px-4 py-5">
        {!collapsed ? (
          <div className="flex items-center gap-2">
            <img src="/favicon.png" className="h-7 w-7 rounded-lg" />
            <span className="text-lg font-bold tracking-tight text-foreground">
              Adslift
            </span>
          </div>
        ) : (
          <img src="/favicon.png" className="h-7 w-7 rounded-lg" />
        )}
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-accent"
                      activeClassName="bg-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="px-3 py-3 space-y-1">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to="/settings"
                className="hover:bg-accent"
                activeClassName="bg-accent text-primary font-medium"
              >
                <Settings className="mr-2 h-4 w-4" />
                {!collapsed && <span>Einstellungen</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <button
                onClick={() => supabase.auth.signOut()}
                className="w-full flex items-center hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                {!collapsed && <span>Abmelden</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
