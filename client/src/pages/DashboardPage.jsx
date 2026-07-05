import React from 'react';

function DashboardShell({ title, description, metrics }) {
  return (
    <div className="page">
      <section className="dashboard-head">
        <div>
          <span className="eyebrow">Dashboard</span>
          <h1>{title}</h1>
          <p>{description}</p>
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

      <section className="section split-layout">
        <div className="content-card content-card--enterprise">
          <h2>Operations</h2>
          <ul className="plain-list">
            <li>Course creation and moderation</li>
            <li>Lesson and quiz management</li>
            <li>Payment and revenue records</li>
          </ul>
        </div>

        <div className="content-card content-card--enterprise">
          <h2>Next integration points</h2>
          <ul className="plain-list">
            <li>Database persistence</li>
            <li>JWT auth and refresh tokens</li>
            <li>Realtime progress tracking</li>
          </ul>
        </div>
      </section>
    </div>
  );
}

export function StudentDashboardPage() {
  return (
    <DashboardShell
      title="Student dashboard"
      description="Purchased courses, progress, grades, and certificate tracking."
      metrics={[
        { label: 'Courses owned', value: '4' },
        { label: 'Completion', value: '68%' },
        { label: 'Average score', value: '89' },
        { label: 'Study streak', value: '12 days' }
      ]}
    />
  );
}

export function TeacherDashboardPage() {
  return (
    <DashboardShell
      title="Teacher dashboard"
      description="Manage courses, lessons, exercises, and learner progress."
      metrics={[
        { label: 'Active courses', value: '8' },
        { label: 'Students', value: '214' },
        { label: 'Pending reviews', value: '17' },
        { label: 'Quizzes', value: '32' }
      ]}
    />
  );
}

export function AdminDashboardPage() {
  return (
    <DashboardShell
      title="Admin dashboard"
      description="Users, approvals, payments, and platform analytics."
      metrics={[
        { label: 'Users', value: '12,480' },
        { label: 'Revenue', value: '$128k' },
        { label: 'Transactions', value: '1,248' },
        { label: 'Approval queue', value: '6' }
      ]}
    />
  );
}
