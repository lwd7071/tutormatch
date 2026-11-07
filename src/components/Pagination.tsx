"use client";

export function Pagination({ page, totalPages, busy = false, label = "Danh sách", onPageChange }: { page: number; totalPages: number; busy?: boolean; label?: string; onPageChange: (page: number) => void }) {
  if (totalPages < 2) return null;
  return <nav className="pagination" aria-label={`Phân trang ${label}`}>
    <button type="button" className="button button-small button-outline" disabled={busy || page <= 1} onClick={() => onPageChange(page - 1)}>Trước</button>
    {Array.from({ length: totalPages }, (_, index) => index + 1).map(number => <button key={number} type="button" className={`pagination-number${page === number ? " active" : ""}`} aria-label={`Trang ${number}`} aria-current={page === number ? "page" : undefined} disabled={busy} onClick={() => onPageChange(number)}>{number}</button>)}
    <button type="button" className="button button-small button-outline" disabled={busy || page >= totalPages} onClick={() => onPageChange(page + 1)}>Sau</button>
  </nav>;
}
