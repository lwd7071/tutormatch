import { FieldPath, type Query } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, DAY, fail, now, requireRole } from "@/lib/server";
import { conflict, invalid, success } from "@/lib/api-response";
import { getPaymentLink } from "@/lib/payos";
import { applyPaidOrder } from "@/lib/payment-flow";
import { stageListing } from "@/lib/listing";
import { paginateQuery, parsePage } from "@/lib/pagination";

export const runtime = "nodejs";
const groups = ["payments", "orders", "sessions", "listings"] as const;
type Group = (typeof groups)[number];

export async function GET(req: NextRequest) {
  try {
    requireRole(await actor(req), "admin");
    const group = req.nextUrl.searchParams.get("group") as Group,
      page = parsePage(req.nextUrl.searchParams.get("page"));
    if (!groups.includes(group)) throw invalid("Danh sách không hợp lệ.");
    const cutoff = now(), database = db();
    let query: Query = database.collection(group === "listings" ? "listingJobs" : group === "payments" || group === "orders" ? "orders" : "sessions");
    if (group === "payments") query = query.where("status", "==", "pending_payment").where("createdAt", "<=", cutoff - 5 * 60_000).orderBy("createdAt");
    if (group === "orders") query = query.where("status", "==", "pending_tutor").where("decisionDue", "<=", cutoff).orderBy("decisionDue");
    if (group === "sessions") query = query.where("status", "==", "scheduled").where("end", "<=", cutoff - DAY).orderBy("end");
    query = query.orderBy(FieldPath.documentId());
    const result = await paginateQuery(query, page);
    const items: Record<string, any>[] = result.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    return success({
      items: items.map((row) => group === "payments"
        ? { id: row.id, title: row.title, price: row.price, createdAt: row.createdAt }
        : group === "orders"
          ? { id: row.id, title: row.title, price: row.price, studentId: row.studentId, tutorId: row.tutorId, decisionDue: row.decisionDue }
          : group === "sessions"
            ? { id: row.id, start: row.start, end: row.end, studentId: row.studentId, tutorId: row.tutorId, trialId: row.trialId, confirmations: row.confirmations }
            : { id: row.id, updatedAt: row.updatedAt }),
      page: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
    });
  } catch (error) { return fail(error); }
}

export async function POST(req: NextRequest) {
  try {
    requireRole(await actor(req), "admin");
    const body: unknown = await req.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) || Object.keys(body).length !== 2 || !("group" in body) || !("id" in body)) throw invalid("Yêu cầu không hợp lệ.");
    const { group, id } = body as { group: Group; id: unknown };
    if (!groups.includes(group) || typeof id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw invalid("Yêu cầu không hợp lệ.");
    const database = db(), cutoff = now();
    if (group === "payments") {
      const ref = database.doc(`orders/${id}`), order = (await ref.get()).data();
      if (!order || order.status !== "pending_payment" || order.createdAt > cutoff - 5 * 60_000) throw conflict("Đơn không còn chờ kiểm tra.");
      const orderCode = Number(id);
      if (!Number.isSafeInteger(orderCode)) throw conflict("Mã đơn payOS không hợp lệ.");
      const link = await getPaymentLink(orderCode);
      if (!link) throw conflict("Không tra được trạng thái đơn trên payOS.");
      if (link.status === "PAID") {
        if (link.amountPaid !== order.price) throw conflict("Số tiền payOS không khớp với đơn.");
        await applyPaidOrder(orderCode, link.amountPaid, "payos-reconciliation");
      } else if (link.status === "PENDING" && link.paymentLinkId && !order.checkoutUrl) {
        await database.runTransaction(async (tx) => {
          const fresh = (await tx.get(ref)).data();
          if (fresh?.status !== "pending_payment") throw conflict("Đơn đã thay đổi.");
          tx.update(ref, { checkoutUrl: link.checkoutUrl || `https://pay.payos.vn/web/${link.paymentLinkId}`, paymentLinkId: link.paymentLinkId, linkLeaseUntil: null });
        });
      } else if (["CANCELLED", "EXPIRED"].includes(link.status)) {
        await database.runTransaction(async (tx) => {
          const fresh = (await tx.get(ref)).data();
          if (fresh?.status !== "pending_payment") throw conflict("Đơn đã thay đổi.");
          tx.update(ref, { status: "payment_error", paymentClosedAt: now(), linkLeaseUntil: null });
        });
      }
    } else if (group === "orders") {
      const ref = database.doc(`orders/${id}`);
      await database.runTransaction(async (tx) => {
        const order = (await tx.get(ref)).data();
        if (!order || order.status !== "pending_tutor" || order.decisionDue > cutoff) throw conflict("Đơn không còn quá hạn.");
        tx.update(ref, { status: "refund_pending", expiredAt: now() });
        tx.create(database.doc(`refunds/order_${id}`), { orderId: id, studentId: order.studentId, amount: order.price, status: "needs_details", source: "tutor_timeout", reason: "Gia sư không phản hồi trong 24 giờ", at: now() });
        tx.create(database.collection("notifications").doc(), { userId: order.studentId, text: "Đơn đã quá hạn phản hồi và được đưa vào luồng hoàn tiền.", at: now() });
      });
    } else if (group === "sessions") {
      const ref = database.doc(`sessions/${id}`);
      await database.runTransaction(async (tx) => {
        const session = (await tx.get(ref)).data();
        if (!session || session.status !== "scheduled" || session.end > cutoff - DAY) throw conflict("Buổi học không còn quá hạn.");
        tx.update(ref, { status: "dispute", expiredAt: now() });
        for (const userId of [session.studentId, session.tutorId]) tx.create(database.collection("notifications").doc(), { userId, text: "Buổi học thiếu xác nhận đã chuyển cho admin xử lý.", at: now() });
      });
    } else {
      const ref = database.doc(`listingJobs/${id}`);
      await database.runTransaction(async (tx) => {
        if (!(await tx.get(ref)).exists) throw conflict("Hồ sơ không còn chờ cập nhật.");
        await stageListing(tx, id);
      });
    }
    return success({ ok: true });
  } catch (error) { return fail(error); }
}
