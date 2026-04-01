import { LayoutDashboard, FolderKanban, Users, DollarSign, Clock, BarChart3, Calendar, ListTodo, FolderOpen, GraduationCap, Settings, LogOut } from "lucide-react";

const MetaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 10.202L8.464 5.15c-.795-1.133-1.517-1.706-2.439-1.865-.72-.124-1.48.078-2.09.71C3.1 4.872 2.5 6.302 2.5 8.5c0 2.2.5 4.5 1.5 6.298.796 1.43 1.733 2.202 2.8 2.202.76 0 1.446-.35 2.13-1.138L12 12.28l3.07 3.582c.684.788 1.37 1.138 2.13 1.138 1.067 0 2.004-.772 2.8-2.202 1-1.798 1.5-4.098 1.5-6.298 0-2.198-.6-3.628-1.435-4.505-.61-.632-1.37-.834-2.09-.71-.922.159-1.644.732-2.44 1.865L12 10.202z"/>
  </svg>
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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Projects", url: "/projects", icon: FolderKanban },
  { title: "Clients", url: "/clients", icon: Users },
  { title: "Finances", url: "/finances", icon: DollarSign },
  { title: "Sales", url: "/sales", icon: BarChart3 },
  { title: "Meta Ads", url: "/meta-ads", icon: MetaIcon },
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
