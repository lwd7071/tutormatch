import { NextRequest } from "next/server";
import { actor, DAY, fail } from "@/lib/server";
import { handleCreateOrder } from "@/lib/actions/order";
import { handleTrial } from "@/lib/actions/trial";
import { handleAdmin } from "@/lib/actions/admin";
import { handleTutor } from "@/lib/actions/tutor";
import { handleLessons } from "@/lib/actions/lessons";
import { handleMember } from "@/lib/actions/member";
import { parseActionRequest } from "@/lib/action-schema";
import { conflict } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = await actor(req);
    const data = await parseActionRequest(req);
    const action = data.action;
    if (action === "sendMessage")
      await rateLimit("message", user.uid, 30, 60_000);
    if (action === "createOrder")
      await rateLimit("checkout", user.uid, 10, 3_600_000);
    if (action === "requestTrial") await rateLimit("trial", user.uid, 5, DAY);

    if (
      action === "saveAvailability" ||
      action === "setFavorites" ||
      action === "becomeTutor" ||
      action === "saveTutor" ||
      action === "savePackage" ||
      action === "togglePackage"
    )
      return handleTutor(user, data);

    if (action === "createOrder") return handleCreateOrder(req, user, data);

    if (
      action === "decideOrder" ||
      action === "createSession" ||
      action === "confirmSession" ||
      action === "cancelSession"
    )
      return handleLessons(user, data);

    if (
      action === "requestRefund" ||
      action === "setRefundBank" ||
      action === "requestWithdrawal" ||
      action === "sendMessage" ||
      action === "reviewTutor"
    )
      return handleMember(user, data);

    if (
      action === "requestTrial" ||
      action === "decideTrial" ||
      action === "createTrialSession"
    )
      return handleTrial(user, data);

    if (action === "admin") return handleAdmin(user, data);
    throw conflict("Thao tác không hợp lệ.");
  } catch (error) {
    return fail(error);
  }
}
