import { FieldPath, type Query } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { dataDto, type DataKind } from "@/lib/data-dto";
import { invalid, success } from "@/lib/api-response";
import { ApiError } from "@/lib/api-response";
import {
  paginateQuery,
  parsePage,
  pageInfo,
  PAGE_SIZE,
} from "@/lib/pagination";

export const runtime = "nodejs";

const resources: Record<string, DataKind> = {
  orders: "order",
  sessions: "session",
  messages: "message",
  withdrawals: "withdrawal",
  refunds: "refund",
  notices: "notice",
  trials: "trial",
  packages: "package",
  users: "user",
  tutors: "tutor",
  subjects: "subject",
  reviews: "review",
  submissions: "submission",
};

export async function GET(req: NextRequest) {
  try {
    const user = await actor(req);
    const resource = req.nextUrl.searchParams.get("resource") || "";
    const view = req.nextUrl.searchParams.get("view") || "queue";
    if (!["queue", "all"].includes(view))
      throw invalid("Chế độ danh sách không hợp lệ.");
    const kind = resources[resource];
    if (!kind) throw invalid("Danh sách không hợp lệ.");
    const pageNumber = parsePage(req.nextUrl.searchParams.get("page"));
    const database = db();
    let query: Query = database.collection(
      resource === "submissions"
        ? "tutorSubmissions"
        : resource === "notices"
          ? "notifications"
          : resource,
    );
    if (
      ["users", "tutors", "reviews", "submissions"].includes(resource) &&
      user.role !== "admin"
    )
      throw new ApiError(
        "FORBIDDEN",
        "Bạn không có quyền xem danh sách này.",
        403,
      );
    if (resource === "messages" && user.role === "admin")
      throw new ApiError(
        "FORBIDDEN",
        "Bạn không có quyền xem danh sách này.",
        403,
      );
    if (resource === "packages" && user.role !== "tutor")
      throw new ApiError(
        "FORBIDDEN",
        "Bạn không có quyền xem danh sách này.",
        403,
      );
    if (resource === "withdrawals" && user.role === "student")
      throw new ApiError(
        "FORBIDDEN",
        "Bạn không có quyền xem danh sách này.",
        403,
      );
    if (resource === "subjects" && user.role === "student")
      throw new ApiError(
        "FORBIDDEN",
        "Bạn không có quyền xem danh sách này.",
        403,
      );
    if (resource === "submissions") {
      const [pending, legacyTutors] = await Promise.all([
        database
          .collection("tutorSubmissions")
          .where("status", "==", "pending")
          .orderBy(FieldPath.documentId())
          .get(),
        database
          .collection("tutors")
          .where("status", "==", "pending")
          .orderBy(FieldPath.documentId())
          .get(),
      ]);
      const pendingIds = new Set(pending.docs.map((doc) => doc.id));
      const legacy = legacyTutors.docs.filter((doc) => !pendingIds.has(doc.id));
      const media = await Promise.all(
        legacy.map((doc) => database.doc(`media/${doc.id}`).get()),
      );
      const submissions = [
        ...pending.docs.map((doc) => {
          const { photo, document, ...fields } = doc.data();
          return {
            id: doc.id,
            ...fields,
            hasPhoto: !!photo,
            hasDocument: !!document,
          };
        }),
        ...legacy.map((doc, index) => ({
          id: doc.id,
          ...doc.data(),
          photoSource: "photo",
          documentSource: "document",
          legacy: true,
          hasPhoto: !!media[index].data()?.photo,
          hasDocument: !!media[index].data()?.document,
        })),
      ].sort((a, b) => a.id.localeCompare(b.id));
      const info = pageInfo(submissions.length, pageNumber);
      const page = submissions.slice(
        (info.page - 1) * PAGE_SIZE,
        info.page * PAGE_SIZE,
      );
      return success({
        items: page.map((row) => dataDto("submission", row, user.role)),
        page: info.page,
        totalPages: info.totalPages,
        totalItems: info.totalItems,
      });
    }
    if (
      resource === "orders" ||
      resource === "sessions" ||
      resource === "trials"
    ) {
      if (user.role !== "admin")
        query = query.where(
          user.role === "tutor" ? "tutorId" : "studentId",
          "==",
          user.uid,
        );
      else if (resource === "sessions" && view === "queue")
        query = query.where("status", "==", "dispute");
    } else if (resource === "messages")
      query = query.where("participants", "array-contains", user.uid);
    else if (resource === "refunds")
      query =
        user.role === "admin"
          ? view === "queue"
            ? query.where("status", "in", ["pending", "needs_details"])
            : query
          : query.where("studentId", "==", user.uid);
    else if (
      (resource === "withdrawals" && user.role === "tutor") ||
      resource === "packages"
    )
      query = query.where("tutorId", "==", user.uid);
    else if (resource === "notices")
      query = query.where("userId", "==", user.uid);
    else if (resource === "subjects" && user.role === "tutor")
      query = query.where("active", "==", true);
    else if (resource === "submissions")
      query = query.where("status", "==", "pending");
    else if (
      resource === "withdrawals" &&
      user.role === "admin" &&
      view === "queue"
    )
      query = query.where("status", "==", "pending");
    query = query.orderBy(FieldPath.documentId());
    const result = await paginateQuery(query, pageNumber);
    const items = await Promise.all(
      result.docs.map(async (doc) => {
        const row: Record<string, any> = { id: doc.id, ...doc.data() };
        if (
          resource === "tutors" &&
          (await database.doc(`users/${doc.id}`).get()).data()?.blocked === true
        )
          row.blocked = true;
        return dataDto(kind, row, user.role);
      }),
    );
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
