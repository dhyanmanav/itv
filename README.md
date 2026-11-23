# Aptitude Round – Technical Event (2 Dec)

## Run
    npm install
    npm start        # http://localhost:3000

1. Supabase: run `supabase.sql` in SQL Editor.
2. Put the Project URL and **service_role** key in `.env` (Project Settings -> API). Never use or expose a publishable/anon key here.
`.env` is pre-filled (gate password `round1`, admin passcode `dhyan`).
Admin login: configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `.env`; passcode is `dhyan`.

## Deploy (Render / Railway)
Build `npm install`, start `npm start`, add all .env values as environment variables + `NODE_ENV=production`
and a long random `JWT_SECRET`. Any Node host works (data lives in Supabase).

## Rules enforced
- Gate password -> signup/login -> exam. Answer keys never leave the server.
- Set 1 / Set 2 assigned randomly (kept balanced); question order shuffled per student.
- One attempt per account AND per browser (DB unique indexes + device cookie + localStorage).
- Auto-submit on tab switch, window blur, fullscreen exit, page leave, reload, or time up (server enforces deadline).
- Participants never see a score. Admin dashboard: live scores, search, sort, CSV, open/close test, reset attempt.
- Set 1 Q4 key corrected to B (19%); Set 2 Q12 "Aunt" is really great-aunt — nearest option kept.
