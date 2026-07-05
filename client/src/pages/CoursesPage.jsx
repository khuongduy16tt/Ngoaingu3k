import React, { useEffect, useState } from 'react';
import { featuredCourses as mockCourses } from '../data/mock';
import { getFeaturedCourses } from '../lib/courseService';

export default function CoursesPage() {
  const [featuredCourses, setFeaturedCourses] = useState(mockCourses);

  useEffect(() => {
    let alive = true;

    getFeaturedCourses().then((courses) => {
      if (alive) {
        setFeaturedCourses(courses);
      }
    });

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div className="page">
      <section className="section">
        <div className="section-head">
          <h1>Course catalog</h1>
          <p>Browse, preview, and prepare for a future checkout flow.</p>
        </div>

        <div className="catalog-layout">
          <aside className="catalog-filters">
            <h3>Filters</h3>
            <button>All levels</button>
            <button>Beginner</button>
            <button>Intermediate</button>
            <button>Advanced</button>
          </aside>

          <div className="card-grid">
            {featuredCourses.map((course) => (
              <article key={course.id} className="course-card course-card--enterprise">
                <span className="pill">{course.level}</span>
                <h3>{course.title}</h3>
                <p>{course.summary}</p>
                <div className="meter">
                  <span style={{ width: `${course.progress}%` }} />
                </div>
                <div className="course-footer">
                  <strong>{course.price}</strong>
                  <a href={`/courses/${course.id}`}>Open course</a>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
