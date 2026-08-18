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

- Google OAuth and realtime progress are scaffolded, not wired to production providers yet.
  Payments run on SePay — see "Thanh toán tự động qua SePay" below.
- The current UI can use local mock auth/data so you can review protected pages before connecting a database.
- On Vercel, deploy the repository root. The root config builds `client/dist`,
  serves the React app, and sends `/api/*` requests to the Express serverless
  handler in `api/[...path].js`.
- Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel project
  settings and local `client/.env`. Only set `VITE_API_URL` when the API is
  deployed on a different domain.

## Thanh toán tự động qua SePay

Học viên bấm mua → server tạo đơn với một nội dung chuyển khoản riêng (vd
`NN3K8F2K1P`) và trả về ảnh VietQR động. Học viên quét QR chuyển tiền, SePay bắn
webhook về `/api/payments/sepay/webhook`, server dò mã trong nội dung giao dịch
và mở khóa khóa học ngay — không ai phải bấm "tôi đã chuyển khoản", không chờ
admin duyệt. Màn thanh toán hỏi lại `/api/payments/:orderId/status` mỗi 5 giây
nên khóa học mở ra ngay trước mắt học viên.

Các bước bật:

1. Chạy `supabase/sepay-payment-migration.sql` trong Supabase SQL editor (thêm
   `orders.transfer_code`, `orders.paid_at`, `orders.sepay_ref` và bảng nhật ký
   `sepay_transactions`). Chưa chạy thì checkout báo lỗi kèm nhắc migration.
2. Ở [my.sepay.vn](https://my.sepay.vn), liên kết tài khoản ngân hàng nhận tiền.
3. Điền env cho server (Vercel project settings hoặc `server/.env`):
   `SEPAY_ACCOUNT_NUMBER`, `SEPAY_BANK_CODE` (mã theo
   <https://vietqr.app/banks.json>, vd `MBBank`), `SEPAY_ACCOUNT_NAME`,
   `SEPAY_WEBHOOK_API_KEY`. Tùy chọn: `SEPAY_CODE_PREFIX` (mặc định `NN3K`),
   `SEPAY_QR_TEMPLATE` (mặc định `compact`).
4. Trong SePay → **Công ty → Webhooks**, tạo webhook:
   - URL: `https://<domain>/api/payments/sepay/webhook`
   - Kiểu xác thực: **API Key**, giá trị đúng bằng `SEPAY_WEBHOOK_API_KEY`
     (SePay gửi header `Authorization: Apikey <key>`).
   - Sự kiện: tiền vào (`transferType = in`).

Ghi chú vận hành:

- Chuyển **thiếu tiền** hoặc **sai nội dung** thì đơn giữ nguyên `pending`; giao
  dịch vẫn được ghi vào `sepay_transactions` (`matched = false`, cột `note` nói
  rõ lý do) để kế toán đối soát. Mở khóa tay ở Dashboard admin → tab Thanh toán.
- Webhook chống xử lý trùng bằng `sepay_transactions.sepay_id`, nên SePay gửi
  lại cùng một giao dịch cũng không mở khóa hai lần.
- Chạy demo không có server: điền `VITE_SEPAY_ACCOUNT_NUMBER` và
  `VITE_SEPAY_BANK_CODE` trong `client/.env` để client tự dựng QR.

## Supabase setup

1. Create a Supabase project.
2. Run `supabase/schema.sql` in the SQL editor, then
   `supabase/sepay-payment-migration.sql`.
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

   // Optional: lets you open the Web app URL in a browser to sanity-check the
   // deployment without hitting "Script function not found: doGet" — the real
   // lead form only ever calls doPost, this is just for manual testing.
   function doGet() {
     return ContentService.createTextOutput(JSON.stringify({ ok: true, hint: 'This webhook only accepts POST.' }))
       .setMimeType(ContentService.MimeType.JSON);
   }
   ```

   Leads land in a **"HSK"** tab or an **"IELTS"** tab depending on the
   "Chương trình quan tâm" the visitor picked — each tab is created with its
   header row on the first submission for that program.

3. Save, then **Deploy → New deployment**. Select type **Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
4. Deploy and copy the generated **Web app URL** — it's the full link shown in
   the deployment dialog (`https://script.google.com/macros/s/<deployment
   id>/exec`), not just the `<deployment id>` part of it.
5. Set it as `GOOGLE_SHEETS_WEBHOOK_URL` in `server/.env` for local dev, and in
   your Vercel project's environment variables for production.
6. To test the deployment itself (separate from the app), send a POST request,
   since Apps Script Web Apps only run `doPost` for POST calls:
   ```sh
   curl -X POST "<your Web app URL>" \
     -H "Content-Type: application/json" \
     -d '{"fullName":"Test","phone":"0900000000","program":"IELTS"}'
   ```
   Opening the URL directly in a browser sends a GET request instead — that's
   expected to just return the `doGet` hint above, not an error, as long as
   you redeployed after adding `doGet`. If you still see "Script function not
   found: doGet", the deployment is serving an older version of the code —
   redeploy (**Deploy → Manage deployments → edit → New version**).
