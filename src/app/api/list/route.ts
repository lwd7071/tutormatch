import { FieldPath, type Query } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { dataDto, type DataKind } from "@/lib/data-dto";
import { invalid, success } from "@/lib/api-response";
import { ApiError } from "@/lib/api-response";

export const runtime = "nodejs";

const resources: Record<string, DataKind> = {
  orders: "order", sessions: "session", messages: "message", withdrawals: "withdrawal", refunds: "refund", notices: "notice", trials: "trial", packages: "package", users: "user", tutors: "tutor", subjects: "subject", reviews: "review", submissions: "submission",
};

export async function GET(req: NextRequest) {
  try {
    const user = await actor(req);
    const resource = req.nextUrl.searchParams.get("resource") || "";
    const kind = resources[resource];
    if (!kind) throw invalid("Danh sách không hợp lệ.");
    const cursor = req.nextUrl.searchParams.get("cursor");
    if (cursor && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor)) throw invalid("Trang dữ liệu không hợp lệ.");
    const database = db();
    let query: Query = database.collection(resource === "submissions" ? "tutorSubmissions" : resource === "notices" ? "notifications" : resource);
    if (["users", "tutors", "reviews", "submissions"].includes(resource) && user.role !== "admin") throw new ApiError("FORBIDDEN", "Bạn không có quyền xem danh sách này.", 403);
    if (resource === "messages" && user.role === "admin") throw new ApiError("FORBIDDEN", "Bạn không có quyền xem danh sách này.", 403);
    if (resource === "packages" && user.role !== "tutor") throw new ApiError("FORBIDDEN", "Bạn không có quyền xem danh sách này.", 403);
    if (resource === "withdrawals" && user.role === "student") throw new ApiError("FORBIDDEN", "Bạn không có quyền xem danh sách này.", 403);
    if (resource === "subjects" && user.role === "student") throw new ApiError("FORBIDDEN", "Bạn không có quyền xem danh sách này.", 403);
    if (resource === "orders" || resource === "sessions" || resource === "trials") {
      if (user.role !== "admin") query = query.where(user.role === "tutor" ? "tutorId" : "studentId", "==", user.uid);
      else if (resource === "sessions") query = query.where("status", "==", "dispute");
    } else if (resource === "messages") query = query.where("participants", "array-contains", user.uid);
    else if (resource === "refunds") query = user.role === "admin" ? query.where("status", "==", "pending") : query.where("studentId", "==", user.uid);
    else if ((resource === "withdrawals" && user.role === "tutor") || resource === "packages") query = query.where("tutorId", "==", user.uid);
    else if (resource === "notices") query = query.where("userId", "==", user.uid);
    else if (resource === "subjects" && user.role === "tutor") query = query.where("active", "==", true);
    else if (resource === "submissions") query = query.where("status", "==", "pending");
    else if (resource === "withdrawals" && user.role === "admin") query = query.where("status", "==", "pending");
    query = query.orderBy(FieldPath.documentId()).limit(51);
    if (cursor) query = query.startAfter(cursor);
    const snapshot = await query.get();
    const page = snapshot.docs.slice(0, 50);
    const items = page.map(doc => dataDto(kind, { id: doc.id, ...doc.data() }, user.role));
    return success({ items, nextCursor: snapshot.size > 50 ? page.at(-1)!.id : null });
  } catch (error) { return fail(error); }
}
