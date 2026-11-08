import assert from "node:assert/strict";
import test from "node:test";
import { actionSchema, parseActionRequest } from "../src/lib/action-schema.ts";
import { failure, success } from "../src/lib/api-response.ts";

test("schema từ chối cờ sai kiểu, mode lạ và trường không khai báo", () => {
  assert.equal(
    actionSchema.safeParse({
      action: "decideOrder",
      id: "123",
      accept: "false",
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      action: "savePackage",
      title: "Toán",
      subjectId: "math",
      price: 1000,
      count: 1,
      durationMinutes: 60,
      mode: "hybrid",
      active: true,
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      action: "admin",
      kind: "resolveSession",
      id: "a",
      taught: "false",
      reason: "Không học",
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      action: "requestTrial",
      tutorId: "abc",
      extra: "ignored",
    }).success,
    false,
  );
  assert.equal(
    actionSchema.safeParse({
      action: "createOrder",
      packageId: "abc",
      idempotencyKey: "not-a-uuid",
    }).success,
    false,
  );
});

test("admin chỉ lưu link HTTPS thuộc Google Forms", () => {
  const action = (url) =>
    actionSchema.safeParse({ action: "admin", kind: "matchFormUrl", url });
  assert.equal(action("https://docs.google.com/forms/d/e/abc/viewform").success, true);
  assert.equal(action("").success, true);
  assert.equal(action("https://example.com/forms/abc").success, false);
  assert.equal(action("http://docs.google.com/forms/abc").success, false);
});

test("reviewTutor chỉ nhận tối đa ba hashtag hợp lệ, không trùng", () => {
  const review = (tags) => actionSchema.safeParse({
    action: "reviewTutor",
    orderId: "order_1",
    stars: 5,
    text: "Giảng dễ hiểu",
    ...(tags === undefined ? {} : { tags }),
  });
  assert.equal(review().success, true);
  assert.equal(review(["clear_explanation"]).success, true);
  assert.equal(review(["clear_explanation", "patient_tutor", "caring_tutor"]).success, true);
  assert.equal(review(["unknown"]).success, false);
  assert.equal(review(["patient_tutor", "patient_tutor"]).success, false);
  assert.equal(review(["clear_explanation", "patient_tutor", "caring_tutor", "fun_learning"]).success, false);
});

test("yêu cầu gói học cần đủ mục tiêu, nội dung và thời gian mong muốn", () => {
  const request = {
    action: "requestPackage", tutorId: "tutor", subjectId: "math",
    purpose: "Ôn thi cuối kỳ", topics: "Phương trình", count: 4,
    durationMinutes: 60, mode: "online", timePreference: "Tối thứ 2 và 4",
  };
  assert.equal(actionSchema.safeParse(request).success, true);
  assert.equal(actionSchema.safeParse({ ...request, count: 0 }).success, false);
  assert.equal(actionSchema.safeParse({ ...request, timePreference: " " }).success, false);
  assert.equal(actionSchema.safeParse({ ...request, purpose: "" }).success, false);
});

test("request quá lớn và JSON sai trả lỗi nhập liệu", async () => {
  await assert.rejects(
    parseActionRequest(
      new Request("http://localhost", { method: "POST", body: "{" }),
    ),
    /JSON/,
  );
  await assert.rejects(
    parseActionRequest(
      new Request("http://localhost", {
        method: "POST",
        body: JSON.stringify({
          action: "sendMessage",
          threadId: "x",
          text: "a".repeat(33_000),
        }),
      }),
    ),
    /quá lớn/,
  );
});

test("response thành công và lỗi có cấu trúc ổn định", async () => {
  assert.deepEqual(await success({ id: "x" }).json(), { data: { id: "x" } });
  const response = failure(new Error("private database detail"));
  assert.equal(response.status, 500);
  const body = await response.json();
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(JSON.stringify(body).includes("private database detail"), false);
  assert.ok(body.requestId);
});
