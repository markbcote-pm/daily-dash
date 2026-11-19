// Reads a calendar feed for the signed-in person. Only links they saved in
// their own Settings are allowed, so this can't be used as an open proxy.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const MAX_BYTES = 5 * 1024 * 1024;

const reply = (body: string, status = 200, type = 'text/plain') =>
  new Response(body, { status, headers: { ...cors, 'Content-Type': `${type}; charset=utf-8` } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return reply('Use POST', 405);

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return reply('Sign in first.', 401);

  let url: string;
  try {
    url = String((await req.json()).url ?? '');
  } catch {
    return reply('Send {"url": "..."}', 400);
  }

  const { data } = await sb.from('app_state').select('doc').eq('user_id', user.id).maybeSingle();
  const saved: string[] = (data?.doc?.settings?.sources ?? []).map((s: { url: string }) => s.url);
  if (!saved.includes(url)) return reply('That link is not one of your saved calendars.', 403);

  const target = url.replace(/^webcals?:\/\//i, 'https://');
  if (!/^https:\/\//i.test(target)) return reply('Calendar links must start with https:// or webcal://', 400);

  try {
    const res = await fetch(target, { headers: { 'User-Agent': 'DailyDash/1.0 (+calendar reader)' }, signal: AbortSignal.timeout(15000) });
    if (!res.ok) return reply(`The calendar server answered ${res.status}.`, 502);
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) return reply('That calendar is too large.', 502);
    const text = new TextDecoder().decode(buf);
    if (!text.includes('BEGIN:VCALENDAR')) return reply("That link didn't return a calendar.", 502);
    return reply(text, 200, 'text/calendar');
  } catch (e) {
    return reply(`Couldn't reach the calendar: ${e instanceof Error ? e.message : e}`, 502);
  }
});
