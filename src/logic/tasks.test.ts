import { describe, expect, it } from 'vitest';
import type { Task } from '../types';
import { addTask, inBucket, moveTask, toggleTask } from './tasks';

const t = (id: string, bucket: Task['bucket'], lens: Task['lens'] = 'business', done = false): Task => ({
  id, title: id, bucket, lens, done, createdAt: 0,
});

describe('moveTask', () => {
  it('places a task before another one', () => {
    const tasks = [t('a', 'week'), t('b', 'week'), t('c', 'inbox')];
    const { tasks: out } = moveTask(tasks, 'c', 'week', 'b');
    expect(inBucket(out, 'week', 'both').map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('appends to the end of a bucket when no target is given', () => {
    const tasks = [t('a', 'week'), t('b', 'inbox'), t('c', 'week'), t('d', 'backlog')];
    const { tasks: out } = moveTask(tasks, 'b', 'week');
    expect(inBucket(out, 'week', 'both').map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('keeps Top 3 per area and bumps the overflow to the front of This week', () => {
    const tasks = [t('b1', 'top'), t('b2', 'top'), t('b3', 'top'), t('l1', 'top', 'life'), t('w', 'week'), t('x', 'inbox')];
    const { tasks: out, bumped } = moveTask(tasks, 'x', 'top', 'b1');
    expect(inBucket(out, 'top', 'business').map((x) => x.id)).toEqual(['x', 'b1', 'b2']);
    expect(bumped).toBe('b3');
    expect(inBucket(out, 'week', 'both').map((x) => x.id)).toEqual(['b3', 'w']);
    // Life is untouched, so the combined view can show up to 6
    expect(inBucket(out, 'top', 'both')).toHaveLength(4);
  });

  it('does not count done tasks against the Top 3 limit', () => {
    const tasks = [t('b1', 'top', 'business', true), t('b2', 'top'), t('b3', 'top'), t('x', 'inbox')];
    const { bumped } = moveTask(tasks, 'x', 'top');
    expect(bumped).toBeUndefined();
  });
});

describe('addTask', () => {
  it('adds to the top of the Inbox', () => {
    const { tasks } = addTask([t('a', 'inbox')], 'New thing', 'life');
    expect(tasks[0].title).toBe('New thing');
    expect(tasks[0].bucket).toBe('inbox');
  });
  it('ignores blank titles', () => {
    expect(addTask([], '   ', 'life').tasks).toHaveLength(0);
  });
});

it('toggleTask marks done and back', () => {
  const once = toggleTask([t('a', 'inbox')], 'a');
  expect(once[0].done).toBe(true);
  expect(toggleTask(once, 'a')[0].done).toBe(false);
});
