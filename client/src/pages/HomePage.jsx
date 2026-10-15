import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedCourses } from '../lib/courseService';
import { handleRemoteImageError, supabaseImageSrcSet, supabaseImageUrl } from '../lib/imageCdn';
import { usePageTitle } from '../hooks/usePageTitle';
import { OPEN_CONSULTATION_EVENT } from '../components/ConsultationFab';
import { CountUp } from '../components/home/CountUp';
import { HeroQuizDemo } from '../components/home/HeroQuizDemo';
import { Mascot } from '../components/home/Mascot';
import { PathTimeline, ProgressDashboard, SpeakingDemo } from '../components/home/FeatureIllustrations';
import { ProgramTabs } from '../components/home/ProgramTabs';
import { TestimonialMarquee } from '../components/home/TestimonialMarquee';
import { Reveal, useInView } from '../components/home/useInView';
import { homePrograms } from '../data/homePrograms';
import { testimonials } from '../data/testimonials';

// Trang chủ (bản 10/2026): bố cục sáng, nhiều minh hoạ tương tác. Style nằm
// trong styles/pages/home-v2.css, mọi màu/bo góc/font lấy từ token --hv-*
// khai báo một chỗ ở đầu file đó.

function openConsultation() {
  window.dispatchEvent(new Event(OPEN_CONSULTATION_EVENT));
}

// Khi khóa học chưa có bannerUrl (dữ liệu thật từ backend), dùng ảnh thật từ
// thư viện ảnh của trung tâm thay vì để trống — luân phiên 3 ảnh khác nhau
// theo vị trí thẻ để cả 3 card không lặp lại cùng 1 ảnh.
const coursePlaceholderPhotos = [
  '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp',
  '/images/imported/9.3_Trang-chu_lua-chon-tin-cay.webp',
  '/images/imported/8.2_Trang-chu_GT-TT.webp',
];

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

const statIcons = {
  learners: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19c.8-3.4 3-5 5.5-5s4.7 1.6 5.5 5" />
      <circle cx="17" cy="9" r="2.4" />
      <path d="M15.5 14.2c2.4.2 4.2 1.7 5 4.8" />
    </svg>
  ),
  satisfaction: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M8.5 14c.9 1.3 2.1 2 3.5 2s2.6-.7 3.5-2" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </svg>
  ),
  support: (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4.5 13v-1a7.5 7.5 0 0 1 15 0v1" />
      <rect x="3.5" y="13" width="4" height="6" rx="1.6" />
      <rect x="16.5" y="13" width="4" height="6" rx="1.6" />
    </svg>
  ),
};

const stats = [
  { value: '15.000+', label: 'học viên', icon: 'learners' },
  { value: '98,2%', label: 'hài lòng', icon: 'satisfaction' },
  { value: '24/7', label: 'hỗ trợ', icon: 'support' },
];

// 5 nhóm lộ trình — minh hoạ timeline của section "Lộ trình cá nhân hoá".
const learningPathSteps = [
  { title: 'Kỹ năng cốt lõi', short: 'Nghe – nói – ngữ pháp · 6 tuần' },
  { title: 'Công sở', short: 'Email, thuyết trình, cuộc họp' },
  { title: 'Luyện thi', short: 'Đề bấm giờ 4 kỹ năng' },
  { title: 'Giao tiếp', short: 'Phản xạ, phản hồi mỗi tuần' },
  { title: 'Viết chuyên nghiệp', short: 'Email, báo cáo chuẩn doanh nghiệp' },
];

const features = [
  {
    id: 'lo-trinh',
    eyebrow: 'Lộ trình học',
    title: 'Lộ trình cá nhân hóa',
    paragraphs: [
      'Chương trình học được thiết kế theo trình độ, mục tiêu và tiến độ của từng học viên, bảo đảm định hướng học tập rõ ràng trong suốt quá trình.',
      '5 nhóm lộ trình với mục tiêu riêng biệt: Kỹ năng cốt lõi, Công sở, Luyện thi, Giao tiếp và Viết chuyên nghiệp — bạn luôn biết mình đang ở đâu và cần học gì tiếp theo.',
    ],
    tone: 'peach',
    Illustration: ({ active }) => <PathTimeline steps={learningPathSteps} active={active} />,
  },
  {
    id: 'giao-tiep',
    eyebrow: 'Mentor đồng hành 24/7',
    title: 'Luyện phát âm và giao tiếp mỗi ngày',
    paragraphs: [
      'Mentor theo dõi quá trình học, đánh giá kết quả và đưa ra phản hồi kịp thời.',
      'Luyện phản xạ qua tình huống giao tiếp hằng ngày, nhận phản hồi trực tiếp mỗi tuần — sửa đúng lỗi phát âm bạn hay mắc thay vì nhận xét chung chung.',
    ],
    tone: 'mint',
    Illustration: ({ active }) => <SpeakingDemo active={active} />,
  },
  {
    id: 'tien-do',
    eyebrow: 'Minh bạch',
    title: 'Theo dõi tiến độ minh bạch',
    paragraphs: [
      'Tiến độ học tập được cập nhật liên tục với hệ thống đánh giá rõ ràng, giúp giảng viên và học viên dễ dàng theo dõi và điều chỉnh lộ trình.',
      'Mỗi bài tập, mỗi bài kiểm tra đều được ghi lại thành biểu đồ — nhìn một lần là thấy mình tiến bộ bao nhiêu.',
    ],
    tone: 'warm',
    Illustration: ({ active }) => <ProgressDashboard active={active} />,
  },
];

// Giới thiệu sản phẩm độc quyền.
const exclusiveProducts = [
  { src: '/images/imported/4_Trang-chu_GT-sp.webp', alt: 'Tài liệu độc quyền của Ngoaingu3k' },
  { src: '/images/imported/5_Trang-chu_GT-sp.webp', alt: 'Bộ khoá học độc quyền của Ngoaingu3k' },
];

// Hoạt động của trung tâm + lựa chọn đáng tin cậy (gộp thành 1 lưới ảnh).
const centerActivities = [
  { src: '/images/imported/8.1_Trang-chu_GT-TT.webp', alt: 'Hoạt động tại Ngoaingu3k' },
  { src: '/images/imported/8.2_Trang-chu_GT-TT.webp', alt: 'Giờ học tại Ngoaingu3k' },
  { src: '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp', alt: 'Học viên tin tưởng lựa chọn Ngoaingu3k' },
  { src: '/images/imported/8.3_Trang-chu_GT-TT.webp', alt: 'Không gian học tập tại Ngoaingu3k' },
  { src: '/images/imported/9.2_Trang-chu_lua-chon-dang-tin-cay.webp', alt: 'Trải nghiệm học tập tại Ngoaingu3k' },
  { src: '/images/imported/8.4_Trang-chu_GT-TT.webp', alt: 'Sự kiện tại Ngoaingu3k' },
  { src: '/images/imported/9.3_Trang-chu_lua-chon-tin-cay.webp', alt: 'Cộng đồng học viên Ngoaingu3k' },
];

function StatsStrip() {
  // Một observer cho cả dải → 3 thẻ hiện và đếm CÙNG LÚC (trước đây mỗi thẻ
  // tự quan sát nên thẻ 2–3 có lúc vẫn trống khi thẻ 1 đã hiện).
  const [ref, inView] = useInView();
  return (
    <section className={`hv-stats hv-stagger hv-reveal ${inView ? 'is-in' : ''}`} ref={ref} aria-label="Số liệu nổi bật">
      {stats.map((stat, i) => (
        <article key={stat.label} className="hv-stat" style={{ '--hv-delay': `${i * 80}ms` }}>
          <span className="hv-stat__icon">{statIcons[stat.icon]}</span>
          <CountUp value={stat.value} start={inView} className="hv-stat__value" />
          <span className="hv-stat__label">{stat.label}</span>
        </article>
      ))}
    </section>
  );
}

function FeatureRow({ feature, index }) {
  const [ref, inView] = useInView();
  const { Illustration } = feature;
  const reverse = index % 2 === 1;
  return (
    <section className={`hv-feature ${reverse ? 'hv-feature--reverse' : ''}`} aria-labelledby={`hv-f-${feature.id}`}>
      <div className="hv-feature__copy">
        <span className="hv-eyebrow">{feature.eyebrow}</span>
        <h2 id={`hv-f-${feature.id}`}>{feature.title}</h2>
        {feature.paragraphs.map((text) => (
          <p key={text}>{text}</p>
        ))}
        {index === 0 ? (
          <Link to="/courses" className="hv-link">
            Khám phá khoá học <span aria-hidden="true">→</span>
          </Link>
        ) : null}
      </div>
      <div ref={ref} className={`hv-panel hv-panel--${feature.tone} hv-reveal ${inView ? 'is-in' : ''}`}>
        <Illustration active={inView} />
        {index === 0 ? <Mascot className="hv-panel__mascot" /> : null}
      </div>
    </section>
  );
}

export default function HomePage() {
  const pageRef = useRef(null);
  usePageTitle('Trang chủ');
  const [featuredCourses, setFeaturedCourses] = useState([]);

  // Chỉ ẩn các khối .hv-reveal khi JS đã chạy — thiếu JS thì trang hiện đủ.
  useLayoutEffect(() => {
    pageRef.current?.classList.add('hv--motion');
  }, []);

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
    <div ref={pageRef} className="hv">
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section id="home-hero" className="hv-hero" aria-labelledby="hv-hero-title">
        <div className="hv-hero__inner">
          <span className="hv-hero__kicker">Tiếng Anh · Tiếng Trung</span>
          <h1 id="hv-hero-title">
            Học ngoại ngữ <em>dễ dàng</em>, hiệu quả
          </h1>
          <div className="hv-hero__demo">
            <HeroQuizDemo />
            <Mascot className="hv-hero__mascot" mood="wow" />
          </div>
          <p className="hv-hero__lead">
            Lộ trình cá nhân hoá, giảng viên đồng hành và tiến độ minh bạch từ buổi đầu.
          </p>
          <div className="hv-hero__actions">
            <Link to="/test" className="hv-btn hv-btn--primary hv-btn--block">
              Kiểm tra trình độ miễn phí
            </Link>
            <button type="button" className="hv-btn hv-btn--light hv-btn--block" onClick={openConsultation}>
              Tôi là phụ huynh / doanh nghiệp
            </button>
          </div>
        </div>
      </section>

      <div className="hv-container">
        <StatsStrip />

        {/* ── Về chúng tôi ─────────────────────────────────────────────── */}
        <section className="hv-feature hv-feature--reverse hv-about" aria-labelledby="hv-about-title">
          <div className="hv-feature__copy">
            <span className="hv-eyebrow">Về chúng tôi</span>
            <h2 id="hv-about-title">Trung tâm ngoại ngữ đồng hành cùng bạn trên từng chặng học</h2>
            <p>
              Ngoaingu3k xây dựng lộ trình học cá nhân hoá cho tiếng Anh và tiếng Trung, với giảng viên theo sát, học
              liệu độc quyền và hệ thống theo dõi tiến độ minh bạch — giúp bạn luôn biết mình đang ở đâu và cần học gì
              tiếp theo.
            </p>
          </div>
          <Reveal className="hv-panel hv-panel--sky hv-panel--photo">
            <img
              src="/images/imported/3_Trang-chu_GT-chung-toi.webp"
              alt="Giới thiệu về Ngoaingu3k"
              width="640"
              height="640"
              loading="lazy"
              decoding="async"
            />
          </Reveal>
        </section>

        {/* ── Vì sao chọn: 3 section tính năng xen kẽ ─────────────────── */}
        <div className="hv-why">
          <Reveal as="p" className="hv-section-kicker">
            Vì sao chọn Ngoaingu3k
          </Reveal>
          {features.map((feature, index) => (
            <FeatureRow key={feature.id} feature={feature} index={index} />
          ))}
        </div>

        {/* ── Tab chương trình ─────────────────────────────────────────── */}
        <Reveal as="section" className="hv-programs" aria-labelledby="hv-programs-title">
          <span className="hv-eyebrow hv-eyebrow--center">Chương trình đào tạo</span>
          <h2 id="hv-programs-title" className="hv-display-title">
            Từ mất gốc đến IELTS / HSK
          </h2>
          <p className="hv-programs__lead">Hai hệ ngoại ngữ, một chuẩn chất lượng.</p>
          <ProgramTabs programs={homePrograms} />
        </Reveal>

        {/* ── Sản phẩm độc quyền ───────────────────────────────────────── */}
        <section className="hv-feature hv-feature--reverse hv-products" aria-labelledby="hv-products-title">
          <div className="hv-feature__copy">
            <span className="hv-eyebrow">Sản phẩm độc quyền</span>
            <h2 id="hv-products-title">Tài liệu và khoá học chỉ có tại Ngoaingu3k</h2>
            <p>
              Bộ giáo trình và khoá học được đội ngũ chuyên môn biên soạn riêng, bám sát nhu cầu học viên Việt Nam —
              không sao chép, cập nhật liên tục theo phản hồi thực tế.
            </p>
          </div>
          <Reveal className="hv-panel hv-panel--mint hv-products__gallery">
            {exclusiveProducts.map((product) => (
              <img key={product.src} src={product.src} alt={product.alt} width="981" height="552" loading="lazy" decoding="async" />
            ))}
          </Reveal>
        </section>
      </div>

      {/* ── Cảm nhận học viên ──────────────────────────────────────────── */}
      <section className="hv-testimonials" aria-labelledby="hv-testimonials-title">
        <Reveal className="hv-container hv-section-head">
          <span className="hv-eyebrow hv-eyebrow--center">Học viên nói gì</span>
          <h2 id="hv-testimonials-title" className="hv-display-title">
            Được hàng nghìn học viên tin tưởng đồng hành
          </h2>
        </Reveal>
        <TestimonialMarquee items={testimonials} />
      </section>

      <div className="hv-container">
        {/* ── Hoạt động trung tâm ──────────────────────────────────────── */}
        <section className="hv-activities" aria-labelledby="hv-activities-title">
          <Reveal className="hv-section-head">
            <span className="hv-eyebrow hv-eyebrow--center">Hoạt động của trung tâm</span>
            <h2 id="hv-activities-title" className="hv-display-title">
              Không khí học tập và sự kiện tại Ngoaingu3k
            </h2>
          </Reveal>
          <Reveal className="hv-gallery hv-stagger">
            {centerActivities.map((activity, i) => (
              <figure key={activity.src} className="hv-gallery__item" style={{ '--hv-delay': `${i * 60}ms` }}>
                <img src={activity.src} alt="" width="600" height="420" loading="lazy" decoding="async" />
                <figcaption>{activity.alt}</figcaption>
              </figure>
            ))}
          </Reveal>
        </section>

        {/* ── Khoá học nổi bật (dữ liệu thật từ server) ───────────────── */}
        {featuredCourses.length ? (
          <section className="hv-courses" aria-labelledby="hv-courses-title">
            <div className="hv-courses__head">
              <h2 id="hv-courses-title">Khóa học nổi bật</h2>
              <Link to="/courses" className="hv-link">
                Xem tất cả khóa học <span aria-hidden="true">→</span>
              </Link>
            </div>
            <Reveal className="hv-courses__grid hv-stagger">
              {featuredCourses.slice(0, 3).map((course, index) => (
                <article key={course.id} className="hv-course" style={{ '--hv-delay': `${index * 80}ms` }}>
                  <div className="hv-course__media">
                    {course.bannerUrl ? (
                      <img
                        src={supabaseImageUrl(course.bannerUrl, { width: 800 })}
                        srcSet={supabaseImageSrcSet(course.bannerUrl)}
                        sizes="(max-width: 700px) 100vw, 380px"
                        onError={handleRemoteImageError(course.bannerUrl)}
                        alt={course.title}
                        width="800"
                        height="450"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <img
                        src={coursePlaceholderPhotos[index % coursePlaceholderPhotos.length]}
                        alt={course.title}
                        width="800"
                        height="450"
                        loading="lazy"
                        decoding="async"
                      />
                    )}
                  </div>
                  <div className="hv-course__body">
                    <h3>{course.title}</h3>
                    <p>{getCourseSummary(course)}</p>
                    <Link to={`/courses/${course.id}`} className="hv-link">
                      Xem chi tiết <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </article>
              ))}
            </Reveal>
          </section>
        ) : null}

        {/* ── CTA cuối trang ───────────────────────────────────────────── */}
        <Reveal as="section" className="hv-cta" aria-labelledby="hv-cta-title">
          <span className="hv-cta__shape hv-cta__shape--1" aria-hidden="true" />
          <span className="hv-cta__shape hv-cta__shape--2" aria-hidden="true" />
          <span className="hv-cta__shape hv-cta__shape--3" aria-hidden="true" />
          <span className="hv-cta__shape hv-cta__shape--4" aria-hidden="true" />
          <h2 id="hv-cta-title">Sẵn sàng bắt đầu lộ trình học của riêng bạn?</h2>
          <p>Nhận lộ trình phù hợp trình độ trong 24h — hoàn toàn miễn phí.</p>
          <div className="hv-cta__actions">
            <Link to="/courses" className="hv-btn hv-btn--primary">
              Bắt đầu học miễn phí
            </Link>
            {/* Mở đúng form tư vấn của nút nổi "Tư vấn". */}
            <button type="button" className="hv-btn hv-btn--outline-light" onClick={openConsultation}>
              Nhận tư vấn
            </button>
          </div>
        </Reveal>
      </div>
    </div>
  );
}
