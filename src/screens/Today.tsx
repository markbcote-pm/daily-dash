import { useAppState } from '../store';
import { useActions } from '../actions';
import { TaskDnd } from '../components/Dnd';
import { TaskList } from '../components/TaskList';
import { LensSeg } from '../components/Controls';
import { inBucket, matchesLens } from '../logic/tasks';
import { toISO } from '../logic/dates';
import type { Lens } from '../types';
import { LENS_LABEL, TOP_LIMIT } from '../types';

function greeting(d = new Date()) {
  const h = d.getHours();
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function Today({ open, go }: { open: (id: string) => void; go: (route: string) => void }) {
  const { tasks, settings } = useAppState();
  const { toggle } = useActions();
  const lens = settings.lens;
  const areas: Lens[] = lens === 'both' ? ['business', 'life'] : [lens];
  const soonCut = new Date();
  soonCut.setDate(soonCut.getDate() + 2);
  const soon = tasks.filter(
    (t) => t.due && !t.done && t.bucket !== 'top' && matchesLens(t, lens) && t.due <= toISO(soonCut),
  ).sort((a, b) => a.due!.localeCompare(b.due!));
  const week = inBucket(tasks, 'week', lens).filter((t) => !soon.includes(t));
  const inbox = inBucket(tasks, 'inbox', lens);
  const openTotal = tasks.filter((t) => !t.done && matchesLens(t, lens)).length;
  const now = new Date();

  return (
    <TaskDnd>
      <div className="page">
        <div className="head">
          <div className="head-text">
            <span className="eyebrow">{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</span>
            <h1>{greeting(now)}, Mark</h1>
          </div>
          <LensSeg />
        </div>

        {tasks.length === 0 && (
          <div className="card stack">
            <h2>Let's bring your list over</h2>
            <p className="muted" style={{ margin: 0 }}>Import from Todoist once and this becomes your single list. It takes about a minute.</p>
            <div><button className="btn primary" onClick={() => go('settings')}>Import from Todoist</button></div>
          </div>
        )}

        <div className="today-grid">
          <div className="col">
            <section className="card" aria-labelledby="top3">
              <div className="card-head">
                <h2 id="top3">Top 3</h2>
                <span className="small muted">{lens === 'both' ? 'Per area, up to 6' : LENS_LABEL[lens]}</span>
              </div>
              <div className="top3">
                {areas.map((a) => {
                  const list = inBucket(tasks, 'top', a);
                  const openCount = list.filter((t) => !t.done).length;
                  return (
                    <div key={a}>
                      {areas.length > 1 && (
                        <div className={`area-label c-${a}`}>
                          <span>{LENS_LABEL[a]}</span>
                          <span className="muted" style={{ fontWeight: 500, letterSpacing: 0 }}>{list.filter((t) => t.done).length} done</span>
                        </div>
                      )}
                      <TaskList id={`top-${a}`} bucket="top" tasks={list} numbered bare onToggle={toggle} onOpen={open}
                        empty={null}
                        footer={openCount < TOP_LIMIT && (
                          <button className="slot" onClick={() => go('tasks/week')}>
                            + Pick {list.length === 0 ? 'up to three' : 'another'} from This week, or drag one here
                          </button>
                        )}
                      />
                    </div>
                  );
                })}
              </div>
            </section>

            {soon.length > 0 && (
              <section aria-labelledby="soon">
                <div className="card-head"><h3 id="soon">Due soon</h3><span className="small muted">Overdue, today and tomorrow</span></div>
                <TaskList id="soon" bucket="week" tasks={soon} showLens={lens === 'both'} showBucket onToggle={toggle} onOpen={open} />
              </section>
            )}
          </div>

          <div className="col">
            <section aria-labelledby="week">
              <div className="card-head">
                <h3 id="week">This week</h3>
                <button className="btn ghost" style={{ minHeight: 36, padding: '0 12px' }} onClick={() => go('tasks/week')}>All {week.length}</button>
              </div>
              <TaskList id="week" bucket="week" tasks={week.slice(0, 7)} showLens={lens === 'both'} onToggle={toggle} onOpen={open}
                empty="Nothing planned. Pull something from Next week or the Backlog." />
            </section>
            <section aria-labelledby="inbox">
              <div className="card-head">
                <h3 id="inbox">Inbox</h3>
                <span className="small muted">{inbox.filter((t) => !t.done).length} to sort</span>
              </div>
              <TaskList id="inbox" bucket="inbox" tasks={inbox.slice(0, 5)} showLens={lens === 'both'} onToggle={toggle} onOpen={open}
                empty="Inbox zero. Add anything below." />
            </section>
          </div>

          <div className="col">
            <section className="card" aria-labelledby="next">
              <div className="card-head"><h3 id="next">Coming to this screen</h3></div>
              <div className="soon-grid">
                <a className="soon-tile" href="#/calendar" style={{ background: 'var(--work-bg)' }}><b style={{ color: 'var(--work)' }}>Calendar</b><span>Work, Life, Business, Training and Rental</span></a>
                <a className="soon-tile" href="#/trips" style={{ background: 'var(--business-bg)' }}><b style={{ color: 'var(--business)' }}>Next trip</b><span>From {settings.homeAirport}, with prep tasks</span></a>
                <a className="soon-tile" href="#/training" style={{ background: 'var(--training-bg)' }}><b style={{ color: 'var(--training)' }}>Training</b><span>Today's workout</span></a>
                <a className="soon-tile" href="#/pins" style={{ background: 'var(--life-bg)' }}><b style={{ color: 'var(--life)' }}>Pinned Research</b><span>This week's pins</span></a>
              </div>
            </section>
            <p className="small muted" style={{ margin: 0 }}>{openTotal} open tasks across all buckets.</p>
          </div>
        </div>
      </div>
    </TaskDnd>
  );
}

