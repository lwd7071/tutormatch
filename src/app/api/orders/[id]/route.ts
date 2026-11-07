import { NextRequest } from "next/server";
import { actor, fail } from "@/lib/server";
import { db } from "@/lib/firebase-admin";
import { ApiError, invalid, success } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await actor(req);
    const { id } = await context.params;
    if (!/^\d{10,18}$/.test(id)) throw invalid("Mã đơn không hợp lệ.");
    const order = (await db().doc(`orders/${id}`).get()).data();
    if (!order) throw new ApiError("NOT_FOUND", "Không tìm thấy đơn.", 404);
    if (order.studentId !== user.uid)
      throw new ApiError("FORBIDDEN", "Bạn không có quyền xem đơn này.", 403);
    return success({
      id,
      status: order.status,
      checkoutUrl:
        order.status === "pending_payment" ? order.checkoutUrl || null : null,
      paidAt: order.paidAt || null,
    });
  } catch (error) {
    return fail(error);
  }
}
