import { useEffect, useMemo, useRef, useState } from 'react';
import { useCalendar } from '../calendarData';
import { useSync } from '../sync';
import { agendaEvents, CAL_LENSES, eventsOnDay, stays, type CalEvent, type CalLens, type Stay } from '../logic/calendar';
import { fromISO, toISO, weekBounds } from '../logic/dates';

const LENS_KEY = 'daily-dash:cal-lenses';
const loadLenses = (): CalLens[] => {
  try { const v = JSON.parse(localStorage.getItem(LENS_KEY) ?? 'null'); if (Array.isArray(v) && v.length) return v; } catch { /* default */ }
  return ['work', 'life', 'business', 'training'];
};

const time = (ms: number) => new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }).replace(':00', '').replace(' ', ' ');
const dayName = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

export function EventRow({ e, day }: { e: CalEvent; day?: Date }) {
  const startsBefore = day && e.start < new Date(day.getFullYear(), day.getMonth(), day.getDate()).getTime();
  return (
    <div className="ev">
      <div className="ev-time">
        {e.allDay ? 'All day' : startsBefore ? 'cont.' : time(e.start)}
        {!e.allDay && !startsBefore && e.end > e.start && <span>{time(e.end)}</span>}
      </div>
      <div className={`ev-bar bg-${e.lens}`} />
      <div className="ev-body">
        <span className="ev-title">{e.title}</span>
        {(e.location || e.alsoIn?.length) && (
          <span className="ev-sub">
            {e.location}
            {e.location && e.alsoIn?.length ? ' · ' : ''}
            {e.alsoIn?.length ? `Also in ${e.alsoIn.join(', ')}` : ''}
          </span>
        )}
      </div>
    </div>
  );
}

function Agenda({ events, week, setWeek }: { events: CalEvent[]; week: number; setWeek: (n: number) => void }) {
  const base = fromISO(weekBounds().start);
  const days = Array.from({ length: 7 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + week * 7 + i));
  const today = toISO(new Date());
  const refs = useRef<Record<string, HTMLElement | null>>({});
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="stack">
      <div className="weekstrip" role="group" aria-label="Week">
        <button className="iconbtn" aria-label="Previous week" onClick={() => setWeek(week - 1)}>‹</button>
        {days.map((d) => {
          const iso = toISO(d);
          const lenses = [...new Set(eventsOnDay(events, d).map((e) => e.lens))];
          return (
            <button key={iso} className={`wday${iso === today ? ' today' : ''}${picked === iso ? ' picked' : ''}`}
              onClick={() => { setPicked(iso); refs.current[iso]?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              aria-label={dayName(d)}>
              <span className="wd">{d.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
              <span className="dn">{d.getDate()}</span>
              <span className="dots">{lenses.slice(0, 4).map((l) => <i key={l} className={`bg-${l}`} />)}</span>
            </button>
          );
        })}
        <button className="iconbtn" aria-label="Next week" onClick={() => setWeek(week + 1)}>›</button>
      </div>
      {week !== 0 && <button className="chip" style={{ alignSelf: 'flex-start' }} onClick={() => setWeek(0)}>Back to this week</button>}
      {days.map((d) => {
        const iso = toISO(d);
        const list = eventsOnDay(events, d);
        return (
          <section key={iso} ref={(el) => { refs.current[iso] = el; }} className="day" aria-label={dayName(d)}>
            <h3 className={iso === today ? 'is-today' : ''}>{iso === today ? `Today · ${dayName(d)}` : dayName(d)}</h3>
            {list.length ? <div className="list ev-list">{list.map((e) => <EventRow key={e.id} e={e} day={d} />)}</div> : <p className="small muted" style={{ margin: '4px 0 0' }}>Nothing scheduled</p>}
          </section>
        );
      })}
    </div>
  );
}

const fmtDate = (iso: string) => fromISO(iso).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

function StayCard({ s }: { s: Stay }) {
  const today = toISO(new Date());
  const inHouse = s.checkIn <= today && today < s.checkOut;
  return (
    <div className={`stay${s.blocked ? ' blocked' : ''}`}>
      <div className="stay-head">
        <div>
          <b>{fmtDate(s.checkIn)} → {fmtDate(s.checkOut)}</b>
          <span className="small muted">{s.nights} night{s.nights === 1 ? '' : 's'} · {s.title}{s.ref ? ` · ··${s.ref.slice(-4)}` : ''}</span>
        </div>
        {inHouse && <span className="badge now">In house</span>}
      </div>
      {!s.blocked && (
        <div className="badges">
          {s.turnover === 'same-day' && <span className="badge warn">Same-day turnover</span>}
          {s.turnover === 'gap' && <span className="badge calm">Open {s.gapNights} night{s.gapNights === 1 ? '' : 's'} after</span>}
          {s.cleaning
            ? <span className="badge ok">Clean booked {new Date(s.cleaning.start).toLocaleDateString(undefined, { weekday: 'short' })} {s.cleaning.allDay ? '' : time(s.cleaning.start)}</span>
            : s.checkOut >= today && <span className="badge late">No cleaning booked</span>}
        </div>
      )}
    </div>
  );
}

function Rental({ events, hasCleaning }: { events: CalEvent[]; hasCleaning: boolean }) {
  const today = toISO(new Date());
  const all = stays(events);
  const upcoming = all.filter((s) => s.checkOut >= today).slice(0, 12);
  const nextIn = upcoming.find((s) => !s.blocked && s.checkIn >= today);
  const inHouse = upcoming.find((s) => !s.blocked && s.checkIn <= today && today < s.checkOut);
  const cleanings = events.filter((e) => e.kind === 'cleaning' && toISO(new Date(e.start)) >= today).sort((a, b) => a.start - b.start).slice(0, 6);
  return (
    <div className="stack">
      <div className="card rental-sum">
        <div><span className="eyebrow">Now</span><b>{inHouse ? `Guest until ${fmtDate(inHouse.checkOut)}` : 'Empty'}</b></div>
        <div><span className="eyebrow">Next check-in</span><b>{nextIn ? fmtDate(nextIn.checkIn) : 'None booked'}</b></div>
      </div>
      {upcoming.length ? upcoming.map((s) => <StayCard key={s.id} s={s} />) : <p className="muted">No upcoming stays.</p>}
      <h3 style={{ marginTop: 8 }}>Cleanings</h3>
      {cleanings.length
        ? <div className="list ev-list">{cleanings.map((e) => <EventRow key={e.id} e={{ ...e, title: `${fmtDate(toISO(new Date(e.start)))}: ${e.title}` }} />)}</div>
        : <p className="small muted" style={{ margin: 0 }}>{hasCleaning ? 'None scheduled.' : 'Link the cleaning app calendar in Settings to see cleanings here.'}</p>}
    </div>
  );
}

export function Calendar({ go }: { go: (r: string) => void }) {
  const cal = useCalendar();
  const sync = useSync();
  const needsSync = !cal.sample && sync.state !== 'synced' && sync.state !== 'syncing';
  const [lenses, setLenses] = useState<CalLens[]>(loadLenses);
  const [view, setView] = useState<'agenda' | 'rental'>(() => (location.hash.includes('rental') ? 'rental' : 'agenda'));
  const [week, setWeek] = useState(0);
  useEffect(() => { try { localStorage.setItem(LENS_KEY, JSON.stringify(lenses)); } catch { /* ignore */ } }, [lenses]);

  const shown = useMemo(() => agendaEvents(cal.events.filter((e) => lenses.includes(e.lens))), [cal.events, lenses]);
  const rentalEvents = cal.events.filter((e) => e.kind === 'airbnb' || e.kind === 'cleaning');
  const toggle = (l: CalLens) => setLenses((cur) => (cur.includes(l) ? (cur.length > 1 ? cur.filter((x) => x !== l) : cur) : [...cur, l]));
  const errors = cal.sources.filter((s) => cal.status[s.id]?.error);
  const month = fromISO(weekBounds().start);
  month.setDate(month.getDate() + week * 7);

  return (
    <div className="page">
      <div className="head">
        <div className="head-text">
          <span className="eyebrow">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <h1>Calendar</h1>
        </div>
        <div className="seg cal-views" role="group" aria-label="View">
          <button aria-pressed={view === 'agenda'} onClick={() => setView('agenda')}>Agenda</button>
          <button aria-pressed={view === 'rental'} onClick={() => setView('rental')}>Rental</button>
        </div>
      </div>

      {cal.sample && (
        <div className="banner">
          <span>This is sample data. Add your calendar links in Settings to see your own.</span>
          <button className="btn" onClick={() => go('settings')}>Add calendars</button>
        </div>
      )}
      {needsSync && (
        <div className="banner">
          <span>Turn on sync in Settings so the app can read your calendar links.</span>
          <button className="btn" onClick={() => go('settings')}>Settings</button>
        </div>
      )}
      {errors.length > 0 && (
        <div className="banner warn" role="alert">
          <span>Couldn't update {errors.map((s) => s.name).join(', ')}: {cal.status[errors[0].id].error}</span>
          <button className="btn" onClick={() => go('settings')}>Check</button>
        </div>
      )}

      <div className={`cal-grid view-${view}`}>
        <div className="cal-agenda stack">
          <div className="chips" role="group" aria-label="Show calendars">
            {CAL_LENSES.map((l) => (
              <button key={l.id} className={`chip lens-chip c-${l.id}`} aria-pressed={lenses.includes(l.id)} onClick={() => toggle(l.id)}>
                <i className={`bg-${l.id}`} />{l.label}
              </button>
            ))}
          </div>
          <Agenda events={shown} week={week} setWeek={setWeek} />
        </div>
        <div className="cal-rental stack">
          <h2 className="rental-title">Rental · Tahoe</h2>
          <Rental events={rentalEvents} hasCleaning={cal.sources.some((s) => s.kind === 'cleaning')} />
        </div>
      </div>
    </div>
  );
}
