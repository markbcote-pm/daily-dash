import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { ReactNode } from 'react';
import type { Bucket, Task } from '../types';
import { TaskRow } from './TaskRow';

interface Props {
  id: string; // droppable id, unique per list on screen
  bucket: Bucket;
  tasks: Task[];
  numbered?: boolean;
  showLens?: boolean;
  showBucket?: boolean;
  empty?: ReactNode;
  footer?: ReactNode;
  bare?: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}

export function TaskList({ id, bucket, tasks, numbered, showLens, showBucket, empty, footer, bare, onToggle, onOpen }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: `list:${id}`, data: { bucket } });
  return (
    <SortableContext id={id} items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
      <div ref={setNodeRef} className={`list${bare ? ' bare' : ''}${isOver ? ' drop-over' : ''}`}>
        {tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} num={numbered ? tasks.slice(0, i + 1).filter((x) => x.lens === t.lens).length : undefined} showLens={showLens} showBucket={showBucket} onToggle={onToggle} onOpen={onOpen} />
        ))}
        {tasks.length === 0 && <div className="empty">{empty ?? 'Nothing here yet.'}</div>}
        {footer}
      </div>
    </SortableContext>
  );
}
