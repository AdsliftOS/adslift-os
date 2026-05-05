// Client-Helper für Claude. Geht über /api/claude (Edge-Proxy in api/claude.ts),
// der den API-Key serverseitig hält. Keine SDK-Dep — direktes fetch.

export type ClaudeMessage = { role: "user" | "assistant"; content: string };

type AskOptions = {
  system?: string;
  messages: ClaudeMessage[];
  /** Default 4096. Für lange Outputs (Reports etc.) entsprechend hochsetzen. */
  max_tokens?: number;
  /** Default "claude-opus-4-7". "claude-sonnet-4-6" oder "claude-haiku-4-5" als günstigere Alternativen. */
  model?: string;
};

type ContentBlock = { type: string; text?: string };
type AnthropicResponse = {
  content?: ContentBlock[];
  stop_reason?: string;
  usage?: { input_tokens: number; output_tokens: number };
  error?: { message?: string; type?: string };
};

export async function askClaude(opts: AskOptions): Promise<string> {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model || "claude-opus-4-7",
      max_tokens: opts.max_tokens ?? 4096,
      system: opts.system,
      messages: opts.messages,
    }),
  });

  const data: AnthropicResponse = await res.json();
  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Claude API ${res.status}`);
  }

  return (data.content || [])
    .filter((b) => b.type === "text" && b.text)
    .map((b) => b.text!)
    .join("\n");
}
