import { randomInt } from "node:crypto";
import { db } from "./firebase-admin";
import { ApiError, conflict, unavailable } from "./api-response";
import { createPaymentLink, getPaymentLink, paymentEnabled } from "./payos";

export const TEST_AMOUNT = 2_000;
export const paymentTestEnabled = () =>
  process.env.APP_ENV === "staging" && process.env.VERCEL_ENV !== "production";

type TestRecord = {
  orderCode: number;
  createdBy: string;
  amount: number;
  status: string;
  checkoutUrl?: string;
  qrCode?: string;
  paymentLinkId?: string;
  reference?: string;
  linkAttemptedAt?: number;
};
const view = (value: TestRecord) => ({
  orderCode: value.orderCode,
  amount: value.amount,
  status: value.status,
  checkoutUrl: value.checkoutUrl || null,
  qrCode: value.qrCode || null,
  paymentLinkId: value.paymentLinkId || null,
  reference: value.reference || null,
});

export async function latestPaymentTest(uid: string) {
  const database = db();
  const state = (await database.doc(`paymentTestAdmins/${uid}`).get()).data();
  if (!state?.lastCode) return null;
  const record = (
    await database.doc(`paymentTests/${state.lastCode}`).get()
  ).data() as TestRecord | undefined;
  return record?.createdBy === uid ? view(record) : null;
}

export async function createPaymentTest(
  uid: string,
  key: string,
  origin: string,
) {
  if (!paymentEnabled() || !paymentTestEnabled())
    throw unavailable("Thanh toán thử chỉ hoạt động trên staging.");
  const database = db();
  const adminRef = database.doc(`paymentTestAdmins/${uid}`);
  const attemptRef = database.doc(`paymentTestAttempts/${uid}_${key}`);
  let code = 0;
  for (let tries = 0; tries < 8; tries++) {
    const candidate = Date.now() * 1000 + randomInt(1000);
    const outcome = await database.runTransaction(async (tx) => {
      const [admin, attempt, registry, normal, existingTest] =
        await Promise.all([
          tx.get(adminRef),
          tx.get(attemptRef),
          tx.get(database.doc(`paymentCodes/${candidate}`)),
          tx.get(database.doc(`orders/${candidate}`)),
          tx.get(database.doc(`paymentTests/${candidate}`)),
        ]);
      const previousCode =
        attempt.data()?.orderCode || admin.data()?.activeCode;
      if (previousCode) return { code: Number(previousCode), collision: false };
      if (registry.exists || normal.exists || existingTest.exists)
        return { code: 0, collision: true };
      const record = {
        orderCode: candidate,
        createdBy: uid,
        amount: TEST_AMOUNT,
        status: "pending",
        createdAt: Date.now(),
        idempotencyKey: key,
      };
      tx.create(database.doc(`paymentCodes/${candidate}`), {
        kind: "test",
        createdAt: record.createdAt,
      });
      tx.create(database.doc(`paymentTests/${candidate}`), record);
      tx.create(attemptRef, {
        orderCode: candidate,
        createdAt: record.createdAt,
      });
      tx.set(
        adminRef,
        { activeCode: candidate, lastCode: candidate },
        { merge: true },
      );
      return { code: candidate, collision: false };
    });
    if (!outcome.collision) {
      code = outcome.code;
      break;
    }
  }
  if (!code)
    throw unavailable("Chưa tạo được mã giao dịch thử. Vui lòng thử lại.");
  const ref = database.doc(`paymentTests/${code}`);
  let record = (await ref.get()).data() as TestRecord;
  if (record.createdBy !== uid)
    throw conflict("Giao dịch thử không thuộc tài khoản này.");
  if (record.status !== "pending" || record.qrCode) return view(record);
  try {
    // The first request has no payOS link to look up. Only reconcile after a create attempt was recorded.
    let existing = null;
    if (record.linkAttemptedAt) {
      try {
        existing = await getPaymentLink(code);
      } catch (lookupError) {
        console.warn("Could not look up previous payment test link", {
          code,
          lookupError,
        });
      }
    }
    if (existing?.status === "PAID") {
      await applyPaidPaymentTest(
        code,
        existing.amountPaid,
        "payos-reconciliation",
      );
      return latestPaymentTest(uid);
    }
    if (existing?.status === "PENDING" && existing.paymentLinkId) {
      if (!existing.qrCode)
        throw unavailable(
          "payOS chưa trả dữ liệu QR; vui lòng kiểm tra trên payOS và thử lại.",
        );
      await ref.update({
        checkoutUrl:
          existing.checkoutUrl ||
          `https://pay.payos.vn/web/${existing.paymentLinkId}`,
        paymentLinkId: existing.paymentLinkId,
        qrCode: existing.qrCode,
      });
    } else {
      if (!record.linkAttemptedAt)
        await ref.update({ linkAttemptedAt: Date.now() });
      const link = await createPaymentLink({
        orderCode: code,
        amount: TEST_AMOUNT,
        description: "TM TEST 2000",
        returnUrl: `${origin}/payment-test`,
        cancelUrl: `${origin}/payment-test`,
      });
      if (!link.qrCode)
        throw unavailable(
          "payOS chưa trả dữ liệu QR; vui lòng kiểm tra trên payOS và thử lại.",
        );
      await ref.update({
        checkoutUrl: link.checkoutUrl,
        paymentLinkId: link.paymentLinkId,
        qrCode: link.qrCode,
      });
    }
    record = (await ref.get()).data() as TestRecord;
    return view(record);
  } catch (error) {
    console.error("Payment test link creation failed", { code, error });
    if (error instanceof ApiError) throw error;
    throw unavailable(
      "Chưa tạo được QR 2.000đ. Có thể kênh payOS không chấp nhận mức tiền này; vui lòng kiểm tra trên payOS.",
    );
  }
}

export async function applyPaidPaymentTest(
  code: number,
  amount: number,
  reference: string,
) {
  const database = db(),
    ref = database.doc(`paymentTests/${code}`);
  return database.runTransaction(async (tx) => {
    const snap = await tx.get(ref),
      record = snap.data();
    if (!record) throw conflict("Không tìm thấy giao dịch thử.");
    if (amount !== TEST_AMOUNT || record.amount !== TEST_AMOUNT)
      throw conflict("Số tiền giao dịch thử không khớp.");
    if (record.status === "paid") return false;
    if (!["pending", "needs_check", "cancelled"].includes(record.status))
      throw conflict("Giao dịch thử đã đóng.");
    const adminRef = database.doc(`paymentTestAdmins/${record.createdBy}`);
    const admin = await tx.get(adminRef);
    tx.update(ref, { status: "paid", reference, paidAt: Date.now() });
    if (admin.data()?.activeCode === code)
      tx.update(adminRef, { activeCode: null });
    return true;
  });
}

export async function reconcilePaymentTest(uid: string, code: number) {
  const database = db(),
    ref = database.doc(`paymentTests/${code}`);
  const record = (await ref.get()).data() as TestRecord | undefined;
  if (!record || record.createdBy !== uid)
    throw conflict("Không tìm thấy giao dịch thử.");
  if (record.status === "paid") return view(record);
  const link = await getPaymentLink(code);
  if (!link)
    throw unavailable(
      "payOS chưa trả trạng thái giao dịch. Vui lòng kiểm tra lại sau.",
    );
  if (link.amount !== TEST_AMOUNT)
    throw conflict("Số tiền trên payOS không khớp 2.000đ.");
  if (link.status === "PAID")
    await applyPaidPaymentTest(code, link.amountPaid, "payos-reconciliation");
  else if (["CANCELLED", "EXPIRED"].includes(link.status))
    await database.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (current?.status === "pending") {
        const adminRef = database.doc(`paymentTestAdmins/${uid}`),
          admin = await tx.get(adminRef);
        tx.update(ref, { status: "cancelled", closedAt: Date.now() });
        if (admin.data()?.activeCode === code)
          tx.update(adminRef, { activeCode: null });
      }
    });
  else if (link.status !== "PENDING")
    await ref.update({ status: "needs_check", checkedAt: Date.now() });
  return view((await ref.get()).data() as TestRecord);
}
