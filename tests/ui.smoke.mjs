import { chromium } from "playwright";

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
  await page.goto("http://localhost:3000", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Gặp đúng gia sư/ }).waitFor();
  if (await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)) throw new Error("Trang chủ tràn ngang trên điện thoại.");
  await page.goto("http://localhost:3000/help", { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: /Học vui, mọi bước rõ ràng/ }).waitFor();
  await page.goto("http://localhost:3000/app", { waitUntil: "networkidle" });
  try { await page.getByRole("heading", { name: "Xin chào bạn!" }).waitFor({ timeout: 10000 }); }
  catch (error) { console.error("Current page:", (await page.locator("body").innerText()).slice(0, 700)); console.error("Browser errors:", errors); throw error; }
  if (errors.length) throw new Error(errors.join("\n"));
  console.log("Mobile homepage, help, and signed-out app smoke checks passed.");
} finally { await browser.close(); }
