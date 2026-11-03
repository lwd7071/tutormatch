import { db } from "./firebase-admin";
import { DAY, now } from "./server";

export async function expireDue() {
  const database = db();
  const [orders, sessions] = await Promise.all([
    database.collection("orders").where("status", "==", "pending_tutor").get(),
    database.collection("sessions").where("status", "==", "scheduled").get(),
  ]);
  let changed = 0;
  for (const doc of orders.docs.filter(d => d.data().decisionDue <= now())) {
    await database.runTransaction(async tx => {
      const fresh = (await tx.get(doc.ref)).data();
      if (!fresh || fresh.status !== "pending_tutor" || fresh.decisionDue > now()) return;
      tx.update(doc.ref, { status: "refund_pending", expiredAt: now() });
      tx.create(database.doc(`refunds/order_${doc.id}`), { orderId: doc.id, studentId: fresh.studentId, amount: fresh.price, status: "needs_details", source: "tutor_timeout", reason: "Gia sư không phản hồi trong 24 giờ", at: now() });
      tx.create(database.collection("notifications").doc(), { userId: fresh.studentId, text: "Gia sư chưa phản hồi. Admin sẽ hoàn toàn bộ tiền.", at: now() });
    });
    changed++;
  }
  for (const doc of sessions.docs.filter(d => d.data().end + DAY <= now())) {
    await database.runTransaction(async tx => {
      const fresh = (await tx.get(doc.ref)).data();
      if (!fresh || fresh.status !== "scheduled" || fresh.end + DAY > now()) return;
      tx.update(doc.ref, { status: "dispute", expiredAt: now() });
      tx.create(database.collection("notifications").doc(), { userId: fresh.studentId, text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.", at: now() });
      tx.create(database.collection("notifications").doc(), { userId: fresh.tutorId, text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.", at: now() });
    });
    changed++;
  }
  return changed;
}
