import assert from "node:assert/strict";
import test from "node:test";
import { canCancelSession, publicCatalog } from "../src/lib/public-data.ts";
import { tutorAcceptsNewOrders } from "../src/lib/tutor-profile.ts";
import { legacyTutorSubmission } from "../src/lib/legacy-tutor-migration.mjs";
import {
  requireRefundBankCorrection,
  requireRefundBankSubmission,
} from "../src/lib/refund-state.ts";

test("gia sư chỉ hủy trước giờ học khi chưa ai xác nhận", () => {
  const session = {
    status: "scheduled",
    start: 1_000,
    end: 2_000,
    confirmations: {},
  };
  assert.equal(canCancelSession(session, 999), true);
  assert.equal(canCancelSession(session, 1_000), false);
  assert.equal(
    canCancelSession({ ...session, confirmations: { student: "yes" } }, 999),
    false,
  );
  assert.equal(canCancelSession({ ...session, status: "dispute" }, 999), false);
});

test("gia sư bị khóa không nhận đơn hoặc học thử dù hồ sơ còn approved", () => {
  assert.equal(tutorAcceptsNewOrders("approved", false), true);
  assert.equal(tutorAcceptsNewOrders("approved", true), false);
  assert.equal(tutorAcceptsNewOrders("suspended", false), false);
});

test("danh sách công khai lọc gia sư bị khóa, môn tạm dừng và trường riêng tư", () => {
  const tutors = [
    {
      id: "a",
      status: "approved",
      name: "A",
      bio: "Toán",
      mode: "online",
      email: "private@example.com",
      documentUrl: "/private",
      reviewReason: "private",
    },
    { id: "b", status: "approved", name: "B", bio: "Lý", mode: "offline" },
  ];
  const packages = [
    { id: "p1", tutorId: "a", subjectId: "math", active: true, price: 1000 },
    { id: "p2", tutorId: "a", subjectId: "physics", active: true, price: 2000 },
    { id: "p3", tutorId: "b", subjectId: "math", active: true, price: 3000 },
  ];
  const subjects = [
    { id: "math", name: "Toán", active: true },
    { id: "physics", name: "Lý", active: false },
  ];
  const reviews = [
    {
      id: "r1",
      tutorId: "a",
      status: "visible",
      stars: 5,
      text: "Tốt",
      studentId: "student-secret",
      orderId: "order-secret",
    },
  ];
  const result = publicCatalog(
    tutors,
    packages,
    subjects,
    reviews,
    new Set(["b"]),
  );
  assert.deepEqual(
    result.tutors.map((t) => t.id),
    ["a"],
  );
  assert.deepEqual(
    result.packages.map((p) => p.id),
    ["p1"],
  );
  assert.deepEqual(
    result.subjects.map((s) => s.id),
    ["math"],
  );
  assert.deepEqual(Object.keys(result.reviews[0]).sort(), [
    "id",
    "stars",
    "text",
    "tutorId",
  ]);
  assert.equal(JSON.stringify(result).includes("private"), false);
  assert.equal(JSON.stringify(result).includes("student-secret"), false);
});

test("migration biến hồ sơ cũ thiếu tệp thành bản có thể bổ sung", () => {
  const tutor = {
    name: "A",
    bio: "Toán",
    mode: "online",
    status: "pending",
    updatedAt: 123,
  };
  const photo = { publicId: "photo" },
    document = { publicId: "document" };
  assert.equal(
    legacyTutorSubmission(tutor, { photo, document }).status,
    "pending",
  );
  const incomplete = legacyTutorSubmission(tutor, { photo });
  assert.equal(incomplete.status, "rejected");
  assert.equal(incomplete.photo.publicId, "photo");
  assert.match(incomplete.reviewReason, /giấy tờ/);
  assert.match(
    legacyTutorSubmission(tutor, {}).reviewReason,
    /ảnh chân dung và giấy tờ/,
  );
  assert.equal(
    legacyTutorSubmission(tutor, { stagedPhoto: photo, document }).photoSource,
    "staged-photo",
  );
  assert.equal(
    legacyTutorSubmission({ ...tutor, status: "rejected" }, { photo, document })
      .status,
    "rejected",
  );
});

test("học viên không sửa tài khoản đã gửi, admin chỉ yêu cầu sửa bản đang chờ", () => {
  requireRefundBankSubmission(
    { studentId: "student", status: "needs_details" },
    "student",
  );
  assert.throws(() =>
    requireRefundBankSubmission(
      { studentId: "student", status: "pending" },
      "student",
    ),
  );
  assert.throws(() =>
    requireRefundBankSubmission(
      { studentId: "student", status: "needs_details" },
      "other",
    ),
  );
  requireRefundBankCorrection({
    source: "tutor_unavailable",
    status: "pending",
  });
  assert.throws(() => requireRefundBankCorrection({ status: "completed" }));
});
