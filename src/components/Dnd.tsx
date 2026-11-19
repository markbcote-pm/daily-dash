import {
  DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, pointerWithin, rectIntersection,
  useSensor, useSensors, type CollisionDetection, type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import { arrayMove, sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { useState, type ReactNode } from 'react';
import { useAppState } from '../store';
import type { Bucket } from '../types';
import { useActions } from '../actions';
import { RowContent } from './TaskRow';

// Prefer what's under the finger: a task row, then a list or bucket chip.
const collide: CollisionDetection = (args) => {
  const hits = pointerWithin(args);
  if (hits.length) {
    const row = hits.find((h) => !String(h.id).includes(':'));
    return row ? [row] : hits;
  }
  return rectIntersection(args);
};

export function TaskDnd({ children }: { children: ReactNode }) {
  const { tasks } = useAppState();
  const { move } = useActions();
  const [activeId, setActiveId] = useState<string | null>(null);
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onStart = (e: DragStartEvent) => {
    setActiveId(String(e.active.id));
    navigator.vibrate?.(10);
  };

  const onEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;
    const id = String(active.id);
    const overId = String(over.id);
    const target = over.data.current?.bucket as Bucket | undefined;
    if (!target) return;

    if (overId.includes(':')) {
      // dropped on a list's empty area or a bucket chip: goes to the end of that bucket
      move(id, target);
      return;
    }
    const from = active.data.current?.bucket as Bucket;
    const items = (over.data.current?.sortable?.items as string[] | undefined) ?? [];
    if (from === target && items.includes(id)) {
      const oldI = items.indexOf(id);
      const newI = items.indexOf(overId);
      const final = arrayMove(items, oldI, newI);
      move(id, target, final[newI + 1] ?? null);
    } else {
      move(id, target, overId);
    }
  };

  const active = activeId ? tasks.find((t) => t.id === activeId) : undefined;
  return (
    <DndContext sensors={sensors} collisionDetection={collide} onDragStart={onStart} onDragEnd={onEnd} onDragCancel={() => setActiveId(null)}>
      {children}
      <DragOverlay dropAnimation={null}>
        {active && (
          <div className="row overlay">
            <RowContent task={active} onToggle={() => {}} onOpen={() => {}} />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
