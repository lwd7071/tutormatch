import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";
import { tutorAcceptsNewOrders } from "../src/lib/tutor-profile.ts";

const require = createRequire(import.meta.url);
const source = readFileSync("src/app/api/payments/webhook/route.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const paymentCompiled = ts.transpileModule(readFileSync("src/lib/payment-flow.ts", "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;

function webhookWithStore(initial) {
  const store = new Map(Object.entries(initial));
  const reference = path => ({ path });
  const database = {
    doc: reference,
    collection: name => ({ doc: id => reference(`${name}/${id || `generated_${store.size}`}`) }),
    runTransaction: async work => {
      const writes = [];
      const tx = {
        get: async ref => ({ exists: store.has(ref.path), data: () => store.get(ref.path) }),
        update: (ref, value) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...value })),
        create: (ref, value) => writes.push(() => {
          if (store.has(ref.path)) throw new Error("Already exists");
          store.set(ref.path, value);
        }),
      };
      await work(tx);
      for (const write of writes) write();
    },
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === "@/lib/firebase-admin") return { db: () => database };
    if (name === "@/lib/payos") return { verifyWebhook: () => true };
    if (name === "@/lib/server") return { DAY: 86_400_000, now: () => 1000 };
    if (name === "@/lib/tutor-profile") return { tutorAcceptsNewOrders };
    if (name === "@/lib/payment-flow") {
      const paymentModule = { exports: {} };
      const paymentRequire = dependency => {
        if (dependency === "./firebase-admin") return { db: () => database };
        if (dependency === "./server") return { DAY: 86_400_000, now: () => 1000 };
        if (dependency === "./tutor-profile") return { tutorAcceptsNewOrders };
        if (dependency === "./api-response") return { conflict: message => new Error(message) };
        if (dependency === "./payos") return { paymentEnabled: () => false };
        return require(dependency);
      };
      new Function("require", "module", "exports", paymentCompiled)(paymentRequire, paymentModule, paymentModule.exports);
      return paymentModule.exports;
    }
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(mockRequire, module, module.exports);
  return { post: module.exports.POST, store };
}

const payload = { code: "00", data: { orderCode: 123, amount: 5000, code: "00", reference: "payment" } };
const request = { json: async () => payload };
const order = { status: "pending_payment", tutorId: "tutor", studentId: "student", price: 5000, renewal: false };

test("webhook hoàn tiền khi gia sư bị khóa và không ghi hai lần khi gửi lặp", async () => {
  const { post, store } = webhookWithStore({ "orders/123": { ...order }, "tutors/tutor": { status: "approved" }, "users/tutor": { blocked: true } });
  assert.equal((await post(request)).status, 200);
  assert.equal(store.get("orders/123").status, "refund_pending");
  assert.equal(store.get("refunds/order_123").amount, 5000);
  const count = store.size;
  assert.equal((await post(request)).status, 200);
  assert.equal(store.size, count);
});

test("webhook đưa đơn của gia sư sẵn sàng vào chờ nhận", async () => {
  const { post, store } = webhookWithStore({ "orders/123": { ...order }, "tutors/tutor": { status: "approved" }, "users/tutor": { blocked: false } });
  assert.equal((await post(request)).status, 200);
  assert.equal(store.get("orders/123").status, "pending_tutor");
  assert.equal(store.has("refunds/order_123"), false);
});

test("webhook vẫn ghi nhận tiền nếu lần tạo link trước đó bị đánh dấu lỗi", async () => {
  const { post, store } = webhookWithStore({ "orders/123": { ...order, status: "payment_error" }, "tutors/tutor": { status: "approved" }, "users/tutor": { blocked: false } });
  assert.equal((await post(request)).status, 200);
  assert.equal(store.get("orders/123").status, "pending_tutor");
  assert.equal(store.get("ledger/payment_123").amount, 5000);
});
