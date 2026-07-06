export const roles = ['student', 'teacher', 'admin'];

export const navLinks = [
  { label: 'Home', to: '/home' },
  { label: 'Courses', to: '/courses' },
  { label: 'Learning', to: '/learn' },
  { label: 'Dashboard', to: '/dashboard/student', role: 'student' },
  { label: 'Dashboard', to: '/dashboard/teacher', role: 'teacher' },
  { label: 'Dashboard', to: '/dashboard/admin', role: 'admin' }
];

export const featuredCourses = [
  {
    id: 'english-foundation',
    slug: 'english-foundation',
    title: 'English Foundation A1-A2',
    level: 'Beginner',
    price: 49,
    progress: 72,
    instructor: 'Coach Linh',
    summary: 'Build speaking, listening, and basic grammar through guided lessons.',
    category: 'Core Skills',
    duration: '6 weeks',
    lessonsCount: 24,
    rating: 4.8,
    studentsCount: 1240,
    badge: 'Best seller',
    bannerUrl: '/images/imported/11.1_KH-TA-scaled.webp',
    hero: 'A complete beginner path focused on speaking confidence, listening habits, and core grammar.',
    whatYouGet: ['24 guided lessons', 'Printable workbook', 'Speaking practice prompts']
  },
  {
    id: 'business-communication',
    slug: 'business-communication',
    title: 'Business Communication',
    level: 'Intermediate',
    price: 79,
    progress: 41,
    instructor: 'Mr. David',
    summary: 'Present ideas clearly, write better emails, and handle meetings with confidence.',
    category: 'Career',
    duration: '8 weeks',
    lessonsCount: 18,
    rating: 4.7,
    studentsCount: 820,
    badge: 'Workplace',
    bannerUrl: '/images/imported/12.1_KH-TT-scaled.webp',
    hero: 'A practical course for office communication, presentations, follow-up emails, and meeting flow.',
    whatYouGet: ['Meeting templates', 'Business email drills', 'Presentation speaking checklist']
  },
  {
    id: 'ielts-boost',
    slug: 'ielts-boost',
    title: 'IELTS Boost Sprint',
    level: 'Advanced',
    price: 99,
    progress: 18,
    instructor: 'Ms. Hanh',
    summary: 'Targeted practice for reading, writing, listening, and speaking.',
    category: 'Exam Prep',
    duration: '10 weeks',
    lessonsCount: 32,
    rating: 4.9,
    studentsCount: 960,
    badge: 'IELTS',
    bannerUrl: '/images/imported/8.2_Trang-chu_GT-TT.webp',
    hero: 'A score-focused sprint with timed practice, writing feedback, and exam strategy reviews.',
    whatYouGet: ['32 exam drills', 'Band descriptor notes', 'Timed mock practice']
  },
  {
    id: 'speaking-confidence',
    slug: 'speaking-confidence',
    title: 'Speaking Confidence Bootcamp',
    level: 'Beginner',
    price: 59,
    progress: 64,
    instructor: 'Ms. Thao',
    summary: 'Speak naturally in daily conversations, social situations, and short presentations.',
    category: 'Speaking',
    duration: '6 weeks',
    lessonsCount: 20,
    rating: 4.6,
    studentsCount: 710,
    badge: 'Live practice',
    bannerUrl: '/images/imported/11.3_KH-TA-scaled.webp',
    hero: 'Build fluency with repeat-after-me practice, speaking prompts, and everyday conversation drills.',
    whatYouGet: ['Role-play lessons', 'Pronunciation prompts', 'Weekly speaking tasks']
  },
  {
    id: 'workplace-writing',
    slug: 'workplace-writing',
    title: 'Workplace Writing Essentials',
    level: 'Intermediate',
    price: 69,
    progress: 53,
    instructor: 'Ms. Trang',
    summary: 'Write polished emails, updates, reports, and task summaries for modern teams.',
    category: 'Writing',
    duration: '5 weeks',
    lessonsCount: 16,
    rating: 4.5,
    studentsCount: 540,
    badge: 'Practical',
    bannerUrl: '/images/imported/12.4_KH-TT-scaled.webp',
    hero: 'Master concise business writing, polite requests, and report-friendly English structures.',
    whatYouGet: ['Email frameworks', 'Correction examples', 'Writing checklist']
  },
  {
    id: 'toeic-fast-track',
    slug: 'toeic-fast-track',
    title: 'TOEIC Fast Track 650+',
    level: 'Intermediate',
    price: 89,
    progress: 37,
    instructor: 'Mr. Khoa',
    summary: 'Train on the most common TOEIC patterns with listening shortcuts and reading tactics.',
    category: 'Exam Prep',
    duration: '8 weeks',
    lessonsCount: 28,
    rating: 4.7,
    studentsCount: 630,
    badge: 'TOEIC',
    bannerUrl: '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp',
    hero: 'A score-improvement course for students aiming to reach job-ready TOEIC performance quickly.',
    whatYouGet: ['Listening pattern drills', 'Reading speed tasks', 'Full mock mini tests']
  }
];

export const courseDetail = {
  id: 'english-foundation',
  slug: 'english-foundation',
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
