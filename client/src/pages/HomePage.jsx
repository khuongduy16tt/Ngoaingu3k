import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { getFeaturedCourses } from '../lib/courseService';
import { handleRemoteImageError, supabaseImageSrcSet, supabaseImageUrl } from '../lib/imageCdn';
import { usePageTitle } from '../hooks/usePageTitle';
import { prefersReducedMotion } from '../lib/scrollMotion';
import { getInitials } from '../lib/avatar';
import { OPEN_CONSULTATION_EVENT } from '../components/ConsultationFab';

// Các khối có data-reveal hiện dần (mờ → rõ, trượt nhẹ lên) khi cuộn tới.
// Chỉ ẩn khối khi JS đã gắn được IntersectionObserver và người dùng không bật
// giảm chuyển động — thiếu một trong hai thì trang hiện đầy đủ như cũ.
// refreshKey: khối dựng muộn (khóa học nổi bật tải từ server) cần được quét lại.
function useRevealOnScroll(rootRef, refreshKey) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    const targets = [...root.querySelectorAll('[data-reveal]:not(.is-revealed)')];
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-revealed');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -8% 0px' }
    );
    root.classList.add('home-page--reveal');
    targets.forEach((target) => observer.observe(target));

    return () => {
      observer.disconnect();
      root.classList.remove('home-page--reveal');
    };
  }, [rootRef, refreshKey]);
}

// "15.000+" → { target: 15000, decimals: 0, suffix: '+' }; "24/7" không phải số.
function parseStatValue(value) {
  const match = /^([\d.,]+)(\D*)$/.exec(String(value).trim());
  if (!match) return null;
  const raw = match[1];
  // Kiểu Việt: dấu chấm ngăn nghìn ("15.000"); một chữ số sau dấu chấm là thập phân ("98.2").
  const isDecimal = /^\d+\.\d{1,2}$/.test(raw);
  const target = Number(isDecimal ? raw : raw.replace(/[.,]/g, ''));
  if (!Number.isFinite(target)) return null;
  return { target, decimals: isDecimal ? raw.split('.')[1].length : 0, suffix: match[2] };
}

function formatStatValue(number, decimals) {
  return decimals
    ? number.toFixed(decimals)
    : Math.round(number).toLocaleString('vi-VN');
}

// Số liệu đếm từ 0 lên giá trị thật khi thẻ lọt vào màn hình. Trình đọc màn
// hình chỉ nghe giá trị cuối (bản ẩn), không nghe từng nhịp đếm.
function CountUpValue({ value }) {
  const ref = useRef(null);
  const parsed = parseStatValue(value);
  const [display, setDisplay] = useState(value);

  useLayoutEffect(() => {
    if (!parsed || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    let frame = 0;
    setDisplay(formatStatValue(0, parsed.decimals) + parsed.suffix);
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      const start = performance.now();
      const duration = 1400;
      const tick = (now) => {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        setDisplay(
          progress < 1 ? formatStatValue(parsed.target * eased, parsed.decimals) + parsed.suffix : value
        );
        if (progress < 1) frame = requestAnimationFrame(tick);
      };
      frame = requestAnimationFrame(tick);
    });
    if (ref.current) observer.observe(ref.current);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
    // value là hằng số của từng thẻ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <strong ref={ref}>
      <span aria-hidden="true">{display}</span>
      <span className="home-visually-hidden">{value}</span>
    </strong>
  );
}

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

function StatPill({ value, label, icon, accent = false }) {
  return (
    <article className={`home-stat ${accent ? 'home-stat--accent' : ''}`}>
      {icon ? <span className="home-stat__icon">{statIcons[icon]}</span> : null}
      <CountUpValue value={value} />
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
    description:
      'Chương trình học được thiết kế theo trình độ, mục tiêu và tiến độ của từng học viên, bảo đảm định hướng học tập rõ ràng trong suốt quá trình.',
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
    title: 'Mentor đồng hành 24/7',
    description: 'Mentor theo dõi quá trình học, đánh giá kết quả và đưa ra phản hồi kịp thời.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="8" r="3.4" />
        <path d="M5.5 20c1-3.8 3.7-5.5 6.5-5.5s5.5 1.7 6.5 5.5" />
      </svg>
    ),
  },
  {
    title: 'Theo dõi tiến độ minh bạch',
    description:
      'Tiến độ học tập được cập nhật liên tục với hệ thống đánh giá rõ ràng, giúp giảng viên và học viên dễ dàng theo dõi và điều chỉnh lộ trình.',
    icon: (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 20V9M11 20V4M18 20v-6" />
        <path d="M3 20h18" />
      </svg>
    ),
  },
];

const testimonialCards = [
  {
    name: 'Thu Hà',
    role: 'Nhân viên văn phòng, công ty xuất nhập khẩu',
    course: 'Viết email và báo cáo công sở',
    quote:
      'Khóa Viết email và báo cáo công sở giúp mình tự tin gửi email cho sếp nước ngoài mà không phải nhờ ai xem lại nữa.',
  },
  {
    name: 'Anh Duy',
    role: 'Sinh viên năm 3, ĐH Ngoại thương',
    course: 'Tự tin giao tiếp và thuyết trình',
    quote: 'Học xong khóa giao tiếp mình dám bắt chuyện với người nước ngoài, không còn run như trước.',
  },
  {
    name: 'Bảo Ngọc',
    role: 'Chuyên viên nhân sự, doanh nghiệp FDI',
    course: 'Giao tiếp doanh nghiệp',
    quote: 'Lộ trình rõ ràng theo từng tuần, bài tập vừa sức nên mình duy trì học đều đặn suốt khóa.',
  },
  {
    name: 'Hữu Phát',
    role: 'Kỹ sư phần mềm, chuẩn bị đi công tác nước ngoài',
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
    src: '/images/imported/hero-banner-tieng-anh.webp',
    mobileSrc: '/images/imported/hero-banner-tieng-anh-mobile.webp',
    alt: 'Học tiếng Anh dễ dàng, hiệu quả cùng Ngoại ngữ 3K',
    to: '/courses#khoa-hoc-ielts',
  },
  {
    src: '/images/imported/hero-banner-tieng-trung.webp',
    mobileSrc: '/images/imported/hero-banner-tieng-trung-mobile.webp',
    alt: 'Học tiếng Trung dễ dàng, hiệu quả cùng Ngoại ngữ 3K',
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
    alt: 'Tài liệu độc quyền của Ngoaingu3k',
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
          {/* Slide đầu là phần tử LCP của trang chủ nên phải nạp sớm nhất có
              thể; slide sau chỉ hiện sau 5s nên để trình duyệt tự xếp lịch
              thay vì tranh băng thông với slide đang hiển thị. */}
          {/* Điện thoại nhận bản cắt sẵn nửa trái (828×633, ~75KB) thay vì
              ảnh gốc 1903px ~200KB rồi CSS cắt bớt — xem mobile.css §7.8. */}
          <picture>
            <source media="(max-width: 767px)" srcSet={banner.mobileSrc} />
            <img
              src={banner.src}
              alt={banner.alt}
              fetchpriority={i === 0 ? 'high' : 'low'}
              decoding="async"
            />
          </picture>
        </Link>
      ))}
      {/* Nút thật đè khít lên nút "Bắt đầu học ngay" in sẵn trong ảnh banner
          (chỉ hiện trên PC ≥1024px — xem .hero-slideshow__cta). Dẫn tới đúng
          nhóm khoá của banner đang hiển thị. */}
      <Link to={banners[index].to} className="hero-slideshow__cta">
        <span className="hero-slideshow__cta-label">Bắt đầu học ngay</span>
        <span className="hero-slideshow__cta-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="m9.5 6 6 6-6 6" />
          </svg>
        </span>
      </Link>
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
      {/* key đổi theo đánh giá → khối được dựng lại và chạy hiệu ứng hiện dần. */}
      <div key={current.name} className="testimonial-carousel__slide">
        <p className="testimonial-carousel__quote">{current.quote}</p>
        <div className="testimonial-carousel__author">
          <span className="testimonial-carousel__avatar" aria-hidden="true">
            {getInitials(current.name)}
          </span>
          <span className="testimonial-carousel__who">
            <strong>{current.name}</strong>
            <span>
              {current.role} · {current.course}
            </span>
          </span>
        </div>
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
  const pageRef = useRef(null);
  usePageTitle('Trang chủ');
  const [featuredCourses, setFeaturedCourses] = useState([]);
  useRevealOnScroll(pageRef, featuredCourses.length);

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

      {/* Chỉ hiện ≤767px: banner là ảnh ngang có chữ in sẵn, thu về bề ngang
          điện thoại thì chữ trong ảnh chỉ còn ~6px, không đọc được. Khối này
          nói lại thông điệp chính và đưa nút hành động lên ngay màn đầu. */}
      <section className="hero-mobile-intro" aria-label="Giới thiệu Ngoaingu3k">
        <span className="section-eyebrow">Tiếng Anh · Tiếng Trung</span>
        <h1>Học ngoại ngữ dễ dàng, hiệu quả</h1>
        <p>Lộ trình cá nhân hoá, giảng viên đồng hành và tiến độ minh bạch từ buổi đầu.</p>
        <div className="hero-mobile-intro__actions">
          <Link to="/courses" className="button">
            Xem khóa học
          </Link>
          <Link to="/test" className="button-ghost">
            Test trình độ miễn phí
          </Link>
        </div>
      </section>

      <div ref={pageRef} className="page home-page home-page--new">
        <section className="hero-metrics" data-reveal="stagger">
          <StatPill value="15.000+" label="Số lượng học viên" icon="learners" />
          <StatPill value="98.2%" label="Tỷ lệ hài lòng" icon="satisfaction" accent />
          <StatPill value="24/7" label="Hỗ trợ" icon="support" />
        </section>

        <section className="about-section" data-reveal>
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
            <div className="path-section" data-reveal>
              <div className="path-section__media">
                <img src="/images/imported/8.3_Trang-chu_GT-TT.webp" alt="Giờ học tại Ngoaingu3k" loading="lazy" />
              </div>
              <div className="path-section__body">
                <span className="section-eyebrow section-eyebrow--lg">Lộ trình học</span>
                <h2>5 nhóm lộ trình với mục tiêu riêng biệt</h2>
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
          <div className="programs-grid" data-reveal="stagger">
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
            <div className="products-section" data-reveal>
              <div className="products-section__body">
                <span className="section-eyebrow">Sản phẩm độc quyền</span>
                <h2>Tài liệu và khoá học chỉ có tại Ngoaingu3k</h2>
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
          <div className="reasons-table" data-reveal="stagger">
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
          <div className="trust-gallery" data-reveal="stagger">
            {trustGallery.map((item) => (
              <div key={item.src} className="trust-gallery__item">
                <img src={item.src} alt={item.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="home-band home-band--alt">
          <div className="home-band__inner">
            <div className="story-section" data-reveal>
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
                  <span>Kỹ sư phần mềm, công ty công nghệ</span>
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
          <div className="activities-gallery" data-reveal="stagger">
            {centerActivities.map((activity) => (
              <div key={activity.src} className="activities-gallery__item">
                <img src={activity.src} alt={activity.alt} loading="lazy" />
              </div>
            ))}
          </div>
        </section>

        <section className="home-band home-band--alt home-band--testimonial">
          <div className="home-band__inner">
            <span className="section-eyebrow">Học viên nói gì</span>
            <div className="home-reveal-block" data-reveal>
              <TestimonialCarousel items={testimonialCards} />
            </div>
          </div>
        </section>

        {featuredCourses.length ? (
          <section className="courses-section">
            <div className="courses-section__head">
              <span className="section-eyebrow">Khóa học nổi bật</span>
              <Link to="/courses" className="courses-section__all">
                Xem tất cả khóa học →
              </Link>
            </div>
            <div className="courses-grid" data-reveal="stagger">
              {featuredCourses.slice(0, 3).map((course, index) => (
                <article key={course.id} className="course-tile">
                  <div className="course-tile__media">
                    {course.bannerUrl ? (
                      <img
                        src={supabaseImageUrl(course.bannerUrl, { width: 800 })}
                        srcSet={supabaseImageSrcSet(course.bannerUrl)}
                        sizes="(max-width: 700px) 100vw, 380px"
                        onError={handleRemoteImageError(course.bannerUrl)}
                        alt={course.title}
                        loading="lazy"
                        decoding="async"
                      />
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
            <p className="cta-band__lead">Nhận lộ trình phù hợp trình độ trong 24h — hoàn toàn miễn phí.</p>
            <div className="cta-band__actions">
              <Link to="/courses" className="cta-band__button">
                Khám phá khóa học
              </Link>
              {/* Mở đúng form tư vấn của nút nổi "Tư vấn" — không dẫn sang trang
                  /test vì trang đó chưa có bài test. */}
              <button
                type="button"
                className="cta-band__button cta-band__button--ghost"
                onClick={() => window.dispatchEvent(new Event(OPEN_CONSULTATION_EVENT))}
              >
                Nhận tư vấn miễn phí
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
