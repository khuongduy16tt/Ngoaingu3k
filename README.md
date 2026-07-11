# Ngoaingu3k

Base code for an e-learning platform built with Node.js and React.

## Structure

- `client`: React app powered by Vite and Supabase
- `server`: Express API skeleton for local/mock development
- `supabase/schema.sql`: initial database and RLS starter
- `vercel.json`: Vercel config for one deployment with React static files and `/api/*` serverless routes

## Features in this base

- Public home, course catalog, and course detail pages
- Learning studio layout inspired by course platforms
- Student, teacher, and admin dashboards
- Auth shell for email login, required full name + phone registration, and Google OAuth profile completion
- Backend API skeleton for auth, courses, progress, and payments

## Run locally

1. Install dependencies from the repo root.
2. Start the integrated dev server.

```bash
npm install
npm run dev
```

This starts the Express API and serves the Vite client from the same origin at
`http://localhost:4000`. If you prefer separate terminals:

```bash
npm run dev:server
npm run dev:client
```

When the client runs separately, set `VITE_API_URL=http://localhost:4000` in
`client/.env` so checkout and other API calls reach the server. When the app is
served from the Express dev server or deployed as a single Vercel project, leave
`VITE_API_URL` empty so API calls use the same domain.

## Notes

- Google OAuth, payments, and realtime progress are scaffolded, not wired to production providers yet.
- The current UI can use local mock auth/data so you can review protected pages before connecting a database.
- On Vercel, deploy the repository root. The root config builds `client/dist`,
  serves the React app, and sends `/api/*` requests to the Express serverless
  handler in `api/[...path].js`.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project
  settings and local `client/.env`. Only set `VITE_API_URL` when the API is
  deployed on a different domain.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password and Google auth in Supabase Auth.
4. Add the site URL and redirect URLs for local dev and Vercel.
5. Set the two `VITE_SUPABASE_*` env vars in local `.env` and Vercel.
