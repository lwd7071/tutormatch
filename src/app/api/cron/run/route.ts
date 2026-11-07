import { NextRequest } from "next/server";
import { actor, fail, requireRole } from "@/lib/server";
import { invalid, success } from "@/lib/api-response";
import { expireDueGroup } from "@/lib/expiry";
import { reconcilePendingPayments } from "@/lib/payment-flow";
import { refreshQueuedListings } from "@/lib/listing";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    requireRole(await actor(req), "admin");
    const raw = await req.text();
    if (raw.length > 100) throw invalid("Yêu cầu không hợp lệ.");
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw invalid("JSON không hợp lệ.");
    }
    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body) ||
      Object.keys(body).length !== 1 ||
      !("group" in body)
    )
      throw invalid("Yêu cầu không hợp lệ.");
    const group = body.group;
    if (group === "payments")
      return success(
        await reconcilePendingPayments({ maxPages: 1, budgetMs: 40_000 }),
      );
    if (group === "orders" || group === "sessions")
      return success(await expireDueGroup(group, 40_000, 1));
    if (group === "listings") return success(await refreshQueuedListings());
    throw invalid("Nhóm công việc không hợp lệ.");
  } catch (error) {
    return fail(error);
  }
}
