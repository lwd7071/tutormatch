"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Header } from "@/components/Header";
import { Star } from "@/components/Star";
import { responseData } from "@/lib/use-user";
import type { CatalogPageDto, PublicPackageDto, PublicSubjectDto, PublicTutorDto } from "@/lib/public-data";

type Tutor = PublicTutorDto;
type Pack = PublicPackageDto;
type Subject = PublicSubjectDto;
type Featured = Tutor & { rating: number; reviewCount: number };
const vnd = (n: number) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);

export default function Home() {
  const [tutors, setTutors] = useState<Tutor[]>([]), [packages, setPackages] = useState<Pack[]>([]), [subjects, setSubjects] = useState<Subject[]>([]), [ranking, setRanking] = useState<Featured[]>([]);
  const [query, setQuery] = useState(""), [subject, setSubject] = useState(""), [mode, setMode] = useState(""), [maxPrice, setMaxPrice] = useState("");
  const [loading, setLoading] = useState(true), [loadingMore, setLoadingMore] = useState(false), [error, setError] = useState(""), [cursor, setCursor] = useState<string | null>(null);
  const generation = useRef(0);
  const filters = () => { const params = new URLSearchParams(); if (query.trim()) params.set("query", query.trim()); if (subject) params.set("subjectId", subject); if (mode) params.set("mode", mode); if (maxPrice) params.set("maxPrice", maxPrice); return params; };
  useEffect(() => {
    const current = ++generation.current;
    const timer = setTimeout(() => {
      setLoading(true); setError("");
      fetch(`/api/catalog?${filters()}`).then(r => responseData<CatalogPageDto>(r, "Không tải được danh sách.")).then(d => {
        if (current !== generation.current) return;
        setTutors(d.items.map(item => item.tutor));
        setPackages(d.items.flatMap(item => item.packages));
        setSubjects(d.subjects);
        setRanking(d.featured.map(item => ({ ...item.tutor, rating: item.rating, reviewCount: item.reviewCount })));
        setCursor(d.nextCursor);
      }).catch(e => { if (current === generation.current) setError(e.message); }).finally(() => { if (current === generation.current) setLoading(false); });
    }, query || maxPrice ? 250 : 0);
    return () => clearTimeout(timer);
  }, [query, subject, mode, maxPrice]);
  async function loadMore() {
    if (!cursor || loadingMore) return;
    const current = generation.current, params = filters(); params.set("cursor", cursor);
    setLoadingMore(true);
    try {
      const page = await responseData<CatalogPageDto>(await fetch(`/api/catalog?${params}`), "Không tải được trang tiếp theo.");
      if (current !== generation.current) return;
      setTutors(previous => [...previous, ...page.items.map((item: { tutor: Tutor }) => item.tutor).filter((tutor: Tutor) => !previous.some(item => item.id === tutor.id))]);
      setPackages(previous => [...previous, ...page.items.flatMap((item: { packages: Pack[] }) => item.packages)]);
      setCursor(page.nextCursor);
    } catch (e) { if (current === generation.current) setError(e instanceof Error ? e.message : "Không tải được trang tiếp theo."); }
    finally { setLoadingMore(false); }
  }
  const shown = tutors;
  return <><Header/><main>
    <section className="hero"><div className="wrap hero-grid"><div className="hero-copy"><div className="eyebrow">✦ HỌC 1–1 THEO CÁCH CỦA BẠN</div><h1>Gặp đúng gia sư.<br/><em>Học vui hết cỡ!</em></h1><p>Tìm người đồng hành hợp môn, hợp lịch, hợp cả cách bạn học. Mỗi buổi học và khoản tiền đều được theo dõi rõ ràng.</p><a className="button hero-cta" href="#tim-gia-su">Tìm gia sư hợp mình <span aria-hidden>↗</span></a><div className="hero-note"><span className="note-dot"/> Học trực tuyến hoặc gặp trực tiếp</div></div><div className="hero-art" aria-hidden="true"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="hero-star"><Star size={230} mood="wink"/></div><span className="float-chip chip-top">✦ Một buổi, một bước tiến</span><span className="float-chip chip-bottom">♡ Học theo nhịp của bạn</span><span className="spark spark-one">✳</span><span className="spark spark-two">✳</span></div></div></section>
    <section id="tim-gia-su" className="search-section"><div className="wrap"><div className="section-heading"><div><span className="eyebrow">BẮT ĐẦU TỪ ĐÂY</span><h2>Tìm người dạy hợp gu</h2></div><p>Chọn điều bạn cần, TutorMatch giúp bạn tìm nhanh hơn.</p></div><div className="search-panel"><label><span>Tên gia sư hoặc từ khóa</span><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Ví dụ: Toán, ôn thi..."/></label><label><span>Môn học</span><select value={subject} onChange={e => setSubject(e.target.value)}><option value="">Tất cả môn học</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label><label><span>Hình thức</span><select value={mode} onChange={e => setMode(e.target.value)}><option value="">Trực tuyến & trực tiếp</option><option value="online">Trực tuyến</option><option value="offline">Trực tiếp</option></select></label><label><span>Giá tối đa / buổi</span><input type="number" min="0" value={maxPrice} onChange={e => setMaxPrice(e.target.value)} placeholder="Không giới hạn"/></label></div>
    {loading ? <div className="empty-card">Đang tìm gia sư cho bạn...</div> : error ? <div className="empty-card error">Chưa tải được danh sách: {error}</div> : shown.length ? <div className="tutor-grid">{shown.map(t => { const packs = packages.filter(p => p.tutorId === t.id); const min = Math.min(...packs.map(p => p.price / p.count)); return <article className="tutor-card" key={t.id}><div className="tutor-photo">{t.photoUrl ? <img src={t.photoUrl} alt={`Ảnh gia sư ${t.name}`}/> : <span>{t.name.slice(0,1)}</span>}</div><div className="tutor-card-body"><div className="tutor-label">{t.mode === "both" ? "Trực tuyến & trực tiếp" : t.mode === "offline" ? "Gặp trực tiếp" : "Học trực tuyến"}</div><h3>{t.name}</h3><p>{t.bio}</p><div className="tutor-bottom"><div><small>Từ</small><strong>{vnd(min)}<small> / buổi</small></strong></div><Link className="button button-small" href={`/tutors/${t.id}`}>Xem hồ sơ</Link></div></div></article>; })}</div> : <div className="empty-card"><Star size={82} mood="sleep"/><h3>Chưa có gia sư phù hợp</h3><p>Thử đổi bộ lọc, hoặc quay lại khi gia sư đầu tiên được duyệt nhé.</p><Link href="/app" className="button button-outline">Trở thành gia sư</Link></div>}</div></section>
    {cursor && <div className="wrap" style={{textAlign:"center",paddingBottom:32}}><button className="button button-outline" disabled={loadingMore} onClick={() => void loadMore()}>{loadingMore ? "Đang tải..." : "Xem thêm gia sư"}</button></div>}
    {ranking.length > 0 && <section className="wrap" style={{paddingBottom:75}}><div className="section-heading"><div><span className="eyebrow">HỌC VIÊN ĐÁNH GIÁ</span><h2>Gia sư được yêu thích</h2></div><p>Xếp theo điểm đánh giá từ các buổi học đã xác nhận.</p></div><div className="grid-3">{ranking.map((t,i) => <Link href={`/tutors/${t.id}`} className="panel" key={t.id}><span className="eyebrow">#{i+1} TRONG BẢNG XẾP HẠNG</span><h3 style={{marginTop:14}}>{t.name}</h3><strong>★ {t.rating.toFixed(1)}</strong><p className="help-text">{t.reviewCount} đánh giá đã xác minh</p></Link>)}</div></section>}
    <section id="cach-hoat-dong" className="how-section"><div className="wrap"><div className="section-heading"><div><span className="eyebrow">ĐƠN GIẢN VÀ RÕ RÀNG</span><h2>Học vui, theo dõi dễ</h2></div></div><div className="steps"><div><span>01</span><h3>Chọn gia sư</h3><p>Xem hồ sơ và gói học, rồi chọn người hợp mục tiêu của bạn.</p></div><div><span>02</span><h3>Thống nhất lịch</h3><p>Sau khi mua, hai bên trao đổi để gia sư tạo từng buổi học.</p></div><div><span>03</span><h3>Xác nhận buổi học</h3><p>Hai bên xác nhận sau buổi; số buổi và tiền học được cập nhật rõ ràng.</p></div></div></div></section>
  </main><footer className="footer"><div className="wrap footer-inner"><div className="brand"><Star size={32}/><span>Tutor<span className="brand-accent">Match</span></span></div><p>Học đúng người, vui đúng nhịp. ✦</p></div></footer></>;
}
