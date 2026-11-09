"use client";

import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { responseData } from "@/lib/use-user";
import { provinces, wards } from "@/lib/discovery";

type Row = Record<string, any>;

export function TutorProfileEditor({
  user,
  data,
  run,
  refresh,
  busy,
}: {
  user: User;
  data: Row;
  run: (action: Row, success?: string) => void;
  refresh: (user: User) => Promise<void>;
  busy: boolean;
}) {
  const live = data.profile || {};
  const submission = data.submission;
  const media = data.media || {};
  const fields = submission || live;
  const locked = submission?.status === "pending";
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageError, setMessageError] = useState(false);
  const [preview, setPreview] = useState("");
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [provinceCode, setProvinceCode] = useState(fields.provinceCode || "");
  const [mode, setMode] = useState(fields.mode || "online");
  const photoKind = media.stagedPhoto
    ? "staged-photo"
    : media.photo
      ? "photo"
      : "";
  const documentKind = media.stagedDocument
    ? "staged-document"
    : media.document
      ? "document"
      : "";

  useEffect(() => {
    if (!photoKind) return;
    let active = true,
      objectUrl = "";
    user
      .getIdToken()
      .then((token) =>
        fetch(`/api/media/${user.uid}/${photoKind}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      )
      .then((response) =>
        response.ok
          ? response.blob()
          : Promise.reject(new Error("Không mở được ảnh.")),
      )
      .then((blob) => {
        objectUrl = URL.createObjectURL(blob);
        if (active) setPreview(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch(() => {
        if (active) setPreview("");
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [user, photoKind, previewEpoch]);

  async function upload(kind: "photo" | "document", file?: File) {
    if (!file) return;
    if (file.size > 4_000_000) {
      setMessage("Tệp phải nhỏ hơn 4 MB.");
      setMessageError(true);
      return;
    }
    setUploading(true);
    setMessage("");
    setMessageError(false);
    try {
      const form = new FormData();
      form.append("kind", kind);
      form.append("file", file);
      const response = await fetch("/api/upload", {
        method: "POST",
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
        body: form,
      });
      await responseData(response, "Tải tệp chưa thành công.");
      await refresh(user);
      setPreviewEpoch((value) => value + 1);
      setMessage(
        `${kind === "photo" ? "Ảnh" : "Giấy tờ"} đã tải lên. Hãy gửi hồ sơ để admin duyệt.`,
      );
      setMessageError(false);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Tải tệp chưa thành công.",
      );
      setMessageError(true);
    } finally {
      setUploading(false);
    }
  }

  async function openDocument() {
    if (!documentKind) return;
    setMessage("");
    setMessageError(false);
    try {
      const response = await fetch(`/api/media/${user.uid}/${documentKind}`, {
        headers: { Authorization: `Bearer ${await user.getIdToken()}` },
      });
      if (!response.ok) throw new Error("Không mở được giấy tờ.");
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Không mở được giấy tờ.",
      );
      setMessageError(true);
    }
  }

  const status = locked
    ? "Đang chờ duyệt"
    : submission?.status === "rejected"
      ? "Cần chỉnh sửa"
      : live.status === "suspended"
        ? "Đang tạm ẩn"
        : live.status === "approved"
          ? "Đã duyệt"
          : "Chưa gửi duyệt";
  return (
    <div className="panel tutor-profile">
      <header className="tutor-profile-header">
        <h2>Hồ sơ gia sư</h2>
        <span className="badge">{status}</span>
      </header>
      {locked && (
        <p className="notice" role="status">
          Bản gửi duyệt đang được kiểm tra.{" "}
          {live.status === "approved"
            ? "Hồ sơ hiện tại vẫn công khai."
            : "Bạn có thể sửa sau khi admin phản hồi."}
        </p>
      )}
      {submission?.status === "rejected" && (
        <p className="notice error" role="status">
          Admin chưa duyệt:{" "}
          {submission.reviewReason || "Vui lòng kiểm tra và gửi lại hồ sơ."}
        </p>
      )}
      {live.status === "suspended" && (
        <p className="notice" role="status">
          Hồ sơ đang tạm ẩn. Admin cần khôi phục trước khi nhận học viên mới.
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(new FormData(event.currentTarget).entries());
          run(
            {
              action: live.id || submission ? "saveTutor" : "becomeTutor",
              ...values,
            },
            live.id || submission
              ? "Đã gửi thay đổi để admin duyệt."
              : "Đã gửi hồ sơ để admin duyệt.",
          );
        }}
      >
        <fieldset className="tutor-profile-fields" disabled={busy || uploading || locked}>
          <section className="tutor-profile-section" aria-labelledby="profile-basics-title">
            <div className="tutor-profile-section-heading">
              <h3 id="profile-basics-title">Thông tin hồ sơ</h3>
              <p>Thông tin học viên sẽ thấy khi xem hồ sơ của bạn.</p>
            </div>
            <div className="tutor-profile-fields-grid">
              <label className="field">
                <span>Tên hiển thị <span aria-hidden="true">*</span></span>
                <input name="name" defaultValue={fields.name || ""} required maxLength={80} />
              </label>
              <label className="field">
                <span>Giới thiệu <span aria-hidden="true">*</span></span>
                <textarea name="bio" defaultValue={fields.bio || ""} required maxLength={2000} rows={4} />
              </label>
              <label className="field">
                <span>Lịch rảnh (mô tả)</span>
                <input name="availability" defaultValue={fields.availability || ""} maxLength={500} placeholder="Ví dụ: Tối thứ 2, 4 và cuối tuần" />
              </label>
            </div>
          </section>
          <section className="tutor-profile-section" aria-labelledby="profile-teaching-title">
            <div className="tutor-profile-section-heading">
              <h3 id="profile-teaching-title">Hình thức và nơi dạy</h3>
            </div>
            <div className="tutor-profile-fields-grid">
              <label className="field">
                <span>Hình thức dạy</span>
                <select name="mode" value={mode} onChange={(event) => setMode(event.target.value)}>
                  <option value="online">Trực tuyến</option>
                  <option value="offline">Trực tiếp</option>
                  <option value="both">Cả hai</option>
                </select>
              </label>
              <div className="tutor-profile-offline tutor-profile-fields-grid" hidden={mode === "online"}>
                <label className="field">
                  <span>Khu vực dạy trực tiếp</span>
                  <input name="location" defaultValue={fields.location || ""} maxLength={120} placeholder="Ví dụ: Quận 3 và khu vực lân cận" />
                </label>
                <label className="field">
                  <span>Tỉnh/thành dạy trực tiếp</span>
                  <select name="provinceCode" value={provinceCode} onChange={(event) => setProvinceCode(event.target.value)}>
                    <option value="">Chưa chọn</option>
                    {provinces.map((place) => (
                      <option value={place.code} key={place.code}>{place.name}</option>
                    ))}
                  </select>
                </label>
                <label className="field">
                  <span>Phường/xã</span>
                  <select
                    name="wardCode"
                    key={provinceCode}
                    required={mode !== "online" && !!provinceCode}
                    defaultValue={provinceCode === fields.provinceCode ? fields.wardCode || "" : ""}
                  >
                    <option value="">Chưa chọn</option>
                    {wards.filter((place) => place.provinceCode === provinceCode).map((place) => (
                      <option value={place.code} key={place.code}>{place.name}</option>
                    ))}
                  </select>
                </label>
              </div>
            </div>
          </section>
        </fieldset>
        <section className="tutor-profile-section" aria-labelledby="profile-media-title">
          <div className="tutor-profile-section-heading">
            <h3 id="profile-media-title">Ảnh và xác minh</h3>
            <p>Cần cả hai tệp trước khi gửi duyệt.</p>
          </div>
          <div className="tutor-profile-media-grid">
            <div className="tutor-profile-media-item">
              {preview ? (
                <img className="tutor-profile-photo" src={preview} alt="Ảnh chân dung đã tải lên" />
              ) : (
                <div className="tutor-profile-photo tutor-profile-photo-empty" aria-hidden="true">Ảnh</div>
              )}
              <div className="tutor-profile-media-copy">
                <strong>Ảnh chân dung <span aria-hidden="true">*</span></strong>
                <span>{media.stagedPhoto ? "Ảnh mới chờ gửi duyệt" : media.photo ? "Đã tải ảnh" : "Chưa có ảnh"}</span>
                <small>JPG, PNG hoặc WebP · tối đa 4 MB</small>
                {!locked && (
                  <label className="tutor-profile-upload">
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      aria-label={media.photo || media.stagedPhoto ? "Thay ảnh chân dung" : "Tải ảnh chân dung"}
                      disabled={busy || uploading}
                      onChange={(event) => {
                        const input = event.currentTarget;
                        void upload("photo", input.files?.[0]).finally(() => { input.value = ""; });
                      }}
                    />
                    <span>{media.photo || media.stagedPhoto ? "Thay ảnh" : "Tải ảnh lên"}</span>
                  </label>
                )}
              </div>
            </div>
            <div className="tutor-profile-media-item">
              <div className="tutor-profile-document-mark" aria-hidden="true">PDF</div>
              <div className="tutor-profile-media-copy">
                <strong>Giấy tờ xác minh <span aria-hidden="true">*</span></strong>
                <span>{media.stagedDocument ? "Giấy tờ mới chờ gửi duyệt" : media.document ? "Đã tải giấy tờ" : "Chưa có giấy tờ"}</span>
                <small>JPG, PNG hoặc PDF · tối đa 4 MB. Chỉ bạn và admin xem được.</small>
                <div className="tutor-profile-media-actions">
                  {!locked && (
                    <label className="tutor-profile-upload">
                      <input
                        type="file"
                        accept="image/jpeg,image/png,application/pdf"
                        aria-label={media.document || media.stagedDocument ? "Thay giấy tờ xác minh" : "Tải giấy tờ xác minh"}
                        disabled={busy || uploading}
                        onChange={(event) => {
                          const input = event.currentTarget;
                          void upload("document", input.files?.[0]).finally(() => { input.value = ""; });
                        }}
                      />
                      <span>{media.document || media.stagedDocument ? "Thay tệp" : "Tải tệp lên"}</span>
                    </label>
                  )}
                  {documentKind && (
                    <button className="text-button" type="button" onClick={openDocument}>Xem giấy tờ ↗</button>
                  )}
                </div>
              </div>
            </div>
          </div>
          {uploading && <p className="help-text" role="status">Đang tải tệp lên...</p>}
          {message && <p className={`notice${messageError ? " error" : ""}`} role={messageError ? "alert" : "status"}>{message}</p>}
        </section>
        <details className="tutor-profile-optional" open={fields.videoUrl ? true : undefined}>
          <summary>Video giới thiệu <span>Không bắt buộc</span></summary>
          <fieldset className="tutor-profile-fields" disabled={busy || uploading || locked}>
            <label className="field">
              <span>Đường liên kết Google Drive</span>
              <input name="videoUrl" type="url" defaultValue={fields.videoUrl || ""} maxLength={500} placeholder="https://drive.google.com/file/d/.../view" />
              <small>Bật quyền “Bất kỳ ai có đường liên kết”. Video sẽ hiển thị sau khi admin duyệt hồ sơ.</small>
            </label>
          </fieldset>
        </details>
        {!locked && (
          <div className="form-actions tutor-profile-actions">
            <button
              className="button"
              disabled={busy || uploading || !((media.photo || media.stagedPhoto) && (media.document || media.stagedDocument))}
            >
              {live.status === "approved" || live.status === "suspended"
                ? "Gửi thay đổi duyệt"
                : submission?.status === "rejected"
                  ? "Gửi lại hồ sơ"
                  : "Gửi hồ sơ duyệt"}
            </button>
            {!((media.photo || media.stagedPhoto) && (media.document || media.stagedDocument)) && (
              <small>Hãy tải ảnh chân dung và giấy tờ xác minh để gửi hồ sơ.</small>
            )}
          </div>
        )}
      </form>
    </div>
  );
}
