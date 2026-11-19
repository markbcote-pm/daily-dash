import { useCallback, useEffect, useState, type ComponentType, type SVGProps } from 'react';
import { ToastProvider } from './components/Toast';
import { Composer } from './components/Controls';
import { TaskSheet } from './components/TaskSheet';
import { IconCalendar, IconSettings, IconTasks, IconToday, IconTraining, IconTrips } from './components/icons';
import { Today } from './screens/Today';
import { Tasks } from './screens/Tasks';
import { Settings } from './screens/Settings';
import { Soon } from './screens/Soon';
import { Calendar } from './screens/Calendar';
import type { Bucket } from './types';
import { BUCKETS } from './types';

type Icon = ComponentType<SVGProps<SVGSVGElement>>;
const NAV: { id: string; label: string; icon: Icon }[] = [
  { id: 'today', label: 'Today', icon: IconToday },
  { id: 'tasks', label: 'Tasks', icon: IconTasks },
  { id: 'calendar', label: 'Calendar', icon: IconCalendar },
  { id: 'trips', label: 'Trips', icon: IconTrips },
  { id: 'training', label: 'Training', icon: IconTraining },
];

const readRoute = () => location.hash.replace(/^#\/?/, '') || 'today';

export function App() {
  const [route, setRoute] = useState(readRoute);
  const [sheet, setSheet] = useState<string | null>(null);

  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const go = useCallback((r: string) => { location.hash = `/${r}`; }, []);
  const [screen, sub] = route.split('/');
  const bucket: Bucket = (BUCKETS.find((b) => b.id === sub)?.id ?? 'top') as Bucket;
  const bucketLabel = BUCKETS.find((b) => b.id === bucket)!.label;

  const nav = () =>
    NAV.map(({ id, label, icon: I }) => (
      <a key={id} className="navlink" href={`#/${id}`} aria-current={screen === id ? 'page' : undefined}>
        <I /><span>{label}</span>
      </a>
    ));

  let body;
  switch (screen) {
    case 'tasks': body = <Tasks bucket={bucket} setBucket={(b) => go(`tasks/${b}`)} open={setSheet} />; break;
    case 'settings': body = <Settings />; break;
    case 'calendar': body = <Calendar go={go} />; break;
    case 'trips': case 'training': case 'pins': body = <Soon which={screen} />; break;
    default: body = <Today open={setSheet} go={go} />;
  }
  const composer = screen === 'tasks' && bucket !== 'top'
    ? <Composer bucket={bucket} bucketLabel={bucketLabel} />
    : screen === 'today' || screen === 'tasks' || !body ? <Composer /> : null;

  return (
    <ToastProvider>
      <div className="shell">
        <nav className="rail" aria-label="Main">
          <p className="brand">Daily Dash</p>
          {nav()}
          <div className="spacer" />
          <a className="navlink" href="#/settings" aria-current={screen === 'settings' ? 'page' : undefined}><IconSettings /><span>Settings</span></a>
        </nav>
        <div className="main">
          <div className="scroll">
            <a className="iconbtn settings-fab" href="#/settings" aria-label="Settings"><IconSettings /></a>
            {body}
          </div>
          {composer}
          <nav className="bottom" aria-label="Main">{nav()}</nav>
        </div>
      </div>
      {sheet && <TaskSheet key={sheet} id={sheet} onClose={() => setSheet(null)} />}
    </ToastProvider>
  );
}
