import { FieldPath } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { dataDto } from "@/lib/data-dto";
import { conflict, invalid, success } from "@/lib/api-response";
import { paginateQuery, parsePage } from "@/lib/pagination";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await actor(req),
      threadId = req.nextUrl.searchParams.get("threadId") || "";
    if (!/^(?:[A-Za-z0-9_-]+|trial:[A-Za-z0-9_-]+)$/.test(threadId))
      throw invalid("Cuộc trò chuyện không hợp lệ.");
    const trial = threadId.startsWith("trial:");
    const thread = (
      await db()
        .doc(trial ? `trials/${threadId.slice(6)}` : `orders/${threadId}`)
        .get()
    ).data();
    if (
      !thread ||
      ![thread.studentId, thread.tutorId].includes(user.uid) ||
      (!trial && thread.status === "pending_payment")
    )
      throw conflict("Bạn chưa thể xem cuộc trò chuyện này.");
    const pageNumber = parsePage(req.nextUrl.searchParams.get("page"));
    const query = db()
      .collection("messages")
      .where("threadId", "==", threadId)
      .orderBy("at", "desc")
      .orderBy(FieldPath.documentId(), "desc");
    const result = await paginateQuery(query, pageNumber);
    const items = result.docs
      .map((doc) =>
        dataDto("message", { id: doc.id, ...doc.data() }, user.role),
      )
      .reverse();
    return success({
      items,
      page: result.page,
      totalPages: result.totalPages,
      totalItems: result.totalItems,
    });
  } catch (error) {
    return fail(error);
  }
}
