export function legacyTutorSubmission(tutor, assets) {
  const photo = assets?.stagedPhoto || assets?.photo;
  const document = assets?.stagedDocument || assets?.document;
  const missing = [
    !photo && "ảnh chân dung",
    !document && "giấy tờ xác minh",
  ].filter(Boolean);
  const complete = missing.length === 0;
  return {
    name: tutor.name || "",
    bio: tutor.bio || "",
    mode: tutor.mode || "online",
    location: tutor.location || "",
    availability: tutor.availability || "",
    ...(photo
      ? { photo, photoSource: assets?.stagedPhoto ? "staged-photo" : "photo" }
      : {}),
    ...(document
      ? {
          document,
          documentSource: assets?.stagedDocument
            ? "staged-document"
            : "document",
        }
      : {}),
    email: tutor.email || "",
    status: tutor.status === "pending" && complete ? "pending" : "rejected",
    submittedAt: tutor.updatedAt || Date.now(),
    ...(missing.length
      ? {
          reviewReason: `Vui lòng bổ sung ${missing.join(" và ")} rồi gửi lại hồ sơ.`,
        }
      : tutor.reviewReason
        ? { reviewReason: tutor.reviewReason }
        : {}),
  };
}
