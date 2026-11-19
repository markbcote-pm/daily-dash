import { describe, expect, it } from 'vitest';
import { agendaEvents, dedupe, eventsOnDay, flightKey, stays, type CalEvent } from './calendar';

const ev = (p: Partial<CalEvent> & { title: string; start: number }): CalEvent => ({
  id: p.title + p.start, uid: p.title, sourceId: 's1', lens: 'life', kind: 'calendar', allDay: false, end: p.start + 36e5, ...p,
});
const at = (s: string) => new Date(s).getTime();

describe('flightKey', () => {
  it('reads codes and airline names', () => {
    expect(flightKey({ title: 'UA 1234 SFO to DEN', start: at('2026-11-20T15:00:00') })).toBe('UA1234|2026-11-20');
    expect(flightKey({ title: 'Flight to Denver', description: 'United Airlines flight 1234', start: at('2026-11-20T15:00:00') })).toBe('UA1234|2026-11-20');
    expect(flightKey({ title: 'Q4 review', start: at('2026-11-20T15:00:00') })).toBeNull();
  });
});

describe('dedupe', () => {
  it('keeps one copy of a flight added by both United and Gmail', () => {
    const out = dedupe([
      ev({ title: 'UA1234 SFO→DEN', start: at('2026-11-20T07:05:00'), sourceId: 'united' }),
      ev({ title: 'Flight to Denver (UA 1234)', start: at('2026-11-20T07:05:00'), sourceId: 'gmail', location: 'SFO' }),
      ev({ title: 'Soccer', start: at('2026-11-20T17:00:00') }),
    ], { gmail: 'Personal' });
    expect(out.map((e) => e.title)).toEqual(['UA1234 SFO→DEN', 'Soccer']);
    expect(out[0].alsoIn).toEqual(['Personal']);
    expect(out[0].location).toBe('SFO');
  });

  it('merges the same meeting shared into two calendars', () => {
    const out = dedupe([
      ev({ title: 'Q1 Planning', start: at('2026-11-20T10:00:00'), sourceId: 'work' }),
      ev({ title: 'Q1 planning', start: at('2026-11-20T10:00:00'), sourceId: 'shared' }),
    ]);
    expect(out).toHaveLength(1);
  });
});

it('eventsOnDay puts all-day items first and includes multi-day spans', () => {
  const day = new Date(2026, 10, 21);
  const out = eventsOnDay([
    ev({ title: 'Lunch', start: new Date(2026, 10, 21, 12).getTime() }),
    ev({ title: 'Trip', allDay: true, start: new Date(2026, 10, 20).getTime(), end: new Date(2026, 10, 23).getTime() }),
    ev({ title: 'Other day', start: new Date(2026, 10, 22, 9).getTime() }),
  ], day);
  expect(out.map((e) => e.title)).toEqual(['Trip', 'Lunch']);
});

it('stays finds turnovers, gaps and booked cleanings', () => {
  const d = (m: number, dd: number) => new Date(2026, m, dd).getTime();
  const a = (title: string, s: number, e: number, kind: CalEvent['kind'] = 'airbnb', description?: string) =>
    ev({ title, start: s, end: e, allDay: true, kind, lens: 'business', description });
  const out = stays([
    a('Reserved', d(10, 20), d(10, 22), 'airbnb', 'Phone Number (Last 4 Digits): 4821'),
    a('Reserved', d(10, 22), d(10, 25)),
    a('Airbnb (Not available)', d(10, 26), d(10, 27)),
    a('Reserved', d(10, 28), d(10, 30)),
    ev({ title: 'Clean: Maria', start: new Date(2026, 10, 25, 11).getTime(), kind: 'cleaning', lens: 'business' }),
  ]);
  expect(out.map((s) => [s.checkIn, s.nights, s.blocked, s.turnover ?? null])).toEqual([
    ['2026-11-20', 2, false, 'same-day'],
    ['2026-11-22', 3, false, 'gap'],
    ['2026-11-26', 1, true, null],
    ['2026-11-28', 2, false, null],
  ]);
  expect(out[0].ref).toBe('4821');
  expect(out[0].cleaning).toBeUndefined();
  expect(out[1].cleaning?.title).toBe('Clean: Maria');
  expect(out[1].gapNights).toBe(3);
});

it('agendaEvents turns a stay into check-in and check-out and drops blocks', () => {
  const s = new Date(2026, 10, 20).getTime(), e = new Date(2026, 10, 23).getTime();
  const out = agendaEvents([
    ev({ title: 'Reserved', kind: 'airbnb', allDay: true, start: s, end: e }),
    ev({ title: 'Airbnb (Not available)', kind: 'airbnb', allDay: true, start: s, end: e }),
  ]);
  expect(out.map((x) => [x.title, new Date(x.start).getDate()])).toEqual([['Tahoe check-in · 3 nights', 20], ['Tahoe check-out', 23]]);
});
