import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '../types';
import { BUCKETS, LENS_LABEL } from '../types';
import { dueLabel } from '../logic/dates';
import { IconCheck } from './icons';

interface Props {
  task: Task;
  num?: number;
  showLens?: boolean;
  showBucket?: boolean;
  onToggle: (id: string) => void;
  onOpen: (id: string) => void;
}

export function RowContent({ task, num, showLens, showBucket, onToggle, onOpen }: Props) {
  const due = task.due ? dueLabel(task.due) : null;
  const bucket = BUCKETS.find((b) => b.id === task.bucket)?.label;
  const hasSub = showLens || due || showBucket || task.source || task.notes;
  return (
    <>
      {num !== undefined && <span className={`num c-${task.lens}`}>{num}</span>}
      <button
        className={`check c-${task.lens}`}
        role="checkbox"
        aria-checked={task.done}
        aria-label={task.done ? `Mark “${task.title}” not done` : `Complete “${task.title}”`}
        onClick={(e) => { e.stopPropagation(); onToggle(task.id); }}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <IconCheck />
      </button>
      <div className="row-body" onClick={() => onOpen(task.id)}>
        <span className="row-title">{task.title}</span>
        {hasSub && (
          <span className="row-sub">
            {showLens && <span className={`tag ${task.lens}`}>{LENS_LABEL[task.lens]}</span>}
            {due && <span className={`due ${due.tone}`}>{due.text}</span>}
            {showBucket && <span>{bucket}</span>}
            {!due && !showBucket && task.source && <span>{task.source.replace(/^todoist:/, 'From Todoist · ')}</span>}
            {task.notes && <span aria-label="Has notes">¶</span>}
          </span>
        )}
      </div>
    </>
  );
}

export function TaskRow(props: Props) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: props.task.id,
    data: { bucket: props.task.bucket },
  });
  return (
    <div
      ref={setNodeRef}
      className={`row${props.task.done ? ' done' : ''}${isDragging ? ' dragging' : ''}`}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      {...attributes}
      {...listeners}
      aria-roledescription="Draggable task"
    >
      <RowContent {...props} />
    </div>
  );
}
