const demoCourseStudents = [
  { name: 'Minh Anh', email: 'minh.anh@ngoaingu3k.com', courseId: 'english-foundation', progress: 82, score: 91, lastActive: 'Hôm nay' },
  { name: 'Gia Huy', email: 'gia.huy@ngoaingu3k.com', courseId: 'english-foundation', progress: 64, score: 78, lastActive: 'Hôm qua' },
  { name: 'Linh Chi', email: 'linh.chi@ngoaingu3k.com', courseId: 'business-communication', progress: 48, score: 84, lastActive: '2 ngày trước' },
  { name: 'Quốc Bảo', email: 'quoc.bao@ngoaingu3k.com', courseId: 'business-communication', progress: 71, score: 88, lastActive: 'Hôm nay' },
  { name: 'Hoàng Nam', email: 'hoang.nam@ngoaingu3k.com', courseId: 'ielts-boost', progress: 35, score: 73, lastActive: '3 ngày trước' },
  { name: 'Thanh Trúc', email: 'thanh.truc@ngoaingu3k.com', courseId: 'ielts-boost', progress: 59, score: 86, lastActive: 'Hôm qua' }
];

export function average(values) {
  const validValues = values.filter((value) => Number.isFinite(Number(value)));
  if (!validValues.length) return 0;
  return Math.round(validValues.reduce((total, value) => total + Number(value), 0) / validValues.length);
}

export function getProgressLabel(progress) {
  if (progress >= 80) return 'Tốt';
  if (progress >= 50) return 'Đang ổn';
  return 'Cần hỗ trợ';
}

export function getScoreLabel(score) {
  if (score >= 85) return 'Hiệu quả cao';
  if (score >= 70) return 'Ổn định';
  return 'Cần can thiệp';
}

export function buildStudentProgressRows(courses = []) {
  const courseLookup = new Map(courses.map((course) => [course.id, course]));

  return demoCourseStudents
    .filter((student) => courseLookup.has(student.courseId))
    .map((student) => ({
      ...student,
      courseTitle: courseLookup.get(student.courseId)?.title || 'Khóa học'
    }));
}
