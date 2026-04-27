import {
  LayoutDashboard,
  FolderKanban,
  Users,
  Wallet,
  TrendingUp,
  Megaphone,
  Mail,
  Calendar,
  CircleCheckBig,
  FolderOpen,
  Clock,
  GraduationCap,
  Settings,
  LogOut,
  ChevronRight,
  UserCircle,
  UsersRound,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useLocation, matchPath } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useCurrentMember, isLeadershipRole } from "@/store/teamMembers";
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

type NavItem = {
  title: string;
  url: string;
  icon: typeof LayoutDashboard;
  badge?: "new";
  end?: boolean;
};

const workspaceItems: NavItem[] = [
  { title: "Dashboard", url: "/", icon: LayoutDashboard, end: true },
  { title: "Mein Bereich", url: "/me", icon: UserCircle, badge: "new" },
  { title: "Team", url: "/team", icon: UsersRound },
  { title: "Projekte", url: "/projects", icon: FolderKanban },
  { title: "Pipeline", url: "/pipeline", icon: Sparkles, badge: "new" },
  { title: "Kunden", url: "/clients", icon: Users },
  { title: "Kalender", url: "/calendar", icon: Calendar },
  { title: "Aufgaben", url: "/tasks", icon: CircleCheckBig },
  { title: "E-Mail", url: "/mail", icon: Mail },
  { title: "Dateien", url: "/files", icon: FolderOpen },
  { title: "Zeiterfassung", url: "/time", icon: Clock },
];

const growthItems: NavItem[] = [
  { title: "Sales", url: "/sales", icon: TrendingUp },
  { title: "Meta Ads", url: "/meta-ads", icon: Megaphone, badge: "new" },
  { title: "Finanzen", url: "/finances", icon: Wallet },
  { title: "Academy", url: "/academy-admin", icon: GraduationCap },
];

// Shared active / base class strings — extracted so the item style stays consistent.
const navItemBase =
  "group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground data-[collapsed=true]:justify-center data-[collapsed=true]:px-0";

const navItemActive =
  "!text-foreground font-semibold bg-gradient-to-r from-primary/20 to-primary/[0.06] border border-primary/25 shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_14px_-4px_rgba(13,114,255,0.3)] before:content-[''] before:absolute before:-left-[1px] before:top-2.5 before:bottom-2.5 before:w-[3px] before:rounded-full before:bg-gradient-to-b before:from-[#4D96FF] before:to-primary before:shadow-[0_0_8px_rgba(77,150,255,0.6)]";

function NavItemLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon;
  const location = useLocation();
  const isActive = item.end
    ? location.pathname === item.url
    : Boolean(matchPath({ path: item.url, end: false }, location.pathname));

  return (
    <NavLink
      to={item.url}
      end={item.end}
      className={navItemBase}
      activeClassName={navItemActive}
    >
      <Icon
        className={cn(
          "h-4 w-4 shrink-0 transition-colors",
          isActive ? "text-[#4D96FF]" : "opacity-70"
        )}
      />
      {!collapsed && (
        <>
          <span className="truncate">{item.title}</span>
          {item.badge === "new" && (
            <span className="ml-auto rounded px-1.5 py-[1px] font-mono text-[9px] font-bold uppercase tracking-ui text-adslift-navy bg-gradient-to-br from-adslift-amber to-adslift-amber-dark">
              New
            </span>
          )}
        </>
      )}
    </NavLink>
  );
}

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [user, setUser] = useState<{ email: string; initials: string } | null>(null);
  const me = useCurrentMember();
  const leadership = isLeadershipRole(me?.role);
  // Setter/Closer only see Mein Bereich + Kalender. Default to leadership view
  // until we know the role, otherwise admins briefly see a stripped sidebar.
  const visibleWorkspaceItems = me === null || leadership
    ? workspaceItems.filter((i) => leadership ? i.url !== "/me" : true)
    : workspaceItems.filter((i) => i.url === "/me" || i.url === "/calendar"); // setter/closer view
  // Hide /team for non-leadership in case of unknown role state.
  const finalWorkspaceItems = leadership
    ? visibleWorkspaceItems
    : visibleWorkspaceItems.filter((i) => i.url !== "/team" && i.url !== "/pipeline");
  const visibleGrowthItems = me === null || leadership ? growthItems : [];

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      const email = session?.user?.email ?? "";
      const initials = email
        .split("@")[0]
        .split(/[.\-_]/)
        .map((p) => p[0]?.toUpperCase() ?? "")
        .slice(0, 2)
        .join("") || email.slice(0, 2).toUpperCase();
      setUser({ email, initials });
    });
  }, []);

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      {/* Brand header */}
      <SidebarHeader className="px-3 py-4 border-b border-white/[0.06]">
        {!collapsed ? (
          <div className="flex items-center gap-2.5 px-1">
            <div className="h-8 w-8 rounded-lg overflow-hidden shrink-0 shadow-[0_4px_12px_-2px_rgba(0,0,0,0.6)]">
              <img src="/favicon.png" className="h-full w-full object-cover" alt="Adslift" />
            </div>
            <div className="leading-tight">
              <div className="font-sans text-[13px] font-extrabold tracking-tight">
                <span className="text-primary">ads</span>
                <span className="text-foreground">LIFT</span>
              </div>
              <div className="font-mono text-[8.5px] uppercase tracking-ui text-muted-foreground/70">
                Core OS
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto h-8 w-8 rounded-lg overflow-hidden">
            <img src="/favicon.png" className="h-full w-full object-cover" alt="Adslift" />
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2 py-3 gap-4">
        <SidebarGroup className="p-0">
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[9px] font-bold uppercase tracking-ui text-muted-foreground/60">
              Workspace
              <span className="ml-auto font-mono text-[9px] text-muted-foreground/40">
                {workspaceItems.length}
              </span>
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {finalWorkspaceItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="p-0 h-auto hover:bg-transparent data-[active=true]:bg-transparent">
                    <NavItemLink item={item} collapsed={collapsed} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {visibleGrowthItems.length > 0 && (
        <SidebarGroup className="p-0">
          {!collapsed && (
            <SidebarGroupLabel className="px-3 text-[9px] font-bold uppercase tracking-ui text-muted-foreground/60">
              Growth
            </SidebarGroupLabel>
          )}
          <SidebarGroupContent>
            <SidebarMenu className="gap-0.5">
              {visibleGrowthItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild className="p-0 h-auto hover:bg-transparent data-[active=true]:bg-transparent">
                    <NavItemLink item={item} collapsed={collapsed} />
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 gap-2 border-t border-white/[0.06]">
        {/* Settings + Logout */}
        <SidebarMenu className="gap-0.5">
          {(me === null || leadership) && (
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="p-0 h-auto hover:bg-transparent data-[active=true]:bg-transparent">
              <NavLink to="/settings" className={navItemBase} activeClassName={navItemActive}>
                <Settings className="h-4 w-4 shrink-0 opacity-70" />
                {!collapsed && <span>Einstellungen</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="p-0 h-auto hover:bg-transparent">
              <button onClick={() => supabase.auth.signOut()} className={navItemBase + " w-full"}>
                <LogOut className="h-4 w-4 shrink-0 opacity-70" />
                {!collapsed && <span>Abmelden</span>}
              </button>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {/* User tile */}
        {!collapsed && user && (
          <div className="mt-1 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.03] p-2">
            <div className="relative h-8 w-8 shrink-0 rounded-lg bg-gradient-to-br from-[#4D96FF] to-[#0650C7] flex items-center justify-center text-[11px] font-bold text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.3)]">
              {user.initials || "A"}
              <span className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full bg-adslift-success border-2 border-sidebar shadow-[0_0_6px_#22C55E]" />
            </div>
            <div className="min-w-0 flex-1 leading-tight">
              <div className="truncate text-[12px] font-semibold text-foreground">
                {user.email.split("@")[0]}
              </div>
              <div className="font-mono text-[9px] uppercase tracking-ui text-primary/70">
                Online
              </div>
            </div>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/50" />
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
