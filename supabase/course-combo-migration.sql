-- Combo khóa học (vd HSK 1-2, HSK 1-2-3, IELTS 0-5.5): bán nhiều khóa lẻ trong
-- một lần thanh toán với giá ưu đãi.
-- Run in the Supabase SQL editor after schema.sql và sepay-payment-migration.sql.
--
-- Mua combo KHÔNG tạo ra loại quyền truy cập mới: server tạo một dòng orders
-- cho từng khóa trong combo (chung combo_group), nên mọi policy "đã mua khóa"
-- hiện có (orders.course_id + status = 'paid') vẫn dùng nguyên. Chỉ dòng đầu
-- nhóm mang transfer_code; webhook SePay thấy mã đó thì mở cả nhóm.

create table if not exists public.course_combos (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  description text,
  -- Giá bán cả combo. Giá gốc = tổng giá các khóa lẻ, tính lúc hiển thị để
  -- đổi giá khóa lẻ thì % tiết kiệm tự đúng theo.
  price numeric(12,2) not null default 0,
  status text not null default 'draft' check (status in ('draft', 'published', 'hidden')),
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.course_combo_items (
  combo_id uuid not null references public.course_combos(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  position int not null default 0,
  primary key (combo_id, course_id)
);

create index if not exists course_combo_items_course_id_idx
  on public.course_combo_items (course_id);

alter table public.orders
  add column if not exists combo_id uuid references public.course_combos(id) on delete set null,
  add column if not exists combo_group uuid;

comment on column public.orders.combo_id is
  'Combo mà đơn này thuộc về (NULL = mua lẻ).';
comment on column public.orders.combo_group is
  'Các đơn sinh ra từ cùng một lần mua combo có chung giá trị này; duyệt/thu hồi/webhook xử lý cả nhóm.';

create index if not exists orders_combo_group_idx
  on public.orders (combo_group)
  where combo_group is not null;

alter table public.course_combos enable row level security;
alter table public.course_combo_items enable row level security;

drop policy if exists "public read published combos" on public.course_combos;
create policy "public read published combos"
on public.course_combos
for select
using (status = 'published' or public.is_admin());

drop policy if exists "admins manage combos" on public.course_combos;
create policy "admins manage combos"
on public.course_combos
for all
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public read combo items" on public.course_combo_items;
create policy "public read combo items"
on public.course_combo_items
for select
using (
  exists (
    select 1 from public.course_combos combo
    where combo.id = course_combo_items.combo_id
      and (combo.status = 'published' or public.is_admin())
  )
);

drop policy if exists "admins manage combo items" on public.course_combo_items;
create policy "admins manage combo items"
on public.course_combo_items
for all
using (public.is_admin())
with check (public.is_admin());
