/**
 * Small iCalendar (RFC 5545) reader: enough for Google secret addresses,
 * Airbnb, Outlook/Exchange published calendars and most app feeds.
 * Handles folded lines, TZID wall times, all-day events, common RRULEs,
 * EXDATE and moved instances (RECURRENCE-ID).
 */

export interface IcsEvent {
  uid: string;
  title: string;
  location?: string;
  description?: string;
  allDay: boolean;
  /** epoch ms. All-day events start at local midnight of their date. */
  start: number;
  end: number;
  status?: string;
}

interface Prop { name: string; params: Record<string, string>; value: string }
interface Raw { props: Prop[] }

const WINDOWS_TZ: Record<string, string> = {
  'Pacific Standard Time': 'America/Los_Angeles',
  'Mountain Standard Time': 'America/Denver',
  'US Mountain Standard Time': 'America/Phoenix',
  'Central Standard Time': 'America/Chicago',
  'Eastern Standard Time': 'America/New_York',
  'GMT Standard Time': 'Europe/London',
  'W. Europe Standard Time': 'Europe/Berlin',
  'Romance Standard Time': 'Europe/Paris',
  'Hawaiian Standard Time': 'Pacific/Honolulu',
  'Alaskan Standard Time': 'America/Anchorage',
  'India Standard Time': 'Asia/Kolkata',
  'Tokyo Standard Time': 'Asia/Tokyo',
  'AUS Eastern Standard Time': 'Australia/Sydney',
  UTC: 'UTC',
};

function normalizeTz(tz?: string): string | undefined {
  if (!tz) return undefined;
  const t = tz.replace(/^"|"$/g, '').replace(/^\/[^/]+\/[^/]+\//, ''); // strip "/mozilla.org/20050126_1/" style prefixes
  const mapped = WINDOWS_TZ[t] ?? t;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: mapped });
    return mapped;
  } catch {
    return undefined;
  }
}

const dtfCache = new Map<string, Intl.DateTimeFormat>();
function tzOffsetMs(utcMs: number, tz: string): number {
  let f = dtfCache.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    dtfCache.set(tz, f);
  }
  const p = Object.fromEntries(f.formatToParts(new Date(utcMs)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(utcMs / 1000) * 1000;
}

/** Wall-clock time in `tz` to epoch ms. */
export function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz: string): number {
  const guess = Date.UTC(y, mo, d, h, mi, s);
  let utc = guess - tzOffsetMs(guess, tz);
  const second = guess - tzOffsetMs(utc, tz);
  if (second !== utc) utc = second;
  return utc;
}

interface Wall { y: number; mo: number; d: number; h: number; mi: number; s: number; date: boolean; utc: boolean; tz?: string }

function parseWall(value: string, params: Record<string, string>): Wall | null {
  const m = value.trim().match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  return {
    y: +m[1], mo: +m[2] - 1, d: +m[3], h: +(m[4] ?? 0), mi: +(m[5] ?? 0), s: +(m[6] ?? 0),
    date: !m[4] || params.VALUE === 'DATE', utc: !!m[7], tz: normalizeTz(params.TZID),
  };
}

function wallToMs(w: Wall, defaultTz: string): number {
  if (w.date) return new Date(w.y, w.mo, w.d).getTime(); // viewer's local midnight
  if (w.utc) return Date.UTC(w.y, w.mo, w.d, w.h, w.mi, w.s);
  return zonedToUtc(w.y, w.mo, w.d, w.h, w.mi, w.s, w.tz ?? defaultTz);
}

const unescape = (v: string) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');

function parseProps(text: string): Raw[] {
  const lines = text.replace(/\r\n?/g, '\n').replace(/\n[ \t]/g, '').split('\n');
  const events: Raw[] = [];
  let cur: Raw | null = null;
  let depth = 0; // ignore nested VALARM etc.
  for (const line of lines) {
    if (!line) continue;
    if (line === 'BEGIN:VEVENT') { cur = { props: [] }; depth = 0; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    if (line.startsWith('BEGIN:')) { depth++; continue; }
    if (line.startsWith('END:')) { depth--; continue; }
    if (depth > 0) continue;
    // NAME;P=V;P2="a:b":VALUE  (colon inside quotes is not the separator)
    let i = 0, q = false;
    for (; i < line.length; i++) {
      if (line[i] === '"') q = !q;
      else if (line[i] === ':' && !q) break;
    }
    const head = line.slice(0, i);
    const value = line.slice(i + 1);
    const [name, ...ps] = head.split(';');
    const params: Record<string, string> = {};
    for (const p of ps) {
      const eq = p.indexOf('=');
      if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
    }
    cur.props.push({ name: name.toUpperCase(), params, value });
  }
  return events;
}

const DAYS = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];

interface Rule { freq: string; interval: number; count?: number; until?: number; byday?: { n: number; d: number }[]; bymonthday?: number[] }

function parseRule(v: string, defaultTz: string): Rule | null {
  const kv = Object.fromEntries(v.split(';').map((p) => p.split('=') as [string, string]));
  if (!kv.FREQ) return null;
  const until = kv.UNTIL ? parseWall(kv.UNTIL, {}) : null;
  return {
    freq: kv.FREQ,
    interval: Math.max(1, +(kv.INTERVAL ?? 1)),
    count: kv.COUNT ? +kv.COUNT : undefined,
    until: until ? (until.date ? new Date(until.y, until.mo, until.d, 23, 59, 59).getTime() : wallToMs(until, defaultTz)) : undefined,
    byday: kv.BYDAY?.split(',').map((x) => {
      const m = x.match(/^([+-]?\d+)?(SU|MO|TU|WE|TH|FR|SA)$/)!;
      return { n: m?.[1] ? +m[1] : 0, d: DAYS.indexOf(m?.[2] ?? 'MO') };
    }),
    bymonthday: kv.BYMONTHDAY?.split(',').map(Number),
  };
}

/** nth weekday of a month (n<0 counts from the end), as day-of-month or null */
function nthWeekday(y: number, mo: number, wd: number, n: number): number | null {
  const days = new Date(Date.UTC(y, mo + 1, 0)).getUTCDate();
  const hits: number[] = [];
  for (let d = 1; d <= days; d++) if (new Date(Date.UTC(y, mo, d)).getUTCDay() === wd) hits.push(d);
  const v = n > 0 ? hits[n - 1] : hits[hits.length + n];
  return v ?? null;
}

/** Candidate dates (y, mo, d) in rule order, starting from the DTSTART date. */
function* dates(rule: Rule, w: Wall): Generator<[number, number, number]> {
  const base = Date.UTC(w.y, w.mo, w.d);
  const day = 864e5;
  for (let k = 0; k < 5000; k++) {
    if (rule.freq === 'DAILY') {
      const t = new Date(base + k * rule.interval * day);
      yield [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
    } else if (rule.freq === 'WEEKLY') {
      const dow = new Date(base).getUTCDay();
      const weekStart = base - ((dow + 6) % 7) * day + k * rule.interval * 7 * day;
      const wds = rule.byday?.length ? rule.byday.map((b) => b.d) : [dow];
      const sorted = [...wds].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
      for (const wd of sorted) {
        const t = new Date(weekStart + ((wd + 6) % 7) * day);
        if (t.getTime() >= base) yield [t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()];
      }
    } else if (rule.freq === 'MONTHLY') {
      const mo = w.mo + k * rule.interval;
      const y = w.y + Math.floor(mo / 12), m = ((mo % 12) + 12) % 12;
      const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      let ds: number[];
      if (rule.byday?.length) ds = rule.byday.map((b) => nthWeekday(y, m, b.d, b.n || 1)).filter((x): x is number => x !== null);
      else ds = (rule.bymonthday ?? [w.d]).map((x) => (x < 0 ? days + x + 1 : x)).filter((x) => x >= 1 && x <= days);
      for (const d of ds.sort((a, b) => a - b)) if (Date.UTC(y, m, d) >= base) yield [y, m, d];
    } else if (rule.freq === 'YEARLY') {
      const y = w.y + k * rule.interval;
      if (w.d <= new Date(Date.UTC(y, w.mo + 1, 0)).getUTCDate()) yield [y, w.mo, w.d];
    } else return;
  }
}

export function parseICS(text: string, from: number, to: number, defaultTz = 'America/Los_Angeles'): IcsEvent[] {
  const raws = parseProps(text);
  const out: IcsEvent[] = [];
  const overrides = new Set<string>();

  type Base = { ev: Omit<IcsEvent, 'start' | 'end'>; w: Wall; startMs: number; dur: number; rule?: Rule; exdates: Set<number> };
  const bases: Base[] = [];

  for (const r of raws) {
    const get = (n: string) => r.props.find((p) => p.name === n);
    const ds = get('DTSTART');
    if (!ds) continue;
    const w = parseWall(ds.value, ds.params);
    if (!w) continue;
    const startMs = wallToMs(w, defaultTz);
    const de = get('DTEND');
    const we = de ? parseWall(de.value, de.params) : null;
    let endMs: number;
    if (we) endMs = wallToMs(we, defaultTz);
    else if (get('DURATION')) endMs = startMs + parseDuration(get('DURATION')!.value);
    else endMs = w.date ? new Date(w.y, w.mo, w.d + 1).getTime() : startMs;
    const uid = get('UID')?.value ?? `${startMs}-${get('SUMMARY')?.value}`;
    const ev = {
      uid,
      title: unescape(get('SUMMARY')?.value ?? '(No title)').trim(),
      location: get('LOCATION') ? unescape(get('LOCATION')!.value).trim() || undefined : undefined,
      description: get('DESCRIPTION') ? unescape(get('DESCRIPTION')!.value).trim() || undefined : undefined,
      allDay: w.date,
      status: get('STATUS')?.value,
    };
    if (ev.status === 'CANCELLED' && !get('RECURRENCE-ID')) continue;
    const rid = get('RECURRENCE-ID');
    if (rid) {
      const rw = parseWall(rid.value, rid.params);
      if (rw) overrides.add(`${uid}|${wallToMs(rw, defaultTz)}`);
      if (ev.status !== 'CANCELLED' && endMs >= from && startMs <= to) out.push({ ...ev, start: startMs, end: endMs });
      continue;
    }
    const rr = get('RRULE');
    const exdates = new Set<number>();
    for (const p of r.props.filter((p) => p.name === 'EXDATE')) {
      for (const v of p.value.split(',')) {
        const xw = parseWall(v, p.params);
        if (xw) exdates.add(wallToMs({ ...xw, tz: xw.tz ?? w.tz }, defaultTz));
      }
    }
    bases.push({ ev, w, startMs, dur: Math.max(0, endMs - startMs), rule: rr ? parseRule(rr.value, defaultTz) ?? undefined : undefined, exdates });
  }

  for (const b of bases) {
    if (!b.rule) {
      const end = b.startMs + b.dur;
      if (end >= from && b.startMs <= to) out.push({ ...b.ev, start: b.startMs, end });
      continue;
    }
    let n = 0;
    for (const [y, mo, d] of dates(b.rule, b.w)) {
      const s = wallToMs({ ...b.w, y, mo, d }, defaultTz);
      if (b.rule.until !== undefined && s > b.rule.until) break;
      if (b.rule.count !== undefined && n >= b.rule.count) break;
      n++;
      if (s > to) break;
      if (b.exdates.has(s) || overrides.has(`${b.ev.uid}|${s}`)) continue;
      if (s + b.dur >= from) out.push({ ...b.ev, uid: `${b.ev.uid}@${s}`, start: s, end: s + b.dur });
    }
  }
  return out.sort((a, b) => a.start - b.start);
}

function parseDuration(v: string): number {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return 0;
  const ms = ((+(m[2] ?? 0) * 7 + +(m[3] ?? 0)) * 86400 + +(m[4] ?? 0) * 3600 + +(m[5] ?? 0) * 60 + +(m[6] ?? 0)) * 1000;
  return m[1] === '-' ? -ms : ms;
}
