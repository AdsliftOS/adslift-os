import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, X, RefreshCw, Loader2, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { CLAUDE_TOOLS, executeClaudeTool } from "@/lib/claude-tools";

type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_use"; id: string; name: string; input: any }
  | { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };

type ApiMessage = { role: "user" | "assistant"; content: string | ContentBlock[] };

// UI-Modell — was wir im Chat-Verlauf rendern
type DisplayMessage =
  | { kind: "user"; text: string }
  | { kind: "assistant"; text: string; tools: { name: string; input: any }[] };

const SYSTEM_PROMPT = `Du bist der interne Assistent von Adslift OS — einer Performance-Marketing-Agentur, die Kunden mit Meta-Ads-Kampagnen, DWY (Done-With-You) Coaching und D4Y (Done-For-You) Service betreut.

Du hast Zugriff auf das gesamte System via Tools: Kunden, Pipeline-Projekte, Tasks, Close-Activities (Calls/Meetings/Notes), Kalender. Nutze diese Tools proaktiv um konkrete, daten-basierte Antworten zu geben — niemals Speculations.

Stil:
- Deutsch, direkt, kein Bullshit
- Knapp und konkret, keine Romane
- Bei Listen: max. die 5-10 wichtigsten Einträge
- Bei Datumsangaben: Format "DD.MM.YYYY"
- Wenn du Daten mit Tools holst: nutze die echten Namen (Kunde, Projekt) statt IDs in der Antwort
- Keine Markdown-Tabellen — schlechte Lesbarkeit im Chat. Stattdessen Bullet-Listen.
- Für komplexe Fragen: erst die richtigen Tools wählen, dann kombinieren, dann antworten

Du sprichst mit dem CEO (Alex) oder seinem Mitgründer (Daniel). Kontext: heute ist ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}.`;

const MAX_TOOL_LOOP = 8;

export function ClaudeChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [apiHistory, setApiHistory] = useState<ApiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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
      const result = await runChatLoop(newHistory);
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
      {/* Floating Toggle Button */}
      <button
        onClick={() => {
          setOpen((v) => !v);
          if (!open) setTimeout(() => inputRef.current?.focus(), 50);
        }}
        className={cn(
          "fixed bottom-6 left-6 z-40 h-12 w-12 rounded-full shadow-lg transition-all flex items-center justify-center",
          "bg-gradient-to-br from-violet-500 via-fuchsia-500 to-rose-500 text-white",
          "hover:scale-110 hover:shadow-xl hover:shadow-violet-500/40",
          open && "scale-95 opacity-0 pointer-events-none",
        )}
        title="Claude öffnen (⌘J)"
      >
        <Sparkles className="h-5 w-5" />
      </button>

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

          {loading && (
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
async function runChatLoop(initialHistory: ApiMessage[]): Promise<{
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
        system: SYSTEM_PROMPT,
        tools: CLAUDE_TOOLS,
        messages: history,
      }),
    });
    const data = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error?.message || `API ${res.status}`);
    }

    const blocks: ContentBlock[] = data.content || [];
    history = [...history, { role: "assistant", content: blocks }];

    if (data.stop_reason === "tool_use") {
      const toolUses = blocks.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
      const results: ContentBlock[] = [];
      for (const tu of toolUses) {
        usedTools.push({ name: tu.name, input: tu.input });
        try {
          const result = await executeClaudeTool(tu.name, tu.input);
          // Auf 30k Zeichen kappen damit Context nicht explodiert
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
