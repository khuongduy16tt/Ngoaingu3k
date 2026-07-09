create extension if not exists "pgcrypto";

alter table public.profiles
add column if not exists email text;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles profile
    where profile.id = auth.uid()
      and profile.role = 'admin'
  );
$$;

create table if not exists public.lesson_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  course_key text not null,
  course_title text not null,
  lesson_title text not null,
  title text not null,
  description text,
  assignment_scope text not null default 'selected_students' check (assignment_scope in ('selected_students', 'course_buyers')),
  audio_name text,
  audio_url text,
  attachment_name text,
  attachment_url text,
  exercise_config jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.lesson_assignments
add column if not exists exercise_config jsonb not null default '{}'::jsonb;

create table if not exists public.lesson_assignment_recipients (
  assignment_id uuid not null references public.lesson_assignments(id) on delete cascade,
  student_email text not null,
  created_at timestamptz not null default now(),
  primary key (assignment_id, student_email)
);

create table if not exists public.lesson_assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.lesson_assignments(id) on delete cascade,
  student_id uuid not null references public.profiles(id) on delete cascade,
  student_email text not null,
  answers jsonb not null default '{}'::jsonb,
  score numeric(6,2) not null default 0,
  max_score numeric(6,2) not null default 0,
  submitted_at timestamptz not null default now(),
  unique (assignment_id, student_id)
);

create table if not exists public.role_permissions (
  role text primary key check (role in ('student', 'teacher', 'admin')),
  label text not null,
  permissions jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

insert into public.role_permissions (role, label, permissions)
values
  ('student', 'Học viên', '{"viewLearning": true, "manageOwnProgress": true, "manageUsers": false, "manageCourses": false, "manageLessons": false, "manageTeachers": false, "manageSystem": false}'::jsonb),
  ('teacher', 'Giảng viên', '{"viewLearning": true, "manageOwnProgress": false, "manageUsers": false, "manageCourses": true, "manageLessons": true, "manageTeachers": false, "manageSystem": false}'::jsonb),
  ('admin', 'Quản trị', '{"viewLearning": true, "manageOwnProgress": true, "manageUsers": true, "manageCourses": true, "manageLessons": true, "manageTeachers": true, "manageSystem": true}'::jsonb)
on conflict (role) do nothing;

alter table public.lesson_assignments enable row level security;
alter table public.lesson_assignment_recipients enable row level security;
alter table public.lesson_assignment_attempts enable row level security;
alter table public.role_permissions enable row level security;

drop policy if exists "admins manage all profiles" on public.profiles;
create policy "admins manage all profiles"
on public.profiles
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage all courses" on public.courses;
create policy "admins manage all courses"
on public.courses
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage all chapters" on public.chapters;
create policy "admins manage all chapters"
on public.chapters
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage all lessons" on public.lessons;
create policy "admins manage all lessons"
on public.lessons
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage all progress" on public.progress;
create policy "admins manage all progress"
on public.progress
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage all orders" on public.orders;
create policy "admins manage all orders"
on public.orders
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "admins manage all quiz attempts" on public.quiz_attempts;
create policy "admins manage all quiz attempts"
on public.quiz_attempts
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "teachers manage own lesson assignments" on public.lesson_assignments;
create policy "teachers manage own lesson assignments"
on public.lesson_assignments
for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

drop policy if exists "admins manage all lesson assignments" on public.lesson_assignments;
create policy "admins manage all lesson assignments"
on public.lesson_assignments
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "teachers and assigned students can read lesson assignments" on public.lesson_assignments;
create policy "teachers and assigned students can read lesson assignments"
on public.lesson_assignments
for select
using (
  auth.uid() = teacher_id
  or exists (
    select 1
    from public.lesson_assignment_recipients recipients
    where recipients.assignment_id = lesson_assignments.id
      and lower(recipients.student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  )
  or (
    assignment_scope = 'course_buyers'
    and exists (
      select 1
      from public.orders paid_orders
      join public.courses purchased_course on purchased_course.id = paid_orders.course_id
      where paid_orders.user_id = auth.uid()
        and paid_orders.status = 'paid'
        and (
          purchased_course.slug = lesson_assignments.course_key
          or purchased_course.id::text = lesson_assignments.course_key
        )
    )
  )
);

drop policy if exists "teachers manage lesson assignment recipients" on public.lesson_assignment_recipients;
create policy "teachers manage lesson assignment recipients"
on public.lesson_assignment_recipients
for all
using (
  exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.id = lesson_assignment_recipients.assignment_id
      and assignment.teacher_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.id = lesson_assignment_recipients.assignment_id
      and assignment.teacher_id = auth.uid()
  )
);

drop policy if exists "admins manage lesson assignment recipients" on public.lesson_assignment_recipients;
create policy "admins manage lesson assignment recipients"
on public.lesson_assignment_recipients
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "assigned students can read their recipients" on public.lesson_assignment_recipients;
create policy "assigned students can read their recipients"
on public.lesson_assignment_recipients
for select
using (
  lower(student_email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  or exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.id = lesson_assignment_recipients.assignment_id
      and assignment.teacher_id = auth.uid()
  )
);

drop policy if exists "students manage own lesson assignment attempts" on public.lesson_assignment_attempts;
create policy "students manage own lesson assignment attempts"
on public.lesson_assignment_attempts
for all
using (auth.uid() = student_id)
with check (auth.uid() = student_id);

drop policy if exists "teachers read attempts for own lesson assignments" on public.lesson_assignment_attempts;
create policy "teachers read attempts for own lesson assignments"
on public.lesson_assignment_attempts
for select
using (
  exists (
    select 1
    from public.lesson_assignments assignment
    where assignment.id = lesson_assignment_attempts.assignment_id
      and assignment.teacher_id = auth.uid()
  )
);

drop policy if exists "admins manage all lesson assignment attempts" on public.lesson_assignment_attempts;
create policy "admins manage all lesson assignment attempts"
on public.lesson_assignment_attempts
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "authenticated users read role permissions" on public.role_permissions;
create policy "authenticated users read role permissions"
on public.role_permissions
for select
using (auth.role() = 'authenticated');

drop policy if exists "admins manage role permissions" on public.role_permissions;
create policy "admins manage role permissions"
on public.role_permissions
for all
using (public.is_admin())
with check (public.is_admin());
