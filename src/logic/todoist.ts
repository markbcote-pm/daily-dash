import type { Bucket, Lens, Task } from '../types';
import { uid } from './tasks';
import { weekBounds } from './dates';

/** A task as read from Todoist, before Mark decides where its project goes. */
export interface RawTodo {
  title: string;
  project: string;
  section?: string;
  notes?: string;
  /** 1 = highest (Todoist p1) .. 4 = none */
  priority: number;
  due?: string;
  recurring?: string;
  labels?: string[];
}

export interface ProjectPlan {
  name: string;
  count: number;
  lens: Lens;
  bucket: Bucket;
  include: boolean;
}

const BUSINESS_HINT = /business|work|rental|tahoe|airbnb|llc|client|consult|invoice|tax|property|clean/i;

export function guessLens(project: string): Lens {
  return BUSINESS_HINT.test(project) ? 'business' : 'life';
}

export function planProjects(todos: RawTodo[]): ProjectPlan[] {
  const counts = new Map<string, number>();
  for (const t of todos) counts.set(t.project, (counts.get(t.project) ?? 0) + 1);
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({
      name,
      count,
      lens: guessLens(name),
      bucket: /^inbox$/i.test(name) ? 'inbox' : 'backlog',
      include: true,
    }));
}

/**
 * Turn Todoist tasks into dashboard tasks. Dated items land by date
 * (overdue or this week -> This week, next week -> Next week); the rest go to
 * the bucket chosen for their project. Higher Todoist priority sorts first.
 */
export function convert(todos: RawTodo[], plans: ProjectPlan[], now = new Date()): Task[] {
  const byName = new Map(plans.map((p) => [p.name, p]));
  const { end, nextEnd } = weekBounds(now);
  const out: Task[] = [];
  const sorted = [...todos].sort((a, b) => a.priority - b.priority);
  for (const t of sorted) {
    const plan = byName.get(t.project);
    if (!plan || !plan.include) continue;
    let bucket: Bucket = plan.bucket;
    if (t.due && bucket !== 'top') {
      if (t.due <= end) bucket = 'week';
      else if (t.due <= nextEnd) bucket = 'next';
    }
    const notes = [t.notes?.trim(), t.recurring ? `Repeats in Todoist: ${t.recurring}` : '', t.labels?.length ? `Labels: ${t.labels.join(', ')}` : '']
      .filter(Boolean)
      .join('\n');
    out.push({
      id: uid(),
      title: t.title,
      lens: plan.lens,
      bucket,
      done: false,
      due: t.due,
      notes: notes || undefined,
      createdAt: now.getTime(),
      source: `todoist:${t.project}${t.section ? ' / ' + t.section : ''}`,
    });
  }
  return out;
}

// ---------- CSV (Todoist "Export as CSV" / template file, one per project) ----------

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  const s = text.replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell); rows.push(row); row = []; cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ''));
}

/** Natural-language Todoist dates ("every monday") can't be resolved offline; ISO-like ones are kept. */
function csvDate(raw: string): { due?: string; recurring?: string } {
  const v = raw.trim();
  if (!v) return {};
  const iso = v.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return { due: iso[1] };
  if (/^every|^ev(ery)?\s|daily|weekly|monthly/i.test(v)) return { recurring: v };
  const d = new Date(v);
  if (!isNaN(d.getTime()) && /\d/.test(v)) {
    return { due: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
  }
  return { recurring: v };
}

export function fromCSV(text: string, project: string): RawTodo[] {
  const rows = parseCSV(text);
  if (!rows.length) return [];
  const head = rows[0].map((h) => h.trim().toUpperCase());
  const col = (name: string) => head.indexOf(name);
  const iType = col('TYPE'), iContent = col('CONTENT'), iDesc = col('DESCRIPTION'), iPri = col('PRIORITY'), iDate = col('DATE');
  if (iContent === -1) throw new Error('This does not look like a Todoist CSV (no CONTENT column).');
  const out: RawTodo[] = [];
  let section: string | undefined;
  let last: RawTodo | undefined;
  for (const r of rows.slice(1)) {
    const type = (iType >= 0 ? r[iType] : 'task')?.trim().toLowerCase();
    const content = (r[iContent] ?? '').trim();
    if (type === 'section') { section = content; continue; }
    if (type === 'note' && last) { last.notes = [last.notes, content].filter(Boolean).join('\n'); continue; }
    if (type !== 'task' || !content) continue;
    const labels = [...content.matchAll(/(?:^|\s)@([\w-]+)/g)].map((m) => m[1]);
    const title = content.replace(/(?:^|\s)@[\w-]+/g, '').trim();
    last = {
      title,
      project,
      section,
      notes: iDesc >= 0 ? r[iDesc]?.trim() || undefined : undefined,
      priority: Number(r[iPri]) || 4,
      labels: labels.length ? labels : undefined,
      ...csvDate(iDate >= 0 ? r[iDate] ?? '' : ''),
    };
    out.push(last);
  }
  return out;
}

// ---------- API (personal token from Todoist Settings > Integrations > Developer) ----------

interface Page<T> { results: T[]; next_cursor: string | null }
interface ApiTask {
  content: string; description?: string; project_id: string; section_id?: string | null;
  priority: number; labels?: string[]; due?: { date: string; is_recurring?: boolean; string?: string } | null;
  checked?: boolean; is_completed?: boolean;
}

async function getAll<T>(path: string, token: string, fetchImpl: typeof fetch): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | null = null;
  do {
    const url = new URL(`https://api.todoist.com/api/v1/${path}`);
    url.searchParams.set('limit', '200');
    if (cursor) url.searchParams.set('cursor', cursor);
    const res = await fetchImpl(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) throw new Error('Todoist rejected that token. Copy it again from Todoist Settings, Integrations, Developer.');
    if (!res.ok) throw new Error(`Todoist returned ${res.status}.`);
    const body = (await res.json()) as Page<T> | T[];
    if (Array.isArray(body)) return body;
    out.push(...body.results);
    cursor = body.next_cursor;
  } while (cursor);
  return out;
}

export async function fromAPI(token: string, fetchImpl: typeof fetch = fetch): Promise<RawTodo[]> {
  const [projects, sections, tasks] = await Promise.all([
    getAll<{ id: string; name: string }>('projects', token, fetchImpl),
    getAll<{ id: string; name: string }>('sections', token, fetchImpl),
    getAll<ApiTask>('tasks', token, fetchImpl),
  ]);
  const pName = new Map(projects.map((p) => [p.id, p.name]));
  const sName = new Map(sections.map((s) => [s.id, s.name]));
  return tasks
    .filter((t) => !t.checked && !t.is_completed)
    .map((t) => ({
      title: t.content,
      project: pName.get(t.project_id) ?? 'Inbox',
      section: t.section_id ? sName.get(t.section_id) : undefined,
      notes: t.description || undefined,
      priority: 5 - (t.priority || 1), // API: 4 = p1
      labels: t.labels?.length ? t.labels : undefined,
      due: t.due?.date?.slice(0, 10),
      recurring: t.due?.is_recurring ? t.due.string : undefined,
    }));
}
