import { useSyncExternalStore } from 'react';
import type { AppState, Settings, Task } from './types';

const KEY = 'daily-dash:v1';

const empty = (): AppState => ({
  version: 1,
  tasks: [],
  settings: { homeAirport: 'SFO', lens: 'both', sources: [] },
  deleted: {},
});

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return empty();
    const parsed = JSON.parse(raw) as AppState;
    return { ...empty(), ...parsed, settings: { ...empty().settings, ...parsed.settings } };
  } catch {
    return empty();
  }
}

let state: AppState = typeof localStorage === 'undefined' ? empty() : load();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked: keep working in memory */
  }
}

export function setState(update: (s: AppState) => AppState) {
  state = update(state);
  save();
  emit();
}

export const setTasks = (fn: (t: Task[]) => Task[]) => setState((s) => ({ ...s, tasks: fn(s.tasks) }));
export const setSettings = (patch: Partial<Settings>) =>
  setState((s) => ({ ...s, settings: { ...s.settings, ...patch, updatedAt: Date.now() } }));

/** Remove tasks and remember the delete so other devices drop them too. */
export const removeTasks = (ids: string[]) =>
  setState((s) => {
    const now = Date.now();
    const gone = new Set(ids);
    return { ...s, tasks: s.tasks.filter((t) => !gone.has(t.id)), deleted: { ...s.deleted, ...Object.fromEntries(ids.map((id) => [id, now])) } };
  });

export function replaceAll(next: AppState) {
  state = { ...empty(), ...next, settings: { ...empty().settings, ...next.settings } };
  save();
  emit();
}

export const getState = () => state;

export function subscribe(l: () => void) {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

if (typeof window !== 'undefined') {
  // keep two open tabs or windows in step
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      state = load();
      emit();
    }
  });
}

export function useAppState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}
