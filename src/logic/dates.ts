/** Local-date helpers. Weeks run Monday to Sunday. */
export const toISO = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export const fromISO = (s: string) => {
  const [y, m, d] = s.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

export function weekBounds(now = new Date()) {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const nextEnd = new Date(end);
  nextEnd.setDate(nextEnd.getDate() + 7);
  return { start: toISO(start), end: toISO(end), nextEnd: toISO(nextEnd) };
}

export function dueLabel(iso: string, now = new Date()) {
  const today = toISO(now);
  const tmw = new Date(now);
  tmw.setDate(tmw.getDate() + 1);
  if (iso < today) return { text: 'Overdue', tone: 'late' as const };
  if (iso === today) return { text: 'Today', tone: 'soon' as const };
  if (iso === toISO(tmw)) return { text: 'Tomorrow', tone: 'soon' as const };
  const d = fromISO(iso);
  const sameYear = d.getFullYear() === now.getFullYear();
  return {
    text: d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(sameYear ? {} : { year: 'numeric' }) }),
    tone: 'plain' as const,
  };
}
