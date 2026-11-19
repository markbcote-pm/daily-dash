import { useEffect, useState } from 'react';
import { useAppState } from '../store';
import { useActions } from '../actions';
import type { Task } from '../types';
import { BUCKETS } from '../types';

export function TaskSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const { tasks } = useAppState();
  const task = tasks.find((t) => t.id === id);
  const { update, remove, toggle } = useActions();
  const [title, setTitle] = useState(task?.title ?? '');
  const [notes, setNotes] = useState(task?.notes ?? '');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!task) return null;
  const set = (patch: Partial<Task>) => update(task.id, patch);
  const commitText = () => {
    const t = title.trim();
    if (t && (t !== task.title || notes !== (task.notes ?? ''))) set({ title: t, notes: notes.trim() || undefined });
  };
  const close = () => { commitText(); onClose(); };

  return (
    <div className="scrim" onClick={close}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label="Edit task" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <label className="field">
          <span>Task</span>
          <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={commitText} />
        </label>

        <div className="field">
          <span>Area</span>
          <div className="seg" role="group" aria-label="Area" style={{ alignSelf: 'flex-start' }}>
            <button aria-pressed={task.lens === 'business'} onClick={() => set({ lens: 'business' })}>Business</button>
            <button aria-pressed={task.lens === 'life'} onClick={() => set({ lens: 'life' })}>Life</button>
          </div>
        </div>

        <div className="field">
          <span>Bucket</span>
          <div className="chips" role="group" aria-label="Bucket" style={{ flexWrap: 'wrap' }}>
            {BUCKETS.map((b) => (
              <button key={b.id} className="chip" aria-pressed={task.bucket === b.id} onClick={() => set({ bucket: b.id })}>{b.label}</button>
            ))}
          </div>
        </div>

        <label className="field">
          <span>Date (only if it's time-bound)</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <input className="input" type="date" value={task.due ?? ''} onChange={(e) => set({ due: e.target.value || undefined })} />
            {task.due && <button className="btn ghost" onClick={() => set({ due: undefined })}>Clear</button>}
          </div>
        </label>

        <label className="field">
          <span>Notes</span>
          <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={commitText} />
        </label>

        {task.source && <p className="note" style={{ margin: 0 }}>Imported from {task.source.replace(/^todoist:/, 'Todoist, ')}</p>}

        <div className="sheet-actions">
          <button className="btn danger ghost" onClick={() => { remove(task.id); onClose(); }}>Delete</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => { toggle(task.id); close(); }}>{task.done ? 'Mark not done' : 'Complete'}</button>
            <button className="btn primary" onClick={close}>Done</button>
          </div>
        </div>
      </div>
    </div>
  );
}
