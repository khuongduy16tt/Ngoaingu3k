-- Ảnh minh họa cho câu hỏi đề thi -------------------------------------------------
--
-- Nội dung câu hỏi (kể cả imageUrl/imageName) nằm trong cột jsonb `exams.sections`
-- nên KHÔNG cần đổi schema bảng. Migration này chỉ tạo bucket Storage để giáo viên
-- upload ảnh cho từng câu hỏi.
--
-- Nếu các lệnh policy trên storage.objects báo lỗi "must be owner of table objects",
-- hãy tạo bucket public "exam-images" và các policy tương đương trong
-- Dashboard → Storage → Policies.
--
-- Chưa chạy file này cũng không sao: uploadExamImage() sẽ tự rơi về bucket
-- "exam-audio" (prefix images/) vốn đã có sẵn policy tương đương.

insert into storage.buckets (id, name, public)
values ('exam-images', 'exam-images', true)
on conflict (id) do nothing;

drop policy if exists "teachers upload exam images" on storage.objects;
create policy "teachers upload exam images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exam-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

-- uploadExamImage dùng upsert nên cần cả quyền update.
drop policy if exists "teachers update exam images" on storage.objects;
create policy "teachers update exam images"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exam-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
)
with check (
  bucket_id = 'exam-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

drop policy if exists "teachers delete exam images" on storage.objects;
create policy "teachers delete exam images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'exam-images'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

-- Học viên đang làm bài phải xem được ảnh câu hỏi.
drop policy if exists "public read exam images" on storage.objects;
create policy "public read exam images"
on storage.objects
for select
using (bucket_id = 'exam-images');
