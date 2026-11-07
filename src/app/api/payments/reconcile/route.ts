import { NextRequest } from "next/server";
import { actor, fail, requireRole } from "@/lib/server";
import { success } from "@/lib/api-response";
import { reconcilePendingPayments } from "@/lib/payment-flow";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    requireRole(await actor(req), "admin");
    return success(
      await reconcilePendingPayments({ maxPages: 1, budgetMs: 40_000 }),
    );
  } catch (error) {
    return fail(error);
  }
}
