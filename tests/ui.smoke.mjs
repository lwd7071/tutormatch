import { chromium } from "playwright";
import { existsSync } from "node:fs";

const systemChrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await chromium.launch({ headless: true, ...(existsSync(systemChrome) ? { executablePath: systemChrome } : {}) });
try {
  for (const viewport of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    await page.route("**/api/catalog**", route => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ data: { items: [{ tutor: { id: "sample", name: "Gia sư mẫu", bio: "Dạy Toán", photoUrl: "", mode: "online", location: "" }, packages: [{ id: "pack", tutorId: "sample", title: "Toán cơ bản", subjectId: "math", price: 100000, count: 1, durationMinutes: 60, mode: "online" }] }], subjects: [{ id: "math", name: "Toán" }], featured: [], nextCursor: null } }) }));
    await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Gặp đúng gia sư/ }).waitFor();
    await page.getByRole("heading", { name: "Gia sư mẫu" }).waitFor();
    if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error(`Trang chủ tràn ngang ở ${viewport.width}px.`);
    await page.goto("http://localhost:3000/help", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: /Học vui, mọi bước rõ ràng/ }).waitFor();
    await page.goto("http://localhost:3000/app", { waitUntil: "networkidle" });
    await page.getByRole("heading", { name: "Xin chào bạn!" }).waitFor({ timeout: 10000 });
    if (errors.length) throw new Error(errors.join("\n"));
    await page.close();
  }
  console.log("Mobile and desktop public pages and signed-out app smoke checks passed.");
} finally { await browser.close(); }
