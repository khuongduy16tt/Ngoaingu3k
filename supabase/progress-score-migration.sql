-- Điểm bài tập của từng bài học, dùng để tính sao/cúp trên danh sách bài học
-- (client/src/lib/lessonStars.js).
--
-- Client vẫn chạy được khi chưa có 2 cột này (điểm chỉ nằm ở localStorage nên
-- mất khi đổi máy/trình duyệt) — chạy migration để điểm được lưu theo tài khoản.
--
-- An toàn để chạy nhiều lần (idempotent). Run trong Supabase SQL editor.

alter table public.progress add column if not exists score numeric(6, 2);
alter table public.progress add column if not exists max_score numeric(6, 2);
