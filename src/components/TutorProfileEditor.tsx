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
  const [preview, setPreview] = useState("");
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const [provinceCode, setProvinceCode] = useState(fields.provinceCode || "");
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
      return;
    }
    setUploading(true);
    setMessage("");
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
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Tải tệp chưa thành công.",
      );
    } finally {
      setUploading(false);
    }
  }

  async function openDocument() {
    if (!documentKind) return;
    setMessage("");
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
    <div className="panel">
      <h2>
        Hồ sơ gia sư <span className="badge">{status}</span>
      </h2>
      {locked && (
        <p className="help-text">
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
      <div className="form-grid">
        <div className="field">
          <span>Ảnh chân dung · bắt buộc</span>
          {preview && (
            <img
              src={preview}
              alt="Ảnh chân dung đã tải lên"
              style={{
                width: 96,
                height: 96,
                objectFit: "cover",
                borderRadius: 14,
                marginBlock: 8,
              }}
            />
          )}
          <small>
            {media.stagedPhoto
              ? "Ảnh mới chờ gửi duyệt"
              : media.photo
                ? "Đã tải ảnh"
                : "Chưa có ảnh"}
          </small>
          {!locked && (
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              aria-label={
                media.photo || media.stagedPhoto
                  ? "Thay ảnh chân dung"
                  : "Tải ảnh chân dung"
              }
              disabled={busy || uploading}
              onChange={(event) => {
                const input = event.currentTarget;
                void upload("photo", input.files?.[0]).finally(() => {
                  input.value = "";
                });
              }}
            />
          )}
        </div>
        <div className="field">
          <span>Giấy tờ xác minh · bắt buộc</span>
          <small>
            {media.stagedDocument
              ? "Giấy tờ mới chờ gửi duyệt"
              : media.document
                ? "Đã tải giấy tờ"
                : "Chưa có giấy tờ"}
          </small>
          {documentKind && (
            <button
              className="text-button"
              type="button"
              onClick={openDocument}
            >
              Xem giấy tờ ↗
            </button>
          )}
          {!locked && (
            <input
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              aria-label={
                media.document || media.stagedDocument
                  ? "Thay giấy tờ xác minh"
                  : "Tải giấy tờ xác minh"
              }
              disabled={busy || uploading}
              onChange={(event) => {
                const input = event.currentTarget;
                void upload("document", input.files?.[0]).finally(() => {
                  input.value = "";
                });
              }}
            />
          )}
        </div>
      </div>
      <p className="help-text">
        Ảnh: JPG, PNG hoặc WebP. Giấy tờ: JPG, PNG hoặc PDF. Tối đa 4 MB mỗi
        tệp; giấy tờ chỉ bạn và admin xem được.
      </p>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const values = Object.fromEntries(
            new FormData(event.currentTarget).entries(),
          );
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
        <fieldset
          disabled={busy || uploading || locked}
          style={{ border: 0, padding: 0, margin: 0, width: "100%" }}
        >
          <div className="form-grid">
            <label className="field">
              <span>Tên hiển thị</span>
              <input
                name="name"
                defaultValue={fields.name || ""}
                required
                maxLength={80}
              />
            </label>
            <label className="field">
              <span>Hình thức</span>
              <select name="mode" defaultValue={fields.mode || "online"}>
                <option value="online">Trực tuyến</option>
                <option value="offline">Trực tiếp</option>
                <option value="both">Cả hai</option>
              </select>
            </label>
            <label className="field">
              <span>Khu vực dạy trực tiếp</span>
              <input
                name="location"
                defaultValue={fields.location || ""}
                maxLength={120}
              />
            </label>
            <label className="field">
              <span>Tỉnh/thành dạy trực tiếp</span>
              <select
                name="provinceCode"
                value={provinceCode}
                onChange={(event) => setProvinceCode(event.target.value)}
              >
                <option value="">Chưa chọn</option>
                {provinces.map((place) => (
                  <option value={place.code} key={place.code}>
                    {place.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Phường/xã</span>
              <select
                name="wardCode"
                key={provinceCode}
                required={!!provinceCode}
                defaultValue={
                  provinceCode === fields.provinceCode
                    ? fields.wardCode || ""
                    : ""
                }
              >
                <option value="">Chưa chọn</option>
                {wards
                  .filter((place) => place.provinceCode === provinceCode)
                  .map((place) => (
                    <option value={place.code} key={place.code}>
                      {place.name}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Lịch rảnh (mô tả)</span>
              <input
                name="availability"
                defaultValue={fields.availability || ""}
                maxLength={500}
              />
            </label>
            <label className="field wide">
              <span>Giới thiệu</span>
              <textarea
                name="bio"
                defaultValue={fields.bio || ""}
                required
                maxLength={2000}
              />
            </label>
          </div>
          {!locked && (
            <div className="form-actions">
              <button
                className="button"
                disabled={
                  !(
                    (media.photo || media.stagedPhoto) &&
                    (media.document || media.stagedDocument)
                  )
                }
              >
                {live.status === "approved" || live.status === "suspended"
                  ? "Gửi thay đổi duyệt"
                  : submission?.status === "rejected"
                    ? "Gửi lại hồ sơ"
                    : "Gửi hồ sơ duyệt"}
              </button>
            </div>
          )}
        </fieldset>
      </form>
    </div>
  );
}
