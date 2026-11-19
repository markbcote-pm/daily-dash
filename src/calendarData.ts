import { useEffect, useSyncExternalStore } from 'react';
import { useAppState } from './store';
import { parseICS } from './logic/ical';
import { dedupe, type CalEvent, type CalSource } from './logic/calendar';
import { fetchFeed, syncNow, useSync } from './sync';
import { SAMPLE_SOURCES, sampleEvents } from './sample';

const KEY = 'daily-dash:cal-cache:v1';
const STALE_MS = 30 * 60 * 1000;

interface Entry { fetchedAt: number; url: string; events: CalEvent[]; error?: string; loading?: boolean }
type Cache = Record<string, Entry>;

let cache: Cache = (() => {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}') as Cache; } catch { return {}; }
})();
const listeners = new Set<() => void>();
const save = () => {
  try { localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(Object.entries(cache).map(([k, v]) => [k, { ...v, loading: false }])))); } catch { /* full */ }
  listeners.forEach((l) => l());
};

const windowRange = () => {
  const now = Date.now();
  return [now - 21 * 864e5, now + 200 * 864e5] as const;
};

export async function refreshSource(src: CalSource) {
  cache = { ...cache, [src.id]: { ...(cache[src.id] ?? { fetchedAt: 0, events: [], url: src.url }), loading: true, error: undefined } };
  listeners.forEach((l) => l());
  try {
    const text = await fetchFeed(src.url);
    const [from, to] = windowRange();
    const events = parseICS(text, from, to).map((e) => ({ ...e, id: `${src.id}:${e.uid}`, sourceId: src.id, lens: src.lens, kind: src.kind }));
    cache = { ...cache, [src.id]: { fetchedAt: Date.now(), url: src.url, events } };
  } catch (e) {
    cache = { ...cache, [src.id]: { ...(cache[src.id] ?? { fetchedAt: 0, events: [], url: src.url }), loading: false, error: e instanceof Error ? e.message : String(e) } };
  }
  save();
}

export async function refreshAll(sources: CalSource[], force = false) {
  await syncNow(); // the server only reads links it already has
  await Promise.all(sources.filter((s) => force || !cache[s.id] || cache[s.id].url !== s.url || Date.now() - cache[s.id].fetchedAt > STALE_MS).map(refreshSource));
}

export interface CalendarView {
  events: CalEvent[];
  sources: CalSource[];
  sample: boolean;
  status: Record<string, { fetchedAt: number; error?: string; loading?: boolean; count: number }>;
}

export function useCalendar(): CalendarView {
  const { settings } = useAppState();
  const sync = useSync();
  const snap = useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => cache);
  const sources = settings.sources;
  const signedIn = sync.state === 'synced' || sync.state === 'syncing';

  useEffect(() => {
    if (!sources.length || !signedIn) return;
    void refreshAll(sources);
    const t = window.setInterval(() => document.visibilityState === 'visible' && void refreshAll(sources), STALE_MS);
    return () => window.clearInterval(t);
  }, [sources, signedIn]);

  if (!sources.length) {
    const names = Object.fromEntries(SAMPLE_SOURCES.map((s) => [s.id, s.name]));
    return { events: dedupe(sampleEvents(), names), sources: SAMPLE_SOURCES, sample: true, status: {} };
  }
  const names = Object.fromEntries(sources.map((s) => [s.id, s.name]));
  const all = sources.flatMap((s) => (snap[s.id]?.url === s.url ? snap[s.id].events : []));
  const status = Object.fromEntries(sources.map((s) => {
    const e = snap[s.id];
    return [s.id, { fetchedAt: e?.fetchedAt ?? 0, error: e?.error, loading: e?.loading, count: e?.events.length ?? 0 }];
  }));
  return { events: dedupe(all, names), sources, sample: false, status };
}
