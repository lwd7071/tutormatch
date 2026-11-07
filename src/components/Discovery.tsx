"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Star } from "@/components/Star";
import { Pagination } from "@/components/Pagination";
import { api, responseData, useUser } from "@/lib/use-user";
import { provinces, wards, matchesDiscovery } from "@/lib/discovery";
import type {
  CatalogItemDto,
  CatalogPageDto,
  PublicSubjectDto,
  TutorDetailDto,
} from "@/lib/public-data";

const vnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n,
  );
const days = [
  "Chủ nhật",
  "Thứ hai",
  "Thứ ba",
  "Thứ tư",
  "Thứ năm",
  "Thứ sáu",
  "Thứ bảy",
];
const periodName: Record<string, string> = {
  morning: "Buổi sáng",
  afternoon: "Buổi chiều",
  evening: "Buổi tối",
};
const storeKey = "tutormatch:favorites";
function localFavorites() {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(storeKey) || "[]");
    return Array.isArray(value)
      ? value
          .filter(
            (id): id is string =>
              typeof id === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(id),
          )
          .slice(0, 20)
      : [];
  } catch {
    return [];
  }
}
type Filters = {
  query: string;
  subjectId: string;
  mode: string;
  maxPrice: string;
  day: string;
  period: string;
  provinceCode: string;
  wardCode: string;
};
const empty: Filters = {
  query: "",
  subjectId: "",
  mode: "",
  maxPrice: "",
  day: "",
  period: "",
  provinceCode: "",
  wardCode: "",
};
function labelSchedule(
  slots: { day: number; start: number; end: number }[],
  fallback = "",
) {
  if (!slots?.length) return fallback || "Chưa cập nhật lịch";
  const first = slots[0];
  const clock = (n: number) =>
    `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  return `${days[first.day]} ${clock(first.start)}–${clock(first.end)}${slots.length > 1 ? ` · +${slots.length - 1} khung` : ""}`;
}
function TutorCard({
  item,
  subjects,
  saved,
  onSave,
}: {
  item: CatalogItemDto;
  subjects: PublicSubjectDto[];
  saved: boolean;
  onSave: (id: string) => void;
}) {
  const { tutor, packages } = item;
  const names = [
    ...new Set(
      packages
        .map((p) => subjects.find((s) => s.id === p.subjectId)?.name)
        .filter(Boolean),
    ),
  ];
  const price = Math.min(...packages.map((p) => p.price / p.count));
  return (
    <article className="tutor-card">
      <div className="tutor-photo">
        {tutor.photoUrl ? (
          <img src={tutor.photoUrl} alt={`Ảnh gia sư ${tutor.name}`} />
        ) : (
          <span>{tutor.name.slice(0, 1)}</span>
        )}
      </div>
      <div className="tutor-card-body">
        <div className="tutor-card-top">
          <span className="tutor-label">
            {tutor.mode === "both"
              ? "Trực tuyến & trực tiếp"
              : tutor.mode === "offline"
                ? "Gặp trực tiếp"
                : "Học trực tuyến"}
          </span>
          <button
            className="save-button"
            type="button"
            aria-label={saved ? `Bỏ lưu ${tutor.name}` : `Lưu ${tutor.name}`}
            aria-pressed={saved}
            onClick={() => onSave(tutor.id)}
          >
            {saved ? "♥ Đã lưu" : "♡ Lưu"}
          </button>
        </div>
        <h3>{tutor.name}</h3>
        <p>{tutor.bio}</p>
        <dl className="tutor-facts">
          <div>
            <dt>Môn</dt>
            <dd>{names.join(", ") || "Chưa cập nhật"}</dd>
          </div>
          <div>
            <dt>Khu vực</dt>
            <dd>
              {tutor.mode === "online"
                ? "Học trực tuyến"
                : tutor.location || "Chưa cập nhật"}
            </dd>
          </div>
          <div>
            <dt>Lịch rảnh</dt>
            <dd>{labelSchedule(tutor.weeklySlots, tutor.availability)}</dd>
          </div>
          <div>
            <dt>Đánh giá</dt>
            <dd>
              {item.reviewCount
                ? `★ ${item.rating.toFixed(1)} · ${item.reviewCount} lượt`
                : "Chưa có đánh giá"}
            </dd>
          </div>
        </dl>
        <div className="tutor-bottom">
          <div>
            <small>Từ</small>
            <strong>
              {Number.isFinite(price) ? vnd(price) : "Chưa cập nhật"}
              <small> / buổi</small>
            </strong>
          </div>
          <Link className="button button-small" href={`/tutors/${tutor.id}`}>
            Xem hồ sơ
          </Link>
        </div>
      </div>
    </article>
  );
}

export function Discovery() {
  const { user } = useUser();
  const [filters, setFilters] = useState<Filters>(empty),
    [items, setItems] = useState<CatalogItemDto[]>([]),
    [subjects, setSubjects] = useState<PublicSubjectDto[]>([]),
    [featured, setFeatured] = useState<CatalogItemDto[]>([]),
    [matchFormUrl, setMatchFormUrl] = useState("");
  const [pageNumber, setPageNumber] = useState(1),
    [totalPages, setTotalPages] = useState(0),
    [loading, setLoading] = useState(true),
    [error, setError] = useState("");
  const [favorites, setFavorites] = useState<string[]>([]),
    [compare, setCompare] = useState<TutorDetailDto[]>([]),
    [compareError, setCompareError] = useState("");
  const [quizOpen, setQuizOpen] = useState(false),
    [matches, setMatches] = useState<CatalogItemDto[] | null>(null),
    [quizBusy, setQuizBusy] = useState(false);
  const generation = useRef(0);
  const set = (key: keyof Filters, value: string) => {
    setMatches(null);
    setPageNumber(1);
    setFilters((current) => ({
      ...current,
      [key]: value,
      ...(key === "provinceCode" ? { wardCode: "" } : {}),
      ...(key === "mode" && value === "online"
        ? { provinceCode: "", wardCode: "" }
        : {}),
    }));
  };
  const params = () =>
    new URLSearchParams(
      Object.entries(filters)
        .filter(([, value]) => value)
        .map(([key, value]) => [key, value]),
    );
  useEffect(() => {
    const current = ++generation.current;
    const timer = setTimeout(
      () => {
        setLoading(true);
        setError("");
        const query = params();
        query.set("page", "1");
        fetch(`/api/catalog?${query}`)
          .then((r) =>
            responseData<CatalogPageDto>(r, "Không tải được danh sách."),
          )
          .then((page) => {
            if (current !== generation.current) return;
            setItems(page.items);
            setSubjects(page.subjects);
            setFeatured(page.featured);
            setMatchFormUrl(page.matchFormUrl || "");
            setPageNumber(page.page);
            setTotalPages(page.totalPages);
          })
          .catch((e) => {
            if (current === generation.current) setError(e.message);
          })
          .finally(() => {
            if (current === generation.current) setLoading(false);
          });
      },
      filters.query || filters.maxPrice ? 250 : 0,
    );
    return () => clearTimeout(timer);
  }, [filters]);
  useEffect(() => {
    const local = localFavorites();
    setFavorites(local);
    if (!user) return;
    user
      .getIdToken()
      .then((token) =>
        fetch("/api/favorites", {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((r) =>
        responseData<{ tutorIds: string[] }>(
          r,
          "Không tải được danh sách đã lưu.",
        ),
      )
      .then(async (data) => {
        const merged = [...new Set([...data.tutorIds, ...local])].slice(0, 20);
        const result = await api(user, {
          action: "setFavorites",
          tutorIds: merged,
        });
        setFavorites(result.tutorIds);
        localStorage.setItem(storeKey, JSON.stringify(result.tutorIds));
      })
      .catch(() => {});
  }, [user]);
  async function toggleFavorite(id: string) {
    const next = favorites.includes(id)
      ? favorites.filter((value) => value !== id)
      : [...favorites, id].slice(0, 20);
    setFavorites(next);
    localStorage.setItem(storeKey, JSON.stringify(next));
    if (user)
      try {
        const result = await api(user, {
          action: "setFavorites",
          tutorIds: next,
        });
        setFavorites(result.tutorIds);
        localStorage.setItem(storeKey, JSON.stringify(result.tutorIds));
      } catch (e) {
        setCompareError(
          e instanceof Error ? e.message : "Không lưu được gia sư.",
        );
      }
  }
  async function loadPage(number: number) {
    if (loading || number < 1 || number > totalPages || number === pageNumber)
      return;
    const current = ++generation.current,
      query = params();
    query.set("page", String(number));
    setLoading(true);
    setError("");
    try {
      const result = await responseData<CatalogPageDto>(
        await fetch(`/api/catalog?${query}`),
        "Không tải được trang gia sư.",
      );
      if (current === generation.current) {
        setItems(result.items);
        setPageNumber(result.page);
        setTotalPages(result.totalPages);
      }
    } catch (e) {
      if (current === generation.current)
        setError(
          e instanceof Error ? e.message : "Không tải được trang gia sư.",
        );
    } finally {
      if (current === generation.current) setLoading(false);
    }
  }
  async function showCompare() {
    setCompareError("");
    try {
      const details = await Promise.all(
        favorites
          .slice(0, 3)
          .map((id) =>
            fetch(`/api/catalog/${encodeURIComponent(id)}`).then((r) =>
              r.ok
                ? responseData<TutorDetailDto>(r, "Không tải được hồ sơ.")
                : null,
            ),
          ),
      );
      setCompare(details.filter((item): item is TutorDetailDto => !!item));
      if (details.some((item) => !item)) {
        const valid = new Set(
          details
            .filter((item): item is TutorDetailDto => !!item)
            .map((item) => item.tutor.id),
        );
        const next = favorites.filter(
          (id) => !favorites.slice(0, 3).includes(id) || valid.has(id),
        );
        setFavorites(next);
        localStorage.setItem(storeKey, JSON.stringify(next));
        if (user) await api(user, { action: "setFavorites", tutorIds: next });
        setCompareError(
          "Một số gia sư đã tạm ẩn và được bỏ khỏi danh sách đã lưu.",
        );
      }
    } catch (e) {
      setCompareError(
        e instanceof Error ? e.message : "Không tải được bảng so sánh.",
      );
    }
  }
  async function runQuiz() {
    if (!filters.subjectId || !filters.mode) return;
    setQuizBusy(true);
    setError("");
    try {
      const query = params();
      query.delete("query");
      const page = await responseData<{ items: CatalogItemDto[] }>(
        await fetch(`/api/match?${query}`),
        "Không tìm được gia sư gợi ý.",
      );
      setMatches(page.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tìm được gia sư gợi ý.");
    } finally {
      setQuizBusy(false);
    }
  }
  const count = Object.values(filters).filter(Boolean).length;
  return (
    <>
      <section id="tim-gia-su" className="search-section">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <span className="eyebrow">BẮT ĐẦU TỪ ĐÂY</span>
              <h2>Tìm người dạy hợp gu</h2>
            </div>
            <p>Chọn điều bạn cần, TutorMatch giúp bạn tìm nhanh hơn.</p>
          </div>
          <div className="search-panel">
            <label>
              <span>Tên gia sư hoặc từ khóa</span>
              <input
                value={filters.query}
                onChange={(e) => set("query", e.target.value)}
                placeholder="Ví dụ: Toán, ôn thi..."
              />
            </label>
            <label>
              <span>Môn học</span>
              <select
                value={filters.subjectId}
                onChange={(e) => set("subjectId", e.target.value)}
              >
                <option value="">Tất cả môn học</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Hình thức</span>
              <select
                value={filters.mode}
                onChange={(e) => set("mode", e.target.value)}
              >
                <option value="">Trực tuyến & trực tiếp</option>
                <option value="online">Trực tuyến</option>
                <option value="offline">Trực tiếp</option>
              </select>
            </label>
            <label>
              <span>Giá tối đa / buổi</span>
              <input
                type="number"
                min="0"
                value={filters.maxPrice}
                onChange={(e) => set("maxPrice", e.target.value)}
                placeholder="Không giới hạn"
              />
            </label>
            <label>
              <span>Ngày rảnh</span>
              <select
                value={filters.day}
                onChange={(e) => set("day", e.target.value)}
              >
                <option value="">Ngày nào cũng được</option>
                {days.map((day, i) => (
                  <option key={i} value={i}>
                    {day}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Buổi học</span>
              <select
                value={filters.period}
                onChange={(e) => set("period", e.target.value)}
              >
                <option value="">Giờ nào cũng được</option>
                {Object.entries(periodName).map(([key, name]) => (
                  <option key={key} value={key}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Tỉnh/thành</span>
              <select
                value={filters.provinceCode}
                onChange={(e) => set("provinceCode", e.target.value)}
                disabled={filters.mode === "online"}
              >
                <option value="">Tất cả tỉnh/thành</option>
                {provinces.map((place) => (
                  <option key={place.code} value={place.code}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Phường/xã</span>
              <select
                value={filters.wardCode}
                onChange={(e) => set("wardCode", e.target.value)}
                disabled={!filters.provinceCode || filters.mode === "online"}
              >
                <option value="">Tất cả phường/xã</option>
                {wards
                  .filter(
                    (place) => place.provinceCode === filters.provinceCode,
                  )
                  .map((place) => (
                    <option key={place.code} value={place.code}>
                      {place.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          <div className="discovery-tools">
            <span>
              {count
                ? `${count} bộ lọc đang áp dụng`
                : "Đang xem tất cả gia sư"}
            </span>
            {count > 0 && (
              <button className="text-button" onClick={() => setFilters(empty)}>
                Xóa bộ lọc
              </button>
            )}
            <button
              className="text-button"
              onClick={() => {
                setQuizOpen((value) => !value);
                setMatches(null);
              }}
            >
              {quizOpen ? "Đóng gợi ý" : "Gợi ý gia sư hợp mình"}
            </button>
            {favorites.length > 0 && (
              <button className="text-button" onClick={showCompare}>
                So sánh đã lưu ({Math.min(favorites.length, 3)})
              </button>
            )}
          </div>
          {quizOpen && (
            <section className="quiz-panel" aria-label="Gợi ý gia sư">
              <h3>Gia sư nào hợp mình?</h3>
              <p>Trả lời vài câu hỏi để xem 3 hồ sơ phù hợp nhất.</p>
              <div className="quiz-fields">
                <label className="field">
                  <span>Bạn muốn học môn gì? *</span>
                  <select
                    value={filters.subjectId}
                    onChange={(e) => set("subjectId", e.target.value)}
                  >
                    <option value="">Chọn môn học</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Bạn muốn học theo cách nào? *</span>
                  <select
                    value={filters.mode}
                    onChange={(e) => set("mode", e.target.value)}
                  >
                    <option value="">Chọn hình thức</option>
                    <option value="online">Trực tuyến</option>
                    <option value="offline">Trực tiếp</option>
                  </select>
                </label>
                <label className="field">
                  <span>Ngân sách tối đa mỗi buổi?</span>
                  <input
                    type="number"
                    min="0"
                    value={filters.maxPrice}
                    onChange={(e) => set("maxPrice", e.target.value)}
                    placeholder="Không giới hạn"
                  />
                </label>
                <label className="field">
                  <span>Bạn rảnh ngày nào?</span>
                  <select
                    value={filters.day}
                    onChange={(e) => set("day", e.target.value)}
                  >
                    <option value="">Ngày nào cũng được</option>
                    {days.map((day, i) => (
                      <option key={i} value={i}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Bạn thích học buổi nào?</span>
                  <select
                    value={filters.period}
                    onChange={(e) => set("period", e.target.value)}
                  >
                    <option value="">Buổi nào cũng được</option>
                    {Object.entries(periodName).map(([key, name]) => (
                      <option key={key} value={key}>
                        {name}
                      </option>
                    ))}
                  </select>
                </label>
                {filters.mode === "offline" && (
                  <>
                    <label className="field">
                      <span>Bạn muốn học ở tỉnh/thành nào?</span>
                      <select
                        value={filters.provinceCode}
                        onChange={(e) => set("provinceCode", e.target.value)}
                      >
                        <option value="">Không giới hạn</option>
                        {provinces.map((place) => (
                          <option key={place.code} value={place.code}>
                            {place.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="field">
                      <span>Phường/xã nào?</span>
                      <select
                        value={filters.wardCode}
                        onChange={(e) => set("wardCode", e.target.value)}
                        disabled={!filters.provinceCode}
                      >
                        <option value="">Không giới hạn</option>
                        {wards
                          .filter(
                            (place) =>
                              place.provinceCode === filters.provinceCode,
                          )
                          .map((place) => (
                            <option key={place.code} value={place.code}>
                              {place.name}
                            </option>
                          ))}
                      </select>
                    </label>
                  </>
                )}
              </div>
              <div className="form-actions">
                <button
                  className="button button-small"
                  disabled={quizBusy || !filters.subjectId || !filters.mode}
                  onClick={runQuiz}
                >
                  {quizBusy ? "Đang tìm..." : "Xem 3 gợi ý"}
                </button>
              </div>
              {matches && (
                <div className="quiz-results">
                  {matches.length ? (
                    matches.map((item) => {
                      const schedule =
                        (filters.day || filters.period) &&
                        matchesDiscovery(item.tutor, {
                          day: filters.day ? Number(filters.day) : undefined,
                          period: filters.period,
                        });
                      const location =
                        filters.mode !== "online" &&
                        !!filters.provinceCode &&
                        item.tutor.provinceCode === filters.provinceCode;
                      return (
                        <div key={item.tutor.id}>
                          <Link href={`/tutors/${item.tutor.id}`}>
                            <strong>{item.tutor.name}</strong>
                          </Link>
                          <span>
                            {[
                              subjects.find((s) => s.id === filters.subjectId)
                                ?.name,
                              schedule ? "Hợp lịch" : "",
                              location ? "Hợp khu vực" : "",
                              "Hợp hình thức và ngân sách",
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <p>
                      Chưa có gia sư khớp. Thử tăng ngân sách, đổi hình thức
                      hoặc chọn lịch khác.
                    </p>
                  )}
                </div>
              )}
            </section>
          )}
          {compareError && (
            <p className="notice error" role="alert">
              {compareError}
            </p>
          )}
          {compare.length > 0 && (
            <section className="compare-panel">
              <h3>So sánh gia sư đã lưu</h3>
              <div className="compare-grid">
                {compare.map((detail) => (
                  <div key={detail.tutor.id}>
                    <Link href={`/tutors/${detail.tutor.id}`}>
                      <strong>{detail.tutor.name}</strong>
                    </Link>
                    <p>
                      Môn:{" "}
                      {[
                        ...new Set(
                          detail.packages.map(
                            (p) =>
                              detail.subjects.find((s) => s.id === p.subjectId)
                                ?.name,
                          ),
                        ),
                      ]
                        .filter(Boolean)
                        .join(", ") || "Chưa cập nhật"}
                    </p>
                    <p>
                      {detail.packages.length
                        ? `Từ ${vnd(Math.min(...detail.packages.map((p) => p.price / p.count)))} / buổi`
                        : "Giá: Chưa cập nhật"}
                    </p>
                    <p>
                      Lịch:{" "}
                      {labelSchedule(
                        detail.tutor.weeklySlots,
                        detail.tutor.availability,
                      )}
                    </p>
                    <p>Khu vực: {detail.tutor.location || "Chưa cập nhật"}</p>
                    <p>
                      Đánh giá:{" "}
                      {detail.reviewCount
                        ? `★ ${detail.rating.toFixed(1)} · ${detail.reviewCount} lượt`
                        : "Chưa có đánh giá"}
                    </p>
                  </div>
                ))}
              </div>
            </section>
          )}
          {loading ? (
            <div className="empty-card">Đang tìm gia sư cho bạn...</div>
          ) : error ? (
            <div className="empty-card error">{error}</div>
          ) : items.length ? (
            <div className="tutor-grid">
              {items.map((item) => (
                <TutorCard
                  key={item.tutor.id}
                  item={item}
                  subjects={subjects}
                  saved={favorites.includes(item.tutor.id)}
                  onSave={toggleFavorite}
                />
              ))}
            </div>
          ) : (
            <div className="empty-card">
              <Star size={82} mood="sleep" />
              <h3>Chưa có gia sư phù hợp</h3>
              <p>
                Chưa có gia sư khớp bộ lọc này. Gửi nhu cầu để TutorMatch liên hệ
                khi tìm được người phù hợp.
              </p>
              <a className="button button-outline" href="#gui-yeu-cau">Nhờ tìm gia sư</a>
              <button
                className="button button-outline"
                onClick={() => setFilters(empty)}
              >
                Xóa bộ lọc
              </button>
            </div>
          )}
          <Pagination
            page={pageNumber}
            totalPages={totalPages}
            busy={loading}
            label="gia sư"
            onPageChange={loadPage}
          />
        </div>
      </section>
      {featured.length > 0 && (
        <section className="wrap ranking-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">HỌC VIÊN ĐÁNH GIÁ</span>
              <h2>Gia sư được yêu thích</h2>
            </div>
            <p>Xếp theo điểm đánh giá từ các buổi học đã xác nhận.</p>
          </div>
          <div className="grid-3">
            {featured.map((item, i) => (
              <Link
                href={`/tutors/${item.tutor.id}`}
                className="panel"
                key={item.tutor.id}
              >
                <span className="eyebrow">#{i + 1} TRONG BẢNG XẾP HẠNG</span>
                <h3>{item.tutor.name}</h3>
                <strong>★ {item.rating.toFixed(1)}</strong>
                <p className="help-text">
                  {item.reviewCount} đánh giá đã xác minh
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      <section id="gui-yeu-cau" className="match-request-section">
        <div className="wrap">
          <span className="eyebrow">TUTOR MATCH TÌM GIÚP BẠN</span>
          <h2>Chưa thấy gia sư phù hợp?</h2>
          <p>
            Phụ huynh gửi nhu cầu học online qua biểu mẫu. Đây là yêu cầu tư vấn,
            chưa phải lịch học đã được xác nhận.
          </p>
          {matchFormUrl ? (
            <a className="button" href={matchFormUrl} target="_blank" rel="noreferrer">
              Mở biểu mẫu tìm gia sư <span aria-hidden>↗</span>
            </a>
          ) : (
            <p className="help-text">Biểu mẫu sẽ được mở khi TutorMatch sẵn sàng nhận yêu cầu.</p>
          )}
        </div>
      </section>
    </>
  );
}
