import type { Metadata } from "next";
import "./styles.css";

export const metadata: Metadata = {
  title: "TutorMatch — Học đúng người, vui đúng nhịp",
  description:
    "Tìm gia sư 1–1 trực tuyến hoặc trực tiếp và theo dõi từng buổi học rõ ràng.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
