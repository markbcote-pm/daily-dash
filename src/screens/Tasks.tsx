import { useState } from 'react';
import { useAppState } from '../store';
import { useActions } from '../actions';
import { TaskDnd } from '../components/Dnd';
import { TaskList } from '../components/TaskList';
import { BucketChip, LensSeg } from '../components/Controls';
import { inBucket } from '../logic/tasks';
import type { Bucket } from '../types';
import { BUCKETS } from '../types';

const HINT: Record<Bucket, string> = {
  top: 'Three per area. Adding a fourth bumps the last one to This week.',
  inbox: 'Everything new lands here. Sort it into a week or the Backlog.',
  week: 'Work top-down. Drag to reorder, or onto a bucket above to move.',
  next: "Lined up for next week. Pull items forward when there's room.",
  backlog: 'Someday and maybe. Nothing here needs a date.',
};

export function Tasks({ bucket, setBucket, open }: { bucket: Bucket; setBucket: (b: Bucket) => void; open: (id: string) => void }) {
  const { tasks, settings } = useAppState();
  const { toggle } = useActions();
  const [showDone, setShowDone] = useState(false);
  const lens = settings.lens;
  const count = (b: Bucket) => inBucket(tasks, b, lens).filter((t) => !t.done).length;
  const list = inBucket(tasks, bucket, lens, showDone);

  return (
    <TaskDnd>
      <div className="page">
        <div className="head">
          <div className="head-text">
            <span className="eyebrow">One list, five buckets</span>
            <h1>Tasks</h1>
          </div>
          <LensSeg />
        </div>

        <div className="phone-tasks stack">
          <div className="chips" role="tablist" aria-label="Buckets">
            {BUCKETS.map((b) => (
              <BucketChip key={b.id} bucket={b.id} label={b.label} count={count(b.id)} selected={bucket === b.id} onPick={() => setBucket(b.id)} />
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
            <span className="small muted">{HINT[bucket]}</span>
            <button className="chip" aria-pressed={showDone} onClick={() => setShowDone(!showDone)}>Done</button>
          </div>
          <TaskList id={`phone-${bucket}`} bucket={bucket} tasks={list} numbered={bucket === 'top'} showLens={lens === 'both'} onToggle={toggle} onOpen={open}
            empty="Nothing here. Long-press a task and drop it on this bucket's chip." />
        </div>

        <div className="board">
          {BUCKETS.map((b) => (
            <div className="board-col" key={b.id}>
              <div className="card-head" style={{ marginBottom: 0 }}>
                <h3>{b.label}</h3>
                <span className="small muted">{count(b.id)}</span>
              </div>
              <TaskList id={`board-${b.id}`} bucket={b.id} tasks={inBucket(tasks, b.id, lens, showDone)} numbered={b.id === 'top'} showLens={lens === 'both'}
                onToggle={toggle} onOpen={open} empty="Drop tasks here" />
            </div>
          ))}
        </div>
      </div>
    </TaskDnd>
  );
}
