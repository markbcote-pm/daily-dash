import { useMemo } from 'react';
import { useToast } from './components/Toast';
import { getState, removeTasks, setState, setTasks } from './store';
import type { Bucket, Lens, Task } from './types';
import { LENS_LABEL } from './types';
import { addTask, moveTask, toggleTask, updateTask, type MoveResult } from './logic/tasks';

export function useActions() {
  const toast = useToast();
  return useMemo(() => {
    const apply = (fn: (t: Task[]) => MoveResult) => {
      let bumped: string | undefined;
      let lens: Lens | undefined;
      setTasks((tasks) => {
        const r = fn(tasks);
        bumped = r.bumped;
        if (bumped) lens = r.tasks.find((t) => t.title === bumped && t.bucket === 'week')?.lens;
        return r.tasks;
      });
      if (bumped) toast({ text: `${lens ? LENS_LABEL[lens] + ' ' : ''}Top 3 was full, so “${bumped}” moved to This week.` });
    };
    return {
      move: (id: string, bucket: Bucket, beforeId?: string | null) => apply((t) => moveTask(t, id, bucket, beforeId)),
      add: (title: string, lens: Lens, bucket: Bucket = 'inbox', due?: string) => apply((t) => addTask(t, title, lens, bucket, due)),
      update: (id: string, patch: Partial<Task>) => apply((t) => updateTask(t, id, patch)),
      toggle: (id: string) => setTasks((t) => toggleTask(t, id)),
      remove: (id: string) => {
        const before = getState();
        const gone = before.tasks.find((t) => t.id === id);
        removeTasks([id]);
        if (gone) {
          toast({
            text: `Deleted “${gone.title}”.`,
            action: { label: 'Undo', run: () => setState((s) => ({ ...s, tasks: before.tasks.map((t) => (t.id === id ? { ...t, updatedAt: Date.now() } : t)), deleted: before.deleted })) },
          });
        }
      },
    };
  }, [toast]);
}
