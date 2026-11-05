import { db } from "./firebase-admin";
import { DAY, now } from "./server";
import { tutorAcceptsNewOrders } from "./tutor-profile";
import { conflict } from "./api-response";
import { getPaymentLink, paymentEnabled } from "./payos";
import { FieldPath } from "firebase-admin/firestore";

export async function applyPaidOrder(orderCode: number, amount: number, reference: string) {
  const database = db(), ref = database.doc(`orders/${orderCode}`);
  return database.runTransaction(async tx => {
    const snap = await tx.get(ref), order = snap.data();
    if (!order) throw conflict("Không tìm thấy đơn thanh toán.");
    if (!["pending_payment", "payment_error"].includes(order.status)) return false;
    if (amount !== order.price) throw conflict("Số tiền thanh toán không khớp đơn.");
    const [tutorSnap, tutorUserSnap] = await Promise.all([tx.get(database.doc(`tutors/${order.tutorId}`)), tx.get(database.doc(`users/${order.tutorId}`))]);
    const unavailable = !tutorAcceptsNewOrders(tutorSnap.data()?.status, tutorUserSnap.data()?.blocked === true);
    const paidAt = now();
    tx.update(ref, { status: unavailable ? "refund_pending" : order.renewal ? "active" : "pending_tutor", paidAt, decisionDue: unavailable || order.renewal ? null : paidAt + DAY, paymentReference: reference });
    tx.create(database.doc(`ledger/payment_${orderCode}`), { type: "payment", orderId: String(orderCode), amount: order.price, at: paidAt });
    if (unavailable) {
      tx.create(database.doc(`refunds/order_${orderCode}`), { orderId: String(orderCode), studentId: order.studentId, amount: order.price, status: "needs_details", source: "tutor_unavailable", reason: "Gia sư đã tạm ngừng nhận học viên", at: paidAt });
      tx.create(database.collection("notifications").doc(), { userId: order.studentId, text: "Gia sư đã tạm ngừng nhận học viên. Vui lòng cung cấp tài khoản để được hoàn tiền.", at: paidAt });
    } else {
      tx.create(database.collection("notifications").doc(), { userId: order.tutorId, text: order.renewal ? "Học viên đã mua tiếp gói học." : "Có đơn học mới cần bạn phản hồi trong 24 giờ.", at: paidAt });
    }
    return true;
  });
}

export async function reconcilePendingPayments() {
  if (!paymentEnabled()) return { changed: 0, failed: 0 };
  const database = db(), cutoff = now() - 5 * 60_000;
  let changed = 0, failed = 0;
  const stateRef = database.doc("settings/paymentReconciliation");
  const saved = (await stateRef.get()).data();
  let cursor = saved?.cursorCreatedAt && saved?.cursorId ? { createdAt: saved.cursorCreatedAt as number, id: saved.cursorId as string } : null;
  let exhausted = false;
  const deadline = now() + 150_000;
  for (let page = 0; page < 5; page++) {
  let query = database.collection("orders").where("status", "==", "pending_payment").where("createdAt", "<=", cutoff).orderBy("createdAt").orderBy(FieldPath.documentId()).limit(100);
  if (cursor) query = query.startAfter(cursor.createdAt, cursor.id);
  const pending = await query.get();
  if (!pending.size) { exhausted = true; break; }
  for (const doc of pending.docs) {
    try {
      const code = Number(doc.id), link = await getPaymentLink(code);
      if (!link) continue;
      if (link.status === "PAID") {
        if (await applyPaidOrder(code, link.amountPaid, "payos-reconciliation")) changed++;
      } else if (link.status === "PENDING" && link.paymentLinkId && !doc.data().checkoutUrl) {
        const updated = await database.runTransaction(async tx => {
          const fresh = (await tx.get(doc.ref)).data();
          if (fresh?.status === "pending_payment" && !fresh.checkoutUrl) {
            tx.update(doc.ref, { checkoutUrl: link.checkoutUrl || `https://pay.payos.vn/web/${link.paymentLinkId}`, paymentLinkId: link.paymentLinkId, linkLeaseUntil: null });
            return true;
          }
          return false;
        });
        if (updated) changed++;
      } else if (["CANCELLED", "EXPIRED"].includes(link.status)) {
        const updated = await database.runTransaction(async tx => {
          if ((await tx.get(doc.ref)).data()?.status === "pending_payment") {
            tx.update(doc.ref, { status: "payment_error", paymentClosedAt: now(), linkLeaseUntil: null });
            return true;
          }
          return false;
        });
        if (updated) changed++;
      }
    } catch (error) { failed++; console.error(`Could not reconcile payment ${doc.id}`, error); }
    cursor = { createdAt: doc.data().createdAt, id: doc.id };
    if (now() >= deadline) break;
  }
  if (pending.size < 100 && cursor?.id === pending.docs.at(-1)?.id) { exhausted = true; break; }
  if (now() >= deadline) break;
  }
  await stateRef.set({ cursorCreatedAt: exhausted ? null : cursor?.createdAt || null, cursorId: exhausted ? null : cursor?.id || null, updatedAt: now() });
  if (!exhausted) console.warn("Payment reconciliation has more orders to check on the next cron run", { cursor: cursor?.id });
  return { changed, failed };
}
