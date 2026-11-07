import { FieldPath } from "firebase-admin/firestore";
import { db } from "./firebase-admin";
import { DAY, now } from "./server";
import { reconcilePendingPayments } from "./payment-flow";
import { refreshQueuedListings } from "./listing";

type Group = "orders" | "sessions";
type Outcome = { changed: number; failed: number; more: boolean };

export async function expireDueGroup(
  collection: Group,
  budgetMs = 40_000,
  maxPages = 5,
): Promise<Outcome> {
  const database = db(),
    cutoff = now(),
    dueAt = collection === "orders" ? cutoff : cutoff - DAY;
  const field = collection === "orders" ? "decisionDue" : "end";
  const status = collection === "orders" ? "pending_tutor" : "scheduled";
  const stateRef = database.doc(`cronCursors/${collection}`);
  const saved = (await stateRef.get()).data();
  let cursor =
    saved?.at !== undefined && saved?.id
      ? { at: Number(saved.at), id: String(saved.id) }
      : null;
  let changed = 0,
    failed = 0,
    exhausted = false;
  const deadline = Date.now() + budgetMs;
  for (let page = 0; page < maxPages && Date.now() < deadline; page++) {
    let query = database
      .collection(collection)
      .where("status", "==", status)
      .where(field, "<=", dueAt)
      .orderBy(field)
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (cursor) query = query.startAfter(cursor.at, cursor.id);
    const batch = await query.get();
    if (batch.empty) {
      exhausted = true;
      break;
    }
    for (const doc of batch.docs) {
      try {
        const updated = await database.runTransaction(async (tx) => {
          const fresh = (await tx.get(doc.ref)).data();
          if (!fresh || fresh.status !== status || fresh[field] > dueAt)
            return false;
          if (collection === "orders") {
            tx.update(doc.ref, { status: "refund_pending", expiredAt: now() });
            tx.create(database.doc(`refunds/order_${doc.id}`), {
              orderId: doc.id,
              studentId: fresh.studentId,
              amount: fresh.price,
              status: "needs_details",
              source: "tutor_timeout",
              reason: "Gia sư không phản hồi trong 24 giờ",
              at: now(),
            });
            tx.create(database.collection("notifications").doc(), {
              userId: fresh.studentId,
              text: "Đơn đã quá hạn phản hồi và được đưa vào luồng hoàn tiền.",
              at: now(),
            });
          } else {
            tx.update(doc.ref, { status: "dispute", expiredAt: now() });
            tx.create(database.collection("notifications").doc(), {
              userId: fresh.studentId,
              text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.",
              at: now(),
            });
            tx.create(database.collection("notifications").doc(), {
              userId: fresh.tutorId,
              text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.",
              at: now(),
            });
          }
          return true;
        });
        if (updated) changed++;
      } catch (error) {
        failed++;
        console.error(`Could not expire ${collection}/${doc.id}`, error);
      }
      cursor = { at: Number(doc.data()[field]), id: doc.id };
      if (Date.now() >= deadline) break;
    }
    if (batch.size < 100 && cursor?.id === batch.docs.at(-1)?.id) {
      exhausted = true;
      break;
    }
    if (Date.now() >= deadline) break;
  }
  await stateRef.set({
    at: exhausted ? null : (cursor?.at ?? null),
    id: exhausted ? null : (cursor?.id ?? null),
    updatedAt: now(),
  });
  if (!exhausted)
    console.warn(`Cron ${collection} has remaining work`, {
      cursor: cursor?.id,
    });
  return { changed, failed, more: !exhausted };
}

export async function expireDue() {
  let changed = 0,
    failed = 0;
  const groups: Record<string, Outcome> = {};
  const tasks: [string, () => Promise<Outcome>][] = [
    ["payments", () => reconcilePendingPayments({ budgetMs: 60_000 })],
    ["orders", () => expireDueGroup("orders")],
    ["sessions", () => expireDueGroup("sessions")],
    ["listings", () => refreshQueuedListings()],
  ];
  for (const [name, run] of tasks) {
    try {
      groups[name] = await run();
      changed += groups[name].changed;
      failed += groups[name].failed;
    } catch (error) {
      failed++;
      groups[name] = { changed: 0, failed: 1, more: true };
      console.error(`Cron ${name} failed`, error);
    }
  }
  return { changed, failed, groups };
}
