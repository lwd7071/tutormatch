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
