import { conflict, invalid } from "./api-response.ts";
import { validPlace } from "./discovery.ts";

export type TutorMedia = {
  publicId: string;
  format: string;
  resourceType: "image" | "raw";
  contentType: string;
};

export type TutorFields = {
  name: string;
  bio: string;
  mode: "online" | "offline" | "both";
  location: string;
  availability: string;
  provinceCode: string;
  wardCode: string;
};

const required = (value: unknown, max: number) => {
  if (typeof value !== "string" || !value.trim() || value.length > max)
    throw invalid("Thông tin hồ sơ chưa hợp lệ.");
  return value.trim();
};

const optional = (value: unknown, max: number) => {
  if (value === undefined) return "";
  if (typeof value !== "string" || value.length > max)
    throw invalid("Thông tin hồ sơ chưa hợp lệ.");
  return value.trim();
};

export function tutorFields(data: Record<string, unknown>): TutorFields {
  if (!["online", "offline", "both"].includes(String(data.mode)))
    throw invalid("Hình thức dạy không hợp lệ.");
  const provinceCode = optional(data.provinceCode, 2),
    wardCode = optional(data.wardCode, 5);
  if (!validPlace(provinceCode, wardCode))
    throw invalid("Tỉnh và phường/xã chưa hợp lệ.");
  return {
    name: required(data.name, 80),
    bio: required(data.bio, 2000),
    mode: data.mode as TutorFields["mode"],
    location: optional(data.location, 120),
    availability: optional(data.availability, 500),
    provinceCode,
    wardCode,
  };
}

export function sameTutorFields(
  current: Record<string, unknown>,
  next: TutorFields,
) {
  return (Object.keys(next) as (keyof TutorFields)[]).every(
    (key) => (current[key] || "") === next[key],
  );
}

export function prepareTutorSubmission(
  live: Record<string, any> | undefined,
  submission: Record<string, any> | undefined,
  media: Record<string, any> | undefined,
  fields: TutorFields,
) {
  if (submission?.status === "pending")
    throw conflict(
      "Hồ sơ đang chờ duyệt. Bạn có thể sửa sau khi admin phản hồi.",
    );
  const photo = (media?.stagedPhoto || media?.photo) as TutorMedia | undefined;
  const document = (media?.stagedDocument || media?.document) as
    | TutorMedia
    | undefined;
  if (!photo) throw conflict("Vui lòng tải ảnh chân dung lên trước.");
  if (!document) throw conflict("Vui lòng tải giấy tờ xác minh lên trước.");
  if (
    ["approved", "suspended"].includes(live?.status) &&
    sameTutorFields(live!, fields) &&
    !media?.stagedPhoto &&
    !media?.stagedDocument
  )
    throw conflict("Hồ sơ chưa có thay đổi để gửi duyệt.");
  return {
    photo,
    document,
    photoSource: media?.stagedPhoto ? "staged-photo" : "photo",
    documentSource: media?.stagedDocument ? "staged-document" : "document",
  };
}

export function tutorPhotoUrl(uid: string, version: number) {
  return `/api/media/${uid}/photo?v=${version}`;
}

export function approvedTutorUpdate(
  candidate: Record<string, any>,
  live: Record<string, any> | undefined,
  uid: string,
  version: number,
) {
  if (!candidate.photo || !candidate.document)
    throw conflict("Cần ảnh chân dung và giấy tờ xác minh trước khi duyệt.");
  return {
    ...tutorFields({
      ...candidate,
      provinceCode: candidate.provinceCode ?? live?.provinceCode,
      wardCode: candidate.wardCode ?? live?.wardCode,
    }),
    email: candidate.email || live?.email || "",
    photoUrl: tutorPhotoUrl(uid, version),
    status: live?.status === "suspended" ? "suspended" : "approved",
    reviewedAt: version,
    updatedAt: version,
  };
}

export function validTutorFile(bytes: Uint8Array, type: string) {
  if (type === "image/jpeg")
    return bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return [137, 80, 78, 71, 13, 10, 26, 10].every(
      (value, index) => bytes[index] === value,
    );
  if (type === "image/webp")
    return (
      String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
    );
  if (type === "application/pdf")
    return String.fromCharCode(...bytes.subarray(0, 5)) === "%PDF-";
  return false;
}

export function tutorAcceptsNewOrders(status: unknown, blocked = false) {
  return status === "approved" && !blocked;
}
