import { useState } from 'react';
import { sendCode, signOut, syncConfigured, syncNow, useSync, verifyCode } from '../sync';

export function SyncCard() {
  const sync = useSync();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const wrap = async (fn: () => Promise<void>) => {
    setBusy(true); setErr('');
    try { await fn(); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); } finally { setBusy(false); }
  };

  return (
    <section className="card stack" aria-labelledby="sync">
      <h2 id="sync">Sync</h2>
      {!syncConfigured && (
        <p className="note" style={{ margin: 0 }}>Sync isn't connected yet. Once the Supabase project is linked, sign in here on each device and your tasks and calendars follow you. Until then, everything stays on this device.</p>
      )}
      {syncConfigured && sync.state === 'signed-out' && (
        <div className="stack">
          <p className="note" style={{ margin: 0 }}>Sign in with your email on each device. We'll email you a 6-digit code. Codes work better than links when the app is on your home screen.</p>
          <label className="field">
            <span>Email</span>
            <input className="input" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {sent && (
            <label className="field">
              <span>Code from the email</span>
              <input className="input" inputMode="numeric" autoComplete="one-time-code" value={code} onChange={(e) => setCode(e.target.value)} />
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {!sent
              ? <button className="btn primary" disabled={busy || !email.includes('@')} onClick={() => wrap(async () => { await sendCode(email.trim()); setSent(true); })}>Email me a code</button>
              : <>
                  <button className="btn primary" disabled={busy || code.trim().length < 6} onClick={() => wrap(() => verifyCode(email.trim(), code))}>Sign in</button>
                  <button className="btn ghost" disabled={busy} onClick={() => wrap(() => sendCode(email.trim()))}>Send again</button>
                </>}
          </div>
        </div>
      )}
      {syncConfigured && sync.state !== 'signed-out' && sync.state !== 'off' && (
        <div className="stack">
          <p style={{ margin: 0 }}>
            Signed in as <b>{sync.email}</b>.{' '}
            <span className={sync.state === 'error' ? 'error' : 'muted'}>
              {sync.state === 'syncing' ? 'Syncing…' : sync.state === 'error' ? `Sync problem: ${sync.error}` : 'Up to date.'}
            </span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => syncNow()}>Sync now</button>
            <button className="btn ghost" onClick={() => signOut()}>Sign out</button>
          </div>
        </div>
      )}
      {err && <p className="error" role="alert" style={{ margin: 0 }}>{err}</p>}
    </section>
  );
}
