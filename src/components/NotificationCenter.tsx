import { useEffect } from "react";
import { Bell, AlertTriangle, UserPlus, TrendingDown, Clock, XCircle, X, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  useNotifications,
  loadNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  type NotificationType,
} from "@/store/notifications";

const typeIcons: Record<NotificationType, React.ElementType> = {
  contract_expiry: AlertTriangle,
  onboarding_complete: UserPlus,
  campaign_underperform: TrendingDown,
  task_due: Clock,
  no_show: XCircle,
};

const typeColors: Record<NotificationType, string> = {
  contract_expiry: "text-amber-500",
  onboarding_complete: "text-emerald-500",
  campaign_underperform: "text-red-500",
  task_due: "text-blue-500",
  no_show: "text-rose-500",
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

export function NotificationCenter() {
  const notifications = useNotifications();
  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    loadNotifications();
  }, []);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="text-sm font-semibold">Benachrichtigungen</span>
          {unreadCount > 0 && (
            <button
              onClick={() => markAllAsRead()}
              className="flex items-center gap-1 text-xs text-primary hover:underline"
            >
              <CheckCheck className="h-3 w-3" />
              Alle als gelesen markieren
            </button>
          )}
        </div>

        {/* List */}
        {notifications.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-muted-foreground">
            Keine Benachrichtigungen
          </div>
        ) : (
          <div className="max-h-80 overflow-y-auto">
            {notifications.map((n) => {
              const Icon = typeIcons[n.type] || Bell;
              const color = typeColors[n.type] || "text-muted-foreground";
              return (
                <div
                  key={n.id}
                  onClick={() => { if (!n.read) markAsRead(n.id); }}
                  className={`flex items-start gap-3 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-accent/50 transition-colors ${
                    !n.read ? "bg-primary/[0.04]" : ""
                  }`}
                >
                  <div className={`mt-0.5 shrink-0 ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-tight ${!n.read ? "font-medium" : "text-muted-foreground"}`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                    className="text-muted-foreground hover:text-foreground shrink-0 mt-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
