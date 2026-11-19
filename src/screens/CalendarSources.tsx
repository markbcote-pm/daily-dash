import { useState } from 'react';
import { setSettings, useAppState } from '../store';
import { useCalendar, refreshAll } from '../calendarData';
import { syncConfigured, useSync } from '../sync';
import { uid } from '../logic/tasks';
import type { CalLens, CalSource, SourceKind } from '../logic/calendar';

const TYPES: { id: string; label: string; lens: CalLens; kind: SourceKind; help: string }[] = [
  { id: 'work', label: 'Work', lens: 'work', kind: 'calendar', help: 'Work Google Calendar: Settings, your calendar, Integrate calendar, "Secret address in iCal format" (if your company allows it). Outlook: Settings, Calendar, Shared calendars, Publish, ICS link.' },
  { id: 'life', label: 'Life', lens: 'life', kind: 'calendar', help: 'Google Calendar on the web: Settings, pick the calendar (yours, the kids\', the Skylight one), Integrate calendar, copy "Secret address in iCal format".' },
  { id: 'business', label: 'Business', lens: 'business', kind: 'calendar', help: 'Any business calendar\'s iCal link.' },
  { id: 'training', label: 'Training', lens: 'training', kind: 'calendar', help: 'Runna: Profile, Connected apps, Calendar sync, copy the link. Zwift or any other plan that offers an iCal link works too.' },
  { id: 'airbnb', label: 'Rental: Airbnb', lens: 'business', kind: 'airbnb', help: 'Airbnb: Listings, your Tahoe listing, Availability, Sync calendars (Connect to another website), Export calendar, copy the link.' },
  { id: 'cleaning', label: 'Rental: cleaning app', lens: 'business', kind: 'cleaning', help: 'The calendar link from the cleaning app.' },
];

const typeOf = (s: CalSource) => TYPES.find((t) => t.kind === s.kind && (s.kind !== 'calendar' || t.lens === s.lens)) ?? TYPES[1];

const ago = (ms: number) => {
  const m = Math.round((Date.now() - ms) / 60000);
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function CalendarSources() {
  const { settings } = useAppState();
  const cal = useCalendar();
  const sync = useSync();
  const [type, setType] = useState(TYPES[1].id);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [err, setErr] = useState('');
  const t = TYPES.find((x) => x.id === type)!;
  const signedIn = sync.state === 'synced' || sync.state === 'syncing';

  const add = () => {
    const u = url.trim();
    if (!/^(https|webcals?):\/\//i.test(u)) { setErr('Paste the full link. It starts with https:// or webcal://'); return; }
    if (settings.sources.some((s) => s.url === u)) { setErr('That calendar is already added.'); return; }
    const src: CalSource = { id: uid(), name: name.trim() || t.label, lens: t.lens, kind: t.kind, url: u };
    setSettings({ sources: [...settings.sources, src] });
    setName(''); setUrl(''); setErr('');
    if (signedIn) void refreshAll([src], true);
  };
  const remove = (id: string) => setSettings({ sources: settings.sources.filter((s) => s.id !== id) });

  return (
    <section className="card stack" aria-labelledby="cals">
      <div>
        <h2 id="cals">Calendars</h2>
        <p className="note" style={{ margin: '6px 0 0' }}>Paste a private calendar link for each calendar. They refresh every 30 minutes while the app is open. Flights that show up in two calendars appear once.</p>
      </div>

      {!syncConfigured || !signedIn ? (
        <p className="note" style={{ margin: 0 }}><b>Turn on sync first, above.</b> Calendar links are read by the app's server, because browsers can't read them directly. You can still add links now.</p>
      ) : null}

      {settings.sources.length > 0 && (
        <div>
          {settings.sources.map((s) => {
            const st = cal.status[s.id];
            return (
              <div className="src-row" key={s.id}>
                <i className={`bg-${s.lens}`} />
                <div className="src-main">
                  <b>{s.name}</b>
                  <span className="small muted">
                    {typeOf(s).label}
                    {' · '}
                    {st?.loading ? 'Updating…' : st?.error ? <span className="error">{st.error}</span> : st?.fetchedAt ? `${st.count} events, updated ${ago(st.fetchedAt)}` : 'Not read yet'}
                  </span>
                </div>
                <button className="btn ghost danger" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`}>Remove</button>
              </div>
            );
          })}
          {signedIn && <button className="btn" style={{ marginTop: 8 }} onClick={() => refreshAll(settings.sources, true)}>Refresh all now</button>}
        </div>
      )}

      <div className="stack" style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 12 }}>
        <h3>Add a calendar</h3>
        <label className="field">
          <span>Type</span>
          <select className="select" value={type} onChange={(e) => setType(e.target.value)}>
            {TYPES.map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}
          </select>
        </label>
        <p className="note" style={{ margin: 0 }}>{t.help}</p>
        <label className="field">
          <span>Name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.label} />
        </label>
        <label className="field">
          <span>Calendar link</span>
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://… or webcal://…" autoComplete="off" inputMode="url" />
        </label>
        {err && <p className="error" style={{ margin: 0 }}>{err}</p>}
        <div><button className="btn primary" disabled={!url.trim()} onClick={add}>Add calendar</button></div>
      </div>
    </section>
  );
}
