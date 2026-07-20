-- Fix: "infinite recursion detected in policy for relation
-- exam_recipients" (Postgres 42P17).
--
-- Nguyên nhân: giống hệt bug đã fix ở lesson_assignments (xem
-- fix-lesson-assignments-recursion-migration.sql) — policy SELECT của exams
-- đọc exam_recipients (kích hoạt RLS của exam_recipients); trong khi đó
-- policy "teachers manage own exam recipients" (FOR ALL, áp dụng cả SELECT)
-- lại đọc ngược lại exams qua 1 subquery thường (kích hoạt lại RLS của exams)
-- → vòng lặp vô hạn.
--
-- Fix: thêm 1 hàm security definer (bỏ qua RLS khi kiểm tra quyền sở hữu đề
-- thi), dùng thay cho subquery trực tiếp vào exams ở policy của
-- exam_recipients — phá vòng lặp mà vẫn giữ đúng logic phân quyền cũ.
--
-- An toàn để chạy nhiều lần (idempotent). Run trong Supabase SQL editor.

create or replace function public.owns_exam(p_exam_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.exams exam
    where exam.id = p_exam_id
      and exam.teacher_id = auth.uid()
  );
$$;

drop policy if exists "teachers manage own exam recipients" on public.exam_recipients;
create policy "teachers manage own exam recipients"
on public.exam_recipients
for all
using (public.owns_exam(exam_id))
with check (public.owns_exam(exam_id));
