-- Fix: "infinite recursion detected in policy for relation
-- lesson_assignments" (Postgres 42P17).
--
-- Nguyên nhân: RLS policy SELECT của lesson_assignments đọc
-- lesson_assignment_recipients; đồng thời các policy của
-- lesson_assignment_recipients/lesson_assignment_attempts lại đọc ngược
-- lại lesson_assignments qua 1 subquery thường (kích hoạt lại RLS của
-- lesson_assignments) → vòng lặp vô hạn.
--
-- Fix: thêm 1 hàm security definer (bỏ qua RLS khi kiểm tra quyền sở hữu
-- assignment), dùng thay cho subquery trực tiếp ở 3 policy bên dưới —
-- phá vòng lặp mà vẫn giữ đúng logic phân quyền cũ.
--
-- An toàn để chạy nhiều lần (idempotent). Run trong Supabase SQL editor.

create or replace function public.owns_lesson_assignment(p_assignment_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.id = p_assignment_id
      and assignment.teacher_id = auth.uid()
  );
$$;

drop policy if exists "teachers manage lesson assignment recipients" on public.lesson_assignment_recipients;
create policy "teachers manage lesson assignment recipients"
on public.lesson_assignment_recipients
for all
using (public.owns_lesson_assignment(assignment_id))
with check (public.owns_lesson_assignment(assignment_id));

drop policy if exists "assigned students can read their recipients" on public.lesson_assignment_recipients;
create policy "assigned students can read their recipients"
on public.lesson_assignment_recipients
for select
using (
  lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or public.owns_lesson_assignment(assignment_id)
);

drop policy if exists "teachers read attempts for own lesson assignments" on public.lesson_assignment_attempts;
create policy "teachers read attempts for own lesson assignments"
on public.lesson_assignment_attempts
for select
using (public.owns_lesson_assignment(assignment_id));
