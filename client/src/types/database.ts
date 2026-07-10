/**
 * Database entity types — mirrors Supabase schema.
 */

export type Role = 'student' | 'teacher' | 'admin';

export type CourseStatus = 'draft' | 'published' | 'hidden';

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export type AssignmentScope = 'selected_students' | 'course_buyers';

export type ExerciseType = 'mcq' | 'tf' | 'match' | 'blank' | 'flash';

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  avatarUrl: string;
  createdAt: string;
  updatedAt?: string;
  source?: 'supabase' | 'local';
}

export interface Course {
  id: string;
  databaseId?: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  status: CourseStatus;
  teacherId: string;
  bannerUrl: string;
  createdAt: string;
  updatedAt?: string;
  source?: 'supabase' | 'local';
}

export interface Chapter {
  id: string;
  courseId: string;
  title: string;
  position: number;
}

export interface Lesson {
  id: string;
  databaseId?: string;
  courseId: string;
  chapterId: string;
  chapterTitle?: string;
  title: string;
  content: string;
  videoUrl: string;
  position: number;
  isPreview: boolean;
  createdAt?: string;
  source?: 'supabase' | 'local';
}

export interface Order {
  id: string;
  userId: string;
  courseId: string;
  status: OrderStatus;
  amount: number;
  createdAt: string;
}

export interface Progress {
  userId: string;
  lessonId: string;
  completed: boolean;
  updatedAt: string;
}

export interface QuizAttempt {
  id: string;
  userId: string;
  lessonId: string;
  score: number;
  maxScore: number;
  attemptNo: number;
  createdAt: string;
}

export interface MatchPair {
  term: string;
  answer: string;
}

export interface ExerciseConfig {
  type: ExerciseType;
  lessonPosition: string;
  prompt: string;
  options: string[];
  correctAnswer: string;
  trueFalseAnswer: string;
  pairs: MatchPair[];
  blankText: string;
  blankAnswer: string;
  flashFront: string;
  flashBack: string;
  explanation: string;
  generatedQuestions?: GeneratedQuestion[];
}

export interface GeneratedQuestion {
  prompt: string;
  options: string[];
  correctAnswer: string;
}

export interface LessonAssignment {
  id: string;
  teacherId: string;
  courseKey: string;
  courseTitle: string;
  lessonTitle: string;
  title: string;
  description?: string;
  assignmentScope: AssignmentScope;
  audioName?: string;
  audioUrl?: string;
  attachmentName?: string;
  attachmentUrl?: string;
  exerciseConfig: ExerciseConfig;
  createdAt: string;
  updatedAt?: string;
}

export interface AssignmentAttempt {
  id: string;
  assignmentId: string;
  studentId: string;
  studentEmail: string;
  answers: Record<string, string>;
  score: number;
  maxScore: number;
  submittedAt: string;
}

export interface RolePermission {
  role: Role;
  label: string;
  permissions: {
    viewLearning: boolean;
    manageOwnProgress: boolean;
    manageUsers: boolean;
    manageCourses: boolean;
    manageLessons: boolean;
    manageTeachers: boolean;
    manageSystem: boolean;
  };
}
