import { useRef, useState } from 'react';
import { getState, replaceAll, setSettings, setTasks, useAppState } from '../store';
import { clearDone } from '../logic/tasks';
import { toISO } from '../logic/dates';
import type { AppState, HomeAirport } from '../types';
import { ImportTodoist } from './ImportTodoist';

const AIRPORTS: { id: HomeAirport; label: string }[] = [
  { id: 'SFO', label: 'SFO · San Francisco' },
  { id: 'SJC', label: 'SJC · San José' },
];

export function Settings() {
  const { settings, tasks } = useAppState();
  const file = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState('');
  const doneCount = tasks.filter((t) => t.done).length;

  const exportBackup = () => {
    const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `daily-dash-backup-${toISO(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const restore = async (f?: File) => {
    if (!f) return;
    try {
      const data = JSON.parse(await f.text()) as AppState;
      if (!Array.isArray(data.tasks)) throw new Error();
      replaceAll(data);
      setMsg(`Restored ${data.tasks.length} tasks.`);
    } catch {
      setMsg("That file isn't a Daily Dash backup.");
    }
  };

  return (
    <div className="page">
      <div className="head"><div className="head-text"><span className="eyebrow">Setup</span><h1>Settings</h1></div></div>
      <div className="settings-grid">
        <ImportTodoist />
        <div className="stack">
          <section className="card stack" aria-labelledby="travel">
            <h2 id="travel">Travel</h2>
            <label className="field">
              <span>Home airport</span>
              <select className="select" value={settings.homeAirport} onChange={(e) => setSettings({ homeAirport: e.target.value as HomeAirport })}>
                {AIRPORTS.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
              </select>
            </label>
            <p className="note" style={{ margin: 0 }}>Trips use this for airport parking and drive-time prep. You can still change it per trip.</p>
          </section>

          <section className="card stack" aria-labelledby="data">
            <h2 id="data">Your data</h2>
            <p className="note" style={{ margin: 0 }}>For now everything is saved on this device. Sync across your phone and laptop comes with the calendar phase. Keep a backup until then.</p>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button className="btn" onClick={exportBackup}>Download backup</button>
              <button className="btn" onClick={() => file.current?.click()}>Restore</button>
              <input ref={file} type="file" accept="application/json,.json" hidden onChange={(e) => restore(e.target.files?.[0])} />
              <button className="btn ghost" disabled={!doneCount} onClick={() => setTasks(clearDone)}>Clear {doneCount} done</button>
            </div>
            {msg && <p className="note" role="status" style={{ margin: 0 }}>{msg}</p>}
          </section>

          <section className="card stack" aria-labelledby="install">
            <h2 id="install">Put it on your home screen</h2>
            <p className="note" style={{ margin: 0 }}><b>iPhone:</b> open in Safari, tap Share, then Add to Home Screen.<br /><b>Android:</b> open in Chrome, tap the menu, then Install app.<br /><b>Desktop:</b> use the install icon in Chrome's address bar.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
