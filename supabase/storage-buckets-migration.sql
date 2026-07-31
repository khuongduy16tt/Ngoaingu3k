-- Storage buckets còn thiếu ------------------------------------------------------
--
-- App upload file trực tiếp từ trình duyệt bằng JWT của người dùng, nên mỗi bucket
-- cần: (1) bản thân bucket, (2) policy cho phép ghi, (3) policy cho phép đọc.
-- Thiếu bucket thì nút upload báo lỗi và file không được lưu.
--
-- Bucket app đang dùng (client/src/lib/storageService.js):
--   exam-audio        — file nghe của đề thi VÀ của bài học   (đã có sẵn)
--   exam-images       — ảnh minh họa câu hỏi đề thi           (đã có sẵn)
--   course-images     — ảnh banner khóa học                    (đã có sẵn)
--   lesson-videos     — "Tải video lên Storage" (mục 10.2)     ← file này tạo
--   avatars           — ảnh đại diện ở trang Hồ sơ             ← file này tạo
--   assignment-images — ảnh bài tập giao                        ← file này tạo
--
-- Chạy trong Supabase → SQL Editor. Chạy lại nhiều lần vẫn an toàn.
--
-- ⚠️ Nếu các lệnh policy trên storage.objects báo "must be owner of table objects",
-- tài khoản của bạn không đủ quyền chạy DDL trên schema storage. Khi đó bỏ qua
-- phần policy ở dưới và tạo bằng tay trong Dashboard → Storage → Policies
-- (xem docs/huong-dan-dang-bai.md, phần "Tạo bucket").

-- ─── 1. Bucket ────────────────────────────────────────────────────────────────
-- public = true để link phát trực tiếp trong thẻ <video>/<img> không cần ký URL.
-- file_size_limit tính bằng byte, khớp với validateVideoFile/validateImageFile.
--
-- ⚠️ TRẦN TOÀN DỰ ÁN: file_size_limit của bucket KHÔNG được vượt giới hạn upload
-- chung của dự án (Settings → Storage → Upload file size limit). Gói Free mặc
-- định 50 MB — đặt bucket 500 MB sẽ báo "Payload too large / 413" ngay lúc tạo.
-- Vì vậy lesson-videos để NULL = dùng đúng trần của dự án. Muốn upload video
-- lớn hơn thì nâng trần ở Settings → Storage trước (cần gói trả phí), rồi mới
-- đặt được file_size_limit cao hơn cho bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'lesson-videos',
  'lesson-videos',
  true,
  null, -- theo trần của dự án
  array['video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  31457280, -- 30 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'assignment-images',
  'assignment-images',
  true,
  31457280, -- 30 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ─── 2. lesson-videos: giảng viên và admin được ghi ───────────────────────────

drop policy if exists "teachers upload lesson videos" on storage.objects;
create policy "teachers upload lesson videos"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'lesson-videos'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

-- uploadLessonVideo dùng upsert nên cần cả quyền update.
drop policy if exists "teachers update lesson videos" on storage.objects;
create policy "teachers update lesson videos"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'lesson-videos'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
)
with check (
  bucket_id = 'lesson-videos'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

drop policy if exists "teachers delete lesson videos" on storage.objects;
create policy "teachers delete lesson videos"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'lesson-videos'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

drop policy if exists "public read lesson videos" on storage.objects;
create policy "public read lesson videos"
on storage.objects
for select
using (bucket_id = 'lesson-videos');

-- ─── 3. avatars: ai cũng đổi được ảnh CỦA CHÍNH MÌNH ──────────────────────────
-- uploadAvatarImage lưu vào đường dẫn "<user id>/avatar.<ext>", nên chỉ cần
-- kiểm tra thư mục đầu tiên có trùng uid người đang đăng nhập hay không.

drop policy if exists "users upload own avatar" on storage.objects;
create policy "users upload own avatar"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "users update own avatar" on storage.objects;
create policy "users update own avatar"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "public read avatars" on storage.objects;
create policy "public read avatars"
on storage.objects
for select
using (bucket_id = 'avatars');

-- ─── 4. assignment-images: giảng viên và admin được ghi ───────────────────────

drop policy if exists "teachers upload assignment images" on storage.objects;
create policy "teachers upload assignment images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'assignment-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

drop policy if exists "teachers update assignment images" on storage.objects;
create policy "teachers update assignment images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'assignment-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
)
with check (
  bucket_id = 'assignment-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

drop policy if exists "public read assignment images" on storage.objects;
create policy "public read assignment images"
on storage.objects
for select
using (bucket_id = 'assignment-images');

-- ─── 5. Kiểm tra sau khi chạy ─────────────────────────────────────────────────
-- Phải thấy đủ 6 dòng.

select id, public, file_size_limit
from storage.buckets
where id in (
  'exam-audio', 'exam-images', 'course-images',
  'lesson-videos', 'avatars', 'assignment-images'
)
order by id;
