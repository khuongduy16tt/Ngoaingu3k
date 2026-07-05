export const mockCourses = [
  {
    id: 'english-foundation',
    title: 'English Foundation A1-A2',
    status: 'published',
    price: 490000
  },
  {
    id: 'business-communication',
    title: 'Business Communication',
    status: 'draft',
    price: 790000
  }
];

export const mockUsers = [
  { id: 1, name: 'Minh', role: 'student' },
  { id: 2, name: 'Hanh', role: 'teacher' },
  { id: 3, name: 'Admin', role: 'admin' }
];

export const mockProgress = [
  {
    userId: 1,
    courseId: 'english-foundation',
    completion: 72,
    lastLesson: 'Lesson 2',
    studyTimeMinutes: 1840,
    lastStudiedAt: '2026-07-04T10:00:00Z'
  }
];
