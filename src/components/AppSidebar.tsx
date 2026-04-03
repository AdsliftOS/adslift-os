import { LayoutDashboard, FolderKanban, Users, DollarSign, Clock, BarChart3, Calendar, ListTodo, FolderOpen, GraduationCap, Settings, LogOut } from "lucide-react";

const MetaIcon = () => (
  <img src="/meta-icon.png" alt="" className="h-4 w-4 shrink-0" />
);
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
  { title: "Dashboard", url: "/", icon: (() => <span className="text-base leading-none">🏠</span>) as any },
  { title: "Projects", url: "/projects", icon: (() => <span className="text-base leading-none">📋</span>) as any },
  { title: "Clients", url: "/clients", icon: (() => <span className="text-base leading-none">👥</span>) as any },
  { title: "Finances", url: "/finances", icon: (() => <span className="text-base leading-none">💳</span>) as any },
  { title: "Sales", url: "/sales", icon: (() => <span className="text-base leading-none">💰</span>) as any },
  { title: "Meta Ads", url: "/meta-ads", icon: MetaIcon },
  { title: "E-Mail", url: "/mail", icon: (() => <span className="text-base leading-none">📧</span>) as any },
  { title: "Kalender", url: "/calendar", icon: (() => <img src="/gcal-icon.png" alt="" className="h-5 w-5 shrink-0" />) as any },
  { title: "Aufgaben", url: "/tasks", icon: (() => <span className="text-base leading-none">🎯</span>) as any },
  { title: "Dateien", url: "/files", icon: (() => <img src="/gdrive-icon.png" alt="" className="h-5 w-5 shrink-0" />) as any },
  { title: "Time Tracking", url: "/time", icon: (() => <span className="text-base leading-none">⏱️</span>) as any },
  { title: "Academy", url: "/academy-admin", icon: (() => <span className="text-base leading-none">🎓</span>) as any },
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
