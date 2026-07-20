-- Mock exam room (phòng thi mô phỏng): exams, recipients, attempts.
-- Run in the Supabase SQL editor after schema.sql.

create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  description text,
  course_key text,
  assignment_scope text not null default 'selected_students' check (assignment_scope in ('selected_students', 'course_buyers')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  sections jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_recipients (
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_email text not null,
  created_at timestamptz not null default now(),
  primary key (exam_id, student_email)
);

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_email text not null,
  answers jsonb not null default '{}'::jsonb,
  section_scores jsonb not null default '[]'::jsonb,
  score numeric(6,2) not null default 0,
  max_score numeric(6,2) not null default 0,
  status text not null default 'submitted' check (status in ('in_progress', 'submitted', 'auto_submitted')),
  started_at timestamptz,
  submitted_at timestamptz not null default now(),
  unique (exam_id, student_id)
);

alter table public.exams enable row level security;
alter table public.exam_recipients enable row level security;
alter table public.exam_attempts enable row level security;

-- Exams -----------------------------------------------------------------------

drop policy if exists "teachers manage own exams" on public.exams;
create policy "teachers manage own exams"
on public.exams
for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

drop policy if exists "admins manage all exams" on public.exams;
create policy "admins manage all exams"
on public.exams
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assigned students read published exams" on public.exams;
create policy "assigned students read published exams"
on public.exams
for select
using (
  status = 'published'
  and (
    exists (
      select 1
      from public.exam_recipients recipient
      where recipient.exam_id = exams.id
        and lower(recipient.student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or (
      assignment_scope = 'course_buyers'
      and exists (
        select 1
        from public.orders paid_order
        join public.courses purchased_course on purchased_course.id = paid_order.course_id
        where paid_order.user_id = auth.uid()
          and paid_order.status = 'paid'
          and (
            purchased_course.slug = exams.course_key
            or purchased_course.id::text = exams.course_key
          )
      )
    )
  )
);

-- Recipients -------------------------------------------------------------------

drop policy if exists "teachers manage own exam recipients" on public.exam_recipients;
create policy "teachers manage own exam recipients"
on public.exam_recipients
for all
using (
  exists (
    select 1
    from public.exams exam
    where exam.id = exam_recipients.exam_id
      and exam.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.exams exam
    where exam.id = exam_recipients.exam_id
      and exam.teacher_id = auth.uid()
  )
);

drop policy if exists "admins manage all exam recipients" on public.exam_recipients;
create policy "admins manage all exam recipients"
on public.exam_recipients
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assigned students read own exam recipient rows" on public.exam_recipients;
create policy "assigned students read own exam recipient rows"
on public.exam_recipients
for select
using (
  lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
);

-- Attempts ---------------------------------------------------------------------

-- Đọc/sửa attempt của chính mình; nhưng chỉ được ghi attempt cho đề đã published
-- và được giao cho mình (hoặc đề do chính mình làm chủ — teacher preview).
-- Điều kiện giao đề được lặp lại tường minh thay vì dựa vào RLS của bảng exams,
-- để nếu sau này policy đọc exams được nới lỏng thì attempts vẫn bị siết.
drop policy if exists "students manage own exam attempts" on public.exam_attempts;
create policy "students manage own exam attempts"
on public.exam_attempts
for all
using (auth.uid() = student_id)
with check (
  auth.uid() = student_id
  and exists (
    select 1
    from public.exams exam
    where exam.id = exam_attempts.exam_id
      and (
        exam.teacher_id = auth.uid()
        or (
          exam.status = 'published'
          and (
            exists (
              select 1
              from public.exam_recipients recipient
              where recipient.exam_id = exam.id
                and lower(recipient.student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
            )
            or (
              exam.assignment_scope = 'course_buyers'
              and exists (
                select 1
                from public.orders paid_order
                join public.courses purchased_course on purchased_course.id = paid_order.course_id
                where paid_order.user_id = auth.uid()
                  and paid_order.status = 'paid'
                  and (
                    purchased_course.slug = exam.course_key
                    or purchased_course.id::text = exam.course_key
                  )
              )
            )
          )
        )
      )
  )
);

drop policy if exists "teachers read attempts for own exams" on public.exam_attempts;
create policy "teachers read attempts for own exams"
on public.exam_attempts
for select
using (
  exists (
    select 1
    from public.exams exam
    where exam.id = exam_attempts.exam_id
      and exam.teacher_id = auth.uid()
  )
);

drop policy if exists "admins manage all exam attempts" on public.exam_attempts;
create policy "admins manage all exam attempts"
on public.exam_attempts
for all
using (public.is_admin())
with check (public.is_admin());

-- Storage ------------------------------------------------------------------------
-- Bucket chứa file nghe của đề thi (client upload trực tiếp bằng JWT của giáo viên).
-- Nếu các lệnh policy trên storage.objects báo lỗi "must be owner of table objects",
-- hãy tạo bucket public "exam-audio" và các policy tương đương trong
-- Dashboard → Storage → Policies.

insert into storage.buckets (id, name, public)
values ('exam-audio', 'exam-audio', true)
on conflict (id) do nothing;

drop policy if exists "teachers upload exam audio" on storage.objects;
create policy "teachers upload exam audio"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'exam-audio'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

-- uploadExamAudio dùng upsert nên cần cả quyền update.
drop policy if exists "teachers update exam audio" on storage.objects;
create policy "teachers update exam audio"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'exam-audio'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
)
with check (
  bucket_id = 'exam-audio'
  and exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role in ('teacher', 'admin')
  )
);

drop policy if exists "public read exam audio" on storage.objects;
create policy "public read exam audio"
on storage.objects
for select
using (bucket_id = 'exam-audio');
