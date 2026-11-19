import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastMsg { text: string; action?: { label: string; run: () => void } }
const Ctx = createContext<(t: ToastMsg) => void>(() => {});
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<ToastMsg | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const show = useCallback((t: ToastMsg) => {
    setMsg(t);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(null), 5000);
  }, []);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <Ctx.Provider value={show}>
      {children}
      {msg && (
        <div className="toast" role="status">
          <span>{msg.text}</span>
          {msg.action && (
            <button onClick={() => { msg.action!.run(); setMsg(null); }}>{msg.action.label}</button>
          )}
          <button aria-label="Dismiss" onClick={() => setMsg(null)}>×</button>
        </div>
      )}
    </Ctx.Provider>
  );
}
