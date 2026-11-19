import type { Bucket, Lens, LensFilter, Task } from '../types';
import { TOP_LIMIT } from '../types';

export const uid = () =>
  (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)) as string;

export const matchesLens = (t: Task, lens: LensFilter) => lens === 'both' || t.lens === lens;

const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Open tasks, plus ones finished today so progress stays visible until tomorrow. */
export const isVisible = (t: Task, showDone = false) => showDone || !t.done || (t.doneAt ?? 0) >= startOfToday();

export function inBucket(tasks: Task[], bucket: Bucket, lens: LensFilter, showDone = false) {
  return tasks.filter((t) => t.bucket === bucket && matchesLens(t, lens) && isVisible(t, showDone));
}

export interface MoveResult {
  tasks: Task[];
  /** title of a task pushed out of Top 3 to make room, if any */
  bumped?: string;
}

/**
 * Move a task into `bucket`, placed just before `beforeId` (or at the end of the bucket).
 * Top 3 holds at most three open tasks per area; the overflow goes to the front of This week.
 */
export function moveTask(tasks: Task[], id: string, bucket: Bucket, beforeId?: string | null): MoveResult {
  const task = tasks.find((t) => t.id === id);
  if (!task) return { tasks };
  const moved: Task = { ...task, bucket };
  let rest = tasks.filter((t) => t.id !== id);

  let idx = beforeId ? rest.findIndex((t) => t.id === beforeId) : -1;
  if (idx === -1) {
    // after the last task of that bucket, or at the end
    const lastInBucket = rest.map((t) => t.bucket).lastIndexOf(bucket);
    idx = lastInBucket === -1 ? rest.length : lastInBucket + 1;
  }
  rest.splice(idx, 0, moved);

  return enforceTopLimit(rest, moved.lens, moved.id);
}

export function enforceTopLimit(tasks: Task[], lens: Lens, keepId?: string): MoveResult {
  const openTop = tasks.filter((t) => t.bucket === 'top' && t.lens === lens && !t.done);
  if (openTop.length <= TOP_LIMIT) return { tasks };
  // bump the last open Top task of this area that is not the one just placed
  const victim = [...openTop].reverse().find((t) => t.id !== keepId)!;
  const without = tasks.filter((t) => t.id !== victim.id);
  const firstWeek = without.findIndex((t) => t.bucket === 'week');
  const at = firstWeek === -1 ? without.length : firstWeek;
  without.splice(at, 0, { ...victim, bucket: 'week' });
  return { tasks: without, bumped: victim.title };
}

export function addTask(tasks: Task[], title: string, lens: Lens, bucket: Bucket = 'inbox', due?: string): MoveResult {
  const t: Task = { id: uid(), title: title.trim(), lens, bucket, done: false, createdAt: Date.now(), due };
  if (!t.title) return { tasks };
  // new items go to the top of their bucket
  const first = tasks.findIndex((x) => x.bucket === bucket);
  const next = [...tasks];
  next.splice(first === -1 ? next.length : first, 0, t);
  return bucket === 'top' ? enforceTopLimit(next, lens, t.id) : { tasks: next };
}

export function toggleTask(tasks: Task[], id: string): Task[] {
  return tasks.map((t) => (t.id === id ? { ...t, done: !t.done, doneAt: t.done ? undefined : Date.now() } : t));
}

export function updateTask(tasks: Task[], id: string, patch: Partial<Task>): MoveResult {
  const next = tasks.map((t) => (t.id === id ? { ...t, ...patch } : t));
  const t = next.find((x) => x.id === id);
  return t && t.bucket === 'top' ? enforceTopLimit(next, t.lens, id) : { tasks: next };
}

export function deleteTask(tasks: Task[], id: string): Task[] {
  return tasks.filter((t) => t.id !== id);
}

/** Done tasks older than a day drop out of view; this clears them for good. */
export function clearDone(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.done);
}
