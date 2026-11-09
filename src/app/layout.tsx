import type { Metadata } from "next";
import { Motion } from "@/components/Motion";
import { Baloo_2, Be_Vietnam_Pro } from "next/font/google";
import "./styles.css";
import "./redesign.css";
import "./public-concept.css";

const beVietnamPro = Be_Vietnam_Pro({
  weight: ["400", "600", "700"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
});
const baloo = Baloo_2({
  weight: ["700", "800"],
  subsets: ["latin", "vietnamese"],
  display: "swap",
  variable: "--font-baloo",
});

export const metadata: Metadata = {
  title: "Tìm gia sư online cho học sinh | TutorMatch",
    description:
      "Phụ huynh gửi nhu cầu tìm gia sư online theo môn, lớp và lịch học. TutorMatch liên hệ trong 1 ngày làm việc.",
  openGraph: {
    title: "Nhờ TutorMatch tìm gia sư online",
    description:
      "Gửi môn học, lớp và lịch mong muốn. TutorMatch liên hệ phụ huynh trong 1 ngày làm việc.",
    siteName: "TutorMatch",
    locale: "vi_VN",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi" className={`${beVietnamPro.className} ${baloo.variable}`}>
      <body>{children}<Motion /></body>
    </html>
  );
}
