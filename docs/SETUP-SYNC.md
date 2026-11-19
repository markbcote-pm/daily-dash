# Turning on sync and calendars

This takes about 15 minutes, all in the browser. When it's done, your tasks follow you between phone and laptop, and your calendar links start working.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), sign in, and click **New project**.
2. Name it `daily-dash`, pick the **West US** region, and save the database password somewhere safe. The free plan is fine.

## 2. Create the table

1. In the project, open **SQL Editor** and click **New query**.
2. Paste the contents of [`supabase/migrations/0001_app_state.sql`](../supabase/migrations/0001_app_state.sql).
3. Click **Run**.

## 3. Sign-in emails with a code

The app signs you in with a 6-digit code from email. A code works inside the home-screen app; a link would open Safari instead.

1. Open **Authentication**, then **Emails** (Templates), then **Magic Link**.
2. Make sure the body includes `{{ .Token }}`, for example:

   ```html
   <h2>Your Daily Dash code</h2>
   <p>Enter this code in the app: <strong>{{ .Token }}</strong></p>
   ```

3. Open **Authentication**, then **URL Configuration**, and set **Site URL** to `https://daily-dash-jzd2.onrender.com`.

## 4. Add the calendar reader

Browsers can't read Airbnb or Google calendar links directly, so a small function reads them for you. It only reads links saved in your own Settings.

1. Open **Edge Functions** and choose **Deploy a new function**, then **Via Editor**.
2. Name it exactly `ical`.
3. Replace the sample code with the contents of [`supabase/functions/ical/index.ts`](../supabase/functions/ical/index.ts).
4. Click **Deploy**. Leave "Verify JWT" on.

## 5. Point the app at Supabase

1. In Supabase, open **Project Settings**, then **API Keys** (or **API**). Copy the **Project URL** and the **anon** / **publishable** key. Both are safe to use in a web app. Do not use the `service_role` or secret key.
2. In Render, open the daily-dash site, then **Environment**, and add:
   - `VITE_SUPABASE_URL` = the Project URL
   - `VITE_SUPABASE_ANON_KEY` = the anon / publishable key
3. Click **Manual Deploy**, then **Clear build cache & deploy**.

## 6. Sign in on each device

Open the app, go to **Settings**, then **Sync**, enter your email, and type in the code. Do this on your phone and your laptop. Whatever is on each device gets merged.

Then add your calendar links under **Settings**, then **Calendars**.
