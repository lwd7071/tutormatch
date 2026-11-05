import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import ts from "typescript";

const require = createRequire(import.meta.url);
const source = readFileSync("src/lib/expiry.ts", "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const clock = 100_000_000;

function expiryWithStore(initial, beforeTransaction = () => {}) {
  const store = new Map(Object.entries(initial));
  const reference = path => ({ path, get id() { return path.split("/").at(-1); } });
  let generated = 0;
  const collection = name => ({
    doc: id => reference(`${name}/${id || `generated_${generated++}`}`),
    where(field, operator, value) {
      const conditions = [[field, operator, value]];
      let ordered = "", limit = Infinity, after = null;
      const query = {
        where(f, op, v) { conditions.push([f, op, v]); return query; },
        orderBy(f) { ordered = f; return query; },
        limit(n) { limit = n; return query; },
        startAfter(doc) { after = doc; return query; },
        async get() {
          let docs = [...store.entries()].filter(([path]) => path.startsWith(`${name}/`)).map(([path, value]) => ({ id: reference(path).id, ref: reference(path), data: () => value }));
          docs = docs.filter(doc => conditions.every(([f, op, v]) => op === "==" ? doc.data()[f] === v : doc.data()[f] !== undefined && doc.data()[f] <= v));
          docs.sort((a, b) => a.data()[ordered] - b.data()[ordered] || a.id.localeCompare(b.id));
          if (after) docs = docs.filter(doc => doc.data()[ordered] > after.data()[ordered] || doc.data()[ordered] === after.data()[ordered] && doc.id > after.id);
          docs = docs.slice(0, limit);
          return { docs, size: docs.length, empty: docs.length === 0 };
        },
      };
      return query;
    },
  });
  const database = {
    doc: reference, collection,
    async runTransaction(work) {
      beforeTransaction(store);
      const writes = [];
      const tx = {
        get: async ref => ({ data: () => store.get(ref.path) }),
        update: (ref, data) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...data })),
        create: (ref, data) => writes.push(() => { if (store.has(ref.path)) throw new Error("Already exists"); store.set(ref.path, data); }),
      };
      const result = await work(tx);
      for (const write of writes) write();
      return result;
    },
  };
  const module = { exports: {} };
  const mockRequire = name => {
    if (name === "./firebase-admin") return { db: () => database };
    if (name === "./server") return { DAY: 86_400_000, now: () => clock };
    return require(name);
  };
  new Function("require", "module", "exports", compiled)(mockRequire, module, module.exports);
  return { expireDue: module.exports.expireDue, store };
}

test("cron xử lý bản ghi đến hạn theo lô và chạy lại không tạo thêm tiền", async () => {
  const initial = Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`orders/${i}`, { status: "pending_tutor", decisionDue: clock - 1, studentId: `s${i}`, price: 1000 }]));
  initial["sessions/lesson"] = { status: "scheduled", end: clock - 86_400_000 - 1, studentId: "s", tutorId: "t" };
  initial["orders/future"] = { status: "pending_tutor", decisionDue: clock + 1, studentId: "s", price: 1000 };
  const { expireDue, store } = expiryWithStore(initial);
  assert.deepEqual(await expireDue(), { changed: 102, failed: 0 });
  assert.equal(store.get("orders/0").status, "refund_pending");
  assert.equal(store.get("sessions/lesson").status, "dispute");
  assert.equal(store.get("orders/future").status, "pending_tutor");
  assert.deepEqual(await expireDue(), { changed: 0, failed: 0 });
});

test("cron bỏ qua đơn đã được nhận sau lúc truy vấn", async () => {
  let changed = false;
  const { expireDue, store } = expiryWithStore({ "orders/one": { status: "pending_tutor", decisionDue: clock - 1, studentId: "s", price: 1000 } }, entries => {
    if (!changed) { entries.set("orders/one", { ...entries.get("orders/one"), status: "active" }); changed = true; }
  });
  assert.deepEqual(await expireDue(), { changed: 0, failed: 0 });
  assert.equal(store.has("refunds/order_one"), false);
});
