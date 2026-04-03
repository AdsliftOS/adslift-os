import { getGmailAccounts, getValidGmailToken, type GmailAccount } from "@/lib/gmail-auth";

const API = "https://gmail.googleapis.com/gmail/v1/users/me";

// --- Types ---

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
  messagesTotal?: number;
  messagesUnread?: number;
};

export type GmailMessageHeader = {
  name: string;
  value: string;
};

export type GmailMessagePart = {
  mimeType: string;
  headers?: GmailMessageHeader[];
  body?: { data?: string; size?: number; attachmentId?: string };
  parts?: GmailMessagePart[];
  filename?: string;
};

export type GmailMessage = {
  id: string;
  threadId: string;
  labelIds: string[];
  snippet: string;
  internalDate: string;
  payload: GmailMessagePart;
  sizeEstimate: number;
};

export type GmailThread = {
  id: string;
  historyId: string;
  messages: GmailMessage[];
};

export type GmailListItem = {
  id: string;
  threadId: string;
};

export type GmailListResponse = {
  messages: GmailListItem[];
  nextPageToken?: string;
  resultSizeEstimate: number;
};

// --- Helpers ---

function getHeader(msg: GmailMessage, name: string): string {
  const h = msg.payload?.headers?.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return h?.value || "";
}

export function parseFrom(from: string): { name: string; email: string } {
  const match = from.match(/^(.+?)\s*<(.+?)>$/);
  if (match) return { name: match[1].replace(/"/g, "").trim(), email: match[2] };
  return { name: from, email: from };
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function extractBody(part: GmailMessagePart): { html: string; text: string } {
  if (part.mimeType === "text/html" && part.body?.data) {
    return { html: decodeBase64Url(part.body.data), text: "" };
  }
  if (part.mimeType === "text/plain" && part.body?.data) {
    return { html: "", text: decodeBase64Url(part.body.data) };
  }
  if (part.parts) {
    let html = "";
    let text = "";
    for (const sub of part.parts) {
      const result = extractBody(sub);
      if (result.html) html = result.html;
      if (result.text && !text) text = result.text;
    }
    return { html, text };
  }
  return { html: "", text: "" };
}

export function getMessageBody(msg: GmailMessage): string {
  const { html, text } = extractBody(msg.payload);
  return html || text.replace(/\n/g, "<br>");
}

export function getMessageSubject(msg: GmailMessage): string {
  return getHeader(msg, "Subject") || "(Kein Betreff)";
}

export function getMessageFrom(msg: GmailMessage): { name: string; email: string } {
  return parseFrom(getHeader(msg, "From"));
}

export function getMessageTo(msg: GmailMessage): string {
  return getHeader(msg, "To");
}

export function getMessageDate(msg: GmailMessage): Date {
  return new Date(parseInt(msg.internalDate));
}

export function getMessageCc(msg: GmailMessage): string {
  return getHeader(msg, "Cc");
}

export type GmailAttachment = {
  filename: string;
  mimeType: string;
  size: number;
  attachmentId: string;
  partId?: string;
};

function extractAttachments(part: GmailMessagePart, list: GmailAttachment[] = []): GmailAttachment[] {
  if (part.filename && part.body?.attachmentId) {
    list.push({
      filename: part.filename,
      mimeType: part.mimeType,
      size: part.body.size || 0,
      attachmentId: part.body.attachmentId,
    });
  }
  if (part.parts) {
    for (const sub of part.parts) extractAttachments(sub, list);
  }
  return list;
}

export function getMessageAttachments(msg: GmailMessage): GmailAttachment[] {
  return extractAttachments(msg.payload);
}

// --- API calls ---

async function gmailFetch(token: string, path: string, init?: RequestInit): Promise<any> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", ...init?.headers },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Gmail API ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export async function listLabels(token: string): Promise<GmailLabel[]> {
  const data = await gmailFetch(token, "/labels");
  return data.labels || [];
}

export async function getLabel(token: string, labelId: string): Promise<GmailLabel> {
  return gmailFetch(token, `/labels/${encodeURIComponent(labelId)}`);
}

export async function listMessages(
  token: string,
  opts: { labelIds?: string[]; q?: string; maxResults?: number; pageToken?: string } = {}
): Promise<GmailListResponse> {
  const params = new URLSearchParams();
  if (opts.labelIds?.length) params.set("labelIds", opts.labelIds.join(","));
  if (opts.q) params.set("q", opts.q);
  params.set("maxResults", String(opts.maxResults || 30));
  if (opts.pageToken) params.set("pageToken", opts.pageToken);
  const data = await gmailFetch(token, `/messages?${params.toString()}`);
  return { messages: data.messages || [], nextPageToken: data.nextPageToken, resultSizeEstimate: data.resultSizeEstimate || 0 };
}

export async function getMessage(token: string, messageId: string): Promise<GmailMessage> {
  return gmailFetch(token, `/messages/${messageId}?format=full`);
}

export async function getThread(token: string, threadId: string): Promise<GmailThread> {
  return gmailFetch(token, `/threads/${threadId}?format=full`);
}

export async function modifyMessage(
  token: string,
  messageId: string,
  addLabelIds: string[] = [],
  removeLabelIds: string[] = []
): Promise<void> {
  await gmailFetch(token, `/messages/${messageId}/modify`, {
    method: "POST",
    body: JSON.stringify({ addLabelIds, removeLabelIds }),
  });
}

export async function trashMessage(token: string, messageId: string): Promise<void> {
  await gmailFetch(token, `/messages/${messageId}/trash`, { method: "POST" });
}

export async function untrashMessage(token: string, messageId: string): Promise<void> {
  await gmailFetch(token, `/messages/${messageId}/untrash`, { method: "POST" });
}

export async function markAsRead(token: string, messageId: string): Promise<void> {
  await modifyMessage(token, messageId, [], ["UNREAD"]);
}

export async function markAsUnread(token: string, messageId: string): Promise<void> {
  await modifyMessage(token, messageId, ["UNREAD"], []);
}

export async function archiveMessage(token: string, messageId: string): Promise<void> {
  await modifyMessage(token, messageId, [], ["INBOX"]);
}

export async function starMessage(token: string, messageId: string): Promise<void> {
  await modifyMessage(token, messageId, ["STARRED"], []);
}

export async function unstarMessage(token: string, messageId: string): Promise<void> {
  await modifyMessage(token, messageId, [], ["STARRED"]);
}

// --- Send ---

function buildRawEmail(to: string, subject: string, body: string, cc?: string, bcc?: string, inReplyTo?: string, references?: string, from?: string): string {
  const boundary = "boundary_" + Date.now();
  const lines = [
    `From: ${from || "me"}`,
    `To: ${to}`,
  ];
  if (cc) lines.push(`Cc: ${cc}`);
  if (bcc) lines.push(`Bcc: ${bcc}`);
  lines.push(`Subject: ${subject}`);
  lines.push(`MIME-Version: 1.0`);
  if (inReplyTo) {
    lines.push(`In-Reply-To: ${inReplyTo}`);
    lines.push(`References: ${references || inReplyTo}`);
  }
  lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
  lines.push("");
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/plain; charset=UTF-8");
  lines.push("");
  lines.push(body.replace(/<[^>]*>/g, ""));
  lines.push(`--${boundary}`);
  lines.push("Content-Type: text/html; charset=UTF-8");
  lines.push("");
  lines.push(body);
  lines.push(`--${boundary}--`);

  const raw = lines.join("\r\n");
  return btoa(unescape(encodeURIComponent(raw))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function sendEmail(
  token: string,
  to: string,
  subject: string,
  body: string,
  opts?: { cc?: string; bcc?: string; threadId?: string; inReplyTo?: string; references?: string; from?: string }
): Promise<GmailMessage> {
  const raw = buildRawEmail(to, subject, body, opts?.cc, opts?.bcc, opts?.inReplyTo, opts?.references, opts?.from);
  return gmailFetch(token, "/messages/send", {
    method: "POST",
    body: JSON.stringify({ raw, threadId: opts?.threadId }),
  });
}

// --- Multi-account helpers ---

export async function getGmailToken(): Promise<{ token: string; email: string } | null> {
  const accounts = getGmailAccounts();
  if (accounts.length === 0) return null;
  const account = accounts[0];
  const token = await getValidGmailToken(account);
  return { token, email: account.email };
}

export async function getGmailTokenForAccount(account: GmailAccount): Promise<string> {
  return getValidGmailToken(account);
}

// System labels we show in the sidebar
export const SYSTEM_LABELS = [
  { id: "INBOX", name: "Posteingang", icon: "inbox" },
  { id: "STARRED", name: "Markiert", icon: "star" },
  { id: "SENT", name: "Gesendet", icon: "send" },
  { id: "DRAFT", name: "Entwürfe", icon: "file-text" },
  { id: "SPAM", name: "Spam", icon: "alert-triangle" },
  { id: "TRASH", name: "Papierkorb", icon: "trash-2" },
] as const;
