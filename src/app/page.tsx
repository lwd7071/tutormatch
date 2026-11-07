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
                Gặp đúng gia sư.
                <br />
                <em>Học vui hết cỡ!</em>
              </h1>
              <p>
                Tìm người đồng hành hợp môn, hợp lịch, hợp cả cách bạn học. Mỗi
                buổi học và khoản tiền đều được theo dõi rõ ràng.
              </p>
              <a className="button hero-cta" href="#tim-gia-su">
                Tìm gia sư hợp mình <span aria-hidden>↗</span>
              </a>
              <div className="hero-note">
                <span className="note-dot" /> Học trực tuyến hoặc gặp trực tiếp
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
                <h2>Học vui, theo dõi dễ</h2>
              </div>
            </div>
            <div className="steps">
              <div>
                <span>01</span>
                <h3>Chọn gia sư</h3>
                <p>
                  Xem hồ sơ và gói học, rồi chọn người hợp mục tiêu của bạn.
                </p>
              </div>
              <div>
                <span>02</span>
                <h3>Thống nhất lịch</h3>
                <p>
                  Sau khi mua, hai bên trao đổi để gia sư tạo từng buổi học.
                </p>
              </div>
              <div>
                <span>03</span>
                <h3>Xác nhận buổi học</h3>
                <p>
                  Hai bên xác nhận sau buổi; số buổi và tiền học được cập nhật
                  rõ ràng.
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
