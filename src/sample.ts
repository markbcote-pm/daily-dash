import type { CalEvent, CalLens, CalSource, SourceKind } from './logic/calendar';
import { weekBounds, fromISO } from './logic/dates';

export const SAMPLE_SOURCES: CalSource[] = [
  { id: 's-work', name: 'Work (sample)', lens: 'work', kind: 'calendar', url: '' },
  { id: 's-life', name: 'Family (sample)', lens: 'life', kind: 'calendar', url: '' },
  { id: 's-kids', name: 'Kids (sample)', lens: 'life', kind: 'calendar', url: '' },
  { id: 's-train', name: 'Training (sample)', lens: 'training', kind: 'calendar', url: '' },
  { id: 's-airbnb', name: 'Tahoe Airbnb (sample)', lens: 'business', kind: 'airbnb', url: '' },
  { id: 's-clean', name: 'Cleaning app (sample)', lens: 'business', kind: 'cleaning', url: '' },
];

/** A believable fortnight of events around the current week, for before any calendars are linked. */
export function sampleEvents(now = new Date()): CalEvent[] {
  const mon = fromISO(weekBounds(now).start);
  const at = (day: number, h: number, m = 0) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + day, h, m).getTime();
  const date = (day: number) => new Date(mon.getFullYear(), mon.getMonth(), mon.getDate() + day).getTime();
  const out: CalEvent[] = [];
  let n = 0;
  const add = (sourceId: string, lens: CalLens, kind: SourceKind, title: string, start: number, end: number, extra: Partial<CalEvent> = {}) =>
    out.push({ id: `sample-${n++}`, uid: `sample-${n}`, sourceId, lens, kind, title, start, end, allDay: false, ...extra });

  for (let w = 0; w < 2; w++) {
    const o = w * 7;
    for (const d of [0, 1, 2, 3, 4]) add('s-work', 'work', 'calendar', 'Team standup', at(o + d, 9), at(o + d, 9, 15), { location: 'Zoom' });
    add('s-work', 'work', 'calendar', 'Roadmap review', at(o + 1, 13), at(o + 1, 14), { location: 'Conf room 4B' });
    add('s-work', 'work', 'calendar', '1:1 with Priya', at(o + 3, 11), at(o + 3, 11, 30));
    add('s-kids', 'life', 'calendar', 'Soccer practice', at(o + 1, 17), at(o + 1, 18, 30), { location: 'Mitchell Park' });
    add('s-kids', 'life', 'calendar', 'Soccer practice', at(o + 3, 17), at(o + 3, 18, 30), { location: 'Mitchell Park' });
    add('s-life', 'life', 'calendar', 'Date night', at(o + 4, 19), at(o + 4, 21, 30));
    add('s-train', 'training', 'calendar', 'Zwift: Sweet spot 3×12', at(o + 0, 6), at(o + 0, 7), { description: 'Zwift Coach plan' });
    add('s-train', 'training', 'calendar', 'Runna: Easy 5 mi', at(o + 2, 6, 30), at(o + 2, 7, 20));
    add('s-train', 'training', 'calendar', 'Runna: Long run 9 mi', at(o + 5, 7), at(o + 5, 8, 30));
  }
  add('s-life', 'life', 'calendar', 'Dentist', at(2, 15), at(2, 16));
  add('s-life', 'life', 'calendar', 'UA 1534 SFO → DEN', at(8, 7, 5), at(8, 10, 40), { location: 'SFO Terminal 3' });
  add('s-work', 'work', 'calendar', 'Flight to Denver (United 1534)', at(8, 7, 5), at(8, 10, 40)); // same flight, merged away
  add('s-life', 'life', 'calendar', 'Thanksgiving at Mom’s', date(3), date(4), { allDay: true });

  const stay = (from: number, to: number, last4: string) =>
    add('s-airbnb', 'business', 'airbnb', 'Reserved', date(from), date(to), { allDay: true, description: `Reservation URL: https://www.airbnb.com/hosting/reservations/details/HM${last4}XYZ\nPhone Number (Last 4 Digits): ${last4}` });
  stay(-2, 1, '4821');
  stay(1, 4, '7730');
  stay(6, 9, '1290');
  add('s-airbnb', 'business', 'airbnb', 'Airbnb (Not available)', date(11), date(13), { allDay: true });
  stay(14, 16, '5512');
  add('s-clean', 'business', 'cleaning', 'Turnover clean: Maria', at(1, 11), at(1, 14));
  add('s-clean', 'business', 'cleaning', 'Turnover clean: Maria', at(4, 11), at(4, 14));
  add('s-clean', 'business', 'cleaning', 'Hot tub service', at(5, 10), at(5, 11));
  return out;
}
