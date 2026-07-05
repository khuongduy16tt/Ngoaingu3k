# Ngoaingu3k

Base code for an e-learning platform built with Node.js and React.

## Structure

- `client`: React app powered by Vite and Supabase
- `server`: Express API skeleton for local/mock development
- `supabase/schema.sql`: initial database and RLS starter
- `client/vercel.json`: Vercel SPA routing config

## Features in this base

- Public home, course catalog, and course detail pages
- Learning studio layout inspired by course platforms
- Student, teacher, and admin dashboards
- Auth shell for email login and Google OAuth readiness
- Backend API skeleton for auth, courses, progress, and payments

## Run locally

1. Install dependencies from the repo root.
2. Start both apps together.

```bash
npm install
npm run dev
```

If you prefer separate terminals:

```bash
npm run dev:server
npm run dev:client
```

## Notes

- Google OAuth, payments, and realtime progress are scaffolded, not wired to production providers yet.
- The current UI uses mock data so you can review the structure before connecting a database.
- On Vercel, deploy the `client` folder as the app root.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project settings and local `.env`.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password and Google auth in Supabase Auth.
4. Add the site URL and redirect URLs for local dev and Vercel.
5. Set the two `VITE_SUPABASE_*` env vars in local `.env` and Vercel.
