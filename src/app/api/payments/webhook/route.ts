import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { verifyWebhook } from "@/lib/payos";
import { DAY, now } from "@/lib/server";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload || !verifyWebhook(payload)) return Response.json({ error: "Invalid signature" }, { status: 401 });
  const orderCode = Number(payload.data?.orderCode);
  const ref = db().collection("orders").doc(String(orderCode));
  try {
    await db().runTransaction(async tx => {
      const snap = await tx.get(ref);
      if (!snap.exists) throw new Error("Order not found");
      const order = snap.data()!;
      if (order.status !== "pending_payment") return;
      if (Number(payload.data.amount) !== order.price || payload.data.code !== "00" || payload.code !== "00") throw new Error("Payment mismatch");
      tx.update(ref, { status: order.renewal ? "active" : "pending_tutor", paidAt: now(), decisionDue: order.renewal ? null : now() + DAY, paymentReference: payload.data.reference || "" });
      tx.create(db().collection("ledger").doc(`payment_${orderCode}`), { type: "payment", orderId: String(orderCode), amount: order.price, at: now() });
      tx.create(db().collection("notifications").doc(), { userId: order.tutorId, text: order.renewal ? "Học viên đã mua tiếp gói học." : "Có đơn học mới cần bạn phản hồi trong 24 giờ.", at: now() });
    });
    return Response.json({ ok: true });
  } catch { return Response.json({ error: "Payment could not be applied" }, { status: 400 }); }
}
