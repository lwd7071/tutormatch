import { FieldPath } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { dataDto } from "@/lib/data-dto";
import { conflict, invalid, success } from "@/lib/api-response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const user = await actor(req), threadId = req.nextUrl.searchParams.get("threadId") || "";
    if (!/^(?:[A-Za-z0-9_-]+|trial:[A-Za-z0-9_-]+)$/.test(threadId)) throw invalid("Cuộc trò chuyện không hợp lệ.");
    const trial = threadId.startsWith("trial:");
    const thread = (await db().doc(trial ? `trials/${threadId.slice(6)}` : `orders/${threadId}`).get()).data();
    if (!thread || ![thread.studentId, thread.tutorId].includes(user.uid) || (!trial && thread.status === "pending_payment")) throw conflict("Bạn chưa thể xem cuộc trò chuyện này.");
    const cursor = req.nextUrl.searchParams.get("cursor");
    let query = db().collection("messages").where("threadId", "==", threadId).orderBy("at", "desc").orderBy(FieldPath.documentId(), "desc").limit(51);
    if (cursor) {
      let position: { at: number; id: string };
      try { position = JSON.parse(Buffer.from(cursor, "base64url").toString()); } catch { throw invalid("Trang tin nhắn không hợp lệ."); }
      if (!Number.isSafeInteger(position.at) || !/^[A-Za-z0-9_-]{1,128}$/.test(position.id)) throw invalid("Trang tin nhắn không hợp lệ.");
      query = query.startAfter(position.at, position.id);
    }
    const snapshot = await query.get(), page = snapshot.docs.slice(0, 50);
    const items = page.map(doc => dataDto("message", { id: doc.id, ...doc.data() }, user.role)).reverse();
    const last = page.at(-1);
    return success({ items, nextCursor: snapshot.size > 50 && last ? Buffer.from(JSON.stringify({ at: last.data().at, id: last.id })).toString("base64url") : null });
  } catch (error) { return fail(error); }
}
