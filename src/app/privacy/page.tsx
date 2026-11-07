import { Header } from "@/components/Header";

export default function Privacy() {
  return (
    <>
      <Header />
      <main className="wrap" style={{ maxWidth: 820, padding: "55px 0 90px" }}>
        <span className="eyebrow">TUTORMATCH</span>
        <h1>Thông tin về dữ liệu cá nhân</h1>
        <p>
          Biểu mẫu tìm gia sư được lưu trữ bằng Google Forms. Thông tin phụ
          huynh nhập như tên, cách liên hệ, lớp, môn và thời gian học được dùng
          để tư vấn và tìm gia sư phù hợp.
        </p>
        <p>
          TutorMatch xử lý yêu cầu thủ công và không dùng thông tin để gửi quảng
          cáo. Vui lòng không nhập thông tin nhạy cảm hoặc dữ liệu không cần
          thiết vào biểu mẫu.
        </p>
        <p className="help-text">
          Người vận hành cần bổ sung kênh liên hệ và thời hạn lưu trữ vào mô tả
          Google Form trước khi mở nhận yêu cầu công khai.
        </p>
      </main>
    </>
  );
}
