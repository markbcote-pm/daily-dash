import { useDroppable } from '@dnd-kit/core';
import { useState } from 'react';
import type { Bucket, Lens, LensFilter } from '../types';
import { useAppState, setSettings } from '../store';
import { useActions } from '../actions';
import { IconPlus } from './icons';

export function LensSeg() {
  const { settings } = useAppState();
  const opts: { id: LensFilter; label: string }[] = [
    { id: 'both', label: 'Both' },
    { id: 'business', label: 'Business' },
    { id: 'life', label: 'Life' },
  ];
  return (
    <div className="seg" role="group" aria-label="Area">
      {opts.map((o) => (
        <button key={o.id} aria-pressed={settings.lens === o.id} onClick={() => setSettings({ lens: o.id })}>{o.label}</button>
      ))}
    </div>
  );
}

export function BucketChip({ bucket, label, count, selected, onPick }: { bucket: Bucket; label: string; count: number; selected: boolean; onPick: () => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: `chip:${bucket}`, data: { bucket } });
  return (
    <button ref={setNodeRef} role="tab" aria-selected={selected} className={`chip${isOver ? ' drop-over' : ''}`} onClick={onPick}>
      {label} <span className="count">{count}</span>
    </button>
  );
}

export function Composer({ bucket = 'inbox', bucketLabel = 'Inbox' }: { bucket?: Bucket; bucketLabel?: string }) {
  const { settings } = useAppState();
  const { add } = useActions();
  const [draft, setDraft] = useState('');
  const [pick, setPick] = useState<Lens>('business');
  const lens: Lens = settings.lens === 'both' ? pick : settings.lens;
  const submit = () => {
    if (!draft.trim()) return;
    add(draft, lens, bucket);
    setDraft('');
  };
  return (
    <div className="composer">
      <div className="composer-row">
        <button
          className={`lens-dot ${lens}`}
          onClick={() => settings.lens === 'both' && setPick(lens === 'business' ? 'life' : 'business')}
          aria-label={`Area: ${lens === 'business' ? 'Business' : 'Life'}${settings.lens === 'both' ? '. Tap to switch' : ''}`}
          title="Switch area"
        >
          {lens === 'business' ? 'BIZ' : 'LIFE'}
        </button>
        <label className="sr-only" htmlFor="composer">Add to {bucketLabel}</label>
        <input
          id="composer"
          className="input"
          value={draft}
          placeholder={`Add to ${bucketLabel}…`}
          enterKeyHint="done"
          autoComplete="off"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button className="add" onClick={submit} aria-label="Add task"><IconPlus /></button>
      </div>
    </div>
  );
}
