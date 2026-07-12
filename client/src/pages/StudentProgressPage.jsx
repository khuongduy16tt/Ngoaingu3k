import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { PaginationControls, usePagination } from '../components/Pagination';
import { readTeacherManagedCourses } from '../lib/courseService';
import {
  average,
  buildStudentProgressRows,
  getProgressLabel,
  getScoreLabel
} from '../lib/studentProgressService';
import { usePageTitle } from '../hooks/usePageTitle';
import { useAuth } from '../providers/AuthProvider';

export default function StudentProgressPage() {
  usePageTitle('Tiến độ học sinh');
  const auth = useAuth();
  const teacherId = auth.user?.id || 'local';
  const [searchParams] = useSearchParams();
  const [teacherCourses, setTeacherCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(searchParams.get('course') || 'all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSelectedCourseId(searchParams.get('course') || 'all');
  }, [searchParams]);

  useEffect(() => {
    let active = true;

    async function loadCourses() {
      setLoading(true);
      const storedCourses = readTeacherManagedCourses(teacherId);

      if (active) {
        setTeacherCourses(storedCourses);
        setLoading(false);
      }
    }

    void loadCourses();

    return () => {
      active = false;
    };
  }, [teacherId]);

  const courseExists = selectedCourseId === 'all' || teacherCourses.some((course) => course.id === selectedCourseId);
  const effectiveCourseId = courseExists ? selectedCourseId : 'all';
  const studentRows = useMemo(() => buildStudentProgressRows(teacherCourses), [teacherCourses]);
  const visibleStudentRows = useMemo(
    () =>
      effectiveCourseId === 'all'
        ? studentRows
        : studentRows.filter((student) => student.courseId === effectiveCourseId),
    [effectiveCourseId, studentRows]
  );
  const progressPagination = usePagination(visibleStudentRows, {
    pageSize: 8,
    resetKey: `${effectiveCourseId}|${visibleStudentRows.length}`
  });
  const metrics = useMemo(
    () => [
      { label: 'Khóa đang quản lý', value: String(teacherCourses.length) },
      { label: 'Học sinh trong bộ lọc', value: String(visibleStudentRows.length) },
      { label: 'Tiến độ trung bình', value: `${average(visibleStudentRows.map((student) => student.progress))}%` },
      { label: 'Hiệu quả trung bình', value: `${average(visibleStudentRows.map((student) => student.score))}%` }
    ],
    [teacherCourses.length, visibleStudentRows]
  );

  return (
    <div className="page">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Tiến độ học sinh</span>
          <h1>Theo dõi tiến độ học sinh</h1>
          <p>Kiểm tra học sinh đang học khóa nào, mức hoàn thành và hiệu quả học tập theo từng khóa.</p>
        </div>
      </section>

      <section className="stat-grid">
        {metrics.map((metric) => (
          <article key={metric.label} className="stat-card stat-card--enterprise">
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
          </article>
        ))}
      </section>

      <section className="content-card content-card--enterprise teacher-student-monitor">
        <div className="section-head">
          <div>
            <span className="eyebrow">Theo dõi học sinh</span>
            <h2>Ai đang học khóa nào, tiến độ và hiệu quả ra sao</h2>
          </div>
          <label className="teacher-course-filter">
            <span>Khóa học</span>
            <select value={effectiveCourseId} onChange={(event) => setSelectedCourseId(event.target.value)}>
              <option value="all">Tất cả khóa</option>
              {teacherCourses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.title}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="teacher-monitor-summary">
          <article>
            <span>Học sinh trong bộ lọc</span>
            <strong>{visibleStudentRows.length}</strong>
          </article>
          <article>
            <span>Tiến độ trung bình</span>
            <strong>{average(visibleStudentRows.map((student) => student.progress))}%</strong>
          </article>
          <article>
            <span>Hiệu quả trung bình</span>
            <strong>{average(visibleStudentRows.map((student) => student.score))}%</strong>
          </article>
        </div>

        {loading ? <p>Đang tải tiến độ học sinh...</p> : null}
        {!loading && teacherCourses.length === 0 ? (
          <p className="empty-state">Chưa có khóa học nào để theo dõi. Hãy tạo hoặc nhập khóa học trước.</p>
        ) : null}
        {!loading && teacherCourses.length > 0 && visibleStudentRows.length === 0 ? (
          <p className="empty-state">Chưa có học sinh nào trong bộ lọc hiện tại.</p>
        ) : null}

        {!loading && visibleStudentRows.length > 0 ? (
          <>
            <div className="teacher-student-table-wrap">
              <table className="teacher-student-table">
                <thead>
                  <tr>
                    <th>Học sinh</th>
                    <th>Đang học khóa</th>
                    <th>Tiến độ</th>
                    <th>Hiệu quả</th>
                    <th>Hoạt động</th>
                  </tr>
                </thead>
                <tbody>
                  {progressPagination.pageItems.map((student) => (
                    <tr key={`${student.email}-${student.courseId}`}>
                      <td>
                        <strong>{student.name}</strong>
                        <span>{student.email}</span>
                      </td>
                      <td>{student.courseTitle}</td>
                      <td>
                        <div className="teacher-progress-cell">
                          <div className="meter">
                            <span style={{ width: `${student.progress}%` }} />
                          </div>
                          <small>
                            {student.progress}% · {getProgressLabel(student.progress)}
                          </small>
                        </div>
                      </td>
                      <td>
                        <strong>{student.score}%</strong>
                        <span>{getScoreLabel(student.score)}</span>
                      </td>
                      <td>{student.lastActive}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <PaginationControls {...progressPagination} label="học sinh" />
          </>
        ) : null}
      </section>
    </div>
  );
}
