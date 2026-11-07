import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = ts.transpileModule(
  readFileSync("src/lib/payment-test.ts", "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

function service() {
  const store = new Map();
  const ref = (path) => ({
    path,
    get: async () => ({ exists: store.has(path), data: () => store.get(path) }),
    update: async (value) => store.set(path, { ...store.get(path), ...value }),
  });
  const database = {
    doc: ref,
    async runTransaction(work) {
      const writes = [];
      const tx = {
        get: (path) => path.get(),
        create: (path, value) =>
          writes.push(() => {
            if (store.has(path.path)) throw Error("exists");
            store.set(path.path, value);
          }),
        set: (path, value, options) =>
          writes.push(() =>
            store.set(
              path.path,
              options?.merge ? { ...store.get(path.path), ...value } : value,
            ),
          ),
        update: (path, value) =>
          writes.push(() =>
            store.set(path.path, { ...store.get(path.path), ...value }),
          ),
      };
      const result = await work(tx);
      for (const write of writes) write();
      return result;
    },
  };
  const module = { exports: {} };
  const mockRequire = (name) => {
    if (name === "./firebase-admin") return { db: () => database };
    if (name === "./payos")
      return {
        paymentEnabled: () => true,
        getPaymentLink: async () => null,
        createPaymentLink: async () => ({
          checkoutUrl: "https://payos.example/test",
          paymentLinkId: "link",
          qrCode: "bank-transfer-data",
        }),
      };
    if (name === "./api-response")
      return {
        ApiError: class extends Error {
          constructor(code, message, status) {
            super(message);
            this.code = code;
            this.status = status;
          }
        },
        conflict: (message) => new Error(message),
        unavailable: (message) => new Error(message),
      };
    return require(name);
  };
  new Function("require", "module", "exports", source)(
    mockRequire,
    module,
    module.exports,
  );
  return { ...module.exports, store };
}

test("QR test cố định 2.000đ, giữ một mã đang mở và không tạo dữ liệu kinh doanh", async () => {
  const prior = process.env.APP_ENV;
  process.env.APP_ENV = "staging";
  try {
    const { createPaymentTest, applyPaidPaymentTest, store } = service();
    const first = await createPaymentTest(
      "admin",
      "11111111-1111-4111-8111-111111111111",
      "https://staging.example",
    );
    assert.equal(first.amount, 2000);
    assert.equal(first.qrCode, "bank-transfer-data");
    assert.equal(
      (
        await createPaymentTest(
          "admin",
          "22222222-2222-4222-8222-222222222222",
          "https://staging.example",
        )
      ).orderCode,
      first.orderCode,
    );
    await assert.rejects(applyPaidPaymentTest(first.orderCode, 3000, "wrong"));
    assert.equal(
      store.get(`paymentTests/${first.orderCode}`).status,
      "pending",
    );
    assert.equal(
      await applyPaidPaymentTest(first.orderCode, 2000, "bank-ref"),
      true,
    );
    assert.equal(
      await applyPaidPaymentTest(first.orderCode, 2000, "bank-ref"),
      false,
    );
    assert.equal(store.get(`paymentTests/${first.orderCode}`).status, "paid");
    for (let index = 2; index <= 6; index++) {
      const next = await createPaymentTest(
        "admin",
        `${index}${"0".repeat(7)}-2222-4222-8222-222222222222`,
        "https://staging.example",
      );
      await applyPaidPaymentTest(next.orderCode, 2000, `ref-${index}`);
    }
    assert.equal(
      [...store.keys()].filter((key) => key.startsWith("paymentTests/")).length,
      6,
    );
    for (const key of store.keys())
      assert.equal(/^(orders|ledger|wallets|refunds)\//.test(key), false);
  } finally {
    if (prior === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prior;
  }
});

test("production không mở luồng test", () => {
  const prior = process.env.APP_ENV;
  process.env.APP_ENV = "production";
  try {
    assert.equal(service().paymentTestEnabled(), false);
  } finally {
    if (prior === undefined) delete process.env.APP_ENV;
    else process.env.APP_ENV = prior;
  }
});
