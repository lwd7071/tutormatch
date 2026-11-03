"use client";
import Link from "next/link";
import { Star } from "./Star";
import { useUser } from "@/lib/use-user";

export function Header() {
  const { user, login, logout } = useUser();
  return <header className="site-header"><div className="wrap header-inner">
    <Link href="/" className="brand" aria-label="TutorMatch, về trang chủ"><Star size={38}/><span>Tutor<span className="brand-accent">Match</span></span></Link>
    <nav className="main-nav" aria-label="Điều hướng chính"><Link href="/#tim-gia-su">Tìm gia sư</Link><Link href="/help">Hướng dẫn</Link><Link href="/app">Khu vực của tôi</Link></nav>
    <div className="header-actions">{user ? <><Link className="button button-small" href="/app">Vào trang của tôi</Link><button className="text-button" onClick={() => logout()}>Đăng xuất</button></> : <button className="button button-small" onClick={() => login()}>Đăng nhập Google</button>}</div>
  </div></header>;
}
