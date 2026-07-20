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

If you are on Windows PowerShell and `npm run dev` is blocked by execution
policy, run `start-local.cmd` from the repo root instead. It calls `npm.cmd`
directly and starts the same local server.

## Notes

- Google OAuth, payments, and realtime progress are scaffolded, not wired to production providers yet.
- The current UI can use local mock auth/data so you can review protected pages before connecting a database.
- On Vercel, deploy the repository root. The root config builds `client/dist`,
  serves the React app, and sends `/api/*` requests to the Express serverless
  handler in `api/[...path].js`.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project
  settings and local `client/.env`. Only set `VITE_API_URL` when the API is
  deployed on a different domain.
- Manual bank-transfer checkout can show a real QR when `VITE_PAYMENT_QR_URL`
  points to the QR image. Admin payment email requires `RESEND_API_KEY`,
  `ADMIN_PAYMENT_EMAIL`, and optionally `PAYMENT_EMAIL_FROM` on the server.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor.
3. Enable Email/Password and Google auth in Supabase Auth.
4. Add the site URL and redirect URLs for local dev and Vercel.
5. Set the two `VITE_SUPABASE_*` env vars in local `.env` and Vercel.

## Consultation form (Google Sheets)

The homepage hero has a "Đăng ký tư vấn" form (`POST /api/leads/consultation`
in `server/src/routes/leads.js`) that forwards submissions to a Google Sheet
through a small Apps Script Web App — no Google Cloud service account or JSON
key needed. Without this set up, submissions are just logged to the server
console (mock mode), so the form still works locally with zero setup.

1. Create a new Google Sheet (the tabs below are created automatically, no
   manual header row needed).
2. In the Sheet, go to **Extensions → Apps Script**, delete the sample code, and paste:

   ```js
   var SHEET_HEADER = ['Thời gian', 'Họ tên', 'SĐT', 'Email', 'Chương trình', 'Nhu cầu', 'Nguồn'];

   function getOrCreateSheet(spreadsheet, name) {
     var sheet = spreadsheet.getSheetByName(name);
     if (!sheet) {
       sheet = spreadsheet.insertSheet(name);
       sheet.appendRow(SHEET_HEADER);
     }
     return sheet;
   }

   function doPost(e) {
     var spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
     var data = JSON.parse(e.postData.contents);
     // Route each lead into its own tab: "HSK" or "IELTS".
     var sheetName = data.program === 'HSK' ? 'HSK' : 'IELTS';
     var sheet = getOrCreateSheet(spreadsheet, sheetName);

     sheet.appendRow([
       new Date(),
       data.fullName || '',
       data.phone || '',
       data.email || '',
       data.program || '',
       data.needs || '',
       data.source || ''
     ]);
     return ContentService.createTextOutput(JSON.stringify({ ok: true }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

   Leads land in a **"HSK"** tab or an **"IELTS"** tab depending on the
   "Chương trình quan tâm" the visitor picked — each tab is created with its
   header row on the first submission for that program.

3. Save, then **Deploy → New deployment**. Select type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Deploy and copy the generated Web app URL.
5. Set it as `GOOGLE_SHEETS_WEBHOOK_URL` in `server/.env` for local dev, and in
   your Vercel project's environment variables for production.
