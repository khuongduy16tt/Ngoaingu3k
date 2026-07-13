-- Normalize lesson content so each lesson can store video metadata and
-- unlimited under-video practice questions as JSON.

create or replace function public.try_parse_lesson_content_jsonb(value text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return '{}'::jsonb;
  end if;

  return value::jsonb;
exception
  when others then
    return jsonb_build_object('content', value);
end;
$$;

do $$
declare
  content_data_type text;
begin
  select data_type
  into content_data_type
  from information_schema.columns
  where table_schema = 'public'
    and table_name = 'lessons'
    and column_name = 'content';

  if content_data_type is null then
    alter table public.lessons
      add column content jsonb not null default '{}'::jsonb;
  elsif content_data_type <> 'jsonb' then
    alter table public.lessons
      add column if not exists content_jsonb jsonb not null default '{}'::jsonb;

    update public.lessons
    set content_jsonb = public.try_parse_lesson_content_jsonb(content::text);

    alter table public.lessons drop column content;
    alter table public.lessons rename column content_jsonb to content;
  else
    update public.lessons
    set content = '{}'::jsonb
    where content is null;
  end if;
end;
$$;

alter table public.lessons
  alter column content set default '{}'::jsonb,
  alter column content set not null;

create index if not exists chapters_course_position_idx
on public.chapters (course_id, position);

create index if not exists lessons_chapter_position_idx
on public.lessons (chapter_id, position);

drop function if exists public.try_parse_lesson_content_jsonb(text);
