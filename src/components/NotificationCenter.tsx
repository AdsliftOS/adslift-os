import { useEffect, useState } from "react";
import { Bell, AlertTriangle, UserPlus, TrendingDown, Clock, XCircle, X, CheckCheck, Settings, BellOff, Trash2, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  loadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type Notification,
  type NotificationType,
} from "@/store/notifications";

const typeConfig: Record<NotificationType, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  contract_expiry: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10", label: "Vertrag" },
  onboarding_complete: { icon: UserPlus, color: "text-emerald-500", bg: "bg-emerald-500/10", label: "Onboarding" },
  campaign_underperform: { icon: TrendingDown, color: "text-red-500", bg: "bg-red-500/10", label: "Kampagne" },
  task_due: { icon: Clock, color: "text-blue-500", bg: "bg-blue-500/10", label: "Aufgabe" },
  no_show: { icon: XCircle, color: "text-rose-500", bg: "bg-rose-500/10", label: "No-Show" },
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.max(0, now - then);
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Gerade eben";
  if (mins < 60) return `Vor ${mins} Min.`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `Vor ${hours} Std.`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Gestern";
  return `Vor ${days} Tagen`;
}

function NotificationItem({ n, onDelete }: { n: Notification; onDelete: () => void }) {
  const config = typeConfig[n.type] || typeConfig.task_due;
  const Icon = config.icon;

  return (
    <div
      onClick={() => { if (!n.read) markAsRead(n.id); }}
      className={cn(
        "flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer transition-all hover:bg-accent/50 group",
        !n.read && "bg-primary/[0.03]"
      )}
    >
      <div className={cn("mt-0.5 shrink-0 p-2 rounded-lg", config.bg)}>
        <Icon className={cn("h-4 w-4", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn("text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded", config.bg, config.color)}>
            {config.label}
          </span>
          {!n.read && (
            <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
          )}
        </div>
        <p className={cn("text-sm leading-tight mt-1.5", !n.read ? "font-semibold" : "text-muted-foreground")}>
          {n.title}
        </p>
        {n.message && (
          <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
        )}
        <p className="text-[10px] text-muted-foreground/60 mt-1.5">{timeAgo(n.created_at)}</p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(); }}
        className="text-muted-foreground/40 hover:text-destructive shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function NotificationCenter() {
  const notifications = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;
  const [tab, setTab] = useState("all");

  useEffect(() => {
    loadNotifications();
  }, []);

  const unread = notifications.filter((n) => !n.read);
  const read = notifications.filter((n) => n.read);
  const shown = tab === "unread" ? unread : notifications;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center shadow-lg shadow-destructive/30 animate-in zoom-in duration-200">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">Benachrichtigungen</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {unreadCount > 0 ? `${unreadCount} ungelesen` : "Alles gelesen"}
              </p>
            </div>
            <div className="flex items-center gap-1">
              {unreadCount > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markAllAsRead()}
                  className="text-xs gap-1.5 h-8"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Alle gelesen
                </Button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mt-3">
            <button
              onClick={() => setTab("all")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                tab === "all" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              Alle ({notifications.length})
            </button>
            <button
              onClick={() => setTab("unread")}
              className={cn(
                "text-xs px-3 py-1.5 rounded-lg font-medium transition-colors",
                tab === "unread" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent"
              )}
            >
              Ungelesen ({unreadCount})
            </button>
          </div>
        </div>

        {/* List */}
        {shown.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <BellOff className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">
              {tab === "unread" ? "Keine ungelesenen Benachrichtigungen" : "Keine Benachrichtigungen"}
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Neue Benachrichtigungen erscheinen hier automatisch.
            </p>
          </div>
        ) : (
          <div className="max-h-[420px] overflow-y-auto">
            {shown.map((n) => (
              <NotificationItem
                key={n.id}
                n={n}
                onDelete={() => deleteNotification(n.id)}
              />
            ))}
          </div>
        )}

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="px-4 py-2.5 border-t bg-muted/30">
            <p className="text-[10px] text-muted-foreground/60 text-center">
              Benachrichtigungen konfigurieren unter Einstellungen
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
