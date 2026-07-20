export const roles = ['student', 'teacher', 'admin'];

export const navLinks = [
  { label: 'Trang chủ', to: '/home' },
  { label: 'Khóa học', to: '/courses' },
  { label: 'Phòng học', to: '/learn' },
  { label: 'Phòng thi', to: '/exams' },
  { label: 'Tiến độ học sinh', to: '/student-progress', role: 'teacher' },
  { label: 'Tiến độ học sinh', to: '/student-progress', role: 'admin' },
  { label: 'Bảng điều khiển', to: '/dashboard/student', role: 'student' },
  { label: 'Bảng điều khiển', to: '/dashboard/teacher', role: 'teacher' },
  { label: 'Bảng điều khiển', to: '/dashboard/admin', role: 'admin' }
];

export const featuredCourses = [
  {
    id: 'english-foundation',
    slug: 'english-foundation',
    title: 'Tiếng Anh nền tảng A1-A2',
    level: 'Nền tảng',
    price: 490000,
    progress: 72,
    instructor: 'Cô Linh',
    summary: 'Xây nền giao tiếp, nghe hiểu và ngữ pháp cốt lõi theo lộ trình có hướng dẫn.',
    category: 'Kỹ năng cốt lõi',
    duration: '6 tuần',
    lessonsCount: 24,
    rating: 4.8,
    studentsCount: 1240,
    badge: 'Bán chạy',
    bannerUrl: '/images/imported/11.1_KH-TA-scaled.webp',
    hero: 'Lộ trình nền tảng giúp học viên tự tin giao tiếp, hình thành thói quen nghe và nắm chắc cấu trúc căn bản.',
    whatYouGet: ['24 bài học có hướng dẫn', 'Workbook có thể in', 'Bài luyện nói theo tình huống']
  },
  {
    id: 'business-communication',
    slug: 'business-communication',
    title: 'Giao tiếp doanh nghiệp',
    level: 'Trung cấp',
    price: 790000,
    progress: 41,
    instructor: 'Thầy David',
    summary: 'Trình bày ý tưởng rõ ràng, viết email chuyên nghiệp và xử lý cuộc họp tự tin hơn.',
    category: 'Công sở',
    duration: '8 tuần',
    lessonsCount: 18,
    rating: 4.7,
    studentsCount: 820,
    badge: 'Công sở',
    bannerUrl: '/images/imported/12.1_KH-TT-scaled.webp',
    hero: 'Khóa học thực chiến cho giao tiếp văn phòng, thuyết trình, email theo dõi và điều phối cuộc họp.',
    whatYouGet: ['Mẫu câu họp chuyên nghiệp', 'Bài luyện email doanh nghiệp', 'Checklist thuyết trình']
  },
  {
    id: 'ielts-boost',
    slug: 'ielts-boost',
    title: 'Tăng tốc IELTS chuyên sâu',
    level: 'Nâng cao',
    price: 990000,
    progress: 18,
    instructor: 'Cô Hạnh',
    summary: 'Luyện tập trọng tâm cho đọc, viết, nghe và nói theo mục tiêu điểm số.',
    category: 'Luyện thi',
    duration: '10 tuần',
    lessonsCount: 32,
    rating: 4.9,
    studentsCount: 960,
    badge: 'IELTS',
    bannerUrl: '/images/imported/8.2_Trang-chu_GT-TT.webp',
    hero: 'Lộ trình tăng tốc theo mục tiêu điểm, có luyện đề bấm giờ, phản hồi bài viết và chiến lược phòng thi.',
    whatYouGet: ['32 bài luyện theo dạng đề', 'Ghi chú tiêu chí band điểm', 'Bài mock test có giới hạn thời gian']
  },
  {
    id: 'speaking-confidence',
    slug: 'speaking-confidence',
    title: 'Tự tin giao tiếp và thuyết trình',
    level: 'Nền tảng',
    price: 590000,
    progress: 64,
    instructor: 'Cô Thảo',
    summary: 'Nói tự nhiên trong giao tiếp hằng ngày, tình huống xã hội và phần trình bày ngắn.',
    category: 'Giao tiếp',
    duration: '6 tuần',
    lessonsCount: 20,
    rating: 4.6,
    studentsCount: 710,
    badge: 'Thực hành live',
    bannerUrl: '/images/imported/11.3_KH-TA-scaled.webp',
    hero: 'Tăng độ lưu loát qua luyện nhại, câu hỏi gợi mở và tình huống giao tiếp thực tế.',
    whatYouGet: ['Bài học nhập vai', 'Gợi ý luyện phát âm', 'Nhiệm vụ nói hằng tuần']
  },
  {
    id: 'workplace-writing',
    slug: 'workplace-writing',
    title: 'Viết email và báo cáo công sở',
    level: 'Trung cấp',
    price: 690000,
    progress: 53,
    instructor: 'Cô Trang',
    summary: 'Viết email, cập nhật công việc, báo cáo và tóm tắt nhiệm vụ theo chuẩn đội nhóm hiện đại.',
    category: 'Viết chuyên nghiệp',
    duration: '5 tuần',
    lessonsCount: 16,
    rating: 4.5,
    studentsCount: 540,
    badge: 'Ứng dụng',
    bannerUrl: '/images/imported/12.4_KH-TT-scaled.webp',
    hero: 'Nắm vững cách viết ngắn gọn, lịch sự và có cấu trúc phù hợp cho môi trường doanh nghiệp.',
    whatYouGet: ['Khung email chuyên nghiệp', 'Ví dụ sửa lỗi thực tế', 'Checklist trước khi gửi']
  },
  {
    id: 'toeic-fast-track',
    slug: 'toeic-fast-track',
    title: 'TOEIC Fast Track 650+',
    level: 'Trung cấp',
    price: 890000,
    progress: 37,
    instructor: 'Thầy Khoa',
    summary: 'Luyện các dạng TOEIC thường gặp với chiến thuật nghe nhanh và đọc hiệu quả.',
    category: 'Luyện thi',
    duration: '8 tuần',
    lessonsCount: 28,
    rating: 4.7,
    studentsCount: 630,
    badge: 'TOEIC',
    bannerUrl: '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp',
    hero: 'Khóa học tăng điểm cho học viên cần năng lực TOEIC sẵn sàng cho tuyển dụng và công việc.',
    whatYouGet: ['Bài luyện mẫu nghe', 'Bài tăng tốc độ đọc', 'Mini test mô phỏng đầy đủ']
  },
  {
    id: 'hsk-accelerator',
    slug: 'hsk-accelerator',
    title: 'Tăng tốc HSK 3 - Giao tiếp phản xạ',
    level: 'Trung cấp',
    price: 890000,
    progress: 22,
    instructor: 'Cô Vy',
    summary: 'Luyện phản xạ giao tiếp tiếng Trung theo chuẩn HSK 3, tăng tốc từ nền tảng.',
    category: 'HSK',
    language: 'Tiếng Trung',
    duration: '8 tuần',
    lessonsCount: 20,
    rating: 4.7,
    studentsCount: 480,
    badge: 'HSK',
    bannerUrl: '/images/imported/12.3_KH-TT-scaled.webp',
    hero: 'Lộ trình tăng tốc HSK 3 giúp học viên phản xạ giao tiếp nhanh, luyện đề theo đúng cấu trúc bài thi HSK.',
    whatYouGet: ['20 bài học theo lộ trình HSK 3', 'Luyện phản xạ giao tiếp theo tình huống', 'Đề luyện tập theo cấu trúc HSK thật']
  }
];

export const courseDetail = {
  id: 'english-foundation',
  slug: 'english-foundation',
  title: 'Tiếng Anh nền tảng A1-A2',
  hero: 'Không gian học trực tuyến với bài giảng, bài luyện tập và theo dõi tiến độ rõ ràng.',
  sections: [
    {
      title: 'Chương 1. Chào hỏi và mở đầu hội thoại',
      lessons: [
        { id: 'l1', title: 'Bài 1. Giới thiệu bản thân', status: 'hoàn thành' },
        { id: 'l2', title: 'Bài 2. Phát âm trọng tâm', status: 'đang học' },
        { id: 'l3', title: 'Bài 3. Hội thoại ngắn', status: 'đang khóa' }
      ]
    },
    {
      title: 'Chương 2. Lịch trình hằng ngày',
      lessons: [
        { id: 'l4', title: 'Bài 4. Cách nói về thời gian', status: 'đang khóa' },
        { id: 'l5', title: 'Bài 5. Thói quen cá nhân', status: 'đang khóa' }
      ]
    }
  ]
};

export const learningExercises = [
  { type: 'Trắc nghiệm', title: 'Chọn đáp án đúng' },
  { type: 'Đúng / Sai', title: 'Đánh giá nhận định' },
  { type: 'Nối cặp', title: 'Ghép từ với nghĩa' },
  { type: 'Điền khuyết', title: 'Hoàn thành câu' }
];

// Seed exam for mock mode (snake_case: same shape examService persists to localStorage).
export const demoExams = [
  {
    id: 'demo-exam-1',
    teacher_id: 'local-teacher',
    title: 'Đề thi thử tổng hợp: Nghe + Đọc',
    description: 'Đề mẫu mô phỏng phòng thi với hai phần thi tính giờ riêng.',
    course_key: '',
    assignment_scope: 'selected_students',
    status: 'published',
    created_at: '2026-07-01T08:00:00.000Z',
    updated_at: '2026-07-01T08:00:00.000Z',
    recipients: [
      { student_email: 'student.demo@ngoaingu3k.local' },
      { student_email: 'google.demo@ngoaingu3k.local' }
    ],
    sections: [
      {
        id: 'demo-listening',
        type: 'listening',
        title: 'Phần 1: Nghe hiểu',
        durationMinutes: 5,
        audioUrl: '',
        audioName: '',
        passage: '',
        questions: [
          {
            id: 'demo-l1',
            type: 'multiple_choice',
            prompt: 'Người nói đang đặt bàn cho mấy người?',
            options: ['2 người', '3 người', '4 người', '5 người'],
            correctAnswer: '4 người',
            explanation: 'Đoạn hội thoại nhắc "a table for four".'
          },
          {
            id: 'demo-l2',
            type: 'true_false',
            prompt: 'Cuộc hẹn diễn ra vào buổi tối.',
            correctAnswer: 'true'
          },
          {
            id: 'demo-l3',
            type: 'fill_blank',
            prompt: 'Điền số điện thoại người nói để lại (4 chữ số cuối).',
            acceptedAnswers: ['1234'],
            correctAnswer: '1234'
          }
        ]
      },
      {
        id: 'demo-reading',
        type: 'reading',
        title: 'Phần 2: Đọc hiểu',
        durationMinutes: 8,
        audioUrl: '',
        audioName: '',
        passage:
          'Học ngoại ngữ đều đặn mỗi ngày hiệu quả hơn học dồn vào cuối tuần. Nghiên cứu cho thấy 25 phút mỗi ngày giúp ghi nhớ từ vựng tốt hơn 3 giờ học liên tục.\n\nNgoài ra, việc ôn tập cách quãng (spaced repetition) giúp chuyển kiến thức từ trí nhớ ngắn hạn sang trí nhớ dài hạn.',
        questions: [
          {
            id: 'demo-r1',
            type: 'multiple_choice',
            prompt: 'Theo bài đọc, cách học nào hiệu quả hơn?',
            options: ['Học dồn cuối tuần', 'Học đều đặn mỗi ngày', 'Chỉ học khi có hứng', 'Học 3 giờ liên tục'],
            correctAnswer: 'Học đều đặn mỗi ngày'
          },
          {
            id: 'demo-r2',
            type: 'fill_blank',
            prompt: 'Bài đọc gợi ý học bao nhiêu phút mỗi ngày?',
            acceptedAnswers: ['25', '25 phút'],
            correctAnswer: '25'
          },
          {
            id: 'demo-r3',
            type: 'matching',
            prompt: 'Nối thuật ngữ với mô tả đúng.',
            pairs: [
              { left: 'Spaced repetition', right: 'Ôn tập cách quãng' },
              { left: 'Trí nhớ ngắn hạn', right: 'Lưu thông tin tạm thời' },
              { left: 'Trí nhớ dài hạn', right: 'Lưu thông tin bền vững' }
            ]
          }
        ]
      }
    ]
  }
];

export const stats = [
  { label: 'Học viên', value: '12,480' },
  { label: 'Khóa học', value: '86' },
  { label: 'Doanh thu', value: '$128k' },
  { label: 'Hoàn thành', value: '68%' }
];

export const recentActivity = [
  'Học viên Minh hoàn thành Bài 2',
  'Giảng viên Hạnh phát hành bài kiểm tra mới',
  'Thanh toán #2026-148 đã được xác nhận',
  'Quản trị viên duyệt bản nháp khóa học mới'
];
