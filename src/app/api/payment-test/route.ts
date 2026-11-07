import { NextRequest } from "next/server";
import { actor, requireRole } from "@/lib/server";
import { fail } from "@/lib/server";
import { invalid, success } from "@/lib/api-response";
import {
  createPaymentTest,
  latestPaymentTest,
  paymentTestEnabled,
  reconcilePaymentTest,
} from "@/lib/payment-test";

export const runtime = "nodejs";

async function admin(req: NextRequest) {
  if (!paymentTestEnabled()) return null;
  const user = await actor(req);
  requireRole(user, "admin");
  return user;
}

export async function GET(req: NextRequest) {
  if (!paymentTestEnabled()) return new Response(null, { status: 404 });
  try {
    const user = await admin(req);
    return success(await latestPaymentTest(user!.uid));
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: NextRequest) {
  if (!paymentTestEnabled()) return new Response(null, { status: 404 });
  try {
    const user = await admin(req);
    const raw = await req.text();
    if (raw.length > 1000) throw invalid("Yêu cầu quá lớn.");
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      throw invalid("JSON không hợp lệ.");
    }
    if (!body || typeof body !== "object" || Array.isArray(body))
      throw invalid("Yêu cầu không hợp lệ.");
    if (
      Object.keys(body).length === 1 &&
      typeof body.idempotencyKey === "string" &&
      /^[0-9a-f-]{36}$/i.test(body.idempotencyKey)
    ) {
      return success(
        await createPaymentTest(
          user!.uid,
          body.idempotencyKey,
          req.nextUrl.origin,
        ),
      );
    }
    if (
      Object.keys(body).length === 2 &&
      body.action === "reconcile" &&
      Number.isSafeInteger(body.orderCode)
    ) {
      return success(
        await reconcilePaymentTest(user!.uid, Number(body.orderCode)),
      );
    }
    throw invalid("Yêu cầu không hợp lệ.");
  } catch (error) {
    return fail(error);
  }
}
