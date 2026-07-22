import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedCourses } from '../lib/courseService';
import { usePageTitle } from '../hooks/usePageTitle';

// Khi khóa học chưa có bannerUrl (dữ liệu thật từ backend), dùng ảnh thật từ
// thư viện ảnh của trung tâm thay vì để trống — luân phiên 3 ảnh khác nhau
// theo vị trí thẻ để cả 3 card không lặp lại cùng 1 ảnh.
const coursePlaceholderPhotos = [
  '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp',
  '/images/imported/9.3_Trang-chu_lua-chon-tin-cay.webp',
  '/images/imported/8.2_Trang-chu_GT-TT.webp',
];

function CoursePlaceholderArt({ variant = 0, title }) {
  const src = coursePlaceholderPhotos[variant % coursePlaceholderPhotos.length];
  return <img className="course-tile__media-placeholder" src={src} alt={title} loading="lazy" />;
}

// Vài khóa học thật trong hệ thống có mô tả do giảng viên nhập tạm/không rõ
// nghĩa (ví dụ "học 1 hiểu 10") — lọc ở tầng hiển thị thay vì sửa trực tiếp
// bản ghi trong database, tránh thay đổi dữ liệu chia sẻ ngoài ý muốn.
const LOW_QUALITY_SUMMARIES = new Set(['học 1 hiểu 10']);
const FALLBACK_COURSE_SUMMARY = 'Khóa học có lộ trình rõ ràng, giảng viên đồng hành và bài tập theo dõi tiến độ.';

function getCourseSummary(course) {
  const summary = (course.summary || '').trim();
  if (!summary || LOW_QUALITY_SUMMARIES.has(summary.toLowerCase())) {
    return FALLBACK_COURSE_SUMMARY;
  }
  return summary;
}

function StatPill({ value, label, accent = false }) {
  return (
    <article className={`home-stat ${accent ? 'home-stat--accent' : ''}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </article>
  );
}

const learningPathSteps = [
  {
    number: '01',
    title: 'Kỹ năng cốt lõi',
    description: 'Xây nền nghe – nói – ngữ pháp vững chắc trong 6 tuần, 24 bài học hướng dẫn từng bước.',
  },
  {
    number: '02',
    title: 'Công sở',
    description: 'Thực hành viết email, thuyết trình và xử lý cuộc họp bằng ngoại ngữ theo tình huống thực tế.',
  },
  {
    number: '03',
    title: 'Luyện thi',
    description: 'Luyện đề bấm giờ theo 4 kỹ năng, chấm chữa bài viết chi tiết theo tiêu chí band điểm.',
  },
  {
    number: '04',
    title: 'Giao tiếp',
    description: 'Luyện phản xạ qua tình huống giao tiếp hằng ngày, nhận phản hồi trực tiếp mỗi tuần.',
  },
  {
    number: '05',
    title: 'Viết chuyên nghiệp',
    description: 'Khung viết email, báo cáo chuẩn doanh nghiệp, sửa lỗi thực tế ngay trên bài viết của bạn.',
  },
];

const reasonColumns = [
  {
    title: 'Lộ trình cá nhân hóa',
    description: 'Mỗi học viên theo dõi tiến độ riêng, luôn biết mình đang ở đâu và cần học gì tiếp theo.',
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
    description: 'Mỗi khóa học gắn với một giảng viên phụ trách, theo sát bài tập và phản hồi trực tiếp.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20c1-3.8 3.7-5.5 6.5-5.5s5.5 1.7 6.5 5.5" />
      </svg>
    ),
  },
  {
    title: 'Theo dõi tiến độ minh bạch',
    description: 'Giáo viên và học viên cùng xem được tiến độ học tập theo thời gian thực, không mập mờ.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V9M11 20V4M18 20v-6" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
];

// Ảnh chân dung AI (StyleGAN2, không phải người thật) dùng làm ảnh minh họa
// tượng trưng cho giảng viên — không có công cụ tạo ảnh AI tích hợp trong
// môi trường này nên lấy trực tiếp từ thispersondoesnotexist.com (ảnh tổng
// hợp, miễn phí sử dụng, không gắn với danh tính người thật nào).
const instructorShowcase = [
  { name: 'Cô Linh', subject: 'Kỹ năng cốt lõi', photo: '/images/team/teacher-linh.jpg' },
  { name: 'Thầy David', subject: 'Công sở', photo: '/images/team/teacher-david.jpg' },
  { name: 'Cô Hạnh', subject: 'Luyện thi IELTS', photo: '/images/team/teacher-hanh.jpg' },
  { name: 'Cô Thảo', subject: 'Giao tiếp', photo: '/images/team/teacher-thao.jpg' },
  { name: 'Cô Trang', subject: 'Viết chuyên nghiệp', photo: '/images/team/teacher-trang.jpg' },
  { name: 'Thầy Khoa', subject: 'Luyện thi TOEIC', photo: '/images/team/teacher-khoa.jpg' },
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

// ── Ảnh theo brief "Check ảnh web" (sheet Ảnh web) — mỗi cụm đặt đúng vị trí
// nội dung mà brief mô tả cho Trang chủ. Tên file khớp thư mục imported/. ──

// Banner giới thiệu khoá TA/TT (brief #1, #2) — brief yêu cầu 2 banner hiển thị
// trong 1 section (slider) thay vì tách 2 section riêng.
const heroBanners = [
  {
    src: '/images/imported/1_Trang-chu_Hero-banner.webp',
    alt: 'Khoá học Tiếng Anh tại Ngoaingu3k',
    to: '/courses#khoa-hoc-ielts',
  },
  {
    src: '/images/imported/2_Trang-chu_Hero-banner.webp',
    alt: 'Khoá học Tiếng Trung tại Ngoaingu3k',
    to: '/courses#khoa-hoc-hsk',
  },
];

// Giới thiệu khoá Tiếng Anh / Tiếng Trung (brief #6, #7).
const trainingPrograms = [
  {
    title: 'Tiếng Anh',
    description: 'IELTS, TOEIC, giao tiếp và tiếng Anh công sở theo lộ trình cá nhân hoá, có giảng viên đồng hành.',
    image: '/images/imported/6_Trang-chu_GT-TA.webp',
    to: '/courses#khoa-hoc-ielts',
  },
  {
    title: 'Tiếng Trung',
    description: 'Luyện thi HSK theo từng cấp độ, xây nền tảng phát âm đến tăng tốc phản xạ giao tiếp.',
    image: '/images/imported/7_Trang-chu_GT-TT.webp',
    to: '/courses#khoa-hoc-hsk',
  },
];

// Giới thiệu sản phẩm độc quyền (brief #4, #5).
const exclusiveProducts = [
  {
    src: '/images/imported/4_Trang-chu_GT-sp.webp',
    alt: 'Học liệu độc quyền của Ngoaingu3k',
  },
  {
    src: '/images/imported/5_Trang-chu_GT-sp.webp',
    alt: 'Bộ khoá học độc quyền của Ngoaingu3k',
  },
];

// Lựa chọn đáng tin cậy (brief #9.1–9.3).
const trustGallery = [
  { src: '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp', alt: 'Học viên tin tưởng lựa chọn Ngoaingu3k' },
  { src: '/images/imported/9.2_Trang-chu_lua-chon-dang-tin-cay.webp', alt: 'Trải nghiệm học tập tại Ngoaingu3k' },
  { src: '/images/imported/9.3_Trang-chu_lua-chon-tin-cay.webp', alt: 'Cộng đồng học viên Ngoaingu3k' },
];

// Hoạt động của trung tâm (brief #8.1–8.4).
const centerActivities = [
  { src: '/images/imported/8.1_Trang-chu_GT-TT.webp', alt: 'Hoạt động tại Ngoaingu3k' },
  { src: '/images/imported/8.2_Trang-chu_GT-TT.webp', alt: 'Giờ học tại Ngoaingu3k' },
  { src: '/images/imported/8.3_Trang-chu_GT-TT.webp', alt: 'Không gian học tập tại Ngoaingu3k' },
  { src: '/images/imported/8.4_Trang-chu_GT-TT.webp', alt: 'Sự kiện tại Ngoaingu3k' },
];

const HERO_BANNER_INTERVAL_MS = 5000;

// Hero trang chủ: slideshow toàn khung 2 banner (TA/TT) tự chuyển, crossfade.
// Mỗi banner bấm được để sang trang khoá học tương ứng.
function HeroBannerSlideshow({ banners }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (banners.length <= 1) return undefined;
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % banners.length);
    }, HERO_BANNER_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [banners.length]);

  return (
    <div className="hero-slideshow">
      {banners.map((banner, i) => (
        <Link
          key={banner.src}
          to={banner.to}
          className={`hero-slideshow__slide ${i === index ? 'is-active' : ''}`}
          aria-hidden={i === index ? undefined : true}
          tabIndex={i === index ? undefined : -1}
        >
          <img src={banner.src} alt={banner.alt} />
        </Link>
      ))}
      <div className="hero-slideshow__dots" role="tablist" aria-label="Chọn banner">
        {banners.map((banner, i) => (
          <button
            key={banner.src}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Xem banner ${i + 1}`}
            className={`hero-slideshow__dot ${i === index ? 'is-active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

const TESTIMONIAL_INTERVAL_MS = 6000;

function TestimonialCarousel({ items }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((current) => (current + 1) % items.length);
    }, TESTIMONIAL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [items.length]);

  const current = items[index];

  return (
    <div className="testimonial-carousel">
      <span className="testimonial-carousel__mark" aria-hidden="true">
        “
      </span>
      <p className="testimonial-carousel__quote">{current.quote}</p>
      <div className="testimonial-carousel__author">
        <strong>{current.name}</strong>
        <span>
          {current.role} · {current.course}
        </span>
      </div>
      <div className="testimonial-carousel__dots" role="tablist" aria-label="Chọn đánh giá học viên">
        {items.map((item, i) => (
          <button
            key={item.name}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={`Xem đánh giá của ${item.name}`}
            className={`testimonial-carousel__dot ${i === index ? 'is-active' : ''}`}
            onClick={() => setIndex(i)}
          />
        ))}
      </div>
    </div>
  );
}

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

  return (
    <>
      <section className="landing-hero landing-hero--banner" aria-label="Khoá học nổi bật">
        <HeroBannerSlideshow banners={heroBanners} />
      </section>

      <div className="page home-page home-page--new">
        <section className="hero-metrics">
          <StatPill value="15k+" label="Học viên ACTIVE" />
          <StatPill value="98%" label="Tỷ lệ hài lòng" accent />
          <StatPill value="24/7" label="Mentor support" />
        </section>

        <section className="about-section">
          <div className="about-section__media">
            <img
              src="/images/imported/3_Trang-chu_GT-chung-toi.webp"
              alt="Giới thiệu về Ngoaingu3k"
              loading="lazy"
            />
          </div>
          <div className="about-section__body">
            <span className="section-eyebrow">Về chúng tôi</span>
            <h2>Trung tâm ngoại ngữ đồng hành cùng bạn trên từng chặng học</h2>
            <p>
              Ngoaingu3k xây dựng lộ trình học cá nhân hoá cho tiếng Anh và tiếng Trung, với giảng viên theo sát,
              học liệu độc quyền và hệ thống theo dõi tiến độ minh bạch — giúp bạn luôn biết mình đang ở đâu và cần
              học gì tiếp theo.
            </p>
            <Link to="/courses" className="course-tile__link">
              Khám phá khoá học →
            </Link>
          </div>
        </section>

        <section className="home-band home-band--alt">
          <div className="home-band__inner">
            <div className="path-section">
              <div className="path-section__media">
                <img src="/images/imported/8.3_Trang-chu_GT-TT.webp" alt="Giờ học tại Ngoaingu3k" loading="lazy" />
              </div>
              <div className="path-section__body">
                <span className="section-eyebrow">Lộ trình học</span>
                <h2>5 nhóm lộ trình, mỗi nhóm một mục tiêu riêng</h2>
                <ol className="path-list">
                  {learningPathSteps.map((step) => (
                    <li key={step.number} className="path-list__item">
                      <Link to="/courses" className="path-list__link">
                        <span className="path-list__number">{step.number}</span>
                        <span className="path-list__copy">
                          <strong>{step.title}</strong>
                          <span>{step.description}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </div>
            </div>
          </div>
        </section>

        <section className="programs-section">
          <div className="programs-section__head">
            <span className="section-eyebrow">Chương trình đào tạo</span>
            <h2>Hai hệ ngoại ngữ, một chuẩn chất lượng</h2>
          </div>
          <div className="programs-grid">
            {trainingPrograms.map((program) => (
              <Link key={program.title} to={program.to} className="program-tile">
                <div className="program-tile__media">
                  <img src={program.image} alt={`Khoá học ${program.title}`} loading="lazy" />
                </div>
                <div className="program-tile__body">
                  <strong>{program.title}</strong>
                  <p>{program.description}</p>
                  <span className="program-tile__cta">Xem khoá học →</span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="home-band home-band--alt">
          <div className="home-band__inner">
            <div className="products-section">
              <div className="products-section__body">
                <span className="section-eyebrow">Sản phẩm độc quyền</span>
                <h2>Học liệu và khoá học chỉ có tại Ngoaingu3k</h2>
                <p>
                  Bộ giáo trình và khoá học được đội ngũ chuyên môn biên soạn riêng, bám sát nhu cầu học viên Việt
                  Nam — không sao chép, cập nhật liên tục theo phản hồi thực tế.
                </p>
              </div>
              <div className="products-section__gallery">
                {exclusiveProducts.map((product) => (
                  <div key={product.src} className="products-section__item">
                    <img src={product.src} alt={product.alt} loading="lazy" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="reasons-section">
          <span className="section-eyebrow">Vì sao chọn Ngoaingu3k</span>
          <div className="reasons-table">
            {reasonColumns.map((reason) => (
              <div key={reason.title} className="reasons-table__col">
                <span className="reasons-table__icon">{reason.icon}</span>
                <h3>{reason.title}</h3>
                <p>{reason.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="trust-section">
          <div className="trust-section__head">
            <span className="section-eyebrow">Lựa chọn đáng tin cậy</span>
            <h2>Được hàng nghìn học viên tin tưởng đồng hành</h2>
          </div>
          <div className="trust-gallery">
            {trustGallery.map((item) => (
              <div key={item.src} className="trust-gallery__item">
                <img src={item.src} alt={item.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="home-band home-band--alt">
          <div className="home-band__inner">
            <div className="story-section">
              <div className="story-section__media">
                <img
                  src="/images/imported/9.2_Trang-chu_lua-chon-dang-tin-cay.webp"
                  alt="Học viên Ngoaingu3k"
                  loading="lazy"
                />
              </div>
              <div className="story-section__quote">
                <span className="story-section__mark" aria-hidden="true">
                  “
                </span>
                <p>Môi trường học tập cực kỳ hiện đại, bài giảng sinh động không gây nhàm chán.</p>
                <div className="story-section__author">
                  <strong>Quốc Trung</strong>
                  <span>Software Engineer</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="activities-section">
          <div className="activities-section__head">
            <span className="section-eyebrow">Hoạt động của trung tâm</span>
            <h2>Không khí học tập và sự kiện tại Ngoaingu3k</h2>
          </div>
          <div className="activities-gallery">
            {centerActivities.map((activity) => (
              <div key={activity.src} className="activities-gallery__item">
                <img src={activity.src} alt={activity.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="teachers-section">
          <span className="section-eyebrow">Đội ngũ giảng viên</span>
          <h2>Mỗi giảng viên phụ trách một nhóm khóa học</h2>
          <div className="teachers-carousel">
            {instructorShowcase.map((teacher) => (
              <article key={teacher.name} className="teacher-chip">
                <span className="teacher-chip__avatar">
                  <img src={teacher.photo} alt={teacher.name} loading="lazy" />
                </span>
                <strong>{teacher.name}</strong>
                <span>{teacher.subject}</span>
              </article>
            ))}
          </div>
        </section>

        <section className="home-band home-band--alt home-band--testimonial">
          <div className="home-band__inner">
            <span className="section-eyebrow">Học viên nói gì</span>
            <TestimonialCarousel items={testimonialCards} />
          </div>
        </section>

        {featuredCourses.length ? (
          <section className="courses-section">
            <div className="courses-section__head">
              <span className="section-eyebrow">Khóa học nổi bật</span>
              <h2>Nhìn phát hiểu ngay có gì để học</h2>
            </div>
            <div className="courses-grid">
              {featuredCourses.slice(0, 3).map((course, index) => (
                <article key={course.id} className="course-tile">
                  <div className="course-tile__media">
                    {course.bannerUrl ? (
                      <img src={course.bannerUrl} alt={course.title} loading="lazy" />
                    ) : (
                      <CoursePlaceholderArt variant={index} title={course.title} />
                    )}
                  </div>
                  <div className="course-tile__body">
                    <strong>{course.title}</strong>
                    <p>{getCourseSummary(course)}</p>
                    <Link to={`/courses/${course.id}`} className="course-tile__link">
                      Xem chi tiết →
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        <section className="home-band home-band--cta">
          <div className="home-band__inner home-band__inner--cta">
            <h2>Sẵn sàng bắt đầu lộ trình học của riêng bạn?</h2>
            <Link to="/courses" className="cta-band__button">
              Khám phá khóa học
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
