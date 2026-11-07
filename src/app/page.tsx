import { Header } from "@/components/Header";
import { Star } from "@/components/Star";
import { Discovery } from "@/components/Discovery";

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
              <div className="hero-actions">
                <a className="button hero-cta" href="#gui-yeu-cau">
                  Nhờ tìm gia sư <span aria-hidden>↗</span>
                </a>
                <a className="hero-link" href="#tim-gia-su">
                  Tự khám phá gia sư <span aria-hidden>↓</span>
                </a>
              </div>
              <div className="hero-note">
                <span className="note-dot" /> Học thử miễn phí sau khi chọn được
                gia sư
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span className="hero-art-label">MỖI BẠN MỘT NHỊP HỌC</span>
              <div className="hero-star">
                <Star size={300} mood="wink" />
              </div>
              <span className="hero-art-caption">
                Tìm đúng người dạy.
                <br />
                Bắt đầu theo cách của mình.
              </span>
            </div>
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
