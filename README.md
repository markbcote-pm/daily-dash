# Daily Dash

Mark's personal daily dashboard: one installable web app for tasks, calendars, trips, training and pinned research. It works on iPhone, an unfolded foldable, and desktop.

## What's in phase 1

- **Today:** Top 3 per area (Business and Life, so up to 6 in the combined view), due soon, This week and Inbox.
- **Tasks:** five buckets (Top 3, Inbox, This week, Next week, Backlog) with a Business / Life / Both filter.
  - Drag to reorder or move. On a phone, long-press a task and drop it on a bucket chip. On desktop, the buckets show as columns.
  - Top 3 holds three open tasks per area. A fourth bumps the last one to the front of This week.
- **Todoist import** (Settings), run once by Mark:
  - **API token:** on the Todoist website (not the app): Settings → Integrations → Developer, https://app.todoist.com/app/settings/integrations/developer. It is used in the browser only and never stored.
  - **CSV:** export each project as a template CSV and upload them together.
  - Each project gets an area and a bucket. Dated tasks go to This week or Next week by date.
- **Settings:** home airport (SFO or SJC), backup and restore as JSON, and clearing done tasks.
- **Installable PWA:** manifest, icons and an offline service worker.

Data lives in `localStorage` on each device for now. Sync across devices comes with the calendar phase (Supabase).

## Run it

```bash
npm install
npm run dev      # local dev server
npm test         # unit tests (task rules, Todoist import)
npm run build    # type-check and production build into dist/
```

## Deploy

This is a static site. Import the repo in Vercel or Cloudflare Pages with build command `npm run build` and output directory `dist`. Then open the URL on your phone and add it to the home screen.

## Roadmap

1. Prototype (done)
2. Tasks core (this)
3. Calendars: Work, Life, Business, Training, plus Rental from the cleaning app
4. Travel autopilot and the Trips log
5. Pinned Research
6. Project threads that become Google Docs
