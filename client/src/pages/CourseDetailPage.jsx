import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { courseDetail as mockCourseDetail, featuredCourses as mockCourses } from '../data/mock';
import { getCourseBySlug } from '../lib/courseService';

export default function CourseDetailPage() {
  const { courseId } = useParams();
  const [course, setCourse] = useState(mockCourseDetail);

  useEffect(() => {
    let alive = true;

    getCourseBySlug(courseId).then((nextCourse) => {
      if (alive) {
        setCourse(nextCourse);
      }
    });

    return () => {
      alive = false;
    };
  }, [courseId]);

  const selectedCourse = mockCourses.find((item) => item.id === courseId) || mockCourses[0];

  return (
    <div className="page">
      <section className="course-hero">
        <div>
          <span className="eyebrow">Course details</span>
          <h1>{course.title}</h1>
          <p>{course.hero}</p>
        </div>
        <div className="price-box">
          <strong>{selectedCourse.price}</strong>
          <p>Instant access after checkout</p>
          <Link className="button" to="/auth">
            Enroll now
          </Link>
        </div>
      </section>

      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Course content</h2>
          {course.sections.map((section) => (
            <div key={section.title}>
              <h3>{section.title}</h3>
              {section.lessons.map((lesson) => (
                <div key={lesson.id} className="detail-row">
                  <span>{lesson.title}</span>
                  <span>{lesson.status}</span>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div className="content-card content-card--enterprise">
          <h2>Instructor</h2>
          <p>{selectedCourse.instructor}</p>
          <h3>What you get</h3>
          <ul className="plain-list">
            <li>Responsive learning experience</li>
            <li>Google Drive video embed support</li>
            <li>Quiz, tests, and progress modules</li>
          </ul>
        </div>
      </section>
    </div>
  );
}
