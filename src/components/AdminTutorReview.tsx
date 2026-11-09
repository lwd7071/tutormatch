"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { placeName } from "@/lib/discovery";

type Row = Record<string, any>;

async function openMedia(user: User, uid: string, kind: string) {
  const response = await fetch(`/api/media/${uid}/${kind}`, {
    headers: { Authorization: `Bearer ${await user.getIdToken()}` },
  });
  if (!response.ok)
    throw new Error("Không mở được tệp. Vui lòng kiểm tra lại bản tải lên.");
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

function ReviewPhoto({
  user,
  uid,
  kind,
  name,
}: {
  user: User;
  uid: string;
  kind: string;
  name: string;
}) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let active = true,
      objectUrl = "";
    user
      .getIdToken()
      .then((token) =>
        fetch(`/api/media/${uid}/${kind}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((response) =>
        response.ok
          ? response.blob()
          : Promise.reject(new Error("Ảnh chưa sẵn sàng.")),
      )
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setSrc(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setSrc("");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user, uid, kind]);
  return src ? (
    <img
      src={src}
      alt={`Ảnh chân dung của ${name}`}
      style={{
        width: 88,
        height: 88,
        objectFit: "cover",
        borderRadius: 14,
        marginBlock: 8,
      }}
    />
  ) : (
    <small>Chưa mở được ảnh chân dung.</small>
  );
}

export function AdminTutorReview({
  data,
  section,
  run,
  busy,
  user,
}: {
  data: Row;
  section: string;
  run: (action: Row) => void;
  busy: boolean;
  user: User;
}) {
  const [error, setError] = useState("");
  const tutors: Row[] = data.tutors || [];
  const blockedIds = new Set(
    (data.users || [])
      .filter((entry: Row) => entry.blocked)
      .map((entry: Row) => entry.id),
  );
  const pending: Row[] = (data.submissions || []).filter(
    (submission: Row) => submission.status === "pending",
  );
  const labels: [string, string][] = [
    ["name", "Tên hiển thị"],
    ["mode", "Hình thức"],
    ["location", "Khu vực mô tả"],
    ["place", "Tỉnh và phường/xã"],
    ["bio", "Giới thiệu"],
    ["availability", "Lịch rảnh mô tả"],
  ];
  const modeLabel = (value: string) =>
    value === "both"
      ? "Cả hai"
      : value === "offline"
        ? "Trực tiếp"
        : "Trực tuyến";

  return (
    <div className="stack">
      {section === "pending" && <div className="panel">
        <h2>Hồ sơ chờ duyệt ({pending.length})</h2>
        {pending.length ? (
          pending.map((submission) => {
            const current = tutors.find(
              (t) =>
                t.id === submission.id &&
                ["approved", "suspended"].includes(t.status),
            );
            return (
              <div className="item" key={submission.id}>
                <div className="item-info" style={{ minWidth: 0 }}>
                  <strong>{submission.name || "Gia sư"}</strong>
                  <small>{submission.email}</small>
                  <p className="help-text">
                    {current ? "Thay đổi hồ sơ đã duyệt" : "Đăng ký mới"}
                  </p>
                  <div className="stack">
                    <div>
                      <small>Ảnh gửi duyệt</small>
                      <ReviewPhoto
                        user={user}
                        uid={submission.id}
                        kind={submission.photoSource || "photo"}
                        name={submission.name || "gia sư"}
                      />
                    </div>
                    {current && submission.photoSource === "staged-photo" && (
                      <div>
                        <small>Ảnh hiện tại</small>
                        <ReviewPhoto
                          user={user}
                          uid={submission.id}
                          kind="photo"
                          name={current.name || "gia sư"}
                        />
                      </div>
                    )}
                  </div>
                  <div className="stack">
                    {labels.map(([key, label]) => {
                      const before =
                        key === "place"
                          ? placeName(current?.provinceCode, current?.wardCode)
                          : String(current?.[key] || "");
                      const after =
                        key === "place"
                          ? placeName(
                              submission.provinceCode,
                              submission.wardCode,
                            )
                          : String(submission[key] || "");
                      return (
                        <div key={key} style={{ overflowWrap: "anywhere" }}>
                          <strong>{label}:</strong>{" "}
                          {key === "mode" ? modeLabel(after) : after || "—"}
                          {current && before !== after && (
                            <small>
                              {current.status === "suspended"
                                ? "Hiện tại"
                                : "Đang công khai"}
                              :{" "}
                              {key === "mode"
                                ? modeLabel(before)
                                : before || "—"}
                            </small>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() =>
                      void openMedia(
                        user,
                        submission.id,
                        submission.documentSource || "document",
                      ).catch((e) => setError(e.message))
                    }
                  >
                    Xem giấy tờ gửi duyệt ↗
                  </button>
                  {current &&
                    submission.documentSource === "staged-document" && (
                      <button
                        className="text-button"
                        type="button"
                        onClick={() =>
                          void openMedia(user, submission.id, "document").catch(
                            (e) => setError(e.message),
                          )
                        }
                      >
                        Xem giấy tờ hiện tại ↗
                      </button>
                    )}
                </div>
                <div className="item-actions">
                  <button
                    className="button button-small"
                    disabled={
                      busy || !submission.hasPhoto || !submission.hasDocument
                    }
                    onClick={() =>
                      run({
                        action: "admin",
                        kind: "approveTutor",
                        id: submission.id,
                      })
                    }
                  >
                    Duyệt
                  </button>
                  <button
                    className="button button-small button-outline"
                    disabled={busy}
                    onClick={() => {
                      const reason = prompt("Lý do chưa duyệt hồ sơ:");
                      if (reason?.trim())
                        run({
                          action: "admin",
                          kind: "rejectTutor",
                          id: submission.id,
                          reason: reason.trim(),
                        });
                    }}
                  >
                    Từ chối
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <p className="help-text">Không có hồ sơ chờ duyệt.</p>
        )}
        {error && (
          <p className="notice error" role="alert">
            {error}
          </p>
        )}
      </div>}
      {section === "approved" && <div className="panel">
        <h2>Gia sư đã duyệt</h2>
        {tutors.filter((t) => ["approved", "suspended"].includes(t.status))
          .length ? (
          tutors
            .filter((t) => ["approved", "suspended"].includes(t.status))
            .map((t) => {
              const blocked = t.blocked || blockedIds.has(t.id);
              return (
                <div className="item" key={t.id}>
                  <div className="item-info">
                    <strong>{t.name}</strong>
                    <small>{t.email}</small>
                    <span className="badge">
                      {blocked
                        ? "Tài khoản bị khóa"
                        : t.status === "suspended"
                          ? "Đang tạm ẩn"
                          : "Đang công khai"}
                    </span>
                  </div>
                  <button
                    className="button button-small button-outline"
                    disabled={busy || (t.status === "suspended" && blocked)}
                    onClick={() =>
                      run({
                        action: "admin",
                        kind:
                          t.status === "suspended"
                            ? "restoreTutor"
                            : "suspendTutor",
                        id: t.id,
                      })
                    }
                  >
                    {t.status === "suspended" ? "Khôi phục" : "Tạm ẩn"}
                  </button>
                </div>
              );
            })
        ) : (
          <p className="help-text">Chưa có gia sư được duyệt.</p>
        )}
      </div>}
    </div>
  );
}
