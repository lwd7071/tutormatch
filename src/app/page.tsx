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
              <div className="eyebrow">✦ HỌC 1–1 THEO CÁCH CỦA BẠN</div>
              <h1>
                Nhờ TutorMatch tìm gia sư.
                <br />
                <em>Học vui hết cỡ!</em>
              </h1>
              <p>
                Phụ huynh gửi môn học, lớp và lịch mong muốn. TutorMatch sẽ liên
                hệ trong 1 ngày làm việc để tìm gia sư phù hợp.
              </p>
              <a className="button hero-cta" href="#gui-yeu-cau">
                Nhờ tìm gia sư <span aria-hidden>↗</span>
              </a>
              <div className="hero-note">
                <span className="note-dot" /> Dành cho phụ huynh tìm gia sư online
              </div>
            </div>
            <div className="hero-art" aria-hidden="true">
              <div className="orbit orbit-one" />
              <div className="orbit orbit-two" />
              <div className="hero-star">
                <Star size={230} mood="wink" />
              </div>
              <span className="float-chip chip-top">
                ✦ Một buổi, một bước tiến
              </span>
              <span className="float-chip chip-bottom">
                ♡ Học theo nhịp của bạn
              </span>
              <span className="spark spark-one">✳</span>
              <span className="spark spark-two">✳</span>
            </div>
          </div>
        </section>
        <Discovery />
        <section id="cach-hoat-dong" className="how-section">
          <div className="wrap">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ĐƠN GIẢN VÀ RÕ RÀNG</span>
                <h2>Tìm gia sư, từng bước rõ ràng</h2>
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
