import { describe, expect, it } from 'vitest';
import type { AppState, Task } from '../types';
import { mergeStates } from './merge';

const t = (id: string, updatedAt: number, extra: Partial<Task> = {}): Task => ({
  id, title: id, lens: 'life', bucket: 'week', done: false, createdAt: 0, updatedAt, ...extra,
});
const st = (tasks: Task[], extra: Partial<AppState> = {}): AppState => ({
  version: 1, tasks, settings: { homeAirport: 'SFO', lens: 'both', sources: [], updatedAt: 0 }, ...extra,
});

describe('mergeStates', () => {
  it('keeps the newest edit of each task', () => {
    const out = mergeStates(st([t('a', 5, { title: 'phone' }), t('b', 1)]), st([t('a', 9, { title: 'laptop' }), t('b', 1)]));
    expect(out.tasks.find((x) => x.id === 'a')?.title).toBe('laptop');
  });

  it('adds tasks created on either side near their neighbours', () => {
    const out = mergeStates(st([t('a', 1), t('n1', 10), t('b', 1)]), st([t('a', 1), t('b', 1), t('n2', 5)]));
    expect(out.tasks.map((x) => x.id)).toEqual(['a', 'n1', 'b', 'n2']);
  });

  it('lets a delete win over an older edit but not a newer one', () => {
    const local = st([t('a', 1), t('b', 20)], {});
    const remote = st([], { deleted: { a: 10, b: 10 } });
    expect(mergeStates(local, remote).tasks.map((x) => x.id)).toEqual(['b']);
  });

  it('takes the newer settings', () => {
    const local = st([]);
    const remote = st([]);
    remote.settings = { ...remote.settings, homeAirport: 'SJC', updatedAt: 3 };
    expect(mergeStates(local, remote).settings.homeAirport).toBe('SJC');
  });
});
