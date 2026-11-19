import { useState } from 'react';
import { getState, setTasks } from '../store';
import { convert, fromAPI, fromCSV, planProjects, type ProjectPlan, type RawTodo } from '../logic/todoist';
import type { Bucket, Lens } from '../types';
import { BUCKETS } from '../types';

type Mode = 'token' | 'csv';

export function ImportTodoist() {
  const [mode, setMode] = useState<Mode>('token');
  const [token, setToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  const [todos, setTodos] = useState<RawTodo[] | null>(null);
  const [plans, setPlans] = useState<ProjectPlan[]>([]);

  const load = (list: RawTodo[]) => {
    if (!list.length) { setError('No open tasks found.'); return; }
    setTodos(list);
    setPlans(planProjects(list));
  };

  const fetchToken = async () => {
    setBusy(true); setError(''); setDone('');
    try {
      load(await fromAPI(token.trim()));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(/fetch|network|load failed/i.test(msg)
        ? "Couldn't reach Todoist from the browser. Try the CSV option instead."
        : msg);
    } finally {
      setBusy(false);
    }
  };

  const readFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(''); setDone('');
    try {
      const all: RawTodo[] = [];
      for (const f of Array.from(files)) {
        const project = f.name.replace(/\.csv$/i, '').replace(/[_-]+/g, ' ').trim() || 'Imported';
        all.push(...fromCSV(await f.text(), project));
      }
      load(all);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const setPlan = (name: string, patch: Partial<ProjectPlan>) =>
    setPlans((ps) => ps.map((p) => (p.name === name ? { ...p, ...patch } : p)));

  const commit = () => {
    if (!todos) return;
    const existing = new Set(getState().tasks.map((t) => `${t.source}|${t.title}`));
    const fresh = convert(todos, plans).filter((t) => !existing.has(`${t.source}|${t.title}`));
    const skipped = convert(todos, plans).length - fresh.length;
    setTasks((ts) => [...ts, ...fresh]);
    setDone(`Imported ${fresh.length} tasks${skipped ? `, skipped ${skipped} already here` : ''}.${mode === 'token' ? ' Your token was not saved.' : ''}`);
    setTodos(null); setPlans([]); setToken('');
  };

  const included = plans.filter((p) => p.include).reduce((n, p) => n + p.count, 0);

  return (
    <section className="card stack" aria-labelledby="imp">
      <div>
        <h2 id="imp">Import from Todoist</h2>
        <p className="note" style={{ margin: '6px 0 0' }}>A one-time move. You choose which area and bucket each Todoist project lands in. Dated tasks go to This week or Next week by date.</p>
      </div>

      {!todos && (
        <>
          <div className="seg" role="group" aria-label="Import method" style={{ alignSelf: 'flex-start' }}>
            <button aria-pressed={mode === 'token'} onClick={() => setMode('token')}>API token</button>
            <button aria-pressed={mode === 'csv'} onClick={() => setMode('csv')}>CSV files</button>
          </div>
          {mode === 'token' ? (
            <div className="stack">
              <p className="note" style={{ margin: 0 }}>The token is only on the Todoist website, not in the phone app. Sign in at <a href="https://app.todoist.com/app/settings/integrations/developer" target="_blank" rel="noreferrer">todoist.com, Settings, Integrations, Developer</a> and copy your API token. It's used once in this browser and never stored.</p>
              <label className="field">
                <span>API token</span>
                <input className="input" type="password" autoComplete="off" value={token} onChange={(e) => setToken(e.target.value)} placeholder="Paste token" />
              </label>
              <div><button className="btn primary" disabled={!token.trim() || busy} onClick={fetchToken}>{busy ? 'Reading Todoist…' : 'Read my tasks'}</button></div>
            </div>
          ) : (
            <div className="stack">
              <p className="note" style={{ margin: 0 }}>In Todoist on the web, open each project's menu and choose Export as a template, then Download as CSV. Pick all the files at once. Each file name becomes the project name.</p>
              <label className="file-drop">
                Choose CSV files
                <input type="file" accept=".csv,text/csv" multiple onChange={(e) => readFiles(e.target.files)} />
              </label>
            </div>
          )}
        </>
      )}

      {todos && (
        <div className="stack">
          <p style={{ margin: 0 }}><b>{todos.length}</b> open tasks in <b>{plans.length}</b> projects. Check where each project goes.</p>
          <div>
            {plans.map((p) => (
              <div className="proj" key={p.name}>
                <input className="cb" type="checkbox" checked={p.include} onChange={(e) => setPlan(p.name, { include: e.target.checked })} aria-label={`Include ${p.name}`} />
                <div><b>{p.name}</b> <span className="muted small">{p.count}</span></div>
                {p.include && (
                  <div className="proj-controls">
                    <div className="seg" role="group" aria-label={`Area for ${p.name}`}>
                      {(['business', 'life'] as Lens[]).map((l) => (
                        <button key={l} aria-pressed={p.lens === l} onClick={() => setPlan(p.name, { lens: l })}>{l === 'business' ? 'Business' : 'Life'}</button>
                      ))}
                    </div>
                    <select className="select" value={p.bucket} aria-label={`Bucket for ${p.name}`} onChange={(e) => setPlan(p.name, { bucket: e.target.value as Bucket })}>
                      {BUCKETS.filter((b) => b.id !== 'top').map((b) => <option key={b.id} value={b.id}>{b.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn primary" disabled={!included} onClick={commit}>Import {included} tasks</button>
            <button className="btn ghost" onClick={() => { setTodos(null); setPlans([]); }}>Start over</button>
          </div>
        </div>
      )}

      {error && <p className="error" role="alert" style={{ margin: 0 }}>{error}</p>}
      {done && <p className="ok" role="status" style={{ margin: 0 }}>{done}</p>}
    </section>
  );
}
