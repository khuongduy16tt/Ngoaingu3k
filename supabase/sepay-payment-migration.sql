-- Thanh toán tự động qua SePay: đơn hàng mang một mã chuyển khoản riêng, SePay
-- bắn webhook khi tiền về, server dò mã trong nội dung giao dịch rồi mở khóa.
-- Run in the Supabase SQL editor after schema.sql.

alter table public.orders
  add column if not exists transfer_code text,
  add column if not exists paid_at timestamptz,
  add column if not exists sepay_ref text;

comment on column public.orders.transfer_code is
  'Nội dung chuyển khoản duy nhất của đơn (vd NN3K8F2K1P). Webhook SePay dò mã này để biết tiền của đơn nào.';
comment on column public.orders.paid_at is
  'Thời điểm SePay xác nhận tiền về (hoặc admin mở khóa tay).';
comment on column public.orders.sepay_ref is
  'Mã tham chiếu giao dịch phía ngân hàng (referenceCode) mà SePay gửi sang.';

-- Mã chuyển khoản phải là duy nhất, nếu không webhook sẽ mở nhầm đơn. Đơn cũ
-- chưa có mã (NULL) không bị ràng buộc.
create unique index if not exists orders_transfer_code_key
  on public.orders (transfer_code)
  where transfer_code is not null;

-- Nhật ký giao dịch SePay: vừa để chống xử lý trùng khi SePay gửi lại webhook,
-- vừa để đối soát các khoản tiền về không khớp đơn nào.
create table if not exists public.sepay_transactions (
  id uuid primary key default gen_random_uuid(),
  sepay_id bigint not null unique,
  order_id uuid references public.orders(id) on delete set null,
  transfer_code text,
  gateway text,
  account_number text,
  amount numeric(12,2) not null default 0,
  content text,
  reference_code text,
  transaction_date timestamptz,
  matched boolean not null default false,
  note text,
  raw jsonb,
  created_at timestamptz not null default now()
);

create index if not exists sepay_transactions_order_id_idx
  on public.sepay_transactions (order_id);
create index if not exists sepay_transactions_created_at_idx
  on public.sepay_transactions (created_at desc);

alter table public.sepay_transactions enable row level security;

-- Chỉ admin đọc được nhật ký; webhook chạy bằng service role nên không vướng RLS.
drop policy if exists "admins read sepay transactions" on public.sepay_transactions;
create policy "admins read sepay transactions"
on public.sepay_transactions
for select
using (
  exists (
    select 1 from public.profiles
    where profiles.id = auth.uid() and profiles.role = 'admin'
  )
);
