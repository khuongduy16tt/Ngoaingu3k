-- ============================================================
-- Ngoaingu3k — Migration: New Features
-- Chạy file này trong: Supabase Dashboard → SQL Editor → New query → Run
-- ============================================================

-- -----------------------------------------------
-- 1. Thêm cột phone vào profiles (nếu chưa có)
-- -----------------------------------------------
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- -----------------------------------------------
-- 2. Thêm image_url vào lesson_assignments
--    Cho phép đính kèm ảnh vào câu hỏi bài tập
-- -----------------------------------------------
ALTER TABLE lesson_assignments ADD COLUMN IF NOT EXISTS image_url TEXT;

-- -----------------------------------------------
-- 3. Thêm video columns vào lessons
-- -----------------------------------------------
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_storage_path TEXT;
ALTER TABLE lessons ADD COLUMN IF NOT EXISTS video_duration_seconds INT;
-- video_url đã có, chỉ thêm path và duration

-- -----------------------------------------------
-- 4. Bảng lịch sử hoạt động user
-- -----------------------------------------------
CREATE TABLE IF NOT EXISTS user_activity_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action        TEXT        NOT NULL,
  -- Các action hợp lệ: 'login', 'logout', 'view_lesson', 'complete_lesson',
  --   'complete_exercise', 'purchase', 'signup', 'view_course'
  target_id     TEXT,
  target_title  TEXT,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index để query nhanh theo user và thời gian
CREATE INDEX IF NOT EXISTS idx_activity_user_id   ON user_activity_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_activity_action     ON user_activity_logs (action);
CREATE INDEX IF NOT EXISTS idx_activity_created    ON user_activity_logs (created_at DESC);

-- -----------------------------------------------
-- 5. RLS cho user_activity_logs
-- -----------------------------------------------
ALTER TABLE user_activity_logs ENABLE ROW LEVEL SECURITY;

-- User chỉ đọc được log của chính mình
DROP POLICY IF EXISTS "Users see own logs" ON user_activity_logs;
CREATE POLICY "Users see own logs"
  ON user_activity_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Admin đọc được tất cả log
DROP POLICY IF EXISTS "Admin sees all logs" ON user_activity_logs;
CREATE POLICY "Admin sees all logs"
  ON user_activity_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

-- User chỉ insert log của chính mình
DROP POLICY IF EXISTS "Insert own log" ON user_activity_logs;
CREATE POLICY "Insert own log"
  ON user_activity_logs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- -----------------------------------------------
-- 6. Supabase Storage buckets
--    Tạo thủ công trong Dashboard → Storage → New Bucket
--    Hoặc chạy lệnh này nếu dùng Supabase CLI
-- -----------------------------------------------
-- INSERT INTO storage.buckets (id, name, public) VALUES ('lesson-videos', 'lesson-videos', true) ON CONFLICT DO NOTHING;
-- INSERT INTO storage.buckets (id, name, public) VALUES ('assignment-images', 'assignment-images', true) ON CONFLICT DO NOTHING;

-- -----------------------------------------------
-- 7. Hàm helper: log_activity() cho server-side triggers
-- -----------------------------------------------
CREATE OR REPLACE FUNCTION log_user_activity(
  p_user_id     UUID,
  p_action      TEXT,
  p_target_id   TEXT DEFAULT NULL,
  p_target_title TEXT DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO user_activity_logs (user_id, action, target_id, target_title, metadata)
  VALUES (p_user_id, p_action, p_target_id, p_target_title, p_metadata);
END;
$$;

-- -----------------------------------------------
-- HOÀN TẤT — Kiểm tra kết quả:
-- -----------------------------------------------
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'profiles';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'lesson_assignments';
-- SELECT column_name FROM information_schema.columns WHERE table_name = 'lessons';
-- SELECT table_name FROM information_schema.tables WHERE table_name = 'user_activity_logs';
