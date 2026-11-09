import { Header } from "@/components/Header";
import { Star } from "@/components/Star";
import { Discovery } from "@/components/Discovery";
import { HeroIllustration } from "@/components/HeroIllustration";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <section className="hero">
          <div className="wrap hero-grid">
            <div className="hero-copy">
              <h1>
                Gia sư <em>hợp gu.</em>
                <br />
                Việc học vào guồng.
              </h1>
              <p>
                Nhờ TutorMatch tìm gia sư học 1–1 theo môn, lớp và lịch của bạn.
                Phụ huynh gửi nhu cầu, chúng mình liên hệ trong 1 ngày làm việc.
              </p>
              <form className="hero-search" action="/#tim-gia-su" method="get">
                <input name="query" type="search" maxLength={100} aria-label="Tìm gia sư theo tên hoặc môn học" placeholder="Bạn muốn học môn gì? Ví dụ: Toán, IELTS…" />
                <button className="button" type="submit">Tìm ngay <span aria-hidden="true">→</span></button>
              </form>
              <div className="hero-actions">
                <a className="button hero-cta" href="#gui-yeu-cau">
                  Nhờ tìm gia sư <span aria-hidden>↗</span>
                </a>
                <a className="button hero-link" href="#tim-gia-su">
                  Tự khám phá gia sư <span aria-hidden>↓</span>
                </a>
              </div>
              <div className="hero-note">
                <span className="note-dot" /> Học thử miễn phí sau khi chọn được
                gia sư
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="hero-star">
                <HeroIllustration />
              </div>
            </div>
          </div>
          <div className="wrap hero-benefits" aria-label="Điểm nổi bật của TutorMatch">
            <div><span aria-hidden="true">✦</span><strong>1–1 theo nhu cầu</strong><small>Đúng môn, đúng lịch, đúng bạn</small></div>
            <div><span aria-hidden="true">▦</span><strong>Linh hoạt thời gian</strong><small>Chọn khung giờ phù hợp</small></div>
            <div><span aria-hidden="true">♡</span><strong>Học thử miễn phí</strong><small>Chọn gia sư rồi học thử</small></div>
          </div>
        </section>
        <Discovery />
        <section id="cach-hoat-dong" className="how-section">
          <div className="wrap">
            <div className="section-heading">
              <div>
                <h2>Từ “mình cần giúp” đến buổi học đầu tiên.</h2>
              </div>
            </div>
            <div className="steps">
              <div>
                <span>01</span>
                <h3>Gửi nhu cầu</h3>
                <p>
                  Phụ huynh cho biết môn, lớp và thời gian học mong muốn.
                </p>
              </div>
              <div>
                <span>02</span>
                <h3>Nhận tư vấn</h3>
                <p>
                  TutorMatch liên hệ trong 1 ngày làm việc để tìm gia sư phù hợp.
                </p>
              </div>
              <div>
                <span>03</span>
                <h3>Đề xuất học thử</h3>
                <p>
                  Khi chọn được gia sư, phụ huynh đề xuất giờ học thử để gia sư xác nhận.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
      <footer className="footer">
        <div className="wrap footer-inner">
          <div className="brand">
            <Star size={32} />
            <span>
              Tutor<span className="brand-accent">Match</span>
            </span>
          </div>
          <p>Học đúng người, vui đúng nhịp. ✦</p>
        </div>
      </footer>
    </>
  );
}
