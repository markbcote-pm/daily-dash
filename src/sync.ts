import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import { useSyncExternalStore } from 'react';
import { getState, replaceAll, subscribe } from './store';
import { mergeStates } from './logic/merge';
import type { AppState } from './types';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const syncConfigured = !!(URL_ && KEY);
export const supabase: SupabaseClient | null = syncConfigured ? createClient(URL_!, KEY!) : null;

export type SyncStatus = { state: 'off' | 'signed-out' | 'syncing' | 'synced' | 'error'; email?: string; at?: number; error?: string };

let status: SyncStatus = { state: syncConfigured ? 'signed-out' : 'off' };
const listeners = new Set<() => void>();
const setStatus = (s: SyncStatus) => { status = s; listeners.forEach((l) => l()); };
export const useSync = () => useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => status);

let session: Session | null = null;
let applyingRemote = false;
let lastPushed = '';
let timer: number | undefined;

async function pull() {
  if (!supabase || !session) return;
  const { data, error } = await supabase.from('app_state').select('doc').eq('user_id', session.user.id).maybeSingle();
  if (error) throw error;
  const local = getState();
  const merged = data?.doc ? mergeStates(local, data.doc as AppState) : local;
  if (JSON.stringify(merged) !== JSON.stringify(local)) {
    applyingRemote = true;
    replaceAll(merged);
    applyingRemote = false;
  }
  if (!data?.doc || JSON.stringify(merged) !== JSON.stringify(data.doc)) await push();
}

async function push() {
  if (!supabase || !session) return;
  const doc = getState();
  const body = JSON.stringify(doc);
  if (body === lastPushed) return;
  const { error } = await supabase.from('app_state').upsert({ user_id: session.user.id, doc, updated_at: new Date().toISOString() });
  if (error) throw error;
  lastPushed = body;
}

async function run(fn: () => Promise<void>) {
  if (!session) return;
  setStatus({ ...status, state: 'syncing' });
  try {
    await fn();
    setStatus({ state: 'synced', email: session.user.email, at: Date.now() });
  } catch (e) {
    setStatus({ state: 'error', email: session.user.email, error: e instanceof Error ? e.message : String(e) });
  }
}

/** Pull then push now, e.g. before asking the server to read a newly added calendar. */
export const syncNow = () => run(pull);

export function startSync() {
  if (!supabase) return;
  supabase.auth.onAuthStateChange((_evt, s) => {
    const was = session?.user.id;
    session = s;
    if (!s) { setStatus({ state: 'signed-out' }); return; }
    if (was !== s.user.id) void run(pull);
  });
  // a local change: push it shortly after
  subscribe(() => {
    if (applyingRemote || !session) return;
    window.clearTimeout(timer);
    timer = window.setTimeout(() => void run(push), 800);
  });
  // catch edits from other devices when coming back to the app, and every minute while open
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && void run(pull));
  window.setInterval(() => document.visibilityState === 'visible' && void run(pull), 60_000);
}

export async function sendCode(email: string) {
  if (!supabase) throw new Error('Sync is not set up.');
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true, emailRedirectTo: location.origin } });
  if (error) throw error;
}

export async function verifyCode(email: string, token: string) {
  if (!supabase) throw new Error('Sync is not set up.');
  const { error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: 'email' });
  if (error) throw error;
}

export async function signOut() {
  await supabase?.auth.signOut();
}

/** Ask the server to fetch a calendar feed (browsers can't read most feeds directly). */
export async function fetchFeed(url: string): Promise<string> {
  if (!supabase || !session) throw new Error('Turn on sync in Settings so the app can read calendar links.');
  const { data, error } = await supabase.functions.invoke('ical', { body: { url } });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const detail = ctx ? await ctx.text().catch(() => '') : '';
    throw new Error(detail || error.message);
  }
  return typeof data === 'string' ? data : String(data);
}
