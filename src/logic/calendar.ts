import type { IcsEvent } from './ical';
import { toISO } from './dates';

export type CalLens = 'work' | 'life' | 'business' | 'training';
export type SourceKind = 'calendar' | 'airbnb' | 'cleaning';

export interface CalSource {
  id: string;
  name: string;
  lens: CalLens;
  kind: SourceKind;
  url: string;
}

export interface CalEvent extends IcsEvent {
  id: string;
  sourceId: string;
  lens: CalLens;
  kind: SourceKind;
  /** other calendars that carried the same event */
  alsoIn?: string[];
}

export const CAL_LENSES: { id: CalLens; label: string }[] = [
  { id: 'work', label: 'Work' },
  { id: 'life', label: 'Life' },
  { id: 'business', label: 'Business' },
  { id: 'training', label: 'Training' },
];

const AIRLINES: Record<string, string> = {
  united: 'UA', alaska: 'AS', delta: 'DL', american: 'AA', southwest: 'WN', jetblue: 'B6',
  hawaiian: 'HA', frontier: 'F9', spirit: 'NK', 'air canada': 'AC', 'british airways': 'BA', lufthansa: 'LH',
};
const CODES = new Set(Object.values(AIRLINES));

/** "UA1234|2026-11-20" for anything that looks like a flight, else null. */
export function flightKey(e: Pick<IcsEvent, 'title' | 'description' | 'start'>): string | null {
  const text = `${e.title} ${e.description ?? ''}`;
  let code: string | undefined, num: string | undefined;
  const byCode = text.match(/\b([A-Z0-9]{2})\s?(\d{1,4})\b/g);
  if (byCode) {
    for (const hit of byCode) {
      const m = hit.match(/^([A-Z0-9]{2})\s?(\d{1,4})$/)!;
      if (CODES.has(m[1])) { code = m[1]; num = m[2]; break; }
    }
  }
  if (!code) {
    const lower = text.toLowerCase();
    for (const [name, c] of Object.entries(AIRLINES)) {
      const m = lower.match(new RegExp(`${name}(?: airlines?)?(?: flight)?\\s*#?\\s*(\\d{1,4})\\b`));
      if (m) { code = c; num = m[1]; break; }
    }
  }
  if (!code || !num) return null;
  return `${code}${Number(num)}|${toISO(new Date(e.start))}`;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * One event per real-world thing: flights match on airline + number + date,
 * everything else on title + start time. The first source wins; the rest are noted.
 */
export function dedupe(events: CalEvent[], names: Record<string, string> = {}): CalEvent[] {
  const seen = new Map<string, CalEvent>();
  const out: CalEvent[] = [];
  for (const e of events) {
    const key = flightKey(e) ?? `${norm(e.title)}|${e.allDay ? toISO(new Date(e.start)) : e.start}`;
    const first = seen.get(key);
    if (first) {
      if (first.sourceId !== e.sourceId) first.alsoIn = [...new Set([...(first.alsoIn ?? []), names[e.sourceId] ?? e.sourceId])];
      if (!first.location && e.location) first.location = e.location;
      continue;
    }
    const copy = { ...e };
    seen.set(key, copy);
    out.push(copy);
  }
  return out.sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
}

export function eventsOnDay(events: CalEvent[], day: Date): CalEvent[] {
  const s = new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  const e = s + 864e5;
  return events
    .filter((x) => x.start < e && (x.end > s || (x.end === x.start && x.start >= s)))
    .sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start - b.start);
}

// ---------- Rental ----------

export interface Stay {
  id: string;
  title: string;
  checkIn: string; // ISO date
  checkOut: string;
  nights: number;
  blocked: boolean;
  /** last 4 of guest phone or reservation code, when Airbnb provides it */
  ref?: string;
  turnover?: 'same-day' | 'gap';
  gapNights?: number;
  cleaning?: CalEvent;
}

const dayISO = (ms: number) => toISO(new Date(ms));
const nightsBetween = (a: string, b: string) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 864e5);

/** Airbnb: "Reserved" = a booking, "Airbnb (Not available)" = blocked by host. */
export function stays(events: CalEvent[]): Stay[] {
  const bookings = events
    .filter((e) => e.kind === 'airbnb')
    .map((e): Stay => {
      const checkIn = dayISO(e.start);
      const checkOut = dayISO(e.allDay ? e.end : e.end);
      const blocked = /not available|blocked|unavailable/i.test(e.title);
      const ref = e.description?.match(/Last 4 Digits\)?:\s*(\d{4})/i)?.[1] ?? e.description?.match(/details\/([A-Z0-9]{8,})/)?.[1];
      return { id: e.id, title: blocked ? 'Blocked' : e.title === 'Reserved' ? 'Guest stay' : e.title, checkIn, checkOut, nights: nightsBetween(checkIn, checkOut), blocked, ref };
    })
    .sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const cleanings = events.filter((e) => e.kind === 'cleaning').sort((a, b) => a.start - b.start);

  const guests = bookings.filter((b) => !b.blocked);
  for (let i = 0; i < guests.length; i++) {
    const s = guests[i];
    const next = guests[i + 1];
    s.cleaning = cleanings.find((c) => dayISO(c.start) >= s.checkOut && (!next || dayISO(c.start) <= next.checkIn));
    if (next) {
      const gap = nightsBetween(s.checkOut, next.checkIn);
      s.turnover = gap <= 0 ? 'same-day' : 'gap';
      s.gapNights = Math.max(0, gap);
    }
  }
  return bookings;
}

/** Map the task area filter to calendar lenses. */
export function lensesFor(filter: 'both' | 'business' | 'life'): CalLens[] {
  if (filter === 'business') return ['work', 'business'];
  if (filter === 'life') return ['life', 'training'];
  return ['work', 'life', 'business', 'training'];
}

/**
 * For the agenda, a multi-night Airbnb booking would repeat on every day.
 * Show it as a check-in on the first day and a check-out on the last instead,
 * and leave host blocks out.
 */
export function agendaEvents(events: CalEvent[]): CalEvent[] {
  const out: CalEvent[] = [];
  for (const e of events) {
    if (e.kind !== 'airbnb') { out.push(e); continue; }
    if (/not available|blocked|unavailable/i.test(e.title)) continue;
    const nights = Math.round((e.end - e.start) / 864e5);
    const inDay = new Date(e.start);
    const outDay = new Date(e.end);
    const dayEnd = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    out.push({ ...e, id: `${e.id}:in`, title: `Tahoe check-in · ${nights} night${nights === 1 ? '' : 's'}`, start: inDay.getTime(), end: dayEnd(inDay) });
    out.push({ ...e, id: `${e.id}:out`, title: 'Tahoe check-out', start: outDay.getTime(), end: dayEnd(outDay) });
  }
  return out;
}
