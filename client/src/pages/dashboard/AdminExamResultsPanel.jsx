import React, { useEffect, useMemo, useState } from 'react';
import { getAllExamAttempts, getAllExams, getSectionTypeLabel } from '../../lib/examService';
import { PaginationControls, usePagination } from '../../components/Pagination';

export function AdminExamResultsPanel() {
  const [exams, setExams] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [examFilter, setExamFilter] = useState('all');

  async function reload() {
    setLoading(true);
    const [nextExams, nextAttempts] = await Promise.all([getAllExams(), getAllExamAttempts()]);
    setExams(nextExams);
    setAttempts(nextAttempts);
    setLoading(false);
  }

  useEffect(() => {
    void reload();
  }, []);

  const examById = useMemo(() => {
    const map = new Map();
    exams.forEach((exam) => map.set(exam.id, exam));
    return map;
  }, [exams]);

  const examSummaries = useMemo(
    () =>
      exams.map((exam) => {
        const examAttempts = attempts.filter((attempt) => attempt.examId === exam.id);
        const averagePercent = examAttempts.length
          ? Math.round(
              (examAttempts.reduce(
                (total, attempt) => total + (attempt.maxScore ? attempt.score / attempt.maxScore : 0),
                0
              ) /
                examAttempts.length) *
                100
            )
          : 0;

        return {
          ...exam,
          attemptsCount: examAttempts.length,
          averagePercent
        };
      }),
    [exams, attempts]
  );

  const filteredAttempts = useMemo(
    () =>
      (examFilter === 'all' ? attempts : attempts.filter((attempt) => attempt.examId === examFilter)).map(
        (attempt) => ({
          ...attempt,
          examTitle: examById.get(attempt.examId)?.title || attempt.examId
        })
      ),
    [attempts, examFilter, examById]
  );
  const attemptsPagination = usePagination(filteredAttempts, {
    pageSize: 10,
    resetKey: `${examFilter}|${filteredAttempts.length}`
  });

  return (
    <section className="content-card content-card--enterprise admin-panel">
      <div className="section-head">
        <div>
          <span className="eyebrow">Phòng thi mô phỏng</span>
          <h2>Đề thi &amp; kết quả toàn hệ thống</h2>
        </div>
        <button type="button" className="button-ghost" onClick={() => void reload()}>
          Làm mới
        </button>
      </div>

      {loading ? (
        <p className="empty-state">Đang tải dữ liệu đề thi...</p>
      ) : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Đề thi</th>
                  <th>Cấu trúc</th>
                  <th>Trạng thái</th>
                  <th>Lượt nộp</th>
                  <th>Điểm TB</th>
                </tr>
              </thead>
              <tbody>
                {examSummaries.length ? (
                  examSummaries.map((exam) => (
                    <tr key={exam.id}>
                      <td>{exam.title}</td>
                      <td>{exam.sections.map((section) => getSectionTypeLabel(section.type)).join(' + ')}</td>
                      <td>{exam.status === 'published' ? 'Đang mở' : exam.status === 'archived' ? 'Lưu trữ' : 'Bản nháp'}</td>
                      <td>{exam.attemptsCount}</td>
                      <td>{exam.attemptsCount ? `${exam.averagePercent}%` : '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5}>Chưa có đề thi nào trong hệ thống.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="section-head exam-manager__results-head">
            <div>
              <span className="eyebrow">Chi tiết</span>
              <h3>Lượt nộp bài</h3>
            </div>
            <label className="marketplace-sort">
              <span>Lọc theo đề</span>
              <select value={examFilter} onChange={(event) => setExamFilter(event.target.value)}>
                <option value="all">Tất cả đề thi</option>
                {exams.map((exam) => (
                  <option key={exam.id} value={exam.id}>
                    {exam.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Học viên</th>
                  <th>Đề thi</th>
                  <th>Điểm</th>
                  <th>Từng phần</th>
                  <th>Trạng thái</th>
                  <th>Nộp lúc</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttempts.length ? (
                  attemptsPagination.pageItems.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{attempt.studentEmail || attempt.studentId}</td>
                      <td>{attempt.examTitle}</td>
                      <td>
                        <strong>
                          {attempt.score}/{attempt.maxScore}
                        </strong>
                      </td>
                      <td>
                        {attempt.sectionScores
                          .map((section) => `${section.title || section.type}: ${section.score}/${section.maxScore}`)
                          .join(' · ')}
                      </td>
                      <td>{attempt.status === 'auto_submitted' ? 'Hết giờ (tự nộp)' : 'Nộp đúng giờ'}</td>
                      <td>{attempt.submittedAt ? new Date(attempt.submittedAt).toLocaleString('vi-VN') : ''}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>Chưa có lượt nộp bài nào.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <PaginationControls {...attemptsPagination} label="lượt nộp" />
        </>
      )}
    </section>
  );
}
