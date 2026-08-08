-- ============================================================
-- Ngoaingu3k — Migration: Mỗi tài khoản học viên chỉ 1 thiết bị
-- Chạy file này trong: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- -----------------------------------------------
-- 1. Bảng giữ chỗ thiết bị
--    Đúng MỘT dòng cho mỗi user = thiết bị đang được quyền dùng tài khoản.
--    Máy nào ghi device_id của mình vào dòng này thì máy đó thắng; các máy
--    khác đọc thấy device_id lạ sẽ tự đăng xuất.
-- -----------------------------------------------
create table if not exists public.active_device_sessions (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  -- uuid do trình duyệt tự sinh và giữ trong localStorage.
  device_id    text not null,
  -- Nhãn dễ đọc ("Chrome trên Windows") để tra khi học viên khiếu nại.
  device_label text,
  claimed_at   timestamptz not null default now()
);

-- -----------------------------------------------
-- 2. RLS — mỗi user chỉ đụng được dòng của chính mình
-- -----------------------------------------------
alter table public.active_device_sessions enable row level security;

drop policy if exists "Users see own device slot" on public.active_device_sessions;
create policy "Users see own device slot"
  on public.active_device_sessions for select
  using (auth.uid() = user_id);

drop policy if exists "Users claim own device slot" on public.active_device_sessions;
create policy "Users claim own device slot"
  on public.active_device_sessions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users update own device slot" on public.active_device_sessions;
create policy "Users update own device slot"
  on public.active_device_sessions for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users release own device slot" on public.active_device_sessions;
create policy "Users release own device slot"
  on public.active_device_sessions for delete
  using (auth.uid() = user_id);

-- Admin xem được tất cả để tra cứu khi có khiếu nại.
drop policy if exists "Admin sees all device slots" on public.active_device_sessions;
create policy "Admin sees all device slots"
  on public.active_device_sessions for select
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid()
        and profiles.role = 'admin'
    )
  );

-- -----------------------------------------------
-- HOÀN TẤT — Kiểm tra kết quả:
-- -----------------------------------------------
-- select * from public.active_device_sessions;
-- select policyname from pg_policies where tablename = 'active_device_sessions';sssssssssssssssssssss
