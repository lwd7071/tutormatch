import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync("src/app/api/payment-test/route.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function route(role = "admin", enabled = true) {
  let created = 0;
  const module = { exports: {} };
  const mockRequire = (name) => {
    if (name === "@/lib/server")
      return {
        actor: async () => ({ uid: "u", role }),
        requireRole: (_user, expected) => {
          if (role !== expected)
            throw { code: "FORBIDDEN", status: 403, message: "Forbidden" };
        },
        fail: (error) =>
          Response.json(
            { error: { code: error.code || "ERROR", message: error.message } },
            { status: error.status || 500 },
          ),
      };
    if (name === "@/lib/api-response")
      return {
        invalid: (message) => ({ code: "INVALID_INPUT", status: 400, message }),
        success: (data) => Response.json({ data }),
      };
    if (name === "@/lib/payment-test")
      return {
        paymentTestEnabled: () => enabled,
        latestPaymentTest: async () => null,
        reconcilePaymentTest: async () => null,
        createPaymentTest: async () => {
          created++;
          return { amount: 2000 };
        },
      };
    return require(name);
  };
  new Function("require", "module", "exports", source)(
    mockRequire,
    module,
    module.exports,
  );
  return {
    ...module.exports,
    get created() {
      return created;
    },
  };
}

const request = (body) => ({
  text: async () => JSON.stringify(body),
  nextUrl: { origin: "https://staging.example" },
});
const key = "11111111-1111-4111-8111-111111111111";

test("API QR test từ chối số tiền do client gửi và chỉ chấp nhận admin", async () => {
  const admin = route();
  assert.equal(
    (await admin.POST(request({ idempotencyKey: key, amount: 2000 }))).status,
    400,
  );
  assert.equal(admin.created, 0);
  assert.equal(
    (await admin.POST(request({ idempotencyKey: key }))).status,
    200,
  );
  assert.equal(admin.created, 1);
  const student = route("student");
  assert.equal(
    (await student.POST(request({ idempotencyKey: key }))).status,
    403,
  );
  assert.equal(student.created, 0);
});

test("API QR test trả 404 ngoài staging", async () => {
  assert.equal(
    (await route("admin", false).POST(request({ idempotencyKey: key }))).status,
    404,
  );
});
