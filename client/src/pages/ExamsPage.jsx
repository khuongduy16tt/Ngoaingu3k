import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../providers/AuthProvider';
import { getEffectiveRole } from '../lib/permissions';
import { getCourseCatalog, getOwnedCourseIds } from '../lib/courseService';
import {
  getAllExams,
  getExamAttemptsForStudent,
  getExamDurationMinutes,
  getExamQuestionCount,
  getExamsForStudent,
  getExamsForTeacher,
  getSectionTypeLabel
} from '../lib/examService';
import { usePageTitle } from '../hooks/usePageTitle';

function ExamCard({ exam, attempt, role }) {
  const isDone = attempt && attempt.status !== 'in_progress';

  return (
    <article className="exam-card">
      <header className="exam-card__head">
        <div>
          <span className="eyebrow">{exam.sections.map((section) => getSectionTypeLabel(section.type)).join(' + ')}</span>
          <h3>{exam.title}</h3>
        </div>
        {isDone ? (
          <span className="exam-card__score">
            {attempt.score}/{attempt.maxScore}
          </span>
        ) : (
          <span className="exam-card__badge">{exam.status === 'published' ? 'Sẵn sàng' : 'Bản nháp'}</span>
        )}
      </header>

      {exam.description ? <p className="exam-card__description">{exam.description}</p> : null}

      <div className="exam-card__facts">
        <span>{exam.sections.length} phần</span>
        <span>{getExamQuestionCount(exam)} câu hỏi</span>
        <span>{getExamDurationMinutes(exam)} phút</span>
      </div>

      <div className="exam-card__actions">
        <Link className="button" to={`/exam/${exam.id}`}>
          {isDone ? 'Xem kết quả' : role === 'student' ? 'Vào phòng thi' : 'Xem trước đề thi'}
        </Link>
      </div>
    </article>
  );
}

export default function ExamsPage() {
  usePageTitle('Phòng thi');
  const auth = useAuth();
  const role = getEffectiveRole(auth);
  const [exams, setExams] = useState([]);
  const [attemptsByExam, setAttemptsByExam] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function load() {
      setLoading(true);

      const userId = auth.user?.id || '';
      const email = auth.user?.email || '';

      let nextExams = [];
      if (role === 'admin') {
        nextExams = await getAllExams();
      } else if (role === 'teacher') {
        nextExams = await getExamsForTeacher(userId);
      } else {
        // Cần catalog để map uuid ↔ slug: orders lưu uuid còn course_key của đề
        // thường là slug, thiếu map thì đề "mua khóa" bị ẩn trên thiết bị mới.
        const ownedCourseIds = await getOwnedCourseIds(userId, await getCourseCatalog());
        nextExams = await getExamsForStudent(email, ownedCourseIds);
      }

      const attempts = await getExamAttemptsForStudent(userId, email);

      if (!alive) return;

      const attemptMap = {};
      attempts.forEach((attempt) => {
        attemptMap[attempt.examId] = attempt;
      });

      setExams(nextExams);
      setAttemptsByExam(attemptMap);
      setLoading(false);
    }

    void load();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, auth.user?.email, role]);

  return (
    <div className="page exams-page">
      <section className="section-head">
        <div className="section-head__copy">
          <span className="eyebrow">Phòng thi mô phỏng</span>
          <h1>Đề thi của bạn</h1>
          <p>
            {role === 'student'
              ? 'Các đề thi thử được giảng viên giao cho bạn. Mỗi phần thi có đồng hồ riêng như phòng thi thật.'
              : 'Danh sách đề thi bạn quản lý. Tạo và giao đề trong bảng điều khiển giảng viên.'}
          </p>
        </div>
      </section>

      {loading ? (
        <p className="empty-state">Đang tải danh sách đề thi...</p>
      ) : exams.length ? (
        <div className="exam-card-grid">
          {exams.map((exam) => (
            <ExamCard key={exam.id} exam={exam} attempt={attemptsByExam[exam.id]} role={role} />
          ))}
        </div>
      ) : (
        <section className="content-card content-card--enterprise marketplace-empty">
          <span className="eyebrow">Chưa có đề thi</span>
          <h3>{role === 'student' ? 'Bạn chưa được giao đề thi nào.' : 'Bạn chưa tạo đề thi nào.'}</h3>
          <p>
            {role === 'student'
              ? 'Khi giảng viên giao đề thi thử, đề sẽ xuất hiện tại đây.'
              : 'Mở bảng điều khiển giảng viên để tạo đề thi đầu tiên.'}
          </p>
        </section>
      )}
    </div>
  );
}
