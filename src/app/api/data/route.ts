import { NextRequest } from "next/server";
import { AggregateField } from "firebase-admin/firestore";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { publicCatalog } from "@/lib/public-data";
import { ApiError, invalid, success } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { dataDto, dataDtos } from "@/lib/data-dto";

export const runtime = "nodejs";

function rows(
  snapshot: FirebaseFirestore.QuerySnapshot,
): Record<string, any>[] {
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}

function submissionView({ photo, document, ...fields }: Record<string, any>) {
  return { ...fields, hasPhoto: !!photo, hasDocument: !!document };
}

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public";
    if (scope !== "public" && scope !== "private")
      throw invalid("Phạm vi dữ liệu không hợp lệ.");
    if (scope === "public" && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
      return success({ tutors: [], packages: [], subjects: [], reviews: [] });
    if (scope === "public")
      await rateLimit(
        "catalog",
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
        120,
        60_000,
      );
    const database = db();
    if (scope === "public") {
      if (
        (await database.doc("settings/main").get()).data()?.publicOfferReady ===
        true
      )
        throw new ApiError("GONE", "Dùng /api/catalog để tìm gia sư.", 410);
      const [tutors, packages, subjects, reviews, blockedUsers] =
        await Promise.all([
          database.collection("tutors").where("status", "==", "approved").get(),
          database.collection("packages").where("active", "==", true).get(),
          database.collection("subjects").get(),
          database.collection("reviews").where("status", "==", "visible").get(),
          database.collection("users").where("blocked", "==", true).get(),
        ]);
      const blockedIds = new Set(blockedUsers.docs.map((doc) => doc.id));
      const approved = rows(tutors).filter((t) => !blockedIds.has(t.id));
      const missingPhotos = approved.filter((t) => !t.photoUrl);
      const media = await Promise.all(
        missingPhotos.map((t) => database.doc(`media/${t.id}`).get()),
      );
      for (let i = 0; i < missingPhotos.length; i++)
        if (media[i].data()?.photo)
          missingPhotos[i].photoUrl = `/api/media/${missingPhotos[i].id}/photo`;
      return success(
        publicCatalog(
          approved,
          rows(packages),
          rows(subjects),
          rows(reviews),
          blockedIds,
        ),
      );
    }
    const user = await actor(req);
    await database
      .doc(`users/${user.uid}`)
      .set(
        { email: user.email, role: user.role, lastSeenAt: Date.now() },
        { merge: true },
      );
    const extra = Promise.all([
      user.role === "tutor"
        ? database
            .collection("packages")
            .where("tutorId", "==", user.uid)
            .limit(20)
            .get()
        : database.collection("packages").limit(0).get(),
      user.role === "tutor"
        ? database.doc(`wallets/${user.uid}`).get()
        : Promise.resolve(null),
      user.role === "admin"
        ? database.collection("users").limit(20).get()
        : database.collection("users").limit(0).get(),
      user.role === "admin"
        ? database.collection("tutors").limit(20).get()
        : database.collection("tutors").limit(0).get(),
      user.role === "admin"
        ? database.collection("subjects").limit(20).get()
        : user.role === "tutor"
          ? database
              .collection("subjects")
              .where("active", "==", true)
              .limit(20)
              .get()
          : database.collection("subjects").limit(0).get(),
      user.role === "admin"
        ? database.collection("reviews").limit(20).get()
        : database.collection("reviews").limit(0).get(),
      user.role === "admin"
        ? database.doc("settings/main").get()
        : Promise.resolve(null),
      user.role === "admin"
        ? database
            .collection("tutorSubmissions")
            .where("status", "==", "pending")
            .limit(20)
            .get()
        : database.collection("tutorSubmissions").limit(0).get(),
    ]);
    const primary = Promise.all([
      database.doc(`tutors/${user.uid}`).get(),
      user.role === "admin"
        ? database.collection("orders").limit(20).get()
        : database
            .collection("orders")
            .where(
              user.role === "tutor" ? "tutorId" : "studentId",
              "==",
              user.uid,
            )
            .limit(20)
            .get(),
      user.role === "admin"
        ? database
            .collection("sessions")
            .where("status", "==", "dispute")
            .limit(20)
            .get()
        : database
            .collection("sessions")
            .where(
              user.role === "tutor" ? "tutorId" : "studentId",
              "==",
              user.uid,
            )
            .limit(20)
            .get(),
      database.collection("messages").limit(0).get(),
      user.role === "admin"
        ? database
            .collection("withdrawals")
            .where("status", "==", "pending")
            .limit(20)
            .get()
        : user.role === "tutor"
          ? database
              .collection("withdrawals")
              .where("tutorId", "==", user.uid)
              .limit(20)
              .get()
          : database.collection("withdrawals").limit(0).get(),
      user.role === "admin"
        ? database
            .collection("refunds")
            .where("status", "in", ["pending", "needs_details"])
            .limit(20)
            .get()
        : database
            .collection("refunds")
            .where("studentId", "==", user.uid)
            .limit(20)
            .get(),
      database
        .collection("notifications")
        .where("userId", "==", user.uid)
        .limit(20)
        .get(),
      user.role === "admin"
        ? database.collection("trials").limit(20).get()
        : database
            .collection("trials")
            .where(
              user.role === "tutor" ? "tutorId" : "studentId",
              "==",
              user.uid,
            )
            .limit(20)
            .get(),
      database.doc(`media/${user.uid}`).get(),
      database.doc(`tutorSubmissions/${user.uid}`).get(),
    ]);
    const [
      [
        profile,
        orders,
        sessions,
        messages,
        withdrawals,
        refunds,
        notices,
        trials,
        myMedia,
        mySubmission,
      ],
      [
        myPackages,
        wallet,
        users,
        tutors,
        subjects,
        reviews,
        settings,
        adminSubmissions,
      ],
    ] = await Promise.all([primary, extra]);
    const profileData: Record<string, any> | null = profile.exists
      ? { id: profile.id, ...profile.data() }
      : null;
    const ownSubmission = mySubmission.exists
      ? { id: mySubmission.id, ...mySubmission.data() }
      : profileData && ["pending", "rejected"].includes(profileData.status)
        ? {
            ...profileData,
            photoSource: "photo",
            documentSource: "document",
            legacy: true,
          }
        : null;
    const allTutors = rows(tutors),
      submissions = rows(adminSubmissions);
    const submittedIds = new Set(submissions.map((s) => s.id));
    const legacy: Record<string, any>[] = allTutors
      .filter(
        (t) =>
          ["pending", "rejected"].includes(t.status) && !submittedIds.has(t.id),
      )
      .map((t) => ({
        ...t,
        photoSource: "photo",
        documentSource: "document",
        legacy: true,
      }));
    const legacyMedia = await Promise.all(
      legacy.map((t) => database.doc(`media/${t.id}`).get()),
    );
    for (let i = 0; i < legacy.length; i++)
      Object.assign(legacy[i], {
        photo: legacyMedia[i].data()?.photo,
        document: legacyMedia[i].data()?.document,
      });
    const mediaState = myMedia.data();
    const summary =
      user.role === "admin"
        ? await (async () => {
            const [
              pendingSubmissions,
              disputeSessions,
              pendingRefunds,
              pendingWithdrawals,
              recentOrders,
            ] = await Promise.all([
              database
                .collection("tutorSubmissions")
                .where("status", "==", "pending")
                .count()
                .get(),
              database
                .collection("sessions")
                .where("status", "==", "dispute")
                .count()
                .get(),
              database
                .collection("refunds")
                .where("status", "in", ["pending", "needs_details"])
                .count()
                .get(),
              database
                .collection("withdrawals")
                .where("status", "==", "pending")
                .count()
                .get(),
              database
                .collection("orders")
                .orderBy("createdAt", "desc")
                .limit(6)
                .get(),
            ]);
            return {
              pendingSubmissions: pendingSubmissions.data().count,
              disputeSessions: disputeSessions.data().count,
              pendingMoney:
                pendingRefunds.data().count + pendingWithdrawals.data().count,
              recentOrders: dataDtos("order", rows(recentOrders), user.role),
            };
          })()
        : await (async () => {
            const field = user.role === "tutor" ? "tutorId" : "studentId";
            const timestamp = Date.now();
            const [activeOrders, pendingOrders, dueSessions] =
              await Promise.all([
                database
                  .collection("orders")
                  .where(field, "==", user.uid)
                  .where("status", "==", "active")
                  .aggregate({
                    total: AggregateField.count(),
                    count: AggregateField.sum("count"),
                    confirmed: AggregateField.sum("confirmedCount"),
                    reserved: AggregateField.sum("reservedCount"),
                  })
                  .get(),
                user.role === "tutor"
                  ? database
                      .collection("orders")
                      .where(field, "==", user.uid)
                      .where("status", "==", "pending_tutor")
                      .count()
                      .get()
                  : Promise.resolve(null),
                database
                  .collection("sessions")
                  .where(field, "==", user.uid)
                  .where("status", "==", "scheduled")
                  .where("end", ">=", timestamp - 86_400_000)
                  .where("end", "<=", timestamp)
                  .limit(100)
                  .get(),
              ]);
            const totals = activeOrders.data();
            const due = dueSessions.docs.filter(
              (doc) => !doc.data().confirmations?.[user.role],
            );
            return {
              activeOrders: totals.total,
              availableSessions:
                totals.count - totals.confirmed - totals.reserved,
              pendingOrders: pendingOrders?.data().count || 0,
              confirmableSessions: due.length,
            };
          })();
    return success({
      user,
      profile: profileData ? dataDto("profile", profileData, user.role) : null,
      submission: ownSubmission
        ? dataDto("submission", submissionView(ownSubmission), user.role)
        : null,
      media: {
        photo: !!mediaState?.photo,
        document: !!mediaState?.document,
        stagedPhoto: !!mediaState?.stagedPhoto,
        stagedDocument: !!mediaState?.stagedDocument,
      },
      submissions: dataDtos(
        "submission",
        [...submissions, ...legacy].map(submissionView),
        user.role,
      ),
      orders: dataDtos("order", rows(orders), user.role),
      sessions: dataDtos("session", rows(sessions), user.role),
      messages: dataDtos("message", rows(messages), user.role),
      withdrawals: dataDtos("withdrawal", rows(withdrawals), user.role),
      refunds: dataDtos("refund", rows(refunds), user.role),
      notices: dataDtos("notice", rows(notices), user.role),
      trials: dataDtos("trial", rows(trials), user.role),
      packages: dataDtos("package", rows(myPackages), user.role),
      wallet: {
        available: wallet?.data()?.available || 0,
        pending: wallet?.data()?.pending || 0,
      },
      users: dataDtos("user", rows(users), user.role),
      tutors: dataDtos("tutor", allTutors, user.role),
      subjects: dataDtos("subject", rows(subjects), user.role),
      reviews: dataDtos("review", rows(reviews), user.role),
      settings: { feeRate: settings?.data()?.feeRate ?? 10 },
      summary,
    });
  } catch (error) {
    return fail(error);
  }
}
