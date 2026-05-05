import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, RefreshCw, Loader2, Wrench, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CLAUDE_TOOLS, executeClaudeTool, isDestructiveTool, describeDeleteAction } from "@/lib/claude-tools";
// Adslift Company-Knowledge — wird im System-Prompt mitgeschickt + gecached
import ADSLIFT_CONTEXT from "@/lib/adslift-context.md?raw";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };
type SystemBlock = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };

// UI-Modell — was wir im Chat-Verlauf rendern
type DisplayMessage =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; tools: { name: string; input: any }[] };

// Stabiler Operator-Prompt — wird mit gecached
const OPERATOR_PROMPT = `Du bist der interne Assistent von Adslift OS — der eigenen Internal-Tools-App des Adslift-Teams. Du sprichst mit dem CEO (Alex) oder seinem Mitgründer (Daniel).

Du hast zwei Wissensquellen:
1) Das ADSLIFT-COMPANY-WISSEN (siehe vorhergehender Block) — Offer, Pricing, ICP, Sales-Skripte, Delivery-Prozesse, Brand, Team, Roadmap.
2) Live-Daten aus der App via Tools: Kunden, Pipeline-Projekte, Tasks, Close-Activities (Calls/Meetings/Notes), Kalender.

Nutze beide proaktiv. Bei strategischen Fragen → Company-Wissen anwenden. Bei operativen Fragen ("Wie läuft Stegemann?", "Was steht heute an?") → Tools nutzen. Bei kombinierten Fragen → beides.

Stil:
- Deutsch, Du-Form, direkt, kein Bullshit
- Knapp und konkret, keine Romane
- Bei Listen: max. die 5-10 wichtigsten Einträge
- Bei Datumsangaben: Format "DD.MM.YYYY"
- Wenn du Daten mit Tools holst: nutze die echten Namen (Kunde, Projekt) statt IDs in der Antwort
- Keine Markdown-Tabellen — schlechte Lesbarkeit im Chat. Stattdessen Bullet-Listen.
- Tone: selbstbewusst, ergebnisorientiert, locker aber professionell — wie ein Gespräch unter Unternehmern.
- Spekuliere nie. Wenn du eine Info nicht hast: sag's, oder hol sie via Tool.

Schreib-Berechtigungen:
- Tasks erstellen / aktualisieren: direkt via create_task / update_task
- Kunden-Kommentare anlegen: create_client_comment
- Kalender-Events anlegen: create_calendar_event
- Pipeline-Projekte updaten: update_pipeline_project (Status, Onboarding-Confirmed, Meeting-Notes)

Lösch-Berechtigungen — WICHTIG:
- delete_task / delete_calendar_event / delete_client_comment lösen automatisch eine UI-Bestätigung beim User aus
- Wenn du löschen willst: zeig vorher kurz an WAS du löschen willst (Titel, Datum etc.), erkläre den Grund, und rufe dann das delete-Tool auf
- Der User muss explizit auf "Löschen bestätigen" klicken — wenn er ablehnt, kommt das als Tool-Ergebnis zurück
- Niemals löschen ohne dass der User vorher klar zustimmt`;

const MAX_TOOL_LOOP = 8;

// System-Prompt mit Caching: stabile Adslift-Wissensbasis im ersten Block (gecached),
// dann Operator-Prompt, dann tagesvariabler Kontext.
function buildSystemPrompt(): SystemBlock[] {
  const today = new Date().toLocaleDateString("de-DE", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  });
  return [
    {
      type: "text",
      text: "## ADSLIFT-COMPANY-WISSEN\n\n" + ADSLIFT_CONTEXT,
      cache_control: { type: "ephemeral" },
    },
    {
      type: "text",
      text: OPERATOR_PROMPT,
    },
    {
      type: "text",
      text: `Heute: ${today}.`,
    },
  ];
}

type PendingConfirmation = {
  toolName: string;
  input: any;
  title: string;
  details: string[];
  resolve: (confirmed: boolean) => void;
};

export function ClaudeChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendingConfirm, setPendingConfirm] = useState<PendingConfirmation | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Wird vom Tool-Loop aufgerufen — zeigt UI-Card und wartet auf Klick
  const askForDeleteConfirmation = (toolName: string, toolInput: any): Promise<boolean> => {
    return new Promise(async (resolve) => {
      const desc = await describeDeleteAction(toolName, toolInput);
      setPendingConfirm({
        toolName,
        input: toolInput,
        title: desc.title,
        details: desc.details,
        resolve,
      });
    });
  };

  // Auto-scroll bei neuen Nachrichten
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  // ESC schließt
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Cmd+J / Ctrl+J zum Öffnen
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "j") {
        e.preventDefault();
        setOpen((v) => !v);
        if (!open) setTimeout(() => inputRef.current?.focus(), 50);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  // Custom-Events von externen Triggern (z.B. AppSidebar-Button)
  useEffect(() => {
    const onOpen = () => {
      setOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    const onToggle = () => setOpen((v) => !v);
    window.addEventListener("claude-chat:open", onOpen);
    window.addEventListener("claude-chat:toggle", onToggle);
    return () => {
      window.removeEventListener("claude-chat:open", onOpen);
      window.removeEventListener("claude-chat:toggle", onToggle);
    };
  }, []);

  const reset = () => {
    setMessages([]);
    setApiHistory([]);
    setError(null);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    setError(null);

    // UI updaten
    setMessages((m) => [...m, { kind: "user", text }]);
    setLoading(true);

    // API-History bauen
    const newHistory: ApiMessage[] = [
      ...apiHistory,
      { role: "user", content: text },
    ];

    try {
      const result = await runChatLoop(newHistory, askForDeleteConfirmation);
      setApiHistory(result.history);
      setMessages((m) => [
        ...m,
        { kind: "assistant", text: result.text, tools: result.tools },
      ]);
    } catch (e: any) {
      setError(e.message || "Unbekannter Fehler");
    }
    setLoading(false);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        className={cn(
          "fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
      />

      {/* Slide-in Panel */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-full w-full sm:w-[420px] flex flex-col",
          "bg-card/95 backdrop-blur-glass border-r border-white/[0.08] shadow-2xl",
          "transition-transform duration-300 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Header */}
        <div className="px-4 py-3 border-b border-white/[0.06] flex items-center gap-2 shrink-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 flex items-center justify-center shadow-md">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold leading-tight">Claude</h3>
            <p className="text-[10px] text-muted-foreground">Adslift-OS Assistant · {messages.length} Nachrichten</p>
          </div>
          {messages.length > 0 && (
            <button
              onClick={reset}
              title="Neuer Chat"
              className="p-1.5 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => setOpen(false)}
            title="Schließen (Esc)"
            className="p-1.5 rounded-md hover:bg-white/[0.06] text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && !loading && (
            <div className="h-full flex flex-col items-center justify-center text-center px-6">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500/20 via-fuchsia-500/20 to-rose-500/20 flex items-center justify-center mb-3">
                <Sparkles className="h-6 w-6 text-violet-400" />
              </div>
              <h4 className="text-sm font-semibold mb-1">Frag was du willst</h4>
              <p className="text-xs text-muted-foreground mb-4 max-w-xs">
                Ich kenne deine Kunden, Projekte, Tasks, Calls und den Kalender. Stell mir konkrete Fragen.
              </p>
              <div className="flex flex-col gap-1.5 w-full max-w-xs">
                {[
                  "Was steht heute an?",
                  "Welche Kunden haben überfällige Tasks?",
                  "Wie lief das letzte Call mit Stegemann?",
                  "Welche D4Y-Projekte sind grad live?",
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="text-left text-xs px-3 py-2 rounded-lg border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.05] hover:border-violet-500/30 transition-all text-muted-foreground hover:text-foreground"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <MessageBubble key={i} msg={msg} />
          ))}

          {pendingConfirm && (
            <div className="rounded-lg border-2 border-red-500/40 bg-red-500/[0.06] p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-red-400">{pendingConfirm.title}</p>
                  <ul className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
                    {pendingConfirm.details.map((d, i) => (
                      <li key={i} className="flex gap-1.5"><span className="text-muted-foreground/50">·</span><span>{d}</span></li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1 h-8 text-xs"
                  onClick={() => {
                    pendingConfirm.resolve(false);
                    setPendingConfirm(null);
                  }}
                >
                  Abbrechen
                </Button>
                <Button
                  size="sm"
                  className="flex-1 h-8 text-xs bg-red-500 hover:bg-red-600 text-white"
                  onClick={() => {
                    pendingConfirm.resolve(true);
                    setPendingConfirm(null);
                  }}
                >
                  Löschen bestätigen
                </Button>
              </div>
            </div>
          )}

          {loading && !pendingConfirm && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pl-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-400" />
              <span>denkt nach...</span>
            </div>
          )}

          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              <span className="font-semibold">Fehler:</span> {error}
            </div>
          )}
        </div>

        {/* Input */}
        <div className="border-t border-white/[0.06] p-3 shrink-0">
          <div className="flex items-end gap-2">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder="Frag mich was..."
              rows={1}
              className="resize-none min-h-9 max-h-32 text-sm"
              disabled={loading}
            />
            <Button
              onClick={send}
              disabled={loading || !input.trim()}
              size="icon"
              className="h-9 w-9 shrink-0 bg-gradient-to-br from-violet-500 to-fuchsia-500 hover:opacity-90"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
            ⌘J zum Toggeln · Enter zum Senden · Shift+Enter für Zeilenumbruch
          </p>
        </div>
      </aside>
    </>
  );
}

function MessageBubble({ msg }: { msg: DisplayMessage }) {
  if (msg.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md px-3 py-2 bg-violet-500/15 text-foreground text-sm whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5">
      {msg.tools.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {msg.tools.map((t, i) => (
            <span
              key={i}
              className="text-[10px] flex items-center gap-1 px-1.5 py-0.5 rounded bg-violet-500/10 text-violet-400 font-mono"
              title={JSON.stringify(t.input)}
            >
              <Wrench className="h-2.5 w-2.5" />
              {t.name}
            </span>
          ))}
        </div>
      )}
      <div className="rounded-2xl rounded-bl-md px-3 py-2 bg-white/[0.04] text-sm whitespace-pre-wrap">
        {msg.text}
      </div>
    </div>
  );
}

// ─── Chat-Loop mit Tool-Use ──────────────────────────────────────────
async function runChatLoop(
  initialHistory: ApiMessage[],
  askForDeleteConfirmation: (toolName: string, input: any) => Promise<boolean>,
): Promise<{
  history: ApiMessage[];
  text: string;
  tools: { name: string; input: any }[];
}> {
  let history = [...initialHistory];
  const usedTools: { name: string; input: any }[] = [];

  for (let i = 0; i < MAX_TOOL_LOOP; i++) {
    const res = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-opus-4-7",
        max_tokens: 4096,
        system: buildSystemPrompt(),
        tools: CLAUDE_TOOLS,
        messages: history,
      }),
    });
    const raw = await res.text();
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      // Vercel/Edge returnt manchmal Plain-Text bei Timeouts oder Gateway-Errors
      console.error("[Claude] Non-JSON response:", { status: res.status, raw: raw.slice(0, 500) });
      throw new Error(
        `Server-Fehler (HTTP ${res.status}): ${raw.slice(0, 200) || "leere Antwort"}`,
      );
    }
    if (!res.ok || data.error) {
      console.error("[Claude] API error:", data);
      throw new Error(data.error?.message || `API ${res.status}: ${JSON.stringify(data).slice(0, 200)}`);
    }

    const blocks: ContentBlock[] = data.content || [];
    history = [...history, { role: "assistant", content: blocks }];

    if (data.stop_reason === "tool_use") {
      const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
      const results: ContentBlock[] = [];
      for (const tu of toolUses) {
        usedTools.push({ name: tu.name, input: tu.input });

        // Destruktive Tools (delete_*) brauchen UI-Bestätigung
        if (isDestructiveTool(tu.name)) {
          const confirmed = await askForDeleteConfirmation(tu.name, tu.input);
          if (!confirmed) {
            results.push({
              type: "tool_result",
              tool_use_id: tu.id,
              content: JSON.stringify({
                rejected: true,
                reason: "User hat die Löschung abgelehnt — nichts wurde gelöscht.",
              }),
            });
            continue;
          }
        }

        try {
          const result = await executeClaudeTool(tu.name, tu.input);
          let str = JSON.stringify(result);
          if (str.length > 30000) str = str.slice(0, 30000) + '..."(truncated)"';
          results.push({ type: "tool_result", tool_use_id: tu.id, content: str });
        } catch (e: any) {
          results.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: `Error: ${e.message || e}`,
            is_error: true,
          });
        }
      }
      history = [...history, { role: "user", content: results }];
      continue;
    }

    // end_turn
    const text = blocks
      .filter((b): b is Extract<ContentBlock, { type: "text" }> => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();
    return { history, text, tools: usedTools };
  }

  throw new Error(`Tool-Loop hat Limit von ${MAX_TOOL_LOOP} erreicht — Anfrage zu komplex?`);
}
