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

### 2026-11-07 — Đánh giá trạng thái project

- Hoàn thành: Rà soát cấu trúc, tài liệu, các luồng thanh toán, quyền truy cập, hàng chờ quản trị, khám phá và gợi ý gia sư; ghi nhận các rủi ro vận hành và mở rộng đã xác nhận từ mã.
- Kiểm tra: `npm run typecheck`, `npm test` (37/37) và `npm run build` đều qua; đối chiếu trực tiếp các API, xử lý giao dịch và README.
- Giới hạn: Chưa chạy UI smoke, chưa kiểm thử vai trò đăng nhập hoặc thanh toán thật trên staging; chưa đo tải và chi phí Firestore bằng dữ liệu thực.

### 2026-11-08 — Đồng bộ hướng dẫn hàng chờ admin

- Hoàn thành: Cập nhật README để mô tả các mục thanh toán chờ, đơn và buổi học quá hạn, cùng việc cập nhật danh sách được admin xử lý thủ công từ **Cần rà soát**; bỏ hướng dẫn cron không có trong code hiện tại.
- Kiểm tra: Tìm `cron` và `daily` trong README; không còn kết quả. Đối chiếu mô tả hàng chờ với `/api/admin/work`.
- Giới hạn: Chỉ sửa tài liệu; không chạy test ứng dụng.

### 2026-11-08 — Thêm video giới thiệu gia sư

- Hoàn thành: Cho phép gia sư thêm link chia sẻ video Google Drive vào hồ sơ; link được kiểm tra, chờ duyệt cùng hồ sơ, rồi mới xuất hiện trong catalog. Thẻ gia sư mở preview khi hover/focus hoặc chạm, có nút đóng; iframe chỉ tải sau khi bấm Play.
- Kiểm tra: `npm test` (38/38), `npm run typecheck`, `git diff --check`; smoke test UI đã thử nhưng timeout khi đợi trang chủ trên server dev sẵn có ở cổng 3000.
- Giới hạn: Chưa xác minh trực quan preview trên trình duyệt vì server dev không phục vụ được trang; quyền chia sẻ công khai của Drive do gia sư tự cấu hình.

### 2026-11-08 — Thiết kế lại thẻ gia sư ngang

- Hoàn thành: Đổi danh sách gia sư sang thẻ ngang với ảnh, thông tin, giá và hành động tách rõ; thêm nút dẫn tới phần chọn giờ học thử. Panel video mở bên phải trên desktop và bên dưới thẻ trên mobile; gia sư không có video không mở panel.
- Kiểm tra: `npm run typecheck` và `git diff --check` qua. Kiểm tra Playwright riêng ở 1440 px và 390 px với tên/giới thiệu dài, có và không có video: không tràn ngang, iframe chưa có trước khi bấm Play; bấm Play, đóng panel và link `#hoc-thu` hoạt động. Đã xem ảnh chụp hai kích thước. `npm run test:ui` vẫn dừng ở bước chờ hiệu ứng ngôi sao của trang chủ.
- Giới hạn: Chưa xác minh bằng video Drive thật; smoke test toàn trang chưa qua do bước kiểm tra hiệu ứng ngôi sao không đạt trên server kiểm tra.

### 2026-11-08 — Thêm hashtag cho đánh giá gia sư

- Hoàn thành: Thay prompt đánh giá bằng form sao, nhận xét và tối đa ba hashtag có sẵn; kiểm tra mã tag ở schema, lưu cùng đánh giá và hiển thị hashtag chỉ trong review công khai. Review cũ vẫn có danh sách tag rỗng; review bị ẩn không được đưa vào dữ liệu công khai.
- Kiểm tra: `npm run typecheck`, `npm test` (39/39) và `git diff --check` đều qua; test xác nhận tag hợp lệ, thiếu tag, mã lạ, trùng, quá ba tag, review cũ và review ẩn.
- Giới hạn: Chưa chạy kiểm tra tương tác trực quan trên trình duyệt hoặc thiết bị di động.
### 2026-11-08 — Chẩn đoán lỗi 500 hàng thanh toán trong bảng điều hành

- Hoàn thành: Xác định Firestore production thiếu composite index cho truy vấn `orders` theo `status` và `createdAt`; cấu hình index cần thiết đã có trong `firestore.indexes.json`.
- Kiểm tra: Chạy truy vấn Firestore production chỉ đọc, tái hiện `FAILED_PRECONDITION: The query requires an index`; liệt kê index production, chỉ thấy index `status` + `decisionDue` ở trạng thái `READY`.
- Giới hạn: Chưa triển khai index lên Firebase production; truy vấn thanh toán sẽ tiếp tục lỗi 500 cho tới khi index trong `firestore.indexes.json` được triển khai và đạt `READY`.

### 2026-11-08 — Thêm yêu cầu gói học riêng

- Hoàn thành: Thêm form gửi yêu cầu học trực tiếp từ hồ sơ gia sư; gia sư có thể từ chối hoặc tạo đề nghị gói riêng, học viên xem tổng giá và giá mỗi buổi rồi chuyển sang checkout. Gói riêng được giới hạn theo học viên, loại khỏi catalog và kiểm tra lại trước khi tạo đơn; thông báo được gửi khi có yêu cầu, đề nghị và quyết định.
- Kiểm tra: `npm run typecheck`, `npm test` (41/41) và `git diff --check` đều qua; bổ sung kiểm tra schema trường yêu cầu và xác nhận gói riêng không vào listing công khai.
- Giới hạn: Chưa chạy UI smoke/kiểm tra trên thiết bị di động hoặc giao dịch thanh toán staging; chưa có kiểm thử tích hợp Firestore cho quyền truy cập, thay thế đề nghị và checkout.
### 2026-11-08 — Triển khai index cho hàng thanh toán admin

- Hoàn thành: Tạo composite index `orders` theo `status` và `createdAt` trên Firebase production; index đạt trạng thái `READY`.
- Kiểm tra: Chạy lại truy vấn đếm và lấy trang cùng điều kiện với API; cả hai chạy thành công, kết quả hiện có 0 đơn chờ thanh toán quá 5 phút. `git diff --check` qua.
- Giới hạn: Chưa kiểm tra request từ trình duyệt đã đăng nhập; truy vấn Firestore tương ứng của API đã chạy thành công.

### 2026-11-08 — Viết lại hướng dẫn sử dụng

- Hoàn thành: Viết lại hướng dẫn cho học viên và gia sư bằng ngôn ngữ thao tác; bổ sung luồng yêu cầu gói học và bỏ tên payOS cùng mô tả rà soát tự động không đúng với cách vận hành hiện tại.
- Kiểm tra: Đọc lại toàn trang; tìm `payOS`, `hằng ngày`, `hệ thống rà`, `tự động` và `chuyển sang hoàn` trong trang hướng dẫn (không còn kết quả); `git diff --check` qua.
- Giới hạn: Chỉ sửa nội dung hướng dẫn; không chạy test ứng dụng.
### 2026-11-08 — Sửa lỗi dữ liệu riêng của gia sư

- Hoàn thành: Bổ sung composite index `sessions(tutorId, status, end)` còn thiếu trên Firebase production; đây là truy vấn buổi học cần xác nhận trong phần tổng kết gia sư.
- Kiểm tra: Trước khi tạo index, truy vấn trả `FAILED_PRECONDITION: The query requires an index`; sau khi index đạt `READY`, chạy lại truy vấn thành công (0 kết quả với UID kiểm tra). `git diff --check` qua.
- Giới hạn: Chưa gọi lại API bằng phiên đăng nhập của gia sư; chưa chạy kiểm tra UI.
### 2026-11-08 — Sửa index tổng kết gói gia sư [8571e21]

- Hoàn thành: Thêm composite index `orders(status, tutorId, confirmedCount, count, reservedCount)` vào `firestore.indexes.json` và tạo index trên Firebase production.
- Kiểm tra: Truy vấn aggregate trước khi sửa trả `FAILED_PRECONDITION`; sau khi index đạt `READY`, chạy lại thành công. JSON hợp lệ và `git diff --check` qua.
- Giới hạn: Chưa gọi lại API bằng phiên đăng nhập thật; xác nhận bằng truy vấn Firestore tương đương với UID giả.

### 2026-11-08 — Giao diện công khai minh họa phẳng

- Hoàn thành: Vẽ hero SVG với mascot sao đội mũ tốt nghiệp, đi giày thể thao và nhân vật học tập; áp dụng màu phẳng cho trang chủ, tìm gia sư, hồ sơ, hướng dẫn và bảo mật. Thêm nút mở video rõ ràng trên thẻ gia sư để panel không làm lệch nút lưu khi rê chuột.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm test` (41/41), `npm run test:ui` trên mobile/desktop và `git diff --check` đều qua; xem ảnh chụp trang chủ, thẻ gia sư, hướng dẫn, bảo mật. Trang chủ/hồ sơ không tràn ngang ở 390 và 1440 px; hướng dẫn/bảo mật không tràn ngang ở 320, 390 và 1440 px.
- Giới hạn: Chưa đo độ mượt trên điện thoại cấu hình thấp thật hoặc kiểm tra trực quan phiên đăng nhập thật; UI smoke dùng dữ liệu gia sư giả lập.

### 2026-11-08 — Custom giao diện công khai theo demo HTML

- Hoàn thành: Thêm Baloo 2, màu phẳng và viền navy; nối tìm kiếm ở hero với bộ lọc thật; đổi danh sách thành lưới thẻ màu dùng ảnh gia sư thật và video xem ngay dưới thẻ. Đồng bộ hồ sơ, hướng dẫn, bảo mật và menu tablet; giữ nguyên luồng dữ liệu, Google Form, gói học và học thử.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm test` (41/41), `npm run test:ui` và `git diff --check` qua. UI smoke kiểm tra tìm kiếm, bộ lọc, lưu, video, hồ sơ, học thử, trạng thái chưa mở Google Form và không tràn ngang ở 320, 390, 768, 1440 px; đã xem ảnh chụp các trang công khai trên mobile/desktop và xác nhận viền focus bàn phím.
- Giới hạn: Chưa đo hiệu năng trên điện thoại thật hoặc kiểm tra bằng tài khoản đăng nhập thật; ảnh và dữ liệu gia sư trong UI smoke là giả lập.

### 2026-11-09 — Tách mục quản lý thành trang con

- Hoàn thành: Thêm URL `section` và điều hướng con cho các nhóm việc của gia sư, học viên và admin theo mẫu Thiết lập; mỗi mục chỉ hiển thị nội dung và phân trang danh sách liên quan. Giữ URL tab cũ, bộ lọc xử lý/lịch sử và các thao tác hiện có.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm test` (43/43), `npm run test:ui` và `git diff --check` qua. Kiểm tra điều hướng con không tràn ngang và link nhận focus ở 320, 390, 768, 1440 px; unit test xác nhận section mặc định, section không hợp lệ và dữ liệu phân trang theo mục.
- Giới hạn: UI smoke chạy với phiên chưa đăng nhập; chưa kiểm tra trực tiếp các thao tác quản lý bằng tài khoản thật của ba vai trò.

### 2026-11-09 — Sửa link cuộn trang và đồng bộ nút hành động

- Hoàn thành: Đổi các link `/#...` ở menu sang anchor HTML để bấm lại cùng hash vẫn cuộn đúng; gom kích thước, viền, bo góc, font và trạng thái của nút hành động về CSS chung. Nút chính cao 52 px, nút nhỏ cao 42 px trên desktop và 44 px trên mobile; hai nút hero rộng theo nội dung.
- Kiểm tra: UI smoke mới tái hiện lỗi trước sửa rồi qua sau sửa; kiểm tra bấm lại menu desktop/mobile, chuyển từ trang khác, tìm kiếm, trạng thái biểu mẫu có/chưa mở, focus bàn phím, giảm chuyển động và không tràn ngang ở 320, 390, 768, 1440 px. `npm run typecheck`, `npm run build`, `npm test` (43/43) và `git diff --check` qua; đã xem ảnh chụp hero mobile/desktop và đo nút trên trang chủ, hướng dẫn, khu đăng nhập.
- Giới hạn: Chưa kiểm tra nút trong khu quản lý bằng tài khoản đăng nhập thật; các nút đó dùng cùng lớp CSS đã được kiểm tra ở trang công khai.

### 2026-11-09 — Cập nhật minh họa trang chủ [6f67f44]

- Hoàn thành: Thay SVG hero bằng ảnh minh họa 2D người dùng đã chọn, đã bỏ mảng đỏ giữa hai chân ngôi sao; giữ bố cục responsive của trang chủ.
- Kiểm tra: `npm run typecheck`, `npm run build`, `npm run test:ui` trên các khung 320, 390, 768 và 1440 px, cùng `git diff --check` đều qua.
- Giới hạn: Chưa xem trực tiếp trên thiết bị thật; kiểm tra giao diện chạy bằng Chrome headless.
