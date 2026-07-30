-- Index cho các khóa ngoại đang bị quét toàn bảng.
--
-- Postgres KHÔNG tự tạo index cho cột khóa ngoại (chỉ tạo cho khóa chính và
-- ràng buộc unique). Vì vậy mọi truy vấn dạng "lấy các bài của chương này" hay
-- "lấy tiến độ của học viên này" đều phải quét tuần tự cả bảng.
--
-- Đo trước khi thêm (khóa HSK 1, 16 chương / 214 bài):
--   select chapters where course_id = ...   ~1.6 s
--   select lessons  where chapter_id in ... ~2.5 s
--
-- Chạy file này một lần trong Supabase SQL editor. Lệnh đều là
-- "create index if not exists" nên chạy lại nhiều lần cũng không sao.

-- Chương của một khóa — dùng ở mọi lần mở trang khóa học và phòng học.
create index if not exists chapters_course_id_position_idx
  on public.chapters (course_id, position);

-- Bài của một chương — truy vấn nặng nhất của toàn hệ thống.
create index if not exists lessons_chapter_id_position_idx
  on public.lessons (chapter_id, position);

-- Bảng progress đã có ràng buộc unique (user_id, lesson_id), nên tra theo
-- user_id được index đó phục vụ sẵn — không cần thêm. Chỉ thiếu chiều ngược
-- lại: tra theo lesson_id (xóa bài, thống kê một bài có bao nhiêu người học).
create index if not exists progress_lesson_id_idx
  on public.progress (lesson_id);

-- Tra khóa học theo slug (đường dẫn /courses/hsk-1-vo-long). Nếu cột slug đã có
-- ràng buộc unique thì index này là thừa và lệnh sẽ tự bỏ qua.
create index if not exists courses_slug_idx
  on public.courses (slug);

-- Lọc khóa công khai ngoài trang danh mục.
create index if not exists courses_status_updated_at_idx
  on public.courses (status, updated_at desc);

-- Danh sách khóa của một giảng viên trong bảng điều khiển.
create index if not exists courses_teacher_id_idx
  on public.courses (teacher_id);

-- Cập nhật thống kê để planner chọn đúng index ngay, không phải chờ autovacuum.
analyze public.chapters;
analyze public.lessons;
analyze public.progress;
analyze public.courses;
