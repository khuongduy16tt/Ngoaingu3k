import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedCourses } from '../lib/courseService';
import { featuredCourses as courseCatalog } from '../data/mock';
import { getAvatarGradient, getInitials } from '../lib/avatar';
import { ConsultationForm } from '../components/ConsultationForm';
import { usePageTitle } from '../hooks/usePageTitle';

function StatPill({ value, label, accent = false }) {
  return (
    <article className={`home-stat ${accent ? 'home-stat--accent' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

function ProgramCard({ title, subtitle, image, href }) {
  return (
    <article className="program-card">
      <Link to={href} className="program-card__link">
        <img src={image} alt={title} loading="lazy" />
        <div className="program-card__overlay">
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
      </Link>
    </article>
  );
}

// placeholder=true bỏ ảnh thật, dùng khối màu trung tính — dùng tạm cho các
// vị trí chưa có ảnh chụp thật phù hợp (thay vì nhét ảnh banner quảng cáo
// không đúng ngữ cảnh "ảnh thực tế").
function PhotoCard({ src, title, subtitle, className = '', placeholder = false }) {
  return (
    <article className={`photo-card ${placeholder ? 'photo-card--placeholder' : ''} ${className}`.trim()}>
      {placeholder ? <div className="photo-card__placeholder-art" aria-hidden="true" /> : <img src={src} alt={title} loading="lazy" />}
      <div className="photo-card__copy">
        <span>{subtitle}</span>
        <strong>{title}</strong>
      </div>
    </article>
  );
}


function CheckIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="check-icon">
      <path d="m5 12.5 4.5 4.5L19 7.5" />
    </svg>
  );
}

function EcosystemCard({ category, course }) {
  return (
    <article className="ecosystem-card">
      <span className="ecosystem-card__eyebrow">{category}</span>
      <h3>{course.title}</h3>
      <p className="ecosystem-card__meta">
        {course.instructor} · {course.duration} · {course.lessonsCount} bài học
      </p>
      <ul className="ecosystem-card__benefits">
        {course.benefits.map((benefit) => (
          <li key={benefit}>
            <CheckIcon />
            <span>{benefit}</span>
          </li>
        ))}
      </ul>
      <Link to="/courses" className="ecosystem-card__link">
        Xem chi tiết →
      </Link>
    </article>
  );
}

function WhyCard({ icon, title, description }) {
  return (
    <article className="why-card">
      <span className="why-card__icon">{icon}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </article>
  );
}

function MethodCard({ title, description }) {
  return (
    <details className="method-card">
      <summary>
        <span>{title}</span>
        <svg viewBox="0 0 24 24" aria-hidden="true" className="method-card__chevron">
          <path d="m6 9 6 6 6-6" />
        </svg>
      </summary>
      <p>{description}</p>
    </details>
  );
}

function InstructorCard({ name, subject, rating }) {
  return (
    <article className="instructor-card">
      <span className="instructor-card__avatar" style={{ background: getAvatarGradient(name) }}>
        {getInitials(name)}
      </span>
      <strong>{name}</strong>
      <span className="instructor-card__subject">{subject}</span>
      <span className="instructor-card__rating">★ {rating.toFixed(1)} đánh giá học viên</span>
    </article>
  );
}

function TestimonialCard({ name, role, quote, course }) {
  return (
    <article className="testimonial-card">
      <span className="quote-card__mark">“</span>
      <p>{quote}</p>
      <div className="testimonial-card__author">
        <span className="testimonial-card__avatar" style={{ background: getAvatarGradient(name) }}>
          {getInitials(name)}
        </span>
        <div>
          <strong>{name}</strong>
          <span>
            {role} · {course}
          </span>
        </div>
      </div>
    </article>
  );
}

const ecosystemSections = [
  {
    category: 'Kỹ năng cốt lõi',
    course: {
      ...courseCatalog.find((course) => course.category === 'Kỹ năng cốt lõi'),
      benefits: [
        'Lộ trình 6 tuần, 24 bài học có hướng dẫn từng bước',
        'Xây nền nghe – nói – ngữ pháp vững chắc cho người mới bắt đầu',
        'Giảng viên sửa lỗi phát âm và ngữ pháp trực tiếp trong buổi học',
      ],
    },
  },
  {
    category: 'Công sở',
    course: {
      ...courseCatalog.find((course) => course.category === 'Công sở'),
      benefits: [
        'Thực hành viết email, thuyết trình và xử lý cuộc họp bằng ngoại ngữ',
        'Giáo án bám sát tình huống công sở thực tế, áp dụng được ngay',
        'Giảng viên phản hồi bài tập theo từng tuần học',
      ],
    },
  },
  {
    category: 'Luyện thi',
    course: {
      ...courseCatalog.find((course) => course.category === 'Luyện thi'),
      benefits: [
        'Luyện đề bấm giờ theo 4 kỹ năng, bám sát cấu trúc bài thi thật',
        'Chấm chữa bài viết chi tiết theo tiêu chí band điểm',
        'Theo dõi tiến độ theo mục tiêu điểm số của từng học viên',
      ],
    },
  },
  {
    category: 'Giao tiếp',
    course: {
      ...courseCatalog.find((course) => course.category === 'Giao tiếp'),
      benefits: [
        'Luyện phản xạ qua tình huống giao tiếp hằng ngày',
        'Nhiệm vụ nói hằng tuần, nhận phản hồi trực tiếp từ giảng viên',
        'Tăng sự tự tin khi thuyết trình và giao tiếp xã hội',
      ],
    },
  },
  {
    category: 'Viết chuyên nghiệp',
    course: {
      ...courseCatalog.find((course) => course.category === 'Viết chuyên nghiệp'),
      benefits: [
        'Khung viết email, báo cáo chuẩn môi trường doanh nghiệp',
        'Sửa lỗi thực tế ngay trên bài viết của học viên',
        'Checklist kiểm tra trước khi gửi, tránh lỗi thường gặp',
      ],
    },
  },
];

const whyChooseFeatures = [
  {
    title: 'Lộ trình học cá nhân hóa',
    description:
      'Mỗi khóa học theo dõi tiến độ riêng của từng học viên, giúp bạn luôn biết mình đang ở đâu và cần học gì tiếp theo.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 18c4-8 8-8 8-14M20 18c-4-8-8-8-8-14" />
        <circle cx="4" cy="19" r="1.6" />
        <circle cx="20" cy="19" r="1.6" />
        <circle cx="12" cy="3" r="1.6" />
      </svg>
    ),
  },
  {
    title: 'Giảng viên đồng hành sát sao',
    description: 'Mỗi khóa học gắn với một giảng viên phụ trách, theo sát bài tập và phản hồi trực tiếp cho học viên.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20c1-3.8 3.7-5.5 6.5-5.5s5.5 1.7 6.5 5.5" />
        <path d="m16.5 6.5 1.6 1.6 2.8-2.8" />
      </svg>
    ),
  },
  {
    title: 'Bài tập và kiểm tra đa dạng',
    description: 'Trắc nghiệm, đúng/sai, nối cặp, điền khuyết... nhiều hình thức luyện tập sau mỗi bài học.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="5" y="3.5" width="14" height="17" rx="1.8" />
        <path d="M8.5 8h7M8.5 12h7M8.5 16h4" />
      </svg>
    ),
  },
  {
    title: 'Theo dõi tiến độ minh bạch',
    description: 'Giáo viên và quản trị viên xem được tiến độ học tập của từng học viên theo thời gian thực.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V9M11 20V4M18 20v-6" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
  {
    title: 'Học online linh hoạt',
    description: 'Học mọi lúc, mọi nơi, chủ động sắp xếp thời gian học theo lịch trình cá nhân.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3.5 2" />
      </svg>
    ),
  },
  {
    title: 'Phòng học riêng cho từng khóa',
    description: 'Bài giảng, bài tập và tài liệu của mỗi khóa học được gom vào một phòng học trực tuyến duy nhất.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="3.5" y="4.5" width="17" height="12" rx="1.6" />
        <path d="M9 20h6M12 16.5V20" />
      </svg>
    ),
  },
];

const teachingMethods = [
  {
    title: 'Học qua tình huống thực tế',
    description:
      'Kết hợp bài giảng trong phòng học với các tình huống gần với đời sống và công việc: hội thoại, viết email, thuyết trình ngắn. Học đến đâu áp dụng ngay đến đó thay vì chỉ ghi nhớ lý thuyết.',
  },
  {
    title: 'Học qua dự án nhóm',
    description:
      'Học viên cùng thực hiện một dự án nhỏ theo chủ đề khóa học, từ lên ý tưởng, triển khai đến trình bày kết quả — rèn cả ngôn ngữ lẫn kỹ năng làm việc nhóm.',
  },
];

const instructorShowcase = [
  { name: 'Cô Linh', subject: 'Kỹ năng cốt lõi', rating: 4.8 },
  { name: 'Thầy David', subject: 'Công sở', rating: 4.7 },
  { name: 'Cô Hạnh', subject: 'Luyện thi IELTS', rating: 4.9 },
  { name: 'Cô Thảo', subject: 'Giao tiếp', rating: 4.6 },
  { name: 'Cô Trang', subject: 'Viết chuyên nghiệp', rating: 4.5 },
  { name: 'Thầy Khoa', subject: 'Luyện thi TOEIC', rating: 4.7 },
];

const testimonialCards = [
  {
    name: 'Thu Hà',
    role: 'Nhân viên văn phòng',
    course: 'Viết email và báo cáo công sở',
    quote:
      'Khóa Viết email và báo cáo công sở giúp mình tự tin gửi email cho sếp nước ngoài mà không phải nhờ ai xem lại nữa.',
  },
  {
    name: 'Anh Duy',
    role: 'Sinh viên năm 3',
    course: 'Tự tin giao tiếp và thuyết trình',
    quote: 'Học xong khóa giao tiếp mình dám bắt chuyện với người nước ngoài, không còn run như trước.',
  },
  {
    name: 'Bảo Ngọc',
    role: 'Nhân sự doanh nghiệp',
    course: 'Giao tiếp doanh nghiệp',
    quote: 'Lộ trình rõ ràng theo từng tuần, bài tập vừa sức nên mình duy trì học đều đặn suốt khóa.',
  },
  {
    name: 'Hữu Phát',
    role: 'Người đi làm',
    course: 'TOEIC Fast Track 650+',
    quote: 'Giảng viên chữa bài kỹ, chỉ đúng lỗi mình hay mắc phải thay vì chấm điểm chung chung.',
  },
];

export default function HomePage() {
  usePageTitle('Trang chủ');
  const [featuredCourses, setFeaturedCourses] = useState([]);

  useEffect(() => {
    let mounted = true;
    getFeaturedCourses().then((courses) => {
      if (mounted) setFeaturedCourses(courses);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const learningPaths = [
    {
      title: 'Tech English',
      subtitle: 'Từ vựng công nghệ, giao tiếp công sở, thuyết trình',
      image: '/images/imported/11.1_KH-TA-scaled.webp',
      href: '/courses',
    },
    {
      title: 'Business Pro',
      subtitle: 'Đàm phán, email, meeting, báo cáo chuẩn doanh nghiệp',
      image: '/images/imported/12.1_KH-TT-scaled.webp',
      href: '/courses',
    },
    {
      title: 'HSK Focus',
      subtitle: 'Học theo lộ trình, dễ theo dõi, dễ tăng tốc',
      image: '/images/imported/10_Trang-chu_footer.png',
      href: '/courses',
    },
  ];

  return (
    <div className="page home-page home-page--new">
      <section className="hero hero--new hero--campaign">
        <div className="hero__copy">
          <h1>
            Học ngoại ngữ
            <br />
            theo <em>lộ trình riêng</em>
            <br />
            cho chính bạn.
          </h1>
          <p>
            Từ tiếng Anh đến tiếng Trung, Ngoaingu3k xây lộ trình theo trình độ và mục tiêu của từng học viên, có
            giảng viên đồng hành sát sao và bài tập theo dõi tiến độ rõ ràng.
          </p>

          <div className="hero__chips" aria-label="Course highlights">
            <span>Tiếng Anh · Tiếng Trung</span>
            <span>Lộ trình cá nhân hóa</span>
            <span>Giảng viên đồng hành sát sao</span>
            <span>Học online linh hoạt</span>
          </div>

          <div className="hero__actions">
            <Link to="/courses" className="button">
              Xem khóa học
            </Link>
            <Link to="/learn" className="button button-ghost">
              Kiểm tra trình độ
            </Link>
          </div>
        </div>

        <div className="hero__media">
          <img
            className="hero__cover"
            src="/images/imported/8.1_Trang-chu_GT-TT.webp"
            alt="Không gian học tập tại Ngoaingu3k"
          />
        </div>
      </section>

      <section className="home-consult-band">
        <div className="home-consult-card">
          <div className="home-consult-card__intro">
            <span className="eyebrow">Tư vấn miễn phí</span>
            <h2>Đăng ký nhận tư vấn lộ trình học</h2>
            <p>Để lại thông tin, đội ngũ Ngoaingu3k liên hệ tư vấn lộ trình phù hợp trong 24h.</p>
          </div>
          <ConsultationForm />
        </div>
      </section>

      <section className="hero-metrics">
        <StatPill value="15k+" label="Học viên ACTIVE" />
        <StatPill value="98%" label="Tỷ lệ hài lòng" accent />
        <StatPill value="24/7" label="Mentor support" />
      </section>

      <section className="home-section home-section--title">
        <h2>
          Hệ Sinh Thái <em>Khóa Học</em>
        </h2>
        <p>Mỗi nhóm mục tiêu có một lộ trình riêng, giảng viên phụ trách riêng và bài tập luyện tập riêng.</p>
      </section>

      <section className="ecosystem-grid">
        {ecosystemSections.map(({ category, course }) => (
          <EcosystemCard key={category} category={category} course={course} />
        ))}
      </section>

      <section className="home-section home-section--title">
        <h2>
          Gương Mặt <em>Thành Công</em>
        </h2>
      </section>

      <section className="success-grid">
        <PhotoCard
          src="/images/imported/8.2_Trang-chu_GT-TT.webp"
          title="Minh Anh"
          subtitle="IELTS 8.5 Highlight"
          className="photo-card--feature"
        />

        <article className="quote-card">
          <span className="quote-card__mark">“</span>
          <p>
            Môi trường học tập cực kỳ hiện đại, bài giảng sinh động không gây nhàm chán.
          </p>
          <div className="quote-card__author">
            <img src="/images/imported/9.2_Trang-chu_lua-chon-dang-tin-cay.webp" alt="Quoc Trung avatar" />
            <div>
              <strong>Quốc Trung</strong>
              <span>Software Engineer</span>
            </div>
          </div>
        </article>

        <article className="mini-panel mini-panel--score">
          <span>500+</span>
          <p>Doanh nghiệp tin dùng</p>
        </article>

        <PhotoCard
          placeholder
          title="Mở khóa tương lai"
          subtitle="Bắt đầu ngay"
        />
      </section>

      <section className="home-section home-section--title">
        <h2>
          Lý Do Chọn <em>Ngoaingu3k</em>
        </h2>
      </section>

      <section className="why-grid">
        {whyChooseFeatures.map((feature) => (
          <WhyCard key={feature.title} {...feature} />
        ))}
      </section>

      <section className="program-section">
        <div className="program-section__head">
          <div>
            <h2>
              Chương Trình <em>May Đo Riêng Cho Bạn</em>
            </h2>
            <p>
              Chúng tôi thiết kế lộ trình học trực tuyến cho từng nhóm mục tiêu, giúp học viên tập trung vào đúng thứ
              cần để tiến bộ nhanh hơn.
            </p>
          </div>
          <Link to="/courses" className="button button-ghost">
            Khám Phá Tất Cả
          </Link>
        </div>

        <div className="program-grid">
          {learningPaths.map((item) => (
            <ProgramCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className="home-section home-section--title">
        <h2>
          Phương Pháp <em>Giảng Dạy</em>
        </h2>
        <p>Kết hợp lý thuyết với thực hành để học viên nhớ lâu và dùng được ngay.</p>
      </section>

      <section className="method-list">
        {teachingMethods.map((method) => (
          <MethodCard key={method.title} {...method} />
        ))}
      </section>

      <section className="home-section home-section--title">
        <h2>
          Đội Ngũ <em>Giảng Viên</em>
        </h2>
        <p>Mỗi giảng viên phụ trách một nhóm khóa học, theo sát học viên từ đầu đến cuối lộ trình.</p>
      </section>

      <section className="instructor-row">
        {instructorShowcase.map((instructor) => (
          <InstructorCard key={instructor.name} {...instructor} />
        ))}
      </section>

      <section className="content-band">
        <div className="content-band__left">
          <span className="eyebrow">Ảnh thực tế</span>
          <h2>Không gian học, seminar và đội ngũ Ngoaingu3k</h2>
          <p>
            Những hình ảnh bạn đưa mình đã gắn sẵn vào phần giao diện để homepage trông giống một trang doanh nghiệp thật
            hơn, rõ nội dung, rõ sản phẩm và dễ tạo niềm tin với người học.
          </p>
        </div>

        <div className="content-band__gallery">
          <PhotoCard src="/images/imported/8.3_Trang-chu_GT-TT.webp" title="Lớp học" subtitle="English training" />
          <PhotoCard src="/images/imported/8.4_Trang-chu_GT-TT.webp" title="Đội ngũ" subtitle="Chinese training" />
          <PhotoCard src="/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp" title="Tư vấn trực tiếp" subtitle="Free test now" />
        </div>
      </section>

      <section className="home-section home-section--title">
        <h2>
          Học Viên <em>Nói Gì</em>
        </h2>
      </section>

      <section className="testimonial-row">
        {testimonialCards.map((testimonial) => (
          <TestimonialCard key={testimonial.name} {...testimonial} />
        ))}
      </section>

      {featuredCourses.length ? (
        <section className="course-preview">
          <div className="course-preview__head">
            <span className="eyebrow">Khóa học nổi bật</span>
            <h2>Nhìn phát hiểu ngay có gì để học</h2>
          </div>
          <div className="course-preview__grid">
            {featuredCourses.slice(0, 3).map((course) => (
              <article key={course.id} className="course-preview-card">
                <img src="/images/imported/11.2_KH-TA-scaled.webp" alt={course.title} />
                <div className="course-preview-card__copy">
                  <span>{course.category}</span>
                  <strong>{course.title}</strong>
                  <p>{course.summary}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
