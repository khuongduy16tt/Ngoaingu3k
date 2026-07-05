import React from 'react';

const courseLessonList = [
  { title: 'Lesson 1. Introduction', icon: '✓', state: 'done' },
  { title: 'Lesson 2. Pronunciation', icon: '▶', state: 'active' },
  { title: 'Lesson 3. Practice', icon: '□', state: 'locked' }
];

export default function LearningPage() {
  return (
    <div className="page">
      <section className="learning-layout">
        <aside className="lesson-sidebar">
          <div className="sidebar-head">
            <span className="eyebrow">Course player</span>
            <h2>Chapter 1</h2>
          </div>
          {courseLessonList.map((lesson) => (
            <button key={lesson.title} className={`lesson-item ${lesson.state}`}>
              <span>{lesson.icon}</span>
              <span>{lesson.title}</span>
            </button>
          ))}
        </aside>

        <div className="lesson-main">
          <div className="video-frame">
            <iframe
              title="Google Drive lesson video"
              src="https://drive.google.com/file/d/your-file-id/preview"
              allow="autoplay; fullscreen"
            />
          </div>
          <div className="content-card content-card--enterprise">
            <h3>Lesson content</h3>
            <p>Ready for transcript, notes, attachments, and next-lesson navigation.</p>
          </div>
          <div className="content-card content-card--enterprise">
            <h3>Exercises</h3>
            <div className="exercise-grid">
              {['Multiple choice', 'True / false', 'Matching', 'Flashcard'].map((item) => (
                <span key={item} className="exercise-chip">
                  {item}
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
