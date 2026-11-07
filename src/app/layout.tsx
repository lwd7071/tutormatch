import type { Metadata } from "next";
import { Be_Vietnam_Pro } from "next/font/google";
import "./styles.css";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "600", "700"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TutorMatch — Học đúng người, vui đúng nhịp",
  description:
    "Tìm gia sư 1–1 trực tuyến hoặc trực tiếp và theo dõi từng buổi học rõ ràng.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={beVietnamPro.className}>
      <body>{children}</body>
    </html>
  );
}
