# Tiến độ TutorMatch

Lịch sử dưới đây được tổng hợp từ các commit đã có trong Git. Ngày là ngày ghi trên commit; phần kiểm tra của các commit cũ không được xác minh lại trong lần tổng hợp này.

## Lịch sử commit

| Ngày | Commit | Hoàn thành |
| --- | --- | --- |
| 2026-11-03 | `74d96ea` | Khởi tạo Next.js, cấu hình Firebase, quy tắc dữ liệu và triển khai. |
| 2026-11-03 | `ae0f3e4` | Tạo giao diện khám phá gia sư và trang hồ sơ công khai. |
| 2026-11-03 | `c0588dd` | Thêm API đơn hàng, buổi học, thanh toán, hoàn tiền và rút tiền. |
| 2026-11-03 | `e047212` | Tạo khu vực làm việc cho học viên, gia sư và quản trị viên. |
| 2026-11-03 | `b90989d` | Bổ sung tài liệu thiết lập và kiểm tra giao diện bằng trình duyệt. |
| 2026-11-03 | `978ef45` | Sửa lỗi Firebase Admin và `jose` khi chạy trên Vercel. |
| 2026-11-03 | `aa6f44d` | Điều chỉnh header và phần đầu trang cho màn hình hẹp. |
| 2026-11-03 | `a4d9cd9` | Đọc dữ liệu Firestore độc lập song song trên dashboard. |
| 2026-11-03 | `c3b6175` | Thêm điều hướng di động theo vai trò và chỉnh bố cục. |
| 2026-11-03 | `b5a2dca` | Thu gọn nút và điều hướng dashboard. |
| 2026-11-03 | `f2d2505` | Bỏ yêu cầu dữ liệu dashboard bị lặp. |
| 2026-11-04 | `7551ad5` | Chuyển tệp ảnh và tài liệu gia sư sang Cloudinary. |
| 2026-11-04 | `4833c35` | Cho phép gia sư cung cấp cả hai hình thức dạy. |
| 2026-11-04 | `44ed94f` | Sửa quy trình duyệt hồ sơ, đình chỉ gia sư và thêm công cụ di chuyển hồ sơ cũ. |
| 2026-11-05 | `967909d` | Gia cố luồng hồ sơ công khai, đơn hàng, hoàn tiền và hết hạn. |
| 2026-11-05 | `6bdd18e` | Gia cố API, thanh toán và catalog; thêm chỉ mục và công cụ di chuyển danh sách công khai. |
| 2026-11-07 | `32243e4` | Thêm phân trang đánh số dùng chung. |
| 2026-11-07 | `2a6fa4d` | Thêm phân trang tin nhắn chat. |
| 2026-11-07 | `8465502` | Hoàn thiện phân trang và mở rộng nền tảng: khám phá, lịch học thử, yêu thích, gợi ý, quản trị và kiểm tra thanh toán staging. |
| 2026-11-07 | `7420da8` | Dùng phông Be Vietnam Pro trên toàn trang. |
| 2026-11-07 | `5d321eb` | Thay cron bằng hàng đợi công việc cho quản trị viên xử lý. |
| 2026-11-07 | `25aad63` | Cho phép quản trị viên cấu hình Google Form nhận yêu cầu tìm gia sư. |

## Nhật ký công việc

### 2026-11-07 — Thiết lập nhật ký tiến độ

- Hoàn thành: Tạo `STATUS.md`, thêm mẫu và quy tắc cập nhật vào `AGENT.md`, liên kết quy tắc từ `AGENTS.md`, tổng hợp 20 commit hiện có.
- Kiểm tra: Đối chiếu danh sách và thứ tự commit bằng `git log`.
- Giới hạn: Chưa xác minh lại kết quả chạy ứng dụng hoặc kiểm tra của các commit cũ.

### 2026-11-07 — Hợp nhất hướng dẫn và cập nhật lịch sử

- Hoàn thành: Chuyển quy tắc ghi log vào `AGENTS.md`, bỏ `AGENT.md`, cập nhật `STATUS.md` theo 21 commit hiện có.
- Kiểm tra: Đối chiếu mã, thứ tự và nội dung hai commit mới nhất bằng `git log` và `git show`.
- Giới hạn: Chưa chạy kiểm tra ứng dụng vì chỉ thay đổi tài liệu.

### 2026-11-07 — Đồng bộ các nhánh vào main

- Hoàn thành: Xác nhận hai nhánh `codex/*` đã có trong lịch sử `main`; đẩy `main` tới commit `25aad63` lên GitHub và cập nhật lịch sử 22 commit.
- Kiểm tra: `npm test` trên checkout sạch qua 36/36; `git rev-list` xác nhận `main` và `origin/main` đồng bộ; GitHub báo `success` cho commit `25aad63` và Vercel báo triển khai hoàn tất.
- Giới hạn: Build local chưa xác minh được vì môi trường kiểm tra không truy cập được Google Fonts; các thay đổi chưa commit trong thư mục làm việc không được đưa lên GitHub.

### 2026-11-07 — Làm mới giao diện TutorMatch

- Hoàn thành: Thiết kế lại trang chủ, khám phá và hồ sơ gia sư theo hướng editorial vui nhộn; đồng bộ màu, thành phần chung, trang hướng dẫn, bảo mật, kiểm thử thanh toán và khu vực làm việc. Giữ nguyên cấu hình Be Vietnam Pro và các luồng API hiện có.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm test` (37/37), UI smoke trên điện thoại và máy tính; kiểm tra tràn ngang các trang công khai ở độ rộng 320–1440 px và xem ảnh chụp trang chủ, hồ sơ gia sư, hướng dẫn.
- Giới hạn: Chưa kiểm tra trực quan khu vực học viên, gia sư và quản trị bằng tài khoản thật; biểu mẫu nhờ tìm gia sư chỉ mở khi quản trị viên đã cấu hình Google Form.

### 2026-11-07 — Thêm chuyển động UX

- Hoàn thành: Thêm hiệu ứng xuất hiện khi cuộn cho nội dung và thẻ gia sư, phản hồi nút lưu, chuyển trạng thái và mở bộ lọc; thống nhất hover/nhấn. Ngôi sao dừng khi ra ngoài màn hình hoặc tab bị ẩn; hỗ trợ giảm chuyển động và nội dung hiển thị mặc định khi JavaScript không hoạt động.
- Kiểm tra: Typecheck, production build và UI smoke mobile/desktop đã qua; bổ sung kiểm tra ngôi sao dừng ngoài màn hình và chế độ giảm chuyển động. Build cần chạy ngoài sandbox vì Turbopack bị chặn tạo junction trên Windows.
- Giới hạn: Chưa đo độ mượt trên điện thoại cấu hình thấp thật hoặc kiểm tra các vai trò đăng nhập bằng tài khoản thật; chuyển tiếp bộ lọc phụ thuộc hỗ trợ trình duyệt và có phương án mở/đóng tức thì.
