import assert from "node:assert/strict";
import test from "node:test";
import {
  approvedTutorUpdate,
  prepareTutorSubmission,
  tutorAcceptsNewOrders,
  tutorFields,
  validTutorFile,
} from "../src/lib/tutor-profile.ts";

const photo = {
  publicId: "photo-old",
  format: "jpg",
  resourceType: "image",
  contentType: "image/jpeg",
};
const document = {
  publicId: "document-old",
  format: "",
  resourceType: "raw",
  contentType: "application/pdf",
};
const input = {
  name: " Gia sư A ",
  bio: " Dạy Toán ",
  mode: "both",
  location: "Hà Nội",
  availability: "Tối thứ hai",
};

test("hồ sơ mới cần cả ảnh chân dung lẫn giấy tờ", () => {
  const fields = tutorFields(input);
  assert.equal(fields.name, "Gia sư A");
  assert.equal(fields.mode, "both");
  assert.throws(
    () =>
      prepareTutorSubmission(
        undefined,
        undefined,
        { stagedDocument: document },
        fields,
      ),
    /ảnh chân dung/,
  );
  assert.throws(
    () =>
      prepareTutorSubmission(
        undefined,
        undefined,
        { stagedPhoto: photo },
        fields,
      ),
    /giấy tờ/,
  );
  assert.equal(
    prepareTutorSubmission(
      undefined,
      undefined,
      { stagedPhoto: photo, stagedDocument: document },
      fields,
    ).photoSource,
    "staged-photo",
  );
});

test("hồ sơ đã duyệt giữ tệp hiện tại và chỉ gửi thay đổi thật", () => {
  const fields = tutorFields(input),
    live = { ...fields, status: "approved" };
  assert.throws(
    () => prepareTutorSubmission(live, undefined, { photo, document }, fields),
    /chưa có thay đổi/,
  );
  const changed = prepareTutorSubmission(
    live,
    undefined,
    { photo, document },
    { ...fields, bio: "Giới thiệu mới" },
  );
  assert.equal(changed.photo.publicId, photo.publicId);
  assert.equal(changed.document.publicId, document.publicId);
  const replacement = prepareTutorSubmission(
    live,
    undefined,
    { photo, document, stagedPhoto: { ...photo, publicId: "photo-new" } },
    fields,
  );
  assert.equal(replacement.photo.publicId, "photo-new");
  assert.equal(replacement.photoSource, "staged-photo");
});

test("bản đang chờ bị khóa, bản từ chối được gửi lại", () => {
  const fields = tutorFields(input),
    media = { stagedPhoto: photo, stagedDocument: document };
  assert.throws(
    () =>
      prepareTutorSubmission(undefined, { status: "pending" }, media, fields),
    /đang chờ duyệt/,
  );
  assert.equal(
    prepareTutorSubmission(undefined, { status: "rejected" }, media, fields)
      .documentSource,
    "staged-document",
  );
  assert.throws(() => tutorFields({ ...input, mode: "unknown" }), /Hình thức/);
});

test("từ chối tệp giả mạo kiểu ảnh hoặc PDF", () => {
  assert.equal(validTutorFile(Buffer.from("<script>"), "image/png"), false);
  assert.equal(
    validTutorFile(Buffer.from("not a pdf"), "application/pdf"),
    false,
  );
  assert.equal(
    validTutorFile(Buffer.from("%PDF-1.7"), "application/pdf"),
    true,
  );
  assert.equal(
    validTutorFile(Buffer.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"),
    true,
  );
});

test("duyệt bản sửa không tự khôi phục gia sư đang tạm ẩn", () => {
  const candidate = {
    ...tutorFields(input),
    photo,
    document,
    email: "tutor@example.com",
  };
  const update = approvedTutorUpdate(
    candidate,
    { status: "suspended" },
    "uid",
    123,
  );
  assert.equal(update.status, "suspended");
  assert.equal(update.photoUrl, "/api/media/uid/photo?v=123");
  assert.equal(
    approvedTutorUpdate(candidate, { status: "approved" }, "uid", 123).status,
    "approved",
  );
  assert.throws(
    () =>
      approvedTutorUpdate(
        { ...candidate, photo: undefined },
        undefined,
        "uid",
        123,
      ),
    /ảnh chân dung/,
  );
});

test("gia sư tạm ẩn không nhận đơn hoặc học thử mới", () => {
  assert.equal(tutorAcceptsNewOrders("approved"), true);
  assert.equal(tutorAcceptsNewOrders("suspended"), false);
  assert.equal(tutorAcceptsNewOrders("pending"), false);
  assert.equal(tutorAcceptsNewOrders(undefined), false);
});
