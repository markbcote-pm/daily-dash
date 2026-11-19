const COPY: Record<string, { title: string; eyebrow: string; color: string; bg: string; items: string[]; phase: string }> = {
  calendar: {
    title: 'Calendar', eyebrow: 'Phase 3', color: 'var(--work)', bg: 'var(--work-bg)', phase: 'Calendars',
    items: ['Work, Life, Business and Training filters', 'Rental view from the cleaning app', 'Kids and Skylight calendars from your Google account', 'Flights added once, never duplicated'],
  },
  trips: {
    title: 'Trips', eyebrow: 'Phase 4', color: 'var(--business)', bg: 'var(--business-bg)', phase: 'Travel autopilot',
    items: ['Full travel log: Scheduled and To be scheduled', 'Each trip builds its checklist: flight, parking, hotel, calendar, kids, check-in', 'Home airport from Settings (SFO or SJC)'],
  },
  training: {
    title: 'Training', eyebrow: 'Later phase', color: 'var(--training)', bg: 'var(--training-bg)', phase: 'Training',
    items: ["Today's workout on the Today screen", 'Week view from Zwift, Runna and your own entries', 'Completed workouts from Strava'],
  },
  pins: {
    title: 'Pinned Research', eyebrow: 'Phase 5', color: 'var(--life)', bg: 'var(--life-bg)', phase: 'Pinned Research',
    items: ['5 to 10 pins a week, each with a reason', 'Text a pin to Danielle', 'Weekly roll-over into a searchable backlog'],
  },
};

export function Soon({ which }: { which: keyof typeof COPY }) {
  const c = COPY[which];
  return (
    <div className="page">
      <div className="head"><div className="head-text"><span className="eyebrow">{c.eyebrow}</span><h1>{c.title}</h1></div></div>
      <div className="soon-hero" style={{ background: c.bg }}>
        <h2 style={{ color: c.color }}>Coming in the {c.phase} phase</h2>
        <ul>{c.items.map((i) => <li key={i}>{i}</li>)}</ul>
      </div>
    </div>
  );
}
