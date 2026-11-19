import { describe, expect, it } from 'vitest';
import { parseICS, zonedToUtc } from './ical';

const wrap = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR\r\n`;
const Y = (iso: string) => new Date(iso).getTime();
const all = [Y('2026-01-01T00:00:00Z'), Y('2027-12-31T00:00:00Z')] as const;

describe('zonedToUtc', () => {
  it('handles Pacific standard and daylight time', () => {
    expect(new Date(zonedToUtc(2026, 0, 15, 9, 0, 0, 'America/Los_Angeles')).toISOString()).toBe('2026-01-15T17:00:00.000Z');
    expect(new Date(zonedToUtc(2026, 6, 15, 9, 0, 0, 'America/Los_Angeles')).toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });
});

describe('parseICS', () => {
  it('reads timed, UTC and all-day events with folded lines and escapes', () => {
    const ics = wrap([
      'BEGIN:VEVENT', 'UID:a', 'DTSTART;TZID=America/Los_Angeles:20261120T090000', 'DTEND;TZID=America/Los_Angeles:20261120T093000',
      'SUMMARY:Standup\\, team', 'LOCATION:Zoom', 'BEGIN:VALARM', 'TRIGGER:-PT10M', 'END:VALARM', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:b', 'DTSTART:20261121T180000Z', 'DTEND:20261121T190000Z', 'SUMMARY:Long title that is', ' folded', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:c', 'DTSTART;VALUE=DATE:20261122', 'DTEND;VALUE=DATE:20261125', 'SUMMARY:Reserved', 'END:VEVENT',
    ].join('\r\n'));
    const ev = parseICS(ics, ...all);
    expect(ev.map((e) => e.title)).toEqual(['Standup, team', 'Long title that isfolded', 'Reserved']);
    expect(new Date(ev[0].start).toISOString()).toBe('2026-11-20T17:00:00.000Z');
    expect(ev[0].location).toBe('Zoom');
    expect(ev[2].allDay).toBe(true);
    expect(new Date(ev[2].start).getDate()).toBe(22);
    expect((ev[2].end - ev[2].start) / 864e5).toBe(3);
  });

  it('expands weekly rules with BYDAY, EXDATE and a moved instance', () => {
    const ics = wrap([
      'BEGIN:VEVENT', 'UID:r', 'DTSTART;TZID=America/Los_Angeles:20261102T100000', 'DTEND;TZID=America/Los_Angeles:20261102T103000',
      'RRULE:FREQ=WEEKLY;BYDAY=MO,WE;COUNT=6', 'EXDATE;TZID=America/Los_Angeles:20261104T100000', 'SUMMARY:1:1', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:r', 'RECURRENCE-ID;TZID=America/Los_Angeles:20261109T100000', 'DTSTART;TZID=America/Los_Angeles:20261109T150000',
      'DTEND;TZID=America/Los_Angeles:20261109T153000', 'SUMMARY:1:1 (moved)', 'END:VEVENT',
    ].join('\r\n'));
    const ev = parseICS(ics, ...all);
    const fmt = (ms: number) => new Date(ms).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'numeric', day: 'numeric', hour: 'numeric' });
    expect(ev.map((e) => `${fmt(e.start)} ${e.title}`)).toEqual([
      '11/2, 10 AM 1:1',
      '11/9, 3 PM 1:1 (moved)',
      '11/11, 10 AM 1:1',
      '11/16, 10 AM 1:1',
      '11/18, 10 AM 1:1',
    ]);
  });

  it('keeps wall time across a DST change', () => {
    const ics = wrap(['BEGIN:VEVENT', 'UID:d', 'DTSTART;TZID=America/Los_Angeles:20261026T090000', 'DURATION:PT1H', 'RRULE:FREQ=DAILY;INTERVAL=7;UNTIL=20261110T000000Z', 'SUMMARY:Gym', 'END:VEVENT'].join('\r\n'));
    const hours = parseICS(ics, ...all).map((e) => new Date(e.start).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', hour: 'numeric' }));
    expect(hours).toEqual(['9 AM', '9 AM', '9 AM']);
  });

  it('handles monthly nth weekday and windows', () => {
    const ics = wrap(['BEGIN:VEVENT', 'UID:m', 'DTSTART:20260113T170000Z', 'DTEND:20260113T180000Z', 'RRULE:FREQ=MONTHLY;BYDAY=2TU', 'SUMMARY:Board', 'END:VEVENT'].join('\r\n'));
    const ev = parseICS(ics, Y('2026-11-01T00:00:00Z'), Y('2026-12-31T00:00:00Z'));
    expect(ev.map((e) => new Date(e.start).toISOString().slice(0, 10))).toEqual(['2026-11-10', '2026-12-08']);
  });

  it('maps Windows time zone names and drops cancelled events', () => {
    const ics = wrap([
      'BEGIN:VEVENT', 'UID:w', 'DTSTART;TZID="Pacific Standard Time":20261201T080000', 'DTEND;TZID="Pacific Standard Time":20261201T090000', 'SUMMARY:Exchange', 'END:VEVENT',
      'BEGIN:VEVENT', 'UID:x', 'DTSTART:20261201T080000Z', 'STATUS:CANCELLED', 'SUMMARY:Gone', 'END:VEVENT',
    ].join('\r\n'));
    const ev = parseICS(ics, ...all);
    expect(ev).toHaveLength(1);
    expect(new Date(ev[0].start).toISOString()).toBe('2026-12-01T16:00:00.000Z');
  });
});
