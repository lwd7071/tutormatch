import { db } from "./firebase-admin";
import { DAY, now } from "./server";
import { reconcilePendingPayments } from "./payment-flow";
import { refreshQueuedListings } from "./listing";

export async function expireDue() {
  const database = db(), cutoff = now();
  let changed = 0, failed = 0;

  async function processDue(collection: "orders" | "sessions", field: "decisionDue" | "end", dueAt: number) {
    let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
    while (true) {
      let query = database.collection(collection).where("status", "==", collection === "orders" ? "pending_tutor" : "scheduled")
        .where(field, "<=", dueAt).orderBy(field).limit(100);
      if (cursor) query = query.startAfter(cursor);
      const batch = await query.get();
      if (batch.empty) break;
      for (const doc of batch.docs) {
        try {
          const updated = await database.runTransaction(async tx => {
            const fresh = (await tx.get(doc.ref)).data();
            if (!fresh || fresh.status !== (collection === "orders" ? "pending_tutor" : "scheduled") || fresh[field] > dueAt) return false;
            if (collection === "orders") {
              tx.update(doc.ref, { status: "refund_pending", expiredAt: now() });
              tx.create(database.doc(`refunds/order_${doc.id}`), { orderId: doc.id, studentId: fresh.studentId, amount: fresh.price, status: "needs_details", source: "tutor_timeout", reason: "Gia sư không phản hồi trong 24 giờ", at: now() });
              tx.create(database.collection("notifications").doc(), { userId: fresh.studentId, text: "Đơn đã quá hạn phản hồi và được đưa vào luồng hoàn tiền.", at: now() });
            } else {
              tx.update(doc.ref, { status: "dispute", expiredAt: now() });
              tx.create(database.collection("notifications").doc(), { userId: fresh.studentId, text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.", at: now() });
              tx.create(database.collection("notifications").doc(), { userId: fresh.tutorId, text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.", at: now() });
            }
            return true;
          });
          if (updated) changed++;
        } catch (error) { failed++; console.error(`Could not expire ${collection}/${doc.id}`, error); }
      }
      cursor = batch.docs.at(-1);
      if (batch.size < 100) break;
    }
  }

  await processDue("orders", "decisionDue", cutoff);
  await processDue("sessions", "end", cutoff - DAY);
  const payments = await reconcilePendingPayments();
  changed += payments.changed;
  failed += payments.failed;
  const listings = await refreshQueuedListings();
  changed += listings.changed;
  failed += listings.failed;
  return { changed, failed };
}
