import Link from "next/link";
import { Header } from "@/components/Header";
import { Star } from "@/components/Star";

export default function Help() {
  return (
    <>
      <Header />
      <main className="wrap help-page">
        <div className="app-heading">
          <div>
            <span className="eyebrow">HƯỚNG DẪN TUTORMATCH</span>
            <h1>Học vui, mọi bước rõ ràng</h1>
            <p>Những điều bạn cần biết trước khi bắt đầu.</p>
          </div>
          <Star size={90} />
        </div>
        <div className="help-columns">
          <section className="help-guide">
            <h2>Dành cho học viên</h2>
            <h3>1. Tìm gia sư và chọn cách học</h3>
            <p>
              Xem hồ sơ gia sư để chọn gói có sẵn, hoặc gửi “Yêu cầu gói học” và
              ghi rõ mục tiêu, nội dung cùng thời gian bạn mong muốn. Gia sư sẽ
              gửi đề nghị riêng để bạn xem trước khi quyết định.
            </p>
            <h3>2. Xem đề nghị và thanh toán</h3>
            <p>
              Nếu đồng ý với số buổi, thời lượng và giá, hãy thanh toán theo
              hướng dẫn trên trang. Với đơn mua đầu tiên, gia sư có 24 giờ để
              phản hồi. Nếu chưa có phản hồi đúng hạn, admin sẽ xem xét và
              hướng dẫn xử lý.
            </p>
            <h3>3. Thống nhất lịch học</h3>
            <p>
              Trao đổi với gia sư nếu cần, rồi xem lịch từng buổi trong mục Lịch
              học. Thời lượng mỗi buổi theo gói bạn đã mua.
            </p>
            <h3>4. Xác nhận sau buổi</h3>
            <p>
              Trong 24 giờ sau khi kết thúc, chọn “Đã học” hoặc “Không diễn ra”.
              Buổi chỉ được tính khi cả hai xác nhận đã học.
            </p>
            <h3>5. Hoàn tiền</h3>
            <p>
              Bạn có thể yêu cầu hoàn phần buổi chưa học khi không còn buổi đã
              đặt. Cung cấp tài khoản ngân hàng để admin chuyển khoản.
            </p>
          </section>
          <section className="help-guide">
            <h2>Dành cho gia sư</h2>
            <h3>1. Hoàn thiện hồ sơ</h3>
            <p>
              Tải ảnh, giấy tờ và mô tả kinh nghiệm. Hồ sơ được công khai sau
              khi admin duyệt.
            </p>
            <h3>2. Gửi đề nghị và quản lý gói học</h3>
            <p>
              Tạo các gói bạn sẵn sàng dạy. Khi có yêu cầu gói học, xem mục tiêu,
              nội dung và thời gian mong muốn của học viên rồi gửi đề nghị gồm số
              buổi, thời lượng và tổng giá, hoặc từ chối yêu cầu. Học viên sẽ xem
              đề nghị và quyết định có thanh toán không. Với đơn mua đầu tiên,
              hãy phản hồi trong 24 giờ.
            </p>
            <h3>3. Tạo và xác nhận buổi</h3>
            <p>
              Sau khi thống nhất lịch, bạn tạo buổi học. Nếu cần hủy, hãy làm
              trước giờ bắt đầu. Sau giờ đó, hai bên xác nhận kết quả hoặc nhờ
              admin xử lý.
            </p>
            <h3>4. Rút thu nhập</h3>
            <p>
              Tiền vào số dư có thể rút sau khi buổi được chốt. Gửi yêu cầu rút
              và admin sẽ kiểm tra, chuyển khoản.
            </p>
          </section>
        </div>
        <div className="help-callout">
          <h2>Khi hai bên xác nhận khác nhau</h2>
          <p>
            Buổi học sẽ chuyển cho admin xử lý. Số buổi và tiền học giữ nguyên
            cho đến khi có quyết định. Bạn có thể dùng lịch sử tin nhắn để giải
            thích sự việc.
          </p>
          <Link className="button" href="/app">
            Vào khu vực của tôi
          </Link>
        </div>
      </main>
    </>
  );
}
