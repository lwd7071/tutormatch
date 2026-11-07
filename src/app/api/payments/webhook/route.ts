import { NextRequest } from "next/server";
import { verifyWebhook } from "@/lib/payos";
import { applyPaidOrder } from "@/lib/payment-flow";
import { applyPaidPaymentTest } from "@/lib/payment-test";
import { db } from "@/lib/firebase-admin";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const payload = await req.json().catch(() => null);
  if (!payload || !verifyWebhook(payload))
    return Response.json({ error: "Invalid signature" }, { status: 401 });
  const orderCode = Number(payload.data?.orderCode);
  try {
    if (
      !Number.isSafeInteger(orderCode) ||
      payload.data.code !== "00" ||
      payload.code !== "00"
    )
      throw new Error("Payment mismatch");
    const reservation = await db().doc(`paymentCodes/${orderCode}`).get();
    if (reservation.data()?.kind === "test")
      await applyPaidPaymentTest(
        orderCode,
        Number(payload.data.amount),
        String(payload.data.reference || ""),
      );
    else
      await applyPaidOrder(
        orderCode,
        Number(payload.data.amount),
        String(payload.data.reference || ""),
      );
    return Response.json({ ok: true });
  } catch (error) {
    console.error("Payment webhook could not be applied", error);
    return Response.json(
      { error: "Payment could not be applied" },
      { status: 500 },
    );
  }
}
