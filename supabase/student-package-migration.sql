-- Gói học theo khóa (số buổi + thời hạn) để tính "buổi đã học / còn lại" và
-- cảnh báo hết hạn cho telesale trên trang Tiến độ học sinh.
-- Run in the Supabase SQL editor after schema.sql.
--
-- Cả hai cột đều nullable: NULL nghĩa là "không giới hạn" (không đếm buổi /
-- không có hạn dùng) — mặc định của khóa học cũ trước khi có tính năng này.

alter table public.courses
  add column if not exists package_total_sessions integer,
  add column if not exists package_duration_months integer;

comment on column public.courses.package_total_sessions is
  'Tổng số buổi trong gói của khóa học này. NULL = không giới hạn.';
comment on column public.courses.package_duration_months is
  'Thời hạn sử dụng gói tính theo tháng kể từ ngày mua (đơn hàng paid gần nhất). NULL = không giới hạn thời gian.';
