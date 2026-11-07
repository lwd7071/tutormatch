"use client";
import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { User } from "firebase/auth";
import { Header } from "@/components/Header";
import { Star } from "@/components/Star";
import { TutorProfileEditor } from "@/components/TutorProfileEditor";
import { AdminTutorReview } from "@/components/AdminTutorReview";
import { canCancelSession } from "@/lib/public-data";
import { MobileNav, type NavItem } from "@/components/MobileNav";
import { api, chatPage, pageList, privateData, useUser } from "@/lib/use-user";
import { AvailabilityEditor } from "@/components/AvailabilityEditor";
import { Pagination } from "@/components/Pagination";

type Row = Record<string, any>;
const vnd = (n: number) =>
  new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(
    n || 0,
  );
const when = (n: number) =>
  new Intl.DateTimeFormat("vi-VN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(n);
const status: Record<string, string> = {
  pending_payment: "Chờ thanh toán",
  pending_tutor: "Chờ gia sư nhận",
  active: "Đang học",
  closed: "Đã học hết",
  refund_pending: "Chờ hoàn tiền",
  refunded: "Đã hoàn tiền",
  scheduled: "Sắp học",
  confirmed: "Đã xác nhận",
  cancelled: "Đã hủy",
  dispute: "Cần admin xử lý",
  pending: "Chờ xử lý",
  needs_details: "Cần tài khoản nhận tiền",
  completed: "Hoàn tất",
  rejected: "Từ chối",
  requested: "Chờ nhận",
  accepted: "Đã nhận",
  approved: "Đã duyệt",
  suspended: "Tạm ẩn",
};
const resourceLabel: Record<string, string> = {
  orders: "đơn học",
  sessions: "buổi học",
  refunds: "yêu cầu hoàn tiền",
  withdrawals: "lượt rút tiền",
  submissions: "hồ sơ chờ duyệt",
  tutors: "gia sư",
  notices: "thông báo",
  trials: "yêu cầu học thử",
  packages: "gói học",
  users: "người dùng",
  subjects: "môn học",
  reviews: "đánh giá",
};
const field = (
  name: string,
  label: string,
  type = "text",
  value?: string | number,
  required = true,
) => (
  <label className="field" key={name}>
    <span>{label}</span>
    <input
      name={name}
      type={name.endsWith("Url") ? "text" : type}
      defaultValue={value}
      required={required}
    />
  </label>
);
function values(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault();
  return Object.fromEntries(new FormData(e.currentTarget).entries());
}
function Badge({ value }: { value: string }) {
  return (
    <span
      className={`badge ${["active", "confirmed", "completed"].includes(value) ? "success" : ["dispute", "refund_pending", "pending_tutor", "pending"].includes(value) ? "warn" : ["cancelled", "rejected"].includes(value) ? "danger" : ""}`}
    >
      {status[value] || value}
    </span>
  );
}

export default function Workspace() {
  return (
    <Suspense
      fallback={
        <>
          <Header />
          <main className="loading-area">Đang mở khu vực của bạn...</main>
        </>
      }
    >
      <WorkspaceContent />
    </Suspense>
  );
}

function WorkspaceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, loading: authLoading, login } = useUser();
  const [data, setData] = useState<Row | null>(null);
  const [dataRevision, setDataRevision] = useState(0);
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const [loadingPages, setLoadingPages] = useState<Record<string, boolean>>({});
  const [adminView, setAdminView] = useState<"queue" | "all">("queue");
  const [historyData, setHistoryData] = useState<Row | null>(null);
  const refresh = useCallback(async (signed: User) => {
    setData(await privateData(signed));
    setDataRevision((revision) => revision + 1);
  }, []);
  useEffect(() => {
    if (user) refresh(user).catch((e) => setError(e.message));
  }, [user, refresh]);
  async function run(action: Row, success = "Đã cập nhật thành công.") {
    if (!user) return;
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const result = await api(user, action);
      if (result.checkoutUrl) {
        location.href = result.checkoutUrl;
        return;
      }
      await refresh(user);
      if (action.action === "becomeTutor") router.push("/app?tab=profile");
      setMessage(success);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Có lỗi xảy ra.");
    } finally {
      setBusy(false);
    }
  }
  const role = data?.user?.role || "student";
  const tabs =
    role === "admin"
      ? [
          ["overview", "Tổng quan"],
          ["work", "Cần rà soát"],
          ["tutors", "Duyệt gia sư"],
          ["disputes", "Buổi tranh chấp"],
          ["money", "Hoàn & rút tiền"],
          ["users", "Người dùng"],
          ["reviews", "Đánh giá"],
          ["settings", "Thiết lập"],
        ]
      : role === "tutor"
        ? [
            ["overview", "Tổng quan"],
            ["profile", "Hồ sơ & gói"],
            ["orders", "Học viên"],
            ["sessions", "Lịch học"],
            ["wallet", "Thu nhập"],
            ["chat", "Tin nhắn"],
            ["notices", "Thông báo"],
          ]
        : [
            ["overview", "Tổng quan"],
            ["orders", "Gói của tôi"],
            ["sessions", "Lịch học"],
            ["chat", "Tin nhắn"],
            ["notices", "Thông báo"],
            ["becomeTutor", "Trở thành gia sư"],
          ];
  const requestedTab = searchParams.get("tab") || "overview";
  const tab = tabs.some(([key]) => key === requestedTab)
    ? requestedTab
    : "overview";
  const settingsSection =
    ["fee", "matchForm"].includes(searchParams.get("section") || "")
      ? searchParams.get("section")!
      : "subjects";
  const tabResources: Record<string, string[]> =
    role === "admin"
      ? {
          tutors: ["submissions", "tutors"],
          disputes: ["sessions"],
          money: ["refunds", "withdrawals"],
          users: ["users"],
          reviews: ["reviews"],
          settings: settingsSection === "subjects" ? ["subjects"] : [],
        }
      : role === "tutor"
        ? {
            profile: ["packages", "subjects"],
            orders: ["orders", "trials"],
            sessions: ["sessions", "orders", "trials"],
            wallet: ["withdrawals"],
            notices: ["notices"],
          }
        : {
            orders: ["orders", "refunds"],
            sessions: ["sessions"],
            notices: ["notices"],
          };
  if (tab === "chat") tabResources.chat = ["orders", "trials"];
  const resourceKey = (tabResources[tab] || []).join(",");
  const pageLoadGeneration = useRef(0);
  const pageNumbers = useRef<Record<string, number>>({});
  const pageKey = (view: string, resource: string) => `${view}:${resource}`;
  useEffect(() => {
    setAdminView("queue");
    setHistoryData(null);
  }, [tab]);
  useEffect(() => {
    for (const resource of resourceKey.split(",").filter(Boolean))
      pageNumbers.current[pageKey(adminView, resource)] = 1;
  }, [tab, resourceKey, adminView]);
  useEffect(() => {
    if (
      !user ||
      !data ||
      !resourceKey ||
      (role === "admin" &&
        adminView === "all" &&
        ["money", "disputes"].includes(tab))
    )
      return;
    const generation = ++pageLoadGeneration.current;
    const resources = resourceKey.split(",");
    const view = role === "admin" && adminView === "all" ? "all" : "queue";
    Promise.all(
      resources.map((resource) =>
        pageList(
          user,
          resource,
          pageNumbers.current[pageKey(view, resource)] || 1,
          view,
        ),
      ),
    )
      .then((pages) => {
        if (generation !== pageLoadGeneration.current) return;
        resources.forEach((resource, index) => {
          pageNumbers.current[pageKey(view, resource)] = pages[index].page;
        });
        setData((current) =>
          current
            ? resources.reduce(
                (next, resource, index) => ({
                  ...next,
                  [resource]: pages[index].items,
                  pageInfo: {
                    ...next.pageInfo,
                    [resource]: {
                      page: pages[index].page,
                      totalPages: pages[index].totalPages,
                      totalItems: pages[index].totalItems,
                    },
                  },
                }),
                current,
              )
            : current,
        );
      })
      .catch((cause) => {
        if (generation === pageLoadGeneration.current)
          setError(
            cause instanceof Error
              ? cause.message
              : "Không tải được danh sách.",
          );
      });
    return () => {
      pageLoadGeneration.current++;
    };
  }, [user, data?.user?.uid, dataRevision, resourceKey, role, tab, adminView]);
  const shownData =
    role === "admin" &&
    adminView === "all" &&
    historyData &&
    ["money", "disputes"].includes(tab)
      ? { ...data, ...historyData }
      : data;
  async function showAdminHistory() {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      const resources =
        tab === "money" ? ["refunds", "withdrawals"] : ["sessions"];
      const pages = await Promise.all(
        resources.map((resource) => pageList(user, resource, 1, "all")),
      );
      const values: Row = { pageInfo: {} };
      resources.forEach((resource, index) => {
        pageNumbers.current[pageKey("all", resource)] = pages[index].page;
        values[resource] = pages[index].items;
        values.pageInfo[resource] = {
          page: pages[index].page,
          totalPages: pages[index].totalPages,
          totalItems: pages[index].totalItems,
        };
      });
      setHistoryData(values);
      setAdminView("all");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Không tải được lịch sử.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function loadPage(resource: string, pageNumber: number) {
    const info = shownData?.pageInfo?.[resource];
    if (
      !user ||
      !info ||
      pageNumber < 1 ||
      pageNumber > info.totalPages ||
      pageNumber === info.page ||
      loadingPages[resource]
    )
      return;
    const view = role === "admin" && adminView === "all" ? "all" : "queue";
    setLoadingPages((current) => ({ ...current, [resource]: true }));
    setError("");
    try {
      const result = await pageList(user, resource, pageNumber, view);
      pageNumbers.current[pageKey(view, resource)] = result.page;
      const update = (current: Row | null) =>
        current
          ? {
              ...current,
              [resource]: result.items,
              pageInfo: {
                ...current.pageInfo,
                [resource]: {
                  page: result.page,
                  totalPages: result.totalPages,
                  totalItems: result.totalItems,
                },
              },
            }
          : current;
      if (view === "all") setHistoryData(update);
      else setData(update);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Không tải được trang dữ liệu.",
      );
    } finally {
      setLoadingPages((current) => ({ ...current, [resource]: false }));
    }
  }
  const primary: NavItem[] =
    role === "admin"
      ? [
          { label: "Tổng quan", href: "/app?tab=overview", icon: "home" },
          { label: "Duyệt", href: "/app?tab=tutors", icon: "shield" },
          { label: "Tranh chấp", href: "/app?tab=disputes", icon: "calendar" },
          { label: "Tiền", href: "/app?tab=money", icon: "money" },
          { label: "Thêm", href: "#more", icon: "more" },
        ]
      : role === "tutor"
        ? [
            { label: "Tổng quan", href: "/app?tab=overview", icon: "home" },
            { label: "Lịch", href: "/app?tab=sessions", icon: "calendar" },
            { label: "Học viên", href: "/app?tab=orders", icon: "users" },
            { label: "Tin nhắn", href: "/app?tab=chat", icon: "chat" },
            { label: "Thêm", href: "#more", icon: "more" },
          ]
        : [
            { label: "Tổng quan", href: "/app?tab=overview", icon: "home" },
            { label: "Gia sư", href: "/#tim-gia-su", icon: "search" },
            { label: "Lịch", href: "/app?tab=sessions", icon: "calendar" },
            { label: "Tin nhắn", href: "/app?tab=chat", icon: "chat" },
            { label: "Thêm", href: "#more", icon: "more" },
          ];
  const moreItems: NavItem[] = tabs
    .filter(([key]) => !primary.some((item) => item.href === `/app?tab=${key}`))
    .map(([key, label]) => ({
      label,
      href: `/app?tab=${key}`,
      icon:
        key === "orders"
          ? "book"
          : key === "wallet"
            ? "money"
            : key === "users"
              ? "users"
              : key === "settings"
                ? "shield"
                : "help",
    }));
  if (authLoading)
    return (
      <>
        <Header />
        <div className="loading-area">Đang kiểm tra đăng nhập...</div>
      </>
    );
  if (!user)
    return (
      <>
        <Header />
        <main className="wrap loading-area">
          <Star size={92} />
          <h1>Xin chào bạn!</h1>
          <p>Đăng nhập Google để xem gói học và lịch của mình.</p>
          <button
            className="button"
            onClick={() => login().catch((e) => setError(e.message))}
          >
            Đăng nhập Google
          </button>
          {error && <p className="notice error">{error}</p>}
        </main>
      </>
    );
  return (
    <>
      <Header hideMobileNav={!!data} />
      <main className={`app-shell role-${role}`}>
        <div className="wrap app-main">
          <div className="app-heading">
            <div>
              <span className="eyebrow">GÓC CỦA BẠN ✦</span>
              <h1>
                {role === "admin"
                  ? "Bảng điều hành"
                  : role === "tutor"
                    ? "Xin chào gia sư!"
                    : "Học vui hôm nay nhé!"}
              </h1>
              <p>{user.displayName || user.email}</p>
            </div>
            <Star size={75} mood="wink" />
          </div>
          {error && (
            <div className="notice error" role="alert">
              {error}
            </div>
          )}
          {message && (
            <div className="notice" role="status">
              {message}
            </div>
          )}
          {!data ? (
            <div className="panel">
              Đang tải dữ liệu...{" "}
              {error && (
                <button
                  className="button button-small"
                  onClick={() => refresh(user)}
                >
                  Thử lại
                </button>
              )}
            </div>
          ) : (
            <>
              <nav className="tabs" aria-label="Khu vực của tôi">
                {tabs.map(([key, label]) => (
                  <Link
                    key={key}
                    href={`/app?tab=${key}`}
                    scroll={false}
                    aria-current={tab === key ? "page" : undefined}
                    className={`tab ${tab === key ? "active" : ""}`}
                  >
                    {label}
                  </Link>
                ))}
              </nav>
              {role === "student" &&
                (tab === "becomeTutor" ? (
                  <TutorProfileEditor
                    user={user}
                    data={data}
                    run={run}
                    refresh={refresh}
                    busy={busy}
                  />
                ) : (
                  <>
                    {tab === "orders" && <PendingPayments data={data} />}
                    <StudentView tab={tab} data={data} run={run} busy={busy} />
                  </>
                ))}
              {role === "tutor" && (
                <>
                  {tab === "profile" && (
                    <>
                      <TutorProfileEditor
                        user={user}
                        data={data}
                        run={run}
                        refresh={refresh}
                        busy={busy}
                      />
                      <AvailabilityEditor
                        profile={data.profile || {}}
                        run={run}
                        busy={busy}
                      />
                      <PackageTools data={data} run={run} busy={busy} />
                      <CreatePackageForm data={data} run={run} busy={busy} />
                    </>
                  )}
                  <TutorView tab={tab} data={data} run={run} busy={busy} />
                  {tab === "overview" && <NoticesPanel data={data} />}
                </>
              )}
              {role === "admin" && (
                <>
                  {tab === "work" && user && <AdminWorkQueue user={user} busy={busy} onDone={async () => { await refresh(user); setMessage("Đã xử lý mục được chọn."); }} />}
                  {["money", "disputes"].includes(tab) && (
                    <div
                      className="item-actions"
                      role="group"
                      aria-label="Chế độ danh sách"
                    >
                      <button
                        className="button button-outline"
                        aria-pressed={adminView === "queue"}
                        disabled={busy}
                        onClick={() => setAdminView("queue")}
                      >
                        Cần xử lý
                      </button>
                      <button
                        className="button button-outline"
                        aria-pressed={adminView === "all"}
                        disabled={busy}
                        onClick={() => void showAdminHistory()}
                      >
                        Tất cả
                      </button>
                    </div>
                  )}
                  {tab === "settings" && (
                    <>
                      <nav
                        className="settings-subnav"
                        aria-label="Mục thiết lập"
                      >
                        {([
                          ["subjects", "Môn học"],
                          ["fee", "Phí nền tảng"],
                          ["matchForm", "Form tìm gia sư"],
                        ] as const).map(([section, label]) => (
                          <Link
                            key={section}
                            href={`/app?tab=settings&section=${section}`}
                            scroll={false}
                            aria-current={
                              settingsSection === section ? "page" : undefined
                            }
                            className={`settings-subnav-link${
                              settingsSection === section ? " active" : ""
                            }`}
                          >
                            {label}
                          </Link>
                        ))}
                      </nav>
                      <div key={settingsSection} className="settings-page">
                        {settingsSection === "subjects" ? (
                          <SubjectTools data={data} run={run} busy={busy} />
                        ) : settingsSection === "fee" ? (
                          <AdminView
                            tab="settings"
                            data={shownData || data}
                            run={run}
                            busy={busy}
                            user={user}
                          />
                        ) : (
                          <MatchFormSettings data={data} run={run} busy={busy} />
                        )}
                      </div>
                    </>
                  )}
                  {tab === "money" && (
                    <RefundReviewTools
                      data={shownData || data}
                      run={run}
                      busy={busy}
                    />
                  )}
                  {tab !== "settings" && (
                    <AdminView
                      tab={tab}
                      data={shownData || data}
                      run={run}
                      busy={busy}
                      user={user}
                    />
                  )}
                </>
              )}
              {(tabResources[tab] || []).map((resource) => {
                const info = shownData?.pageInfo?.[resource];
                return (
                  info && (
                    <Pagination
                      key={resource}
                      page={info.page}
                      totalPages={info.totalPages}
                      busy={!!loadingPages[resource]}
                      label={resourceLabel[resource] || resource}
                      onPageChange={(number) => void loadPage(resource, number)}
                    />
                  )
                );
              })}
            </>
          )}
        </div>
      </main>
      {data && (
        <MobileNav
          items={primary}
          activeHref={`/app?tab=${tab}`}
          moreItems={moreItems}
        />
      )}
    </>
  );
}

function PackageTools({
  data,
  run,
  busy,
}: {
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
}) {
  const packages: Row[] = data.packages || [];
  if (!packages.length) return null;
  return (
    <div className="panel">
      <h2>Quản lý gói đang bán</h2>
      {packages.map((p) => (
        <div className="item" key={p.id}>
          <div>
            <strong>{p.title}</strong>
            <small>
              {vnd(p.price)} · {p.count} buổi · {p.durationMinutes} phút/buổi
            </small>
            <Badge value={p.active ? "active" : "Tạm dừng"} />
          </div>
          <div className="item-actions">
            <button
              className="button button-small button-outline"
              disabled={busy}
              onClick={() => {
                const title = prompt("Tên gói:", p.title),
                  price = prompt("Giá mới (VND):", String(p.price)),
                  count = prompt("Số buổi:", String(p.count)),
                  duration = prompt(
                    "Phút mỗi buổi:",
                    String(p.durationMinutes),
                  );
                if (title && price && count && duration)
                  run({
                    action: "savePackage",
                    id: p.id,
                    title,
                    price: Number(price),
                    count: Number(count),
                    durationMinutes: Number(duration),
                    subjectId: p.subjectId,
                    mode: p.mode,
                    active: p.active,
                  });
              }}
            >
              Sửa gói
            </button>
            <button
              className="button button-small button-outline"
              disabled={busy}
              onClick={() => run({ action: "togglePackage", id: p.id })}
            >
              {p.active ? "Tạm dừng" : "Mở bán"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function CreatePackageForm({
  data,
  run,
  busy,
}: {
  data: Row;
  run: (a: Row, success?: string) => void;
  busy: boolean;
}) {
  if (data.profile?.status !== "approved") return null;
  return (
    <div className="panel">
      <h2>Tạo gói học mới</h2>
      <form
        onSubmit={(event) => {
          const values = Object.fromEntries(
            new FormData(event.currentTarget).entries(),
          );
          event.preventDefault();
          run({
            action: "savePackage",
            title: values.title,
            subjectId: values.subjectId,
            price: Number(values.price),
            count: Number(values.count),
            durationMinutes: Number(values.durationMinutes),
            mode: values.mode,
            active: true,
          });
          event.currentTarget.reset();
        }}
      >
        <div className="form-grid">
          {field("title", "Tên gói")}
          <label className="field">
            <span>Môn học</span>
            <select name="subjectId" required>
              {(data.subjects || []).map((s: Row) => (
                <option value={s.id} key={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
          {field("price", "Tổng giá (VND)", "number")}
          {field("count", "Số buổi", "number", "1")}
          {field("durationMinutes", "Phút mỗi buổi", "number", "60")}
          <label className="field">
            <span>Hình thức</span>
            <select name="mode">
              <option value="online">Trực tuyến</option>
              <option value="offline">Trực tiếp</option>
              <option value="both">Cả hai</option>
            </select>
          </label>
        </div>
        <div className="form-actions">
          <button className="button" disabled={busy || !data.subjects?.length}>
            Mở bán gói
          </button>
        </div>
      </form>
    </div>
  );
}

function MatchFormSettings({
  data,
  run,
  busy,
}: {
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
}) {
  return (
    <div className="panel">
      <h2>Biểu mẫu tìm gia sư</h2>
      <p>Dán link Google Forms để hiện nút gửi nhu cầu trên trang chủ. Xóa link để tạm ẩn nút.</p>
      <form
        className="form-actions"
        onSubmit={(event) => {
          const value = values(event).url;
          run(
            { action: "admin", kind: "matchFormUrl", url: String(value || "") },
            "Đã lưu link biểu mẫu.",
          );
        }}
      >
        <label className="field" style={{ flex: 1, minWidth: 260 }}>
          <span>Link Google Forms</span>
          <input
            name="url"
            type="url"
            defaultValue={data.settings?.matchFormUrl || ""}
            placeholder="https://docs.google.com/forms/d/e/.../viewform"
          />
        </label>
        <button className="button" disabled={busy}>Lưu link</button>
      </form>
    </div>
  );
}

function SubjectTools({
  data,
  run,
  busy,
}: {
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
}) {
  const subjects: Row[] = data.subjects || [];
  return (
    <div className="panel">
      <h2>Quản lý môn học</h2>
      <form
        className="form-actions"
        onSubmit={(e) => {
          const v = values(e);
          run(
            { action: "admin", kind: "subject", name: v.name },
            "Đã thêm môn học.",
          );
          e.currentTarget.reset();
        }}
      >
        {field("name", "Tên môn mới")}
        <button className="button" disabled={busy}>
          Thêm môn
        </button>
      </form>
      {subjects.length ? (
        subjects.map((s) => (
          <div className="item" key={s.id}>
            <div>
              <strong>{s.name}</strong>
              <small>{s.active ? "Đang hoạt động" : "Đang tạm dừng"}</small>
            </div>
            <button
              className="button button-small button-outline"
              disabled={busy}
              onClick={() =>
                run({ action: "admin", kind: "toggleSubject", id: s.id })
              }
            >
              {s.active ? "Tạm dừng" : "Bật lại"}
            </button>
          </div>
        ))
      ) : (
        <p>Chưa có môn học nào.</p>
      )}
    </div>
  );
}

function PendingPayments({ data }: { data: Row }) {
  const pending: Row[] = (data.orders || []).filter(
    (o: Row) => o.status === "pending_payment" && o.checkoutUrl,
  );
  if (!pending.length) return null;
  return (
    <div className="panel">
      <h2>Thanh toán chưa hoàn tất</h2>
      {pending.map((o) => (
        <div className="item" key={o.id}>
          <div>
            <strong>{o.title}</strong>
            <small>{vnd(o.price)}</small>
          </div>
          <a className="button button-small" href={o.checkoutUrl}>
            Tiếp tục thanh toán
          </a>
        </div>
      ))}
    </div>
  );
}

function RefundReviewTools({
  data,
  run,
  busy,
}: {
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
}) {
  const requests: Row[] = (data.refunds || []).filter(
    (r: Row) =>
      r.source === "student" && ["needs_details", "pending"].includes(r.status),
  );
  if (!requests.length) return null;
  return (
    <div className="panel">
      <h2>Xem xét yêu cầu hoàn tiền</h2>
      {requests.map((r) => (
        <div className="item" key={r.id}>
          <div>
            <strong>{vnd(r.amount)}</strong>
            <small>{r.reason}</small>
          </div>
          <button
            className="button button-small button-outline"
            disabled={busy}
            onClick={() => {
              const reason = prompt("Lý do từ chối hoàn tiền:");
              if (reason)
                run({
                  action: "admin",
                  kind: "refundReject",
                  id: r.id,
                  reason,
                });
            }}
          >
            Từ chối yêu cầu
          </button>
        </div>
      ))}
    </div>
  );
}

function NoticesPanel({ data }: { data: Row }) {
  const notices: Row[] = (data.notices || [])
    .sort((a: Row, b: Row) => b.at - a.at)
    .slice(0, 8);
  return (
    <div className="panel">
      <h2>Thông báo gần đây</h2>
      {notices.length ? (
        notices.map((n) => (
          <div className="item" key={n.id}>
            <div>
              <strong>{n.text}</strong>
              <small>{when(n.at)}</small>
            </div>
          </div>
        ))
      ) : (
        <p>Chưa có thông báo mới.</p>
      )}
    </div>
  );
}

function StudentView({
  tab,
  data,
  run,
  busy,
}: {
  tab: string;
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
}) {
  const orders: Row[] = data.orders || [],
    sessions: Row[] = data.sessions || [];
  const upcoming = sessions
    .filter((s) => s.status === "scheduled" && s.start > Date.now())
    .sort((a, b) => a.start - b.start)[0];
  const needsConfirm = sessions.filter(
    (s) =>
      s.status === "scheduled" &&
      s.end <= Date.now() &&
      s.end + 86_400_000 >= Date.now() &&
      !s.confirmations?.student,
  );
  const available = orders
    .filter((o) => o.status === "active")
    .reduce((n, o) => n + o.count - o.confirmedCount - o.reservedCount, 0);
  if (tab === "overview")
    return (
      <>
        <div className="grid-3">
          <div className="stat">
            <small>Buổi còn có thể đặt</small>
            <strong>{data.summary?.availableSessions ?? available}</strong>
          </div>
          <div className="stat">
            <small>Buổi cần xác nhận</small>
            <strong>
              {data.summary?.confirmableSessions ?? needsConfirm.length}
            </strong>
          </div>
          <div className="stat">
            <small>Gói đang học</small>
            <strong>
              {data.summary?.activeOrders ??
                orders.filter((o) => o.status === "active").length}
            </strong>
          </div>
        </div>
        <div className="grid-2" style={{ marginTop: 18 }}>
          <div className="panel">
            <h2>Buổi học sắp tới</h2>
            {upcoming ? (
              <>
                <strong>{when(upcoming.start)}</strong>
                <p>
                  {upcoming.durationMinutes} phút ·{" "}
                  {upcoming.trialId ? "Học thử miễn phí" : "Buổi trả phí"}
                </p>
              </>
            ) : (
              <p>
                Chưa có buổi học sắp tới. Hãy trao đổi với gia sư để thống nhất
                lịch nhé.
              </p>
            )}
          </div>
          <div className="panel">
            <h2>Cần bạn xác nhận</h2>
            {needsConfirm.length ? (
              needsConfirm.map((s) => (
                <SessionActions
                  key={s.id}
                  session={s}
                  run={run}
                  busy={busy}
                  side="student"
                />
              ))
            ) : (
              <p>Không có buổi nào cần xác nhận lúc này.</p>
            )}
          </div>
        </div>
        <div className="panel">
          <h2>Học tiếp nào</h2>
          <p>Khám phá hồ sơ và tìm gia sư phù hợp với mục tiêu của bạn.</p>
          <Link className="button" href="/#tim-gia-su">
            Tìm gia sư
          </Link>
        </div>
      </>
    );
  if (tab === "orders")
    return (
      <>
        <div className="panel">
          <h2>Gói học của tôi</h2>
          {orders.length ? (
            orders
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((o) => (
                <div className="item" key={o.id}>
                  <div className="item-info">
                    <strong>{o.title}</strong>
                    <small>
                      {o.count} buổi · {o.durationMinutes} phút/buổi ·{" "}
                      {vnd(o.price)}
                    </small>
                    <small>
                      Còn {o.count - o.confirmedCount - o.reservedCount} buổi
                      chưa đặt · Đã học {o.confirmedCount}
                    </small>
                    <Badge value={o.status} />
                  </div>
                  <div className="item-actions">
                    {["active", "closed"].includes(o.status) && (
                      <button
                        className="button button-small button-outline"
                        disabled={busy}
                        onClick={() =>
                          run({
                            action: "createOrder",
                            packageId: o.packageId,
                            renewalOf: o.id,
                          })
                        }
                      >
                        Mua tiếp
                      </button>
                    )}
                    {o.status === "active" && o.count > o.confirmedCount && (
                      <button
                        className="button button-small button-outline"
                        disabled={busy}
                        onClick={() => {
                          const reason = prompt("Lý do yêu cầu hoàn tiền?");
                          if (reason !== null)
                            run(
                              {
                                action: "requestRefund",
                                orderId: o.id,
                                reason,
                              },
                              "Đã gửi yêu cầu hoàn tiền.",
                            );
                        }}
                      >
                        Yêu cầu hoàn
                      </button>
                    )}
                    {o.confirmedCount > 0 && (
                      <button
                        className="button button-small"
                        disabled={busy}
                        onClick={() => {
                          const stars = Number(
                            prompt("Bạn chấm gia sư mấy sao (1–5)?"),
                          );
                          const text = prompt("Chia sẻ trải nghiệm của bạn:");
                          if (stars && text)
                            run(
                              {
                                action: "reviewTutor",
                                orderId: o.id,
                                stars,
                                text,
                              },
                              "Cảm ơn bạn đã đánh giá!",
                            );
                        }}
                      >
                        Đánh giá
                      </button>
                    )}
                  </div>
                </div>
              ))
          ) : (
            <p>
              Bạn chưa mua gói nào.{" "}
              <Link href="/#tim-gia-su">Tìm gia sư →</Link>
            </p>
          )}
        </div>
        <div className="panel">
          <h2>Hoàn tiền</h2>
          {(data.refunds || []).length ? (
            data.refunds.map((r: Row) => (
              <div className="item" key={r.id}>
                <div className="item-info">
                  <strong>{vnd(r.amount)}</strong>
                  <small>{r.reason}</small>
                  {r.status === "rejected" && r.adminReason && (
                    <small>Lý do từ chối: {r.adminReason}</small>
                  )}
                  {r.status === "needs_details" && r.bankCorrectionReason && (
                    <small>
                      Vui lòng sửa tài khoản: {r.bankCorrectionReason}
                    </small>
                  )}
                </div>
                <Badge value={r.status} />
                {r.status === "needs_details" && (
                  <button
                    className="button button-small"
                    onClick={() => {
                      const bankName = prompt("Tên ngân hàng nhận tiền:");
                      const bankAccount = prompt("Số tài khoản:");
                      const accountHolder = prompt("Tên chủ tài khoản:");
                      if (bankName && bankAccount && accountHolder)
                        run({
                          action: "setRefundBank",
                          id: r.id,
                          bankName,
                          bankAccount,
                          accountHolder,
                        });
                    }}
                  >
                    Thêm tài khoản nhận
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>Chưa có yêu cầu hoàn tiền.</p>
          )}
        </div>
      </>
    );
  if (tab === "sessions")
    return (
      <div className="panel">
        <h2>Lịch học</h2>
        {sessions.length ? (
          sessions
            .sort((a, b) => b.start - a.start)
            .map((s) => (
              <SessionActions
                key={s.id}
                session={s}
                run={run}
                busy={busy}
                side="student"
              />
            ))
        ) : (
          <p>Chưa có buổi học nào.</p>
        )}
      </div>
    );
  if (tab === "chat")
    return <Chat data={data} run={run} busy={busy} side="student" />;
  return (
    <div className="panel">
      <h2>Thông báo</h2>
      {(data.notices || []).length ? (
        data.notices
          .sort((a: Row, b: Row) => b.at - a.at)
          .map((n: Row) => (
            <div className="item" key={n.id}>
              <div>
                <strong>{n.text}</strong>
                <small>{when(n.at)}</small>
              </div>
            </div>
          ))
      ) : (
        <p>Chưa có thông báo mới.</p>
      )}
    </div>
  );
}

function TutorView({
  tab,
  data,
  run,
  busy,
}: {
  tab: string;
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
}) {
  const orders: Row[] = data.orders || [],
    sessions: Row[] = data.sessions || [],
    profile = data.profile || {};
  if (tab === "overview")
    return (
      <>
        <div className="grid-3">
          <div className="stat">
            <small>Đơn chờ phản hồi</small>
            <strong>
              {data.summary?.pendingOrders ??
                orders.filter((o) => o.status === "pending_tutor").length}
            </strong>
          </div>
          <div className="stat">
            <small>Buổi cần xác nhận</small>
            <strong>
              {data.summary?.confirmableSessions ??
                sessions.filter(
                  (s) =>
                    s.status === "scheduled" &&
                    s.end <= Date.now() &&
                    !s.confirmations?.tutor,
                ).length}
            </strong>
          </div>
          <div className="stat">
            <small>Có thể rút</small>
            <strong>{vnd(data.wallet?.available)}</strong>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Việc cần làm</h2>
          {orders
            .filter((o) => o.status === "pending_tutor")
            .map((o) => (
              <div className="item" key={o.id}>
                <div>
                  <strong>{o.title}</strong>
                  <small>Phản hồi trước {when(o.decisionDue)}</small>
                </div>
                <div className="item-actions">
                  <button
                    className="button button-small"
                    disabled={busy}
                    onClick={() =>
                      run({ action: "decideOrder", id: o.id, accept: true })
                    }
                  >
                    Nhận học viên
                  </button>
                  <button
                    className="button button-small button-outline"
                    disabled={busy}
                    onClick={() =>
                      run({ action: "decideOrder", id: o.id, accept: false })
                    }
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            ))}
          {!orders.some((o) => o.status === "pending_tutor") && (
            <p>Không có đơn mới cần xử lý.</p>
          )}
        </div>
      </>
    );
  if (tab === "profile") return null;
  if (tab === "orders")
    return (
      <>
        <div className="panel">
          <h2>Học viên và đơn mua</h2>
          {orders.length ? (
            orders
              .sort((a, b) => b.createdAt - a.createdAt)
              .map((o) => (
                <div className="item" key={o.id}>
                  <div>
                    <strong>{o.title}</strong>
                    <small>
                      {o.count} buổi · Đã học {o.confirmedCount} · Chưa đặt{" "}
                      {o.count - o.confirmedCount - o.reservedCount}
                    </small>
                    <Badge value={o.status} />
                  </div>
                  {o.status === "pending_tutor" && (
                    <div className="item-actions">
                      <button
                        className="button button-small"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "decideOrder", id: o.id, accept: true })
                        }
                      >
                        Nhận
                      </button>
                      <button
                        className="button button-small button-outline"
                        disabled={busy}
                        onClick={() =>
                          run({
                            action: "decideOrder",
                            id: o.id,
                            accept: false,
                          })
                        }
                      >
                        Từ chối
                      </button>
                    </div>
                  )}
                </div>
              ))
          ) : (
            <p>Chưa có học viên mua gói.</p>
          )}
        </div>
        <div className="panel">
          <h2>Yêu cầu học thử</h2>
          {(data.trials || []).length ? (
            data.trials.map((t: Row) => (
              <div className="item" key={t.id}>
                <div>
                  <strong>Học thử miễn phí</strong>
                  <small>{t.start ? when(t.start) : "Chưa chọn giờ"}</small>
                  <small>{t.message}</small>
                  <Badge value={t.status} />
                </div>
                <div className="item-actions">
                  {t.status === "requested" && (
                    <>
                      <button
                        className="button button-small"
                        disabled={busy}
                        onClick={() =>
                          run({ action: "decideTrial", id: t.id, accept: true })
                        }
                      >
                        Nhận
                      </button>
                      <button
                        className="button button-small button-outline"
                        disabled={busy}
                        onClick={() =>
                          run({
                            action: "decideTrial",
                            id: t.id,
                            accept: false,
                          })
                        }
                      >
                        Từ chối
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          ) : (
            <p>Chưa có yêu cầu học thử.</p>
          )}
        </div>
      </>
    );
  if (tab === "sessions")
    return (
      <>
        <div className="panel">
          <h2>Tạo buổi học</h2>
          <p className="help-text">
            Hãy thống nhất lịch với học viên trước. Thời lượng được lấy từ gói.
          </p>
          <form
            onSubmit={(e) => {
              const v = values(e);
              run(
                {
                  action: "createSession",
                  orderId: v.orderId,
                  start: Date.parse(String(v.start)),
                },
                "Đã tạo buổi học.",
              );
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Gói của học viên</span>
                <select name="orderId" required>
                  {orders
                    .filter(
                      (o) =>
                        o.status === "active" &&
                        o.confirmedCount + o.reservedCount < o.count,
                    )
                    .map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.title} · còn{" "}
                        {o.count - o.confirmedCount - o.reservedCount} buổi
                      </option>
                    ))}
                </select>
              </label>
              {field("start", "Giờ bắt đầu", "datetime-local")}
            </div>
            <div className="form-actions">
              <button
                className="button"
                disabled={
                  busy ||
                  !orders.some(
                    (o) =>
                      o.status === "active" &&
                      o.confirmedCount + o.reservedCount < o.count,
                  )
                }
              >
                Tạo buổi học
              </button>
            </div>
          </form>
        </div>
        <div className="panel">
          <h2>Tạo buổi học thử</h2>
          <form
            onSubmit={(e) => {
              const v = values(e);
              run({
                action: "createTrialSession",
                id: v.id,
                start: Date.parse(String(v.start)),
                durationMinutes: Number(v.durationMinutes),
              });
            }}
          >
            <div className="form-grid">
              <label className="field">
                <span>Yêu cầu đã nhận</span>
                <select name="id">
                  {(data.trials || [])
                    .filter((t: Row) => t.status === "accepted")
                    .map((t: Row) => (
                      <option key={t.id} value={t.id}>
                        {t.id}
                      </option>
                    ))}
                </select>
              </label>
              {field("start", "Giờ bắt đầu", "datetime-local")}
              {field("durationMinutes", "Thời lượng (phút)", "number", "60")}
            </div>
            <div className="form-actions">
              <button
                className="button button-outline"
                disabled={
                  busy ||
                  !(data.trials || []).some((t: Row) => t.status === "accepted")
                }
              >
                Tạo buổi thử
              </button>
            </div>
          </form>
        </div>
        <div className="panel">
          <h2>Lịch học</h2>
          {sessions.length ? (
            sessions
              .sort((a, b) => b.start - a.start)
              .map((s) => (
                <SessionActions
                  key={s.id}
                  session={s}
                  run={run}
                  busy={busy}
                  side="tutor"
                />
              ))
          ) : (
            <p>Chưa có buổi học nào.</p>
          )}
        </div>
      </>
    );
  if (tab === "wallet")
    return (
      <>
        <div className="grid-2">
          <div className="stat">
            <small>Có thể rút</small>
            <strong>{vnd(data.wallet?.available)}</strong>
          </div>
          <div className="stat">
            <small>Đang chờ chuyển</small>
            <strong>{vnd(data.wallet?.pending)}</strong>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Yêu cầu rút tiền</h2>
          <form
            onSubmit={(e) => {
              const v = values(e);
              run(
                {
                  action: "requestWithdrawal",
                  amount: Number(v.amount),
                  bankName: v.bankName,
                  bankAccount: v.bankAccount,
                },
                "Đã gửi yêu cầu rút tiền.",
              );
            }}
          >
            <div className="form-grid">
              {field("amount", "Số tiền muốn rút (VND)", "number")}
              {field("bankName", "Tên ngân hàng")}
              {field("bankAccount", "Số tài khoản")}
            </div>
            <div className="form-actions">
              <button
                className="button"
                disabled={busy || !data.wallet?.available}
              >
                Gửi yêu cầu
              </button>
            </div>
          </form>
        </div>
        <div className="panel">
          <h2>Lịch sử rút tiền</h2>
          {(data.withdrawals || []).length ? (
            data.withdrawals.map((w: Row) => (
              <div className="item" key={w.id}>
                <div>
                  <strong>{vnd(w.amount)}</strong>
                  <small>
                    {w.bankName} · {w.bankAccount}
                  </small>
                </div>
                <Badge value={w.status} />
              </div>
            ))
          ) : (
            <p>Chưa có yêu cầu rút tiền.</p>
          )}
        </div>
      </>
    );
  if (tab === "notices")
    return (
      <div className="panel">
        <h2>Thông báo</h2>
        {(data.notices || []).length ? (
          data.notices.map((n: Row) => (
            <div className="item" key={n.id}>
              <div>
                <strong>{n.text}</strong>
                <small>{when(n.at)}</small>
              </div>
            </div>
          ))
        ) : (
          <p>Chưa có thông báo mới.</p>
        )}
      </div>
    );
  return <Chat data={data} run={run} busy={busy} side="tutor" />;
}

function SessionActions({
  session: s,
  run,
  busy,
  side,
}: {
  session: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
  side: "student" | "tutor";
}) {
  const confirmable =
    s.status === "scheduled" &&
    s.end <= Date.now() &&
    s.end + 86_400_000 >= Date.now() &&
    !s.confirmations?.[side];
  return (
    <div className="item">
      <div className="item-info">
        <strong>
          {s.trialId ? "Học thử miễn phí" : "Buổi học trả phí"} ·{" "}
          {when(s.start)}
        </strong>
        <small>
          {s.durationMinutes} phút · Kết thúc {when(s.end)}
        </small>
        <Badge value={s.status} />
        {s.confirmations?.[side] && (
          <small>
            Bạn đã chọn:{" "}
            {s.confirmations[side] === "yes" ? "Đã học" : "Không diễn ra"}
          </small>
        )}
      </div>
      <div className="item-actions">
        {confirmable && (
          <>
            <button
              className="button button-small"
              disabled={busy}
              onClick={() =>
                run({ action: "confirmSession", id: s.id, answer: "yes" })
              }
            >
              Đã học
            </button>
            <button
              className="button button-small button-outline"
              disabled={busy}
              onClick={() =>
                run({ action: "confirmSession", id: s.id, answer: "no" })
              }
            >
              Không diễn ra
            </button>
          </>
        )}
        {side === "tutor" && canCancelSession(s, Date.now()) && (
          <button
            className="button button-small button-outline"
            disabled={busy}
            onClick={() => {
              const reason = prompt("Lý do hủy buổi?");
              if (reason !== null)
                run({ action: "cancelSession", id: s.id, reason });
            }}
          >
            Hủy buổi
          </button>
        )}
      </div>
    </div>
  );
}

function Chat({
  data,
  run,
  busy,
  side,
}: {
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
  side: "student" | "tutor";
}) {
  const { user } = useUser();
  const orders: Row[] = (data.orders || []).filter(
    (o: Row) => o.status !== "pending_payment",
  );
  const trials: Row[] = data.trials || [];
  const threads = [
    ...orders.map((o) => ({ id: o.id, label: o.title })),
    ...trials.map((t) => ({ id: `trial:${t.id}`, label: "Học thử miễn phí" })),
  ];
  const [selected, setSelected] = useState("");
  const id =
    (threads.some((thread) => thread.id === selected)
      ? selected
      : threads[0]?.id) || "";
  const [messages, setMessages] = useState<Row[]>([]),
    [messagePage, setMessagePage] = useState(1),
    [messageTotalPages, setMessageTotalPages] = useState(0),
    [chatError, setChatError] = useState(""),
    [chatLoading, setChatLoading] = useState(false);
  useEffect(() => {
    if (!user || !id) return;
    let active = true;
    setMessages([]);
    setMessagePage(1);
    setChatLoading(true);
    const refresh = async () => {
      try {
        const page = await chatPage(user, id, 1);
        if (!active) return;
        setMessages(page.items);
        setMessagePage(page.page);
        setMessageTotalPages(page.totalPages);
        setChatError("");
      } catch (error) {
        if (active)
          setChatError(
            error instanceof Error ? error.message : "Không tải được tin nhắn.",
          );
      } finally {
        if (active) setChatLoading(false);
      }
    };
    void refresh();
    return () => {
      active = false;
    };
  }, [user, id]);
  useEffect(() => {
    if (!user || !id || messagePage !== 1) return;
    let active = true;
    const refresh = async () => {
      try {
        const result = await chatPage(user, id, 1);
        if (active) {
          setMessages(result.items);
          setMessagePage(result.page);
          setMessageTotalPages(result.totalPages);
        }
      } catch (error) {
        if (active)
          setChatError(
            error instanceof Error ? error.message : "Không tải được tin nhắn.",
          );
      }
    };
    const timer = setInterval(() => void refresh(), 15_000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [user, id, messagePage]);
  async function loadMessagePage(pageNumber: number) {
    if (
      !user ||
      !id ||
      pageNumber < 1 ||
      pageNumber > messageTotalPages ||
      pageNumber === messagePage ||
      chatLoading
    )
      return;
    setChatLoading(true);
    setChatError("");
    try {
      const result = await chatPage(user, id, pageNumber);
      setMessages(result.items);
      setMessagePage(result.page);
      setMessageTotalPages(result.totalPages);
    } catch (error) {
      setChatError(
        error instanceof Error ? error.message : "Không tải được tin nhắn.",
      );
    } finally {
      setChatLoading(false);
    }
  }
  return (
    <div className="panel">
      <h2>Tin nhắn</h2>
      {threads.length ? (
        <>
          <label className="field">
            <span>Cuộc trò chuyện</span>
            <select
              value={id}
              onChange={(e) => {
                setSelected(e.target.value);
                setMessagePage(1);
              }}
            >
              {threads.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label} · {side === "student" ? "Gia sư" : "Học viên"}
                </option>
              ))}
            </select>
          </label>
          {chatError && <p className="notice error">{chatError}</p>}
          <div className="chat-box" style={{ marginTop: 15 }}>
            {messages.length ? (
              messages.map((m: Row) => (
                <div
                  className={`bubble ${m.senderId === data.user.uid ? "mine" : ""}`}
                  key={m.id}
                >
                  {m.text}
                  <small>{when(m.at)}</small>
                </div>
              ))
            ) : (
              <p className="help-text">
                Bắt đầu trao đổi để thống nhất lịch học.
              </p>
            )}
          </div>
          <Pagination
            page={messagePage}
            totalPages={messageTotalPages}
            busy={chatLoading}
            label="tin nhắn"
            onPageChange={(page) => void loadMessagePage(page)}
          />
          <form
            onSubmit={(e) => {
              const v = values(e);
              run(
                { action: "sendMessage", threadId: id, text: v.text },
                "Đã gửi tin nhắn.",
              );
              e.currentTarget.reset();
            }}
            className="form-actions"
          >
            <input
              name="text"
              required
              maxLength={2000}
              placeholder="Viết tin nhắn..."
              aria-label="Nội dung tin nhắn"
              style={{
                flex: 1,
                minWidth: 180,
                padding: 12,
                borderRadius: 12,
                border: "1px solid #eadfed",
              }}
            />
            <button className="button" disabled={busy}>
              Gửi
            </button>
          </form>
        </>
      ) : (
        <p>Chưa có gói học hoặc buổi thử để bắt đầu trò chuyện.</p>
      )}
    </div>
  );
}

function AdminWorkQueue({ user, busy, onDone }: { user: User; busy: boolean; onDone: () => Promise<void> }) {
  const groups = ["payments", "orders", "sessions", "listings"] as const;
  const labels: Record<string, string> = { payments: "Thanh toán", orders: "Đơn quá hạn", sessions: "Buổi học", listings: "Tìm kiếm" };
  const [group, setGroup] = useState<(typeof groups)[number]>("payments");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Row>({ items: [], totalPages: 1, totalItems: 0 });
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const reload = useCallback(async () => {
    const response = await fetch(`/api/admin/work?group=${group}&page=${page}`, { headers: { authorization: `Bearer ${await user.getIdToken()}` } });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error?.message || "Không tải được hàng chờ.");
    setResult(body.data);
  }, [group, page, user]);
  useEffect(() => { reload().catch((e) => setError(e.message)); }, [reload]);
  async function process(id: string) {
    setWorking(true); setError("");
    try {
      const response = await fetch("/api/admin/work", { method: "POST", headers: { authorization: `Bearer ${await user.getIdToken()}`, "content-type": "application/json" }, body: JSON.stringify({ group, id }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error?.message || "Không xử lý được mục này.");
      await onDone(); await reload();
    } catch (e) { setError(e instanceof Error ? e.message : "Không xử lý được mục này."); await reload().catch(() => {}); }
    finally { setWorking(false); }
  }
  return <div className="panel">
    <h2>Cần rà soát ({result.totalItems})</h2>
    <div className="item-actions" role="group" aria-label="Loại công việc">
      {groups.map((key) => <button key={key} className={`button button-small ${group === key ? "" : "button-outline"}`} aria-pressed={group === key} disabled={busy || working} onClick={() => { setGroup(key); setPage(1); }}>{labels[key]}</button>)}
      <button className="button button-small button-outline" disabled={busy || working} onClick={() => { setError(""); reload().catch((e) => setError(e.message)); }}>Làm mới</button>
    </div>
    {error && <p role="alert" className="notice error">{error}</p>}
    {result.items.length ? result.items.map((row: Row) => <div className="item" key={row.id}>
      <div><strong>{row.title || (group === "sessions" ? `Buổi học ${when(row.start)}` : row.id)}</strong><small>{group === "payments" ? `${vnd(row.price)} · ${when(row.createdAt)}` : group === "orders" ? `${vnd(row.price)} · Hạn ${when(row.decisionDue)}` : group === "sessions" ? `Học viên ${row.studentId} · Gia sư ${row.tutorId}` : `Cập nhật lúc ${when(row.updatedAt)}`}</small></div>
      <button className="button button-small" disabled={busy || working} onClick={() => void process(row.id)}>{group === "payments" ? "Kiểm tra payOS" : group === "orders" ? "Chuyển hoàn tiền" : group === "sessions" ? "Chuyển tranh chấp" : "Cập nhật"}</button>
    </div>) : <p>Không có mục cần rà soát.</p>}
    {result.totalPages > 1 && <div className="item-actions"><button className="button button-small button-outline" disabled={page <= 1 || working} onClick={() => setPage(page - 1)}>Trước</button><small>Trang {page}/{result.totalPages}</small><button className="button button-small button-outline" disabled={page >= result.totalPages || working} onClick={() => setPage(page + 1)}>Sau</button></div>}
  </div>;
}

function AdminView({
  tab,
  data,
  run,
  busy,
  user,
}: {
  tab: string;
  data: Row;
  run: (a: Row, s?: string) => void;
  busy: boolean;
  user: User;
}) {
  if (tab === "overview")
    return (
      <>
        <div className="grid-3">
          <div className="stat">
            <small>Gia sư chờ duyệt</small>
            <strong>
              {data.summary?.pendingSubmissions ??
                (data.submissions || []).filter(
                  (s: Row) => s.status === "pending",
                ).length}
            </strong>
          </div>
          <div className="stat">
            <small>Buổi chờ xử lý</small>
            <strong>
              {data.summary?.disputeSessions ??
                (data.sessions || []).filter((s: Row) => s.status === "dispute")
                  .length}
            </strong>
          </div>
          <div className="stat">
            <small>Yêu cầu tiền chờ xử lý</small>
            <strong>
              {data.summary?.pendingMoney ??
                (data.refunds || []).filter((r: Row) => r.status === "pending")
                  .length +
                  (data.withdrawals || []).filter(
                    (w: Row) => w.status === "pending",
                  ).length}
            </strong>
          </div>
        </div>
        <div className="panel" style={{ marginTop: 18 }}>
          <h2>Hoạt động gần đây</h2>
          {(data.summary?.recentOrders || data.orders || [])
            .slice(0, 6)
            .map((o: Row) => (
              <div className="item" key={o.id}>
                <div>
                  <strong>{o.title}</strong>
                  <small>
                    {vnd(o.price)} · {when(o.createdAt)}
                  </small>
                </div>
                <Badge value={o.status} />
              </div>
            ))}
        </div>
      </>
    );
  if (tab === "users")
    return (
      <div className="panel">
        <h2>Người dùng</h2>
        {(data.users || []).length ? (
          data.users.map((u: Row) => (
            <div className="item" key={u.id}>
              <div>
                <strong>{u.email || u.id}</strong>
                <small>Vai trò: {u.role || "student"}</small>
                <Badge value={u.blocked ? "Đã khóa" : "Đang hoạt động"} />
              </div>
              <button
                className="button button-small button-outline"
                disabled={busy || u.id === user.uid}
                onClick={() =>
                  run({
                    action: "admin",
                    kind: u.blocked ? "unblockUser" : "blockUser",
                    id: u.id,
                  })
                }
              >
                {u.blocked ? "Mở khóa" : "Khóa"}
              </button>
            </div>
          ))
        ) : (
          <p>Chưa có người dùng.</p>
        )}
      </div>
    );
  if (tab === "reviews")
    return (
      <div className="panel">
        <h2>Kiểm duyệt đánh giá</h2>
        {(data.reviews || []).length ? (
          data.reviews.map((r: Row) => (
            <div className="item" key={r.id}>
              <div>
                <strong>
                  {"★".repeat(r.stars)} · {r.text}
                </strong>
                <small>Đơn {r.orderId}</small>
                <Badge value={r.status} />
              </div>
              <button
                className="button button-small button-outline"
                disabled={busy}
                onClick={() =>
                  run({
                    action: "admin",
                    kind: r.status === "visible" ? "hideReview" : "showReview",
                    id: r.id,
                  })
                }
              >
                {r.status === "visible" ? "Ẩn" : "Hiện"}
              </button>
            </div>
          ))
        ) : (
          <p>Chưa có đánh giá.</p>
        )}
      </div>
    );
  if (tab === "tutors")
    return <AdminTutorReview data={data} run={run} busy={busy} user={user} />;
  if (tab === "disputes")
    return (
      <div className="panel">
        <h2>Buổi cần quyết định</h2>
        {(data.sessions || []).filter((s: Row) => s.status === "dispute")
          .length ? (
          data.sessions
            .filter((s: Row) => s.status === "dispute")
            .map((s: Row) => (
              <div className="item" key={s.id}>
                <div>
                  <strong>
                    {when(s.start)} · {s.trialId ? "Học thử" : "Buổi trả phí"}
                  </strong>
                  <small>
                    Học viên: {s.confirmations?.student || "Chưa trả lời"} · Gia
                    sư: {s.confirmations?.tutor || "Chưa trả lời"}
                  </small>
                </div>
                <div className="item-actions">
                  <button
                    className="button button-small"
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt("Lý do xác nhận đã học:");
                      if (reason)
                        run({
                          action: "admin",
                          kind: "resolveSession",
                          id: s.id,
                          taught: true,
                          reason,
                        });
                    }}
                  >
                    Tính buổi
                  </button>
                  <button
                    className="button button-small button-outline"
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt("Lý do không tính buổi:");
                      if (reason)
                        run({
                          action: "admin",
                          kind: "resolveSession",
                          id: s.id,
                          taught: false,
                          reason,
                        });
                    }}
                  >
                    Không tính
                  </button>
                </div>
              </div>
            ))
        ) : (
          <p>Không có buổi chờ xử lý.</p>
        )}
      </div>
    );
  if (tab === "money")
    return (
      <>
        <div className="panel">
          <h2>Hoàn tiền cho học viên</h2>
          <p className="help-text">
            Chỉ đánh dấu hoàn tất sau khi đã chuyển khoản ngoài hệ thống.
          </p>
          {(data.refunds || []).length ? (
            data.refunds.map((r: Row) => (
              <div className="item" key={r.id}>
                <div className="item-info">
                  <strong>{vnd(r.amount)}</strong>
                  <small>
                    {r.reason} · Đơn {r.orderId}
                  </small>
                  <small>
                    {r.bankName
                      ? `${r.bankName} · ${r.bankAccount} · ${r.accountHolder}`
                      : "Chờ học viên cung cấp tài khoản"}
                  </small>
                  <Badge value={r.status} />
                </div>
                {r.status === "pending" && (
                  <button
                    className="button button-small"
                    disabled={busy}
                    onClick={() => {
                      const reference = prompt(
                        "Mã giao dịch chuyển khoản hoàn tiền:",
                      );
                      if (reference)
                        run({
                          action: "admin",
                          kind: "refundComplete",
                          id: r.id,
                          reference,
                        });
                    }}
                  >
                    Đã chuyển khoản
                  </button>
                )}
                {r.status === "pending" && (
                  <button
                    className="button button-small button-outline"
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt(
                        "Lý do cần sửa tài khoản nhận tiền:",
                      );
                      if (reason?.trim())
                        run({
                          action: "admin",
                          kind: "requestRefundBankCorrection",
                          id: r.id,
                          reason: reason.trim(),
                        });
                    }}
                  >
                    Yêu cầu sửa tài khoản
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>Chưa có yêu cầu hoàn tiền.</p>
          )}
        </div>
        <div className="panel">
          <h2>Rút tiền của gia sư</h2>
          {(data.withdrawals || []).length ? (
            data.withdrawals.map((w: Row) => (
              <div className="item" key={w.id}>
                <div>
                  <strong>{vnd(w.amount)}</strong>
                  <small>
                    {w.bankName} · {w.bankAccount}
                  </small>
                  <Badge value={w.status} />
                </div>
                {w.status === "pending" && (
                  <div className="item-actions">
                    <button
                      className="button button-small"
                      disabled={busy}
                      onClick={() => {
                        const reference = prompt(
                          "Mã giao dịch đã chuyển cho gia sư:",
                        );
                        if (reference)
                          run({
                            action: "admin",
                            kind: "withdrawalComplete",
                            id: w.id,
                            reference,
                          });
                      }}
                    >
                      Đã chuyển khoản
                    </button>
                    <button
                      className="button button-small button-outline"
                      disabled={busy}
                      onClick={() =>
                        run({
                          action: "admin",
                          kind: "withdrawalReject",
                          id: w.id,
                        })
                      }
                    >
                      Từ chối
                    </button>
                  </div>
                )}
              </div>
            ))
          ) : (
            <p>Chưa có yêu cầu rút tiền.</p>
          )}
        </div>
      </>
    );
  return (
    <div className="panel">
      <h2>Phí nền tảng</h2>
      <p className="help-text">
        Tỷ lệ này được lưu tại thời điểm học viên mua gói. Mặc định 10% nếu
        chưa đặt.
      </p>
      <form
        onSubmit={(e) => {
          const v = values(e);
          run({ action: "admin", kind: "fee", feeRate: Number(v.feeRate) });
        }}
        className="form-actions"
      >
        {field("feeRate", "Phần trăm phí", "number", "10")}
        <button className="button" disabled={busy}>
          Lưu tỷ lệ
        </button>
      </form>
    </div>
  );
}
