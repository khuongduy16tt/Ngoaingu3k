create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  role text not null default 'student' check (role in ('student', 'teacher', 'admin')),
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  price numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  teacher_id uuid references public.profiles(id) on delete set null,
  banner_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  position int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid not null references public.chapters(id) on delete cascade,
  title text not null,
  video_url text,
  content text,
  position int not null default 0,
  is_preview boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid not null references public.lessons(id) on delete cascade,
  completed boolean not null default false,
  last_position_seconds int not null default 0,
  updated_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  provider text not null default 'stripe',
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded')),
  amount numeric(12,2) not null,
  created_at timestamptz not null default now()
);

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  lesson_id uuid references public.lessons(id) on delete cascade,
  score numeric(5,2) not null default 0,
  max_score numeric(5,2) not null default 0,
  attempt_no int not null default 1,
  created_at timestamptz not null default now()
);

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
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lesson_assignment_recipients (
  assignment_id uuid not null references public.lesson_assignments(id) on delete cascade,
  student_email text not null,
  created_at timestamptz not null default now(),
  primary key (assignment_id, student_email)
);

alter table public.profiles enable row level security;
alter table public.courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.progress enable row level security;
alter table public.orders enable row level security;
alter table public.quiz_attempts enable row level security;
alter table public.lesson_assignments enable row level security;
alter table public.lesson_assignment_recipients enable row level security;

create policy "read published courses"
on public.courses
for select
using (status = 'published');

create policy "teachers manage own courses"
on public.courses
for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

create policy "users read own profile"
on public.profiles
for select
using (auth.uid() = id);

create policy "users manage own progress"
on public.progress
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "users manage own orders"
on public.orders
for all
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "teachers manage own lesson assignments"
on public.lesson_assignments
for all
using (auth.uid() = teacher_id)
with check (auth.uid() = teacher_id);

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
  or assignment_scope = 'course_buyers'
);

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

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into public.profiles (id, full_name, role, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'student'),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();
