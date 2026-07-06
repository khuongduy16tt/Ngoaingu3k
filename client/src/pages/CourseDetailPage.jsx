import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { courseDetail as mockCourseDetail } from '../data/mock';
import { getCourseBySlug, getOwnedCourseIds, purchaseCourse } from '../lib/courseService';
import { getEffectiveRole } from '../lib/permissions';
import { useAuth } from '../providers/AuthProvider';

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const auth = useAuth();
  const currentRole = getEffectiveRole(auth);
  const [course, setCourse] = useState({
    ...mockCourseDetail,
    price: '$0',
    priceValue: 0,
    instructor: 'Coach Linh',
    level: 'Beginner',
    category: 'Core Skills',
    whatYouGet: []
  });
  const [ownedCourseIds, setOwnedCourseIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
  const [feedback, setFeedback] = useState('');

  useEffect(() => {
    if (!auth.ready) {
      return undefined;
    }

    let alive = true;

    async function loadCourse() {
      setLoading(true);
      const nextCourse = await getCourseBySlug(courseId);
      const nextOwnedIds = await getOwnedCourseIds(auth.user?.id, [nextCourse]);

      if (alive) {
        setCourse(nextCourse);
        setOwnedCourseIds(nextOwnedIds);
        setLoading(false);
      }
    }

    void loadCourse();

    return () => {
      alive = false;
    };
  }, [auth.ready, auth.user?.id, courseId]);

  const isOwned = ownedCourseIds.includes(course.id);

  async function handlePurchase() {
    if (!auth.session || currentRole !== 'student' || isOwned) {
      return;
    }

    setPurchasing(true);
    setFeedback('');

    try {
      const result = await purchaseCourse({
        course,
        userId: auth.user?.id
      });

      setOwnedCourseIds(result.ownedCourseIds);
      setFeedback(`${course.title} is now available in this student's owned library.`);
    } catch (error) {
      setFeedback(error?.message || 'We could not complete the purchase right now.');
    } finally {
      setPurchasing(false);
    }
  }

  return (
    <div className="page">
      <section className="course-hero">
        <div>
          <span className="eyebrow">{course.category || 'Course details'}</span>
          <h1>{course.title}</h1>
          <p>{loading ? 'Loading course details...' : course.hero}</p>

          <div className="marketplace-card__facts course-detail__facts">
            <span>{course.level}</span>
            <span>{course.duration || 'Flexible schedule'}</span>
            <span>{course.lessonsCount || 0} lessons</span>
            <span>{course.instructor}</span>
          </div>
        </div>

        <div className="price-box course-detail__sidebar">
          <span className="pill">{isOwned ? 'Owned' : 'One-time purchase'}</span>
          <strong>{course.price}</strong>
          <p>
            {isOwned
              ? 'This course already belongs to the current student account.'
              : 'Buy once and keep the course in the owned library with instant access.'}
          </p>

          {isOwned ? (
            <Link className="button" to={course.id === 'english-foundation' ? '/learn' : `/courses/${course.id}`}>
              {course.id === 'english-foundation' ? 'Start learning' : 'View owned'}
            </Link>
          ) : auth.session ? (
            <button
              type="button"
              className="button"
              disabled={currentRole !== 'student' || purchasing}
              onClick={handlePurchase}
            >
              {currentRole === 'student' ? (purchasing ? 'Processing...' : 'Buy now') : 'Student only'}
            </button>
          ) : (
            <Link className="button" to="/auth">
              Sign in to buy
            </Link>
          )}

          <Link className="button-ghost" to="/courses">
            Back to catalog
          </Link>
        </div>
      </section>

      {feedback ? (
        <section className="content-card content-card--enterprise marketplace-feedback">
          <strong>Course update</strong>
          <p>{feedback}</p>
        </section>
      ) : null}

      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Course content</h2>
          {course.sections?.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              {section.lessons?.length ? (
                section.lessons.map((lesson) => (
                  <div key={lesson.id} className="detail-row">
                    <span>{lesson.title}</span>
                    <span>{lesson.status}</span>
                  </div>
                ))
              ) : (
                <div className="detail-row">
                  <span>Lesson list will appear here when chapters are synced.</span>
                  <span>Preview</span>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="content-card content-card--enterprise">
          <h2>What you get</h2>
          <ul className="plain-list">
            {(course.whatYouGet || []).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>

          <h3>Instructor</h3>
          <p>{course.instructor}</p>

          <h3>Ownership</h3>
          <p>
            Purchased courses are tracked in the student library so they can be filtered later by
            owned status on the catalog page.
          </p>
        </div>
      </section>
    </div>
  );
}
