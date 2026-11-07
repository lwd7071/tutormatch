"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Star } from "./Star";
import { MobileNav, type NavItem } from "./MobileNav";
import { useUser } from "@/lib/use-user";

const publicItems: NavItem[] = [
  { label: "Trang đầu", href: "/", icon: "home" },
  { label: "Gia sư", href: "/#tim-gia-su", icon: "search" },
  { label: "Hướng dẫn", href: "/help", icon: "help" },
  { label: "Tài khoản", href: "/app", icon: "account" },
];

export function Header({ hideMobileNav = false }: { hideMobileNav?: boolean }) {
  const { user, login, logout } = useUser();
  const [loginError, setLoginError] = useState("");
  const pathname = usePathname();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const sync = () => setHash(location.hash);
    sync();
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, [pathname]);
  const activeHref =
    pathname === "/" && hash === "#tim-gia-su"
      ? "/#tim-gia-su"
      : pathname === "/"
        ? "/"
        : pathname === "/help"
          ? "/help"
          : "";
  return (
    <>
      <header className="site-header">
        <div className="wrap header-inner">
          <Link
            href="/"
            className="brand"
            aria-label="TutorMatch, về trang chủ"
          >
            <Star size={38} />
            <span>
              Tutor<span className="brand-accent">Match</span>
            </span>
          </Link>
          <nav className="main-nav" aria-label="Điều hướng chính">
            <Link href="/#tim-gia-su">Tìm gia sư</Link>
            <Link href="/#gui-yeu-cau">Nhờ tìm giúp</Link>
            <Link href="/help">Hướng dẫn</Link>
            <Link href="/privacy">Bảo mật</Link>
            <Link href="/app">Khu vực của tôi</Link>
          </nav>
          <div className="header-actions">
            {user ? (
              <>
                <Link className="button button-small" href="/app">
                  Vào trang của tôi
                </Link>
                <button className="text-button" onClick={() => logout()}>
                  Đăng xuất
                </button>
              </>
            ) : (
              <button
                className="button button-small"
                onClick={() => {
                  setLoginError("");
                  login().catch((error) =>
                    setLoginError(
                      error?.code === "auth/unauthorized-domain"
                        ? "Tên miền này chưa được cho phép đăng nhập Google."
                        : "Đăng nhập chưa thành công. Vui lòng thử lại.",
                    ),
                  );
                }}
              >
                Đăng nhập Google
              </button>
            )}
          </div>
        </div>
        {loginError && (
          <div className="wrap header-error" role="alert">
            {loginError}
          </div>
        )}
      </header>
      {!hideMobileNav && (
        <MobileNav items={publicItems} activeHref={activeHref || "/app"} />
      )}
    </>
  );
}
