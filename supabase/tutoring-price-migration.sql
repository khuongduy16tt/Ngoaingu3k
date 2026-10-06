-- Giá bán dạy kèm: mỗi khóa / combo có thể bán thêm gói "khóa học + dạy kèm".
-- Run in the Supabase SQL editor after course-combo-migration.sql.
--
-- Quyền học không đổi (vẫn là orders paid theo course_id). with_tutoring chỉ
-- đánh dấu đơn nào đã trả tiền dạy kèm để trung tâm xếp lịch dạy.

alter table public.courses
  add column if not exists tutoring_price numeric(12,2);

alter table public.course_combos
  add column if not exists tutoring_price numeric(12,2);

alter table public.orders
  add column if not exists with_tutoring boolean not null default false;

comment on column public.courses.tutoring_price is
  'Giá gói khóa học + dạy kèm. NULL = khóa này không bán kèm dạy kèm.';
comment on column public.course_combos.tutoring_price is
  'Giá combo + dạy kèm. NULL = combo không bán kèm dạy kèm.';
comment on column public.orders.with_tutoring is
  'Đơn đã trả tiền gói dạy kèm (học viên được xếp lịch dạy kèm cho khóa này).';
