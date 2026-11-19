import { describe, expect, it } from 'vitest';
import { convert, fromAPI, fromCSV, parseCSV, planProjects } from './todoist';

const CSV = `TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE
section,Guests,,,,,,,,
task,"Restock coffee, filters @tahoe",Check pantry,1,1,Mark,,2026-11-20,en,America/Los_Angeles
note,Use the Costco run,,,,,,,,
task,Renew business license,,4,1,Mark,,every year,en,
task,Update listing photos,,2,1,Mark,,,en,
`;

describe('Todoist CSV', () => {
  it('parses quoted cells with commas', () => {
    expect(parseCSV('a,"b, c",d\n')[0]).toEqual(['a', 'b, c', 'd']);
  });

  it('reads tasks, sections, notes, labels and dates', () => {
    const todos = fromCSV(CSV, 'Tahoe Rental');
    expect(todos).toHaveLength(3);
    expect(todos[0]).toMatchObject({
      title: 'Restock coffee, filters', section: 'Guests', priority: 1, due: '2026-11-20', labels: ['tahoe'],
    });
    expect(todos[0].notes).toContain('Use the Costco run');
    expect(todos[1].recurring).toBe('every year');
    expect(todos[1].due).toBeUndefined();
  });

  it('rejects files that are not Todoist exports', () => {
    expect(() => fromCSV('foo,bar\n1,2', 'X')).toThrow();
  });
});

describe('convert', () => {
  const now = new Date(2026, 10, 18); // Wed 18 Nov 2026
  it('guesses the area and files dated tasks by week', () => {
    const todos = [
      ...fromCSV(CSV, 'Tahoe Rental'),
      { title: 'Dentist', project: 'Inbox', priority: 4, due: '2026-11-25' },
      { title: 'Read book', project: 'Personal', priority: 4 },
    ];
    const plans = planProjects(todos);
    expect(plans.find((p) => p.name === 'Tahoe Rental')?.lens).toBe('business');
    expect(plans.find((p) => p.name === 'Personal')?.lens).toBe('life');
    const out = convert(todos, plans, now);
    const by = (title: string) => out.find((t) => t.title === title)!;
    expect(by('Restock coffee, filters').bucket).toBe('week');
    expect(by('Dentist').bucket).toBe('next');
    expect(by('Read book').bucket).toBe('backlog');
    expect(by('Renew business license').notes).toContain('Repeats in Todoist');
    expect(out[0].title).toBe('Restock coffee, filters'); // p1 first
  });

  it('skips projects Mark leaves out', () => {
    const todos = [{ title: 'x', project: 'Old', priority: 4 }];
    const plans = planProjects(todos).map((p) => ({ ...p, include: false }));
    expect(convert(todos, plans, now)).toHaveLength(0);
  });
});

describe('Todoist API', () => {
  it('follows cursors and maps priority', async () => {
    const pages: Record<string, unknown> = {
      projects: { results: [{ id: 'p1', name: 'Work stuff' }], next_cursor: null },
      sections: { results: [], next_cursor: null },
      tasks: { results: [{ content: 'A', project_id: 'p1', priority: 4, due: { date: '2026-11-19' } }], next_cursor: 'c2' },
      'tasks?c2': { results: [{ content: 'B', project_id: 'p1', priority: 1 }], next_cursor: null },
    };
    const fake = (async (url: URL) => {
      const path = url.pathname.split('/').pop()!;
      const key = url.searchParams.get('cursor') ? `${path}?${url.searchParams.get('cursor')}` : path;
      return new Response(JSON.stringify(pages[key]), { status: 200 });
    }) as unknown as typeof fetch;
    const todos = await fromAPI('tok', fake);
    expect(todos.map((t) => [t.title, t.priority, t.project])).toEqual([
      ['A', 1, 'Work stuff'],
      ['B', 4, 'Work stuff'],
    ]);
  });
});
