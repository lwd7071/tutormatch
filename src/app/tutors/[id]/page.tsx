"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Header } from "@/components/Header";
import { Pagination } from "@/components/Pagination";
import { Star } from "@/components/Star";
import { api, responseData, useUser } from "@/lib/use-user";
import type {
  PublicTutorDto,
  PublicPackageDto,
  PublicSubjectDto,
  PublicReviewDto,
  TutorDetailDto,
} from "@/lib/public-data";
import { sizedTutorPhotoUrl } from "@/lib/photo";
import { REVIEW_TAG_LABELS } from "@/lib/review-tags";

const vnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n,
  );
const when = (n: number) =>
  new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(n);

export default function TutorProfile() {
  const id = String(useParams().id),
    router = useRouter(),
    { user, login } = useUser();
  const [tutor, setTutor] = useState<PublicTutorDto | null>(null);
  const [packages, setPackages] = useState<PublicPackageDto[]>([]),
    [subjects, setSubjects] = useState<PublicSubjectDto[]>([]);
  const [reviews, setReviews] = useState<PublicReviewDto[]>([]),
    [packagePage, setPackagePage] = useState(1),
    [packageTotalPages, setPackageTotalPages] = useState(0),
    [reviewPage, setReviewPage] = useState(1),
    [reviewTotalPages, setReviewTotalPages] = useState(0);
  const [purchaseEnabled, setPurchaseEnabled] = useState(false);
  const [starts, setStarts] = useState<number[]>([]),
    [selectedStart, setSelectedStart] = useState(0);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  useEffect(() => {
    fetch(`/api/catalog/${encodeURIComponent(id)}`)
      .then((r) =>
        responseData<TutorDetailDto>(r, "Không tải được hồ sơ gia sư."),
      )
      .then((detail) => {
        setTutor(detail.tutor);
        setPackages(detail.packages);
        setSubjects(detail.subjects);
        setReviews(detail.reviews);
        setPackagePage(detail.packagePage);
        setPackageTotalPages(detail.packageTotalPages);
        setReviewPage(detail.reviewPage);
        setReviewTotalPages(detail.reviewTotalPages);
        setPurchaseEnabled(detail.purchaseEnabled);
        fetch(`/api/catalog/${encodeURIComponent(id)}/slots`)
          .then((r) =>
            responseData<{ starts: number[] }>(r, "Không tải được lịch rảnh."),
          )
          .then((slots) => setStarts(slots.starts))
          .catch((e) => setError(e.message));
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);
  async function loadProfilePage(
    kind: "packages" | "reviews",
    pageNumber: number,
  ) {
    setBusy(true);
    try {
      const params = new URLSearchParams({
        packagePage: String(kind === "packages" ? pageNumber : packagePage),
        reviewPage: String(kind === "reviews" ? pageNumber : reviewPage),
      });
      const result = await responseData<TutorDetailDto>(
        await fetch(`/api/catalog/${encodeURIComponent(id)}?${params}`),
        "Không tải được trang hồ sơ.",
      );
      setPackages(result.packages);
      setPackagePage(result.packagePage);
      setPackageTotalPages(result.packageTotalPages);
      setReviews(result.reviews);
      setReviewPage(result.reviewPage);
      setReviewTotalPages(result.reviewTotalPages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Không tải được trang hồ sơ.");
    } finally {
      setBusy(false);
    }
  }
  async function run(action: Record<string, unknown>) {
    setBusy(true);
    setError("");
    try {
      const signed = user || (await login()).user;
      const result = await api(signed, action);
      if (result.checkoutUrl) window.location.href = result.checkoutUrl;
      else router.push("/app");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
      if (action.action === "requestTrial")
        fetch(`/api/catalog/${encodeURIComponent(id)}/slots`)
          .then((r) =>
            responseData<{ starts: number[] }>(r, "Không tải được lịch."),
          )
          .then((d) => setStarts(d.starts))
          .catch(() => {});
    } finally {
      setBusy(false);
    }
  }
  if (loading)
    return (
      <>
        <Header />
        <div className="wrap loading-area">Đang tải hồ sơ gia sư...</div>
      </>
    );
  if (!tutor)
    return (
      <>
        <Header />
        <div className="wrap loading-area">
          <Star />
          <h2>Chưa tìm thấy gia sư</h2>
          <p>{error || "Hồ sơ này hiện chưa công khai."}</p>
        </div>
      </>
    );
  return (
    <>
      <Header />
      <main className="wrap">
        <div className="profile-hero">
          <div className="profile-portrait">
            {tutor.photoUrl ? (
              <img
                className="profile-portrait"
                src={sizedTutorPhotoUrl(tutor.photoUrl, "profile")}
                alt={`Ảnh ${tutor.name}`}
                width={480}
                height={480}
                decoding="async"
              />
            ) : (
              tutor.name?.slice(0, 1)
            )}
          </div>
          <div>
            <span className="eyebrow">GIA SƯ ĐÃ ĐƯỢC DUYỆT ✦</span>
            <h1>{tutor.name}</h1>
            <p>{tutor.bio}</p>
            <span className="badge success">
              {tutor.mode === "both"
                ? "Trực tuyến & trực tiếp"
                : tutor.mode === "offline"
                  ? "Gặp trực tiếp"
                  : "Học trực tuyến"}
            </span>{" "}
            {tutor.location && <span className="badge">{tutor.location}</span>}
          </div>
        </div>
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
        <div className="grid-2">
          <section className="panel">
            <h2>Gói học đang mở</h2>
            <div className="stack">
              {packages.length ? (
                packages.map((p) => (
                  <div className="profile-pack" key={p.id}>
                    <div>
                      <strong>{p.title}</strong>
                      <p>
                        {subjects.find((s) => s.id === p.subjectId)?.name ||
                          "Môn học"}{" "}
                        · {p.count} buổi · {p.durationMinutes} phút/buổi ·{" "}
                        {p.mode === "both"
                          ? "Cả hai"
                          : p.mode === "offline"
                            ? "Trực tiếp"
                            : "Trực tuyến"}
                      </p>
                      <strong>{vnd(p.price)}</strong>
                    </div>
                    {purchaseEnabled && (
                      <button
                        className="button button-small"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "createOrder", packageId: p.id })
                        }
                      >
                        Mua gói
                      </button>
                    )}
                  </div>
                ))
              ) : (
                <p>Gia sư chưa mở bán gói học.</p>
              )}
            </div>
            <Pagination
              page={packagePage}
              totalPages={packageTotalPages}
              busy={busy}
              label="gói học"
              onPageChange={(number) =>
                void loadProfilePage("packages", number)
              }
            />
          </section>
          <section className="stack">
            <div className="panel">
              <h2>Yêu cầu gói học</h2>
              <p>Cho gia sư biết mục tiêu, nội dung và khung giờ bạn mong muốn. Gia sư sẽ gửi gói riêng để bạn xem trước khi thanh toán.</p>
              <form className="review-form" onSubmit={(event) => {
                event.preventDefault();
                const values = Object.fromEntries(new FormData(event.currentTarget).entries());
                void run({ action: "requestPackage", tutorId: id, subjectId: values.subjectId, purpose: values.purpose, topics: values.topics, count: Number(values.count), durationMinutes: Number(values.durationMinutes), mode: values.mode, timePreference: values.timePreference, note: values.note });
              }}>
                <label className="field"><span>Môn học</span><select name="subjectId" required>{subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}</select></label>
                <label className="field"><span>Bạn muốn đạt mục tiêu gì?</span><input name="purpose" required maxLength={300} placeholder="Ví dụ: ôn thi cuối kỳ, củng cố kiến thức" /></label>
                <label className="field"><span>Bạn muốn học những nội dung nào?</span><textarea name="topics" required maxLength={1000} /></label>
                <div className="form-grid">
                  <label className="field"><span>Số buổi mong muốn</span><input name="count" type="number" min="1" max="100" defaultValue="4" required /></label>
                  <label className="field"><span>Phút mỗi buổi</span><input name="durationMinutes" type="number" min="15" max="240" step="15" defaultValue="60" required /></label>
                  <label className="field"><span>Hình thức</span><select name="mode"><option value="online">Trực tuyến</option><option value="offline">Trực tiếp</option></select></label>
                </div>
                <label className="field"><span>Ngày và khung giờ bạn có thể học</span><textarea name="timePreference" required maxLength={500} placeholder="Ví dụ: tối thứ 2, 4, 6 sau 19:00" /></label>
                <label className="field"><span>Ghi chú thêm (không bắt buộc)</span><textarea name="note" maxLength={1000} /></label>
                <button className="button" disabled={busy || !subjects.length}>Gửi yêu cầu</button>
              </form>
            </div>
            <div className="panel" id="hoc-thu">
              <h2>Học thử miễn phí</h2>
              <p>
                Chọn một giờ rảnh trong 14 ngày tới. Gia sư sẽ xác nhận trước
                khi lịch được chốt.
              </p>
              {starts.length ? (
                <>
                  <label className="field">
                    <span>Giờ đề xuất · giờ Việt Nam</span>
                    <select
                      value={selectedStart}
                      onChange={(e) => setSelectedStart(Number(e.target.value))}
                    >
                      <option value={0}>Chọn giờ học thử</option>
                      {starts.map((start) => (
                        <option value={start} key={start}>
                          {when(start)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="form-actions">
                    <button
                      className="button button-outline"
                      disabled={busy || !selectedStart}
                      onClick={() =>
                        run({
                          action: "requestTrial",
                          tutorId: id,
                          start: selectedStart,
                        })
                      }
                    >
                      Gửi yêu cầu học thử
                    </button>
                  </div>
                </>
              ) : (
                <p className="help-text">
                  Gia sư chưa mở giờ học thử trong 14 ngày tới.
                </p>
              )}
            </div>
            <div className="panel">
              <h2>Lịch rảnh</h2>
              <p>
                {tutor.availability ||
                  (tutor.weeklySlots?.length
                    ? "Xem các giờ có thể chọn phía trên."
                    : "Gia sư chưa cập nhật lịch rảnh.")}
              </p>
            </div>
          </section>
        </div>
        <section className="panel">
          <h2>Đánh giá từ học viên</h2>
          {reviews.length ? (
            reviews.map((r) => (
              <div className="item" key={r.id}>
                <div>
                  <strong>
                    {"★".repeat(r.stars)}
                    {"☆".repeat(5 - r.stars)}
                  </strong>
                  <p>{r.text}</p>
                  {!!r.tags.length && (
                    <div className="review-public-tags" aria-label="Hashtag từ học viên">
                      {r.tags.map((tag) => (
                        <span className="review-public-tag" key={tag}>#{REVIEW_TAG_LABELS[tag]}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p className="help-text">
              Chưa có đánh giá từ buổi học trả phí đã hoàn thành.
            </p>
          )}
          <Pagination
            page={reviewPage}
            totalPages={reviewTotalPages}
            busy={busy}
            label="đánh giá"
            onPageChange={(number) => void loadProfilePage("reviews", number)}
          />
        </section>
      </main>
    </>
  );
}
