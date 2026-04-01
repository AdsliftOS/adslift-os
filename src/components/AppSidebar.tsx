import { LayoutDashboard, FolderKanban, Users, DollarSign, Clock, BarChart3, Calendar, ListTodo, FolderOpen, GraduationCap, Settings, LogOut } from "lucide-react";

const MetaIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M6.915 4.03c-1.968 0-3.402 1.042-4.36 2.879C1.513 8.388 1 10.378 1 12.182c0 1.632.373 2.923 1.103 3.839.744.93 1.726 1.432 2.91 1.432 1.08 0 1.988-.396 2.76-1.199.76-.792 1.645-2.108 2.666-3.942l.28-.503c.906-1.63 1.74-2.924 2.5-3.87.78-.97 1.72-1.747 2.82-2.316a7.568 7.568 0 0 1 3.428-.842c1.74 0 3.2.67 4.36 1.988 1.147 1.305 1.726 3.073 1.726 5.3 0 2.293-.6 4.296-1.792 5.985C22.57 19.758 21 20.96 19.09 21.453l-.58-1.792c1.496-.41 2.692-1.323 3.57-2.735.89-1.427 1.34-3.116 1.34-5.043 0-1.803-.44-3.186-1.303-4.117-.875-.944-1.982-1.424-3.323-1.424-1.08 0-2.038.34-2.85 1.01-.827.68-1.691 1.8-2.582 3.355l-.28.503c-1.01 1.82-1.905 3.196-2.675 4.108-.784.929-1.59 1.574-2.408 1.925-.832.358-1.72.537-2.66.537-1.72 0-3.12-.642-4.176-1.9C.48 14.58 0 12.914 0 10.88c0-2.16.56-4.218 1.674-6.143C2.806 2.862 4.578 1.959 6.915 1.959c.924 0 1.753.183 2.476.537l-.614 1.81a4.752 4.752 0 0 0-1.862-.276Z"/>
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
