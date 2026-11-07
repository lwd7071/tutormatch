import { chromium } from "playwright";
import { existsSync } from "node:fs";

const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const baseUrl = process.env.BASE_URL || "http://localhost:3000";
const browser = await chromium.launch({
  headless: true,
  ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}),
});
try {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 1440, height: 900 },
  ]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.route("**/api/catalog**", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            items: [
              {
                tutor: {
                  id: "sample",
                  name: "Gia sư mẫu",
                  bio: "Dạy Toán",
                  photoUrl: "",
                  mode: "online",
                  location: "",
                  availability: "Tối thứ hai",
                  weeklySlots: [{ day: 1, start: 1080, end: 1200 }],
                },
                packages: [
                  {
                    id: "pack",
                    tutorId: "sample",
                    title: "Toán cơ bản",
                    subjectId: "math",
                    price: 100000,
                    count: 1,
                    durationMinutes: 60,
                    mode: "online",
                  },
                ],
                rating: 4.5,
                reviewCount: 2,
              },
            ],
            subjects: [{ id: "math", name: "Toán" }],
            featured: [],
            page: 1,
            totalPages: 1,
            totalItems: 1,
          },
        }),
      }),
    );
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Gia sư hợp gu/ }).waitFor();
    await page.getByRole("heading", { name: "Chưa thấy gia sư phù hợp?" }).waitFor();
    await page.getByRole("heading", { name: "Gia sư mẫu" }).waitFor();
    await page.getByText("★ 4.5 · 2 lượt").waitFor();
    await page.getByRole("button", { name: "Lưu Gia sư mẫu" }).click();
    await page.getByRole("button", { name: "Bỏ lưu Gia sư mẫu" }).waitFor();
    await page.getByText("Lọc thêm theo lịch và khu vực").click();
    await page.getByLabel("Ngày rảnh").selectOption("1");
    await page.getByText(/1 bộ lọc đang áp dụng/).waitFor();
    await page.getByRole("button", { name: "Gợi ý theo tiêu chí" }).click();
    await page.getByRole("heading", { name: "Gia sư nào hợp mình?" }).waitFor();
    if (
      await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      )
    )
      throw new Error(`Trang chủ tràn ngang ở ${viewport.width}px.`);
    await page.route("**/api/catalog/sample/slots", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ data: { starts: [Date.now() + 86400000] } }),
      }),
    );
    await page.route("**/api/catalog/sample", (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          data: {
            tutor: {
              id: "sample", name: "Gia sư mẫu", bio: "Dạy Toán",
              photoUrl: "", mode: "online", location: "", availability: "Tối thứ hai",
              weeklySlots: [{ day: 1, start: 1080, end: 1200 }],
            },
            packages: [{
              id: "pack", tutorId: "sample", title: "Toán cơ bản",
              subjectId: "math", price: 100000, count: 1,
              durationMinutes: 60, mode: "online",
            }],
            packagePage: 1, packageTotalPages: 1, packageTotalItems: 1,
            subjects: [{ id: "math", name: "Toán" }],
            reviews: [], reviewPage: 1, reviewTotalPages: 0,
            reviewTotalItems: 0, rating: 0, reviewCount: 0,
            purchaseEnabled: true,
          },
        }),
      }),
    );
    await page.goto(`${baseUrl}/tutors/sample`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Gia sư mẫu" }).waitFor();
    await page.getByRole("button", { name: "Mua gói" }).waitFor();
    await page.getByLabel("Giờ đề xuất · giờ Việt Nam").selectOption({ index: 1 });
    if (!(await page.getByRole("button", { name: "Gửi yêu cầu học thử" }).isEnabled()))
      throw new Error("Không chọn được giờ học thử.");
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth))
      throw new Error(`Hồ sơ gia sư tràn ngang ở ${viewport.width}px.`);
    await page.goto(`${baseUrl}/help`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: /Học vui, mọi bước rõ ràng/ })
      .waitFor();
    await page.goto(`${baseUrl}/privacy`, { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Thông tin về dữ liệu cá nhân" }).waitFor();
    await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
    await page
      .getByRole("heading", { name: "Xin chào bạn!" })
      .waitFor({ timeout: 10000 });
    if (errors.length) throw new Error(errors.join("\n"));
    await page.close();
  }
  console.log(
    "Mobile and desktop public pages and signed-out app smoke checks passed.",
  );
} finally {
  await browser.close();
}
