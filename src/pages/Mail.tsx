import { useState, useEffect, useCallback, useRef } from "react";
import { format, isToday, isYesterday, isThisYear } from "date-fns";
import { de } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Inbox, Star, Send, FileText, AlertTriangle, Trash2, Search, Plus, RefreshCw, Archive, MailOpen, Mail as MailIcon,
  Reply, ReplyAll, Forward, ChevronLeft, Paperclip, MoreHorizontal, Tag, X, Loader2, ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { isGmailConnected, connectGmail, getGmailAccounts, getValidGmailToken } from "@/lib/gmail-auth";
import {
  listMessages, getMessage, getThread, sendEmail, markAsRead, markAsUnread,
  archiveMessage, trashMessage, starMessage, unstarMessage, listLabels,
  getMessageSubject, getMessageFrom, getMessageTo, getMessageCc, getMessageDate, getMessageBody,
  getMessageAttachments, SYSTEM_LABELS, type GmailMessage, type GmailLabel, type GmailAttachment,
} from "@/lib/gmail";

// --- Icon map ---
const LABEL_ICONS: Record<string, typeof Inbox> = {
  inbox: Inbox, star: Star, send: Send, "file-text": FileText,
  "alert-triangle": AlertTriangle, "trash-2": Trash2,
};

// --- Date formatting ---
function formatMailDate(date: Date): string {
  if (isToday(date)) return format(date, "HH:mm");
  if (isYesterday(date)) return "Gestern";
  if (isThisYear(date)) return format(date, "d. MMM", { locale: de });
  return format(date, "d. MMM yyyy", { locale: de });
}

function formatFullDate(date: Date): string {
  return format(date, "d. MMMM yyyy, HH:mm", { locale: de });
}

// --- Message list item (parsed) ---
type ParsedMessage = {
  id: string;
  threadId: string;
  subject: string;
  from: { name: string; email: string };
  snippet: string;
  date: Date;
  isUnread: boolean;
  isStarred: boolean;
  labelIds: string[];
  hasAttachments: boolean;
};

function parseListMessage(msg: GmailMessage): ParsedMessage {
  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: getMessageSubject(msg),
    from: getMessageFrom(msg),
    snippet: msg.snippet,
    date: getMessageDate(msg),
    isUnread: msg.labelIds?.includes("UNREAD") ?? false,
    isStarred: msg.labelIds?.includes("STARRED") ?? false,
    labelIds: msg.labelIds || [],
    hasAttachments: getMessageAttachments(msg).length > 0,
  };
}

// ============================================================
// MAIL PAGE
// ============================================================

export default function MailPage() {
  const accounts = getGmailAccounts();
  const [connected, setConnected] = useState(isGmailConnected());
  const [activeAccountIdx, setActiveAccountIdx] = useState(0);
  const [activeLabel, setActiveLabel] = useState("INBOX");
  const [messages, setMessages] = useState<ParsedMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedMessage, setSelectedMessage] = useState<GmailMessage | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchActive, setSearchActive] = useState(false);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyMode, setReplyMode] = useState<"reply" | "replyAll" | "forward" | null>(null);
  const [labels, setLabels] = useState<GmailLabel[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Active account helper
  const getActiveToken = useCallback(async () => {
    const accs = getGmailAccounts();
    if (accs.length === 0) return null;
    const idx = Math.min(activeAccountIdx, accs.length - 1);
    return getValidGmailToken(accs[idx]);
  }, [activeAccountIdx]);

  const getActiveAccount = useCallback(() => {
    const accs = getGmailAccounts();
    if (accs.length === 0) return null;
    return accs[Math.min(activeAccountIdx, accs.length - 1)];
  }, [activeAccountIdx]);

  // --- Load labels + unread counts ---
  const loadLabels = useCallback(async () => {
    const token = await getActiveToken();
    if (!token) return;
    try {
      const all = await listLabels(token);
      setLabels(all.filter((l) => l.type === "user"));
      const counts: Record<string, number> = {};
      for (const l of all) {
        if (l.messagesUnread) counts[l.id] = l.messagesUnread;
      }
      setUnreadCounts(counts);
    } catch (e: any) {
      console.error("Failed to load labels:", e);
    }
  }, [getActiveToken]);

  // --- Load messages ---
  const loadMessages = useCallback(async (labelId: string, query?: string, pageToken?: string) => {
    const token = await getActiveToken();
    if (!token) return;
    if (pageToken) setLoadingMore(true); else { setLoading(true); setError(null); }

    try {
      const opts: any = { maxResults: 30, pageToken };
      if (query) {
        opts.q = query;
      } else {
        opts.labelIds = [labelId];
      }
      const list = await listMessages(token, opts);
      setNextPageToken(list.nextPageToken);

      const fullMessages: GmailMessage[] = [];
      const ids = list.messages.map((m) => m.id);
      for (let i = 0; i < ids.length; i += 10) {
        const batch = ids.slice(i, i + 10);
        const results = await Promise.all(batch.map((id) => getMessage(token, id)));
        fullMessages.push(...results);
      }

      const parsed = fullMessages.map(parseListMessage);
      if (pageToken) {
        setMessages((prev) => [...prev, ...parsed]);
      } else {
        setMessages(parsed);
      }
    } catch (e: any) {
      const msg = e.message || "Unbekannter Fehler";
      setError(msg);
      console.error("Gmail load error:", e);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getActiveToken]);

  // Initial load + account switch
  useEffect(() => {
    if (connected) {
      setMessages([]);
      setSelectedId(null);
      setSelectedMessage(null);
      setActiveLabel("INBOX");
      setSearchActive(false);
      setSearchQuery("");
      loadMessages("INBOX");
      loadLabels();
    }
  }, [connected, activeAccountIdx]);

  // Label change
  const switchLabel = (labelId: string) => {
    setActiveLabel(labelId);
    setSelectedId(null);
    setSelectedMessage(null);
    setSearchActive(false);
    setSearchQuery("");
    loadMessages(labelId);
  };

  // Search
  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    setSearchActive(true);
    setSelectedId(null);
    setSelectedMessage(null);
    loadMessages(activeLabel, searchQuery);
  };

  // Refresh
  const handleRefresh = () => {
    if (searchActive) {
      loadMessages(activeLabel, searchQuery);
    } else {
      loadMessages(activeLabel);
    }
    loadLabels();
  };

  // Open message
  const openMessage = async (msg: ParsedMessage) => {
    setSelectedId(msg.id);
    setLoadingMessage(true);
    setReplyMode(null);
    try {
      const token = await getActiveToken();
      if (!token) return;
      const full = await getMessage(token, msg.id);
      setSelectedMessage(full);
      if (msg.isUnread) {
        await markAsRead(token, msg.id);
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, isUnread: false } : m));
      }
    } catch (e: any) {
      toast.error("Fehler: " + e.message);
    } finally {
      setLoadingMessage(false);
    }
  };

  // Actions
  const handleArchive = async (id: string) => {
    try {
      const token = await getActiveToken();
      if (!token) return;
      await archiveMessage(token, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) { setSelectedId(null); setSelectedMessage(null); }
      toast.success("Archiviert");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleTrash = async (id: string) => {
    try {
      const token = await getActiveToken();
      if (!token) return;
      await trashMessage(token, id);
      setMessages((prev) => prev.filter((m) => m.id !== id));
      if (selectedId === id) { setSelectedId(null); setSelectedMessage(null); }
      toast.success("In Papierkorb verschoben");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggleRead = async (id: string, isUnread: boolean) => {
    try {
      const token = await getActiveToken();
      if (!token) return;
      if (isUnread) await markAsRead(token, id); else await markAsUnread(token, id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isUnread: !isUnread } : m));
    } catch (e: any) { toast.error(e.message); }
  };

  const handleToggleStar = async (id: string, isStarred: boolean) => {
    try {
      const token = await getActiveToken();
      if (!token) return;
      if (isStarred) await unstarMessage(token, id); else await starMessage(token, id);
      setMessages((prev) => prev.map((m) => m.id === id ? { ...m, isStarred: !isStarred } : m));
    } catch (e: any) { toast.error(e.message); }
  };

  // Switch account
  const switchAccount = (idx: number) => {
    setActiveAccountIdx(idx);
  };

  // --- Not connected ---
  if (!connected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center max-w-md space-y-4">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            <MailIcon className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">E-Mail verbinden</h2>
          <p className="text-muted-foreground">
            Verbinde dein Google-Konto, um E-Mails direkt in Adslift zu lesen, schreiben und organisieren.
          </p>
          <Button onClick={() => connectGmail()} size="lg">
            <MailIcon className="h-5 w-5 mr-2" />
            Google-Konto verbinden
          </Button>
        </div>
      </div>
    );
  }

  const activeLabelName = SYSTEM_LABELS.find((l) => l.id === activeLabel)?.name
    || labels.find((l) => l.id === activeLabel)?.name
    || activeLabel;

  const activeAccount = getActiveAccount();

  return (
    <div className="flex-1 flex flex-col h-[calc(100vh-2rem)] overflow-hidden">
      {/* --- ACCOUNT SWITCHER --- */}
      {accounts.length > 0 && (
        <div className="flex items-center gap-1 px-3 py-1.5 border-b bg-muted/20">
          {accounts.map((acc, idx) => (
            <button
              key={acc.email}
              onClick={() => switchAccount(idx)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                activeAccountIdx === idx
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {idx === 0 ? "Main" : "Office"}{" "}
              <span className="opacity-60">({acc.email.split("@")[0]})</span>
            </button>
          ))}
          <Button variant="ghost" size="sm" className="h-6 px-2 ml-1 text-xs text-muted-foreground" onClick={() => connectGmail()}>
            <Plus className="h-3 w-3 mr-1" /> Account
          </Button>
        </div>
      )}

      <ResizablePanelGroup direction="horizontal" className="flex-1 overflow-hidden">
        {/* --- LEFT: Label Sidebar --- */}
        <ResizablePanel defaultSize={15} minSize={10} maxSize={25}>
          <div className="flex flex-col h-full bg-muted/30">
            <div className="p-3">
              <Button onClick={() => setComposeOpen(true)} className="w-full" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Verfassen
              </Button>
            </div>
          <ScrollArea className="flex-1">
            <div className="px-2 space-y-0.5">
              {SYSTEM_LABELS.map((label) => {
                const Icon = LABEL_ICONS[label.icon] || Tag;
                const isActive = activeLabel === label.id && !searchActive;
                const unread = unreadCounts[label.id];
                return (
                  <button
                    key={label.id}
                    onClick={() => switchLabel(label.id)}
                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                      isActive ? "bg-accent text-accent-foreground font-medium" : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="truncate flex-1 text-left">{label.name}</span>
                    {unread ? <span className="text-xs font-medium tabular-nums">{unread}</span> : null}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* --- MIDDLE: Message List --- */}
      <ResizablePanel defaultSize={30} minSize={20} maxSize={50}>
        <div className="flex flex-col h-full">
          {/* Search + Actions bar */}
          <div className="flex items-center gap-2 p-2 border-b">
            <div className="flex-1 flex items-center gap-1">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="E-Mails durchsuchen..."
                  className="pl-8 h-8 text-sm"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                {searchActive && (
                  <button
                    onClick={() => { setSearchActive(false); setSearchQuery(""); loadMessages(activeLabel); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                  >
                    <X className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                  </button>
                )}
              </div>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleRefresh}>
                  <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Aktualisieren</TooltipContent>
            </Tooltip>
          </div>

          {/* Header */}
          <div className="px-3 py-2 border-b">
            <h2 className="font-semibold text-sm">
              {searchActive ? `Suche: "${searchQuery}"` : activeLabelName}
            </h2>
            <p className="text-xs text-muted-foreground">{messages.length} E-Mails</p>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                <AlertTriangle className="h-8 w-8 mb-3 text-destructive/60" />
                <p className="text-sm font-medium mb-1">Gmail konnte nicht geladen werden</p>
                <p className="text-xs text-muted-foreground mb-4 max-w-xs">{error}</p>
                {error.toLowerCase().includes("403") || error.toLowerCase().includes("insufficient") || error.toLowerCase().includes("scope") ? (
                  <div className="space-y-2 text-center">
                    <p className="text-xs text-muted-foreground">Gmail-Berechtigung fehlt. Bitte Account neu verbinden.</p>
                    <Button size="sm" onClick={() => connectGmail()}>
                      <img src="/gmail-icon.svg" alt="" className="h-4 w-4 mr-1.5" /> Gmail neu verbinden
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleRefresh}>
                    <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Nochmal versuchen
                  </Button>
                )}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Inbox className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-sm">Keine E-Mails</p>
              </div>
            ) : (
              <div>
                {messages.map((msg) => (
                  <button
                    key={msg.id}
                    onClick={() => openMessage(msg)}
                    className={`w-full text-left px-3 py-2.5 border-b transition-colors ${
                      selectedId === msg.id
                        ? "bg-accent"
                        : msg.isUnread
                        ? "bg-primary/[0.03] hover:bg-accent/60"
                        : "hover:bg-accent/40"
                    }`}
                  >
                    <div className="flex items-start gap-2 overflow-hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleToggleStar(msg.id, msg.isStarred); }}
                        className="mt-0.5 shrink-0"
                      >
                        <Star className={`h-3.5 w-3.5 ${msg.isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40 hover:text-amber-400"}`} />
                      </button>
                      <div className="flex-1 min-w-0 overflow-hidden">
                        <div className="flex items-baseline justify-between gap-1">
                          <span className={`text-sm truncate min-w-0 ${msg.isUnread ? "font-semibold" : ""}`}>
                            {msg.from.name || msg.from.email}
                          </span>
                          <span className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                            {formatMailDate(msg.date)}
                          </span>
                        </div>
                        <p className={`text-sm break-words line-clamp-1 ${msg.isUnread ? "font-medium text-foreground" : "text-foreground/80"}`}>
                          {msg.subject}
                        </p>
                        <p className="text-xs text-muted-foreground break-words line-clamp-1 mt-0.5">{msg.snippet}</p>
                      </div>
                      {msg.hasAttachments && <Paperclip className="h-3 w-3 text-muted-foreground shrink-0 mt-1.5" />}
                    </div>
                  </button>
                ))}
                {nextPageToken && (
                  <div className="py-4 flex justify-center" ref={(el) => {
                    if (!el) return;
                    const observer = new IntersectionObserver(([entry]) => {
                      if (entry.isIntersecting && !loadingMore) {
                        loadMessages(activeLabel, searchActive ? searchQuery : undefined, nextPageToken);
                      }
                    }, { threshold: 0.1 });
                    observer.observe(el);
                    return () => observer.disconnect();
                  }}>
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle withHandle />

      {/* --- RIGHT: Message Detail / Empty State --- */}
      <ResizablePanel defaultSize={55} minSize={30}>
        {selectedMessage ? (
          <MessageDetail
            message={selectedMessage}
            onClose={() => { setSelectedId(null); setSelectedMessage(null); }}
            onArchive={() => handleArchive(selectedMessage.id)}
            onTrash={() => handleTrash(selectedMessage.id)}
            onToggleRead={() => {
              const isUnread = selectedMessage.labelIds?.includes("UNREAD");
              handleToggleRead(selectedMessage.id, !!isUnread);
            }}
            onReply={() => setReplyMode("reply")}
            onReplyAll={() => setReplyMode("replyAll")}
            onForward={() => setReplyMode("forward")}
            replyMode={replyMode}
            onCloseReply={() => setReplyMode(null)}
            onSent={() => { setReplyMode(null); handleRefresh(); }}
            accountIdx={activeAccountIdx}
          />
        ) : (
          <div className="flex-1 h-full flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <MailIcon className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm">Wähle eine E-Mail aus</p>
            </div>
          </div>
        )}
      </ResizablePanel>

      {/* --- Compose Dialog --- */}
      <ComposeDialog open={composeOpen} onClose={() => setComposeOpen(false)} onSent={() => { setComposeOpen(false); handleRefresh(); }} accountIdx={activeAccountIdx} />
    </ResizablePanelGroup>
  );
}

// ============================================================
// MESSAGE DETAIL
// ============================================================

function MessageDetail({
  message, onClose, onArchive, onTrash, onToggleRead, onReply, onReplyAll, onForward,
  replyMode, onCloseReply, onSent, accountIdx,
}: {
  message: GmailMessage;
  onClose: () => void;
  onArchive: () => void;
  onTrash: () => void;
  onToggleRead: () => void;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  replyMode: "reply" | "replyAll" | "forward" | null;
  onCloseReply: () => void;
  onSent: () => void;
  accountIdx: number;
}) {
  const from = getMessageFrom(message);
  const to = getMessageTo(message);
  const cc = getMessageCc(message);
  const subject = getMessageSubject(message);
  const date = getMessageDate(message);
  const body = getMessageBody(message);
  const attachments = getMessageAttachments(message);

  return (
    <div className="flex flex-col h-full min-w-0 overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-1 p-2 border-b">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Zurück</TooltipContent>
        </Tooltip>
        <div className="flex-1" />
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onArchive}>
              <Archive className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Archivieren</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onTrash}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Löschen</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onToggleRead}>
              <MailOpen className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Gelesen/Ungelesen</TooltipContent>
        </Tooltip>
      </div>

      {/* Message content */}
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-5 max-w-3xl overflow-hidden">
          <h1 className="text-xl font-semibold mb-4">{subject}</h1>

          <div className="flex items-start gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
              {(from.name || from.email).charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-2">
                <span className="font-medium text-sm">{from.name || from.email}</span>
                <span className="text-xs text-muted-foreground">&lt;{from.email}&gt;</span>
              </div>
              <p className="text-xs text-muted-foreground">
                An: {to}
                {cc ? ` | Cc: ${cc}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">{formatFullDate(date)}</p>
            </div>
          </div>

          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-4">
              {attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 bg-muted rounded-md text-xs">
                  <Paperclip className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate max-w-[200px]">{att.filename}</span>
                  <span className="text-muted-foreground">({Math.round(att.size / 1024)}KB)</span>
                </div>
              ))}
            </div>
          )}

          <Separator className="mb-4" />

          <iframe
            srcDoc={`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;font-size:14px;line-height:1.5;color:#222;margin:0;padding:0;word-break:break-word;}img{max-width:100%!important;height:auto!important;}table{max-width:100%!important;}a{color:#2563eb;}</style></head><body>${body}</body></html>`}
            sandbox="allow-same-origin"
            className="w-full border-0 min-h-[200px]"
            style={{ colorScheme: "light" }}
            onLoad={(e) => {
              const iframe = e.target as HTMLIFrameElement;
              if (iframe.contentDocument?.body) {
                iframe.style.height = iframe.contentDocument.body.scrollHeight + 32 + "px";
              }
            }}
          />

          {/* Reply actions */}
          {!replyMode && (
            <div className="flex items-center gap-2 mt-6 pt-4 border-t">
              <Button variant="outline" size="sm" onClick={onReply}>
                <Reply className="h-3.5 w-3.5 mr-1" /> Antworten
              </Button>
              <Button variant="outline" size="sm" onClick={onReplyAll}>
                <ReplyAll className="h-3.5 w-3.5 mr-1" /> Allen antworten
              </Button>
              <Button variant="outline" size="sm" onClick={onForward}>
                <Forward className="h-3.5 w-3.5 mr-1" /> Weiterleiten
              </Button>
            </div>
          )}

          {/* Inline reply */}
          {replyMode && (
            <InlineReply
              mode={replyMode}
              originalMessage={message}
              onClose={onCloseReply}
              onSent={onSent}
              accountIdx={accountIdx}
            />
          )}
        </div>
      </ScrollArea>
    </div>
  );
}

// ============================================================
// INLINE REPLY
// ============================================================

function InlineReply({
  mode, originalMessage, onClose, onSent, accountIdx,
}: {
  mode: "reply" | "replyAll" | "forward";
  accountIdx: number;
  originalMessage: GmailMessage;
  onClose: () => void;
  onSent: () => void;
}) {
  const from = getMessageFrom(originalMessage);
  const to = getMessageTo(originalMessage);
  const cc = getMessageCc(originalMessage);
  const subject = getMessageSubject(originalMessage);

  const [toField, setToField] = useState(() => {
    if (mode === "forward") return "";
    return from.email;
  });
  const [ccField, setCcField] = useState(() => {
    if (mode === "replyAll") return cc;
    return "";
  });
  const [subjectField] = useState(() => {
    const prefix = mode === "forward" ? "Fwd: " : "Re: ";
    return subject.startsWith("Re:") || subject.startsWith("Fwd:") ? subject : prefix + subject;
  });
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!toField.trim()) { toast.error("Empfänger fehlt"); return; }
    setSending(true);
    try {
      const accs = getGmailAccounts();
      const acc = accs[Math.min(accountIdx, accs.length - 1)];
      const token = await getValidGmailToken(acc);
      const messageId = originalMessage.payload?.headers?.find((h) => h.name === "Message-ID" || h.name === "Message-Id")?.value;
      await sendEmail(token, toField, subjectField, body.replace(/\n/g, "<br>"), {
        cc: ccField || undefined,
        threadId: mode !== "forward" ? originalMessage.threadId : undefined,
        inReplyTo: mode !== "forward" ? messageId : undefined,
        references: mode !== "forward" ? messageId : undefined,
        from: acc.email,
      });
      toast.success("Gesendet!");
      onSent();
    } catch (e: any) {
      toast.error("Fehler beim Senden: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 border rounded-lg p-4 bg-muted/30">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium">
          {mode === "reply" ? "Antworten" : mode === "replyAll" ? "Allen antworten" : "Weiterleiten"}
        </span>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
      <div className="space-y-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground w-8">An:</span>
          <Input className="h-7 text-sm" value={toField} onChange={(e) => setToField(e.target.value)} />
        </div>
        {(mode === "replyAll" || mode === "forward") && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground w-8">Cc:</span>
            <Input className="h-7 text-sm" value={ccField} onChange={(e) => setCcField(e.target.value)} />
          </div>
        )}
      </div>
      <Textarea
        placeholder="Nachricht schreiben..."
        className="min-h-[120px] text-sm mb-3"
        value={body}
        onChange={(e) => setBody(e.target.value)}
        autoFocus
      />
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleSend} disabled={sending}>
          {sending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1" />}
          Senden
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose}>Verwerfen</Button>
      </div>
    </div>
  );
}

// ============================================================
// COMPOSE DIALOG
// ============================================================

function ComposeDialog({ open, onClose, onSent, accountIdx }: { open: boolean; onClose: () => void; onSent: () => void; accountIdx: number }) {
  const [to, setTo] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [showCcBcc, setShowCcBcc] = useState(false);

  const resetForm = () => {
    setTo(""); setCc(""); setBcc(""); setSubject(""); setBody(""); setShowCcBcc(false);
  };

  const handleSend = async () => {
    if (!to.trim()) { toast.error("Empfänger fehlt"); return; }
    if (!subject.trim()) { toast.error("Betreff fehlt"); return; }
    setSending(true);
    try {
      const accs = getGmailAccounts();
      const acc = accs[Math.min(accountIdx, accs.length - 1)];
      const token = await getValidGmailToken(acc);
      await sendEmail(token, to, subject, body.replace(/\n/g, "<br>"), {
        cc: cc || undefined,
        bcc: bcc || undefined,
        from: acc.email,
      });
      toast.success("E-Mail gesendet!");
      resetForm();
      onSent();
    } catch (e: any) {
      toast.error("Fehler: " + e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) { resetForm(); onClose(); } }}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Neue E-Mail</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-12">An:</span>
            <Input value={to} onChange={(e) => setTo(e.target.value)} placeholder="empfaenger@email.com" className="text-sm" />
            {!showCcBcc && (
              <Button variant="ghost" size="sm" className="text-xs shrink-0" onClick={() => setShowCcBcc(true)}>
                Cc/Bcc
              </Button>
            )}
          </div>
          {showCcBcc && (
            <>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">Cc:</span>
                <Input value={cc} onChange={(e) => setCc(e.target.value)} className="text-sm" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground w-12">Bcc:</span>
                <Input value={bcc} onChange={(e) => setBcc(e.target.value)} className="text-sm" />
              </div>
            </>
          )}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground w-12">Betreff:</span>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} className="text-sm" />
          </div>
          <Textarea
            placeholder="Nachricht schreiben..."
            className="min-h-[200px] text-sm"
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => { resetForm(); onClose(); }}>Verwerfen</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Send className="h-4 w-4 mr-1" />}
            Senden
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
