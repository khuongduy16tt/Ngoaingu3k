import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { featuredCourses as mockCourses } from '../data/mock';
import { getFeaturedCourses } from '../lib/courseService';

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

function PhotoCard({ src, title, subtitle, className = '' }) {
  return (
    <article className={`photo-card ${className}`.trim()}>
      <img src={src} alt={title} loading="lazy" />
      <div className="photo-card__copy">
        <span>{subtitle}</span>
        <strong>{title}</strong>
      </div>
    </article>
  );
}

export default function HomePage() {
  const [featuredCourses, setFeaturedCourses] = useState(mockCourses);

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

  const trustCards = [
    {
      title: 'Minh Anh',
      subtitle: 'IELTS 8.5 Highlight',
      image: '/images/imported/8.2_Trang-chu_GT-TT.webp',
      copy: 'Hành trình từ con số 0 đến học bổng toàn phần nhờ Ngoaingu3k.',
    },
    {
      title: 'Quốc Trung',
      subtitle: 'Software Engineer',
      image: '/images/imported/9.1_Trang-chu_lua-chon-tin-cay.webp',
      copy: 'Môi trường học tập cực kỳ hiện đại, bài giảng sinh động và bám sát mục tiêu.',
    },
  ];

  return (
    <div className="page home-page home-page--new">
      <section className="hero hero--new hero--campaign">
        <img className="hero__cover" src="/images/imported/hsk-cover.png" alt="Khóa luyện thi tiếng Trung HSK 1-5" />
        <div className="hero__veil" aria-hidden="true" />
        <div className="hero__copy">
          <h1>
            Khóa luyện thi
            <br />
            <em>tiếng Trung HSK 1-5</em>
            <br />
            theo lộ trình cá nhân.
          </h1>
          <p>
            Một không gian học có định hướng rõ ràng: đánh giá đầu vào, giáo trình chuẩn HSK,
            giảng viên theo sát và lộ trình luyện thi được cá nhân hóa cho từng mục tiêu.
          </p>

          <div className="hero__actions">
            <Link to="/courses" className="button">
              Xem khóa HSK
            </Link>
            <Link to="/learn" className="button button-ghost">
              Kiểm tra trình độ
            </Link>
          </div>

          <div className="hero__search">
            <span className="hero__search-icon">⌕</span>
            <input type="text" placeholder="Tìm HSK 1, HSK 3, giao tiếp, luyện đề..." aria-label="Search courses" />
            <button type="button">Tìm</button>
          </div>
        </div>

        <div className="hero__campaign-panel" aria-label="Course highlights">
          <span>HSK 1-5</span>
          <span>Lộ trình cá nhân hóa</span>
          <span>Giáo trình chuẩn HSK</span>
          <span>Giảng viên kinh nghiệm</span>
        </div>
      </section>

      <section className="hero-metrics">
        <StatPill value="15k+" label="Học viên ACTIVE" />
        <StatPill value="98%" label="Tỷ lệ hài lòng" accent />
        <StatPill value="24/7" label="Mentor support" />
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
          src="/images/imported/9.3_Trang-chu_lua-chon-tin-cay.webp"
          title="Mở khóa tương lai"
          subtitle="Bắt đầu ngay"
        />
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
          <PhotoCard src="/images/imported/11.4_KH-TA-scaled.webp" title="Lớp học" subtitle="English training" />
          <PhotoCard src="/images/imported/12.4_KH-TT-scaled.webp" title="Lộ trình" subtitle="Chinese training" />
          <PhotoCard src="/images/imported/10_Trang-chu_footer.png" title="CTA banner" subtitle="Free test now" />
        </div>
      </section>

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
    </div>
  );
}
