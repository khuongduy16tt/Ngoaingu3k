import type { Role } from './database';

export interface NavLink {
  label: string;
  to: string;
  role?: Role;
}

export interface ExerciseTab {
  id: string;
  label: string;
}

export interface ContactAction {
  label: string;
  description: string;
  href: string;
  className: string;
  external?: boolean;
  icon: React.ReactNode;
}

export interface StatMetric {
  label: string;
  value: string;
}

export interface CourseCardData {
  id: string;
  slug: string;
  title: string;
  level: string;
  price: string;
  priceValue: number;
  progress: number;
  instructor: string;
  summary: string;
  category: string;
  bannerUrl: string | null;
  duration: string;
  lessonsCount: number;
  rating: number;
  studentsCount: number;
  badge: string;
  hero: string;
  language: string;
  certificate: boolean;
  whatYouGet: string[];
  databaseId?: string;
}
