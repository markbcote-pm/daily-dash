import type { CalSource } from './logic/calendar';

export type Lens = 'business' | 'life';
export type LensFilter = Lens | 'both';
export type Bucket = 'top' | 'inbox' | 'week' | 'next' | 'backlog';

export interface Task {
  id: string;
  title: string;
  lens: Lens;
  bucket: Bucket;
  done: boolean;
  /** ISO date (YYYY-MM-DD), only for time-bound items */
  due?: string;
  notes?: string;
  createdAt: number;
  doneAt?: number;
  /** where it came from, e.g. "todoist:Home" */
  source?: string;
  /** last change, used to merge edits from other devices */
  updatedAt?: number;
}

export type HomeAirport = 'SFO' | 'SJC';

export interface Settings {
  homeAirport: HomeAirport;
  lens: LensFilter;
  sources: CalSource[];
  /** when settings last changed, for sync */
  updatedAt?: number;
}

export interface AppState {
  version: 1;
  tasks: Task[];
  settings: Settings;
  /** ids of deleted tasks and when, so a delete on one device sticks on the others */
  deleted?: Record<string, number>;
}

export const BUCKETS: { id: Bucket; label: string }[] = [
  { id: 'top', label: 'Top 3' },
  { id: 'inbox', label: 'Inbox' },
  { id: 'week', label: 'This week' },
  { id: 'next', label: 'Next week' },
  { id: 'backlog', label: 'Backlog' },
];

export const LENS_LABEL: Record<Lens, string> = { business: 'Business', life: 'Life' };
export const TOP_LIMIT = 3;
