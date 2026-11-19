import type { AppState, Task } from '../types';

const ts = (t: Task) => t.updatedAt ?? t.createdAt ?? 0;

/**
 * Merge two copies of the app state (this device and the server).
 * Each task keeps its newest version; deletes win over older edits.
 * Order follows whichever copy changed most recently, with tasks only the
 * other copy knows about slotted in after their old neighbour.
 */
export function mergeStates(local: AppState, remote: AppState): AppState {
  const deleted: Record<string, number> = { ...(remote.deleted ?? {}) };
  for (const [id, at] of Object.entries(local.deleted ?? {})) deleted[id] = Math.max(at, deleted[id] ?? 0);

  const newest = (s: AppState) => Math.max(s.settings.updatedAt ?? 0, ...s.tasks.map(ts), ...Object.values(s.deleted ?? {}), 0);
  const [primary, secondary] = newest(local) >= newest(remote) ? [local, remote] : [remote, local];

  const byId = new Map<string, Task>();
  for (const t of [...secondary.tasks, ...primary.tasks]) {
    const have = byId.get(t.id);
    if (!have || ts(t) > ts(have) || (ts(t) === ts(have) && primary.tasks.includes(t))) byId.set(t.id, t);
  }

  const order = primary.tasks.map((t) => t.id);
  const inOrder = new Set(order);
  secondary.tasks.forEach((t, i) => {
    if (inOrder.has(t.id)) return;
    const prev = secondary.tasks.slice(0, i).reverse().find((p) => inOrder.has(p.id));
    const at = prev ? order.indexOf(prev.id) + 1 : 0;
    order.splice(at, 0, t.id);
    inOrder.add(t.id);
  });

  const tasks = order
    .map((id) => byId.get(id)!)
    .filter((t) => !(deleted[t.id] && deleted[t.id] >= ts(t)));

  // keep tombstones for 60 days
  const cutoff = Date.now() - 60 * 864e5;
  for (const [id, at] of Object.entries(deleted)) if (at < cutoff) delete deleted[id];

  const settings = (local.settings.updatedAt ?? 0) >= (remote.settings.updatedAt ?? 0) ? local.settings : remote.settings;
  return { version: 1, tasks, settings, deleted };
}
