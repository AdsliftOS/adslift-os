import type { CalendarEvent } from "@/store/calendar";

// Sales calls: "Meeting mit X von Adslift" (internal team meeting with prospect)
const SALES_PATTERNS = [
  /meeting mit.*von adslift/i,
  /meeting with.*von adslift/i,
  /termin mit.*von adslift/i,
  /call mit.*von adslift/i,
];

// Client meetings: "Meeting mit Adslift" (existing client meeting)
const CLIENT_PATTERNS = [
  /meeting mit adslift$/i,
  /meeting with adslift$/i,
  /termin mit adslift$/i,
  /call mit adslift$/i,
];

export function isSalesMeeting(event: CalendarEvent): boolean {
  return SALES_PATTERNS.some((p) => p.test(event.title));
}

export function isClientMeeting(event: CalendarEvent): boolean {
  return CLIENT_PATTERNS.some((p) => p.test(event.title));
}

export function getSalesPersonFromTitle(title: string): string | null {
  const match = title.match(/meeting mit (\w+) von adslift/i)
    || title.match(/termin mit (\w+) von adslift/i)
    || title.match(/call mit (\w+) von adslift/i);
  return match ? match[1] : null;
}
