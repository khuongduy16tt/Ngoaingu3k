export const roles = ['student', 'teacher', 'admin'];

export const navLinks = [
  { label: 'Home', to: '/home' },
  { label: 'Courses', to: '/courses' },
  { label: 'Learning', to: '/learn' },
  { label: 'Student Dashboard', to: '/dashboard/student', role: 'student' },
  { label: 'Teacher Dashboard', to: '/dashboard/teacher', role: 'teacher' },
  { label: 'Admin Dashboard', to: '/dashboard/admin', role: 'admin' }
];

export const featuredCourses = [
  {
    id: 'english-foundation',
    title: 'English Foundation A1-A2',
    level: 'Beginner',
    price: '$49',
    progress: 72,
    instructor: 'Coach Linh',
    summary: 'Build speaking, listening, and basic grammar through guided lessons.',
    category: 'Core Skills'
  },
  {
    id: 'business-communication',
    title: 'Business Communication',
    level: 'Intermediate',
    price: '$79',
    progress: 41,
    instructor: 'Mr. David',
    summary: 'Present ideas clearly, write better emails, and handle meetings with confidence.',
    category: 'Career'
  },
  {
    id: 'ielts-boost',
    title: 'IELTS Boost Sprint',
    level: 'Advanced',
    price: '$99',
    progress: 18,
    instructor: 'Ms. Hanh',
    summary: 'Targeted practice for reading, writing, listening, and speaking.',
    category: 'Exam Prep'
  }
];

export const courseDetail = {
  id: 'english-foundation',
  title: 'English Foundation A1-A2',
  hero: 'A live learning layout with video lessons, quizzes, and progress tracking.',
  sections: [
    {
      title: 'Chapter 1. Greetings',
      lessons: [
        { id: 'l1', title: 'Lesson 1. Introduction', status: 'done' },
        { id: 'l2', title: 'Lesson 2. Pronunciation', status: 'active' },
        { id: 'l3', title: 'Lesson 3. Small talk', status: 'locked' }
      ]
    },
    {
      title: 'Chapter 2. Daily Routine',
      lessons: [
        { id: 'l4', title: 'Lesson 4. Time expressions', status: 'locked' },
        { id: 'l5', title: 'Lesson 5. Habits', status: 'locked' }
      ]
    }
  ]
};

export const learningExercises = [
  { type: 'Multiple Choice', title: 'Choose the correct answer' },
  { type: 'True / False', title: 'Mark the statement' },
  { type: 'Matching', title: 'Pair the words' },
  { type: 'Fill in the Blank', title: 'Complete the sentence' }
];

export const stats = [
  { label: 'Learners', value: '12,480' },
  { label: 'Courses', value: '86' },
  { label: 'Revenue', value: '$128k' },
  { label: 'Completion', value: '68%' }
];

export const recentActivity = [
  'Student Minh completed Lesson 2',
  'Teacher Hanh published a new quiz',
  'Payment #2026-148 was confirmed',
  'Admin approved a new course draft'
];
