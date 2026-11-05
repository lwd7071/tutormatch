import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { publicCatalog } from "@/lib/public-data";

export const runtime = "nodejs";

function rows(snapshot: FirebaseFirestore.QuerySnapshot): Record<string, any>[] {
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

function submissionView({ photo, document, ...fields }: Record<string, any>) {
  return { ...fields, hasPhoto: !!photo, hasDocument: !!document };
}

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public";
    if (scope === "public" && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return Response.json({ tutors: [], packages: [], subjects: [], reviews: [] });
    const database = db();
    if (scope === "public") {
      const [tutors, packages, subjects, reviews, blockedUsers] = await Promise.all([
        database.collection("tutors").where("status", "==", "approved").get(),
        database.collection("packages").where("active", "==", true).get(),
        database.collection("subjects").get(),
        database.collection("reviews").where("status", "==", "visible").get(),
        database.collection("users").where("blocked", "==", true).get(),
      ]);
      const blockedIds = new Set(blockedUsers.docs.map(doc => doc.id));
      const approved = rows(tutors).filter(t => !blockedIds.has(t.id));
      const missingPhotos = approved.filter(t => !t.photoUrl);
      const media = await Promise.all(missingPhotos.map(t => database.doc(`media/${t.id}`).get()));
      for (let i = 0; i < missingPhotos.length; i++) if (media[i].data()?.photo) missingPhotos[i].photoUrl = `/api/media/${missingPhotos[i].id}/photo`;
      return Response.json(publicCatalog(approved, rows(packages), rows(subjects), rows(reviews), blockedIds));
    }
    const user = await actor(req);
    await database.doc(`users/${user.uid}`).set({ email: user.email, role: user.role, lastSeenAt: Date.now() }, { merge: true });
    const extra = Promise.all([
      user.role === "tutor" ? database.collection("packages").where("tutorId", "==", user.uid).get() : database.collection("packages").limit(0).get(),
      user.role === "tutor" ? database.doc(`wallets/${user.uid}`).get() : Promise.resolve(null),
      user.role === "admin" ? database.collection("users").get() : database.collection("users").limit(0).get(),
      user.role === "admin" ? database.collection("tutors").get() : database.collection("tutors").limit(0).get(),
      user.role === "admin" ? database.collection("subjects").get() : user.role === "tutor" ? database.collection("subjects").where("active", "==", true).get() : database.collection("subjects").limit(0).get(),
      user.role === "admin" ? database.collection("reviews").get() : database.collection("reviews").limit(0).get(),
      user.role === "admin" ? database.doc("settings/main").get() : Promise.resolve(null),
      user.role === "admin" ? database.collection("tutorSubmissions").get() : database.collection("tutorSubmissions").limit(0).get(),
    ]);
    const primary = Promise.all([
      database.doc(`tutors/${user.uid}`).get(),
      user.role === "admin" ? database.collection("orders").get() : database.collection("orders").where(user.role === "tutor" ? "tutorId" : "studentId", "==", user.uid).get(),
      user.role === "admin" ? database.collection("sessions").get() : database.collection("sessions").where(user.role === "tutor" ? "tutorId" : "studentId", "==", user.uid).get(),
      user.role === "admin" ? database.collection("messages").limit(0).get() : database.collection("messages").where("participants", "array-contains", user.uid).get(),
      user.role === "admin" ? database.collection("withdrawals").get() : user.role === "tutor" ? database.collection("withdrawals").where("tutorId", "==", user.uid).get() : database.collection("withdrawals").limit(0).get(),
      user.role === "admin" ? database.collection("refunds").get() : database.collection("refunds").where("studentId", "==", user.uid).get(),
      database.collection("notifications").where("userId", "==", user.uid).get(),
      user.role === "admin" ? database.collection("trials").get() : database.collection("trials").where(user.role === "tutor" ? "tutorId" : "studentId", "==", user.uid).get(),
      database.doc(`media/${user.uid}`).get(),
      database.doc(`tutorSubmissions/${user.uid}`).get(),
    ]);
    const [
      [profile, orders, sessions, messages, withdrawals, refunds, notices, trials, myMedia, mySubmission],
      [myPackages, wallet, users, tutors, subjects, reviews, settings, adminSubmissions],
    ] = await Promise.all([primary, extra]);
    const profileData: Record<string, any> | null = profile.exists ? { id: profile.id, ...profile.data() } : null;
    const ownSubmission = mySubmission.exists ? { id: mySubmission.id, ...mySubmission.data() } : profileData && ["pending", "rejected"].includes(profileData.status) ? { ...profileData, photoSource: "photo", documentSource: "document", legacy: true } : null;
    const allTutors = rows(tutors), submissions = rows(adminSubmissions);
    const submittedIds = new Set(submissions.map(s => s.id));
    const legacy: Record<string, any>[] = allTutors.filter(t => ["pending", "rejected"].includes(t.status) && !submittedIds.has(t.id)).map(t => ({ ...t, photoSource: "photo", documentSource: "document", legacy: true }));
    const legacyMedia = await Promise.all(legacy.map(t => database.doc(`media/${t.id}`).get()));
    for (let i = 0; i < legacy.length; i++) Object.assign(legacy[i], { photo: legacyMedia[i].data()?.photo, document: legacyMedia[i].data()?.document });
    const mediaState = myMedia.data();
    return Response.json({ user, profile: profileData, submission: ownSubmission ? submissionView(ownSubmission) : null, media: { photo: !!mediaState?.photo, document: !!mediaState?.document, stagedPhoto: !!mediaState?.stagedPhoto, stagedDocument: !!mediaState?.stagedDocument }, submissions: [...submissions, ...legacy].map(submissionView), orders: rows(orders), sessions: rows(sessions), messages: rows(messages), withdrawals: rows(withdrawals), refunds: rows(refunds), notices: rows(notices), trials: rows(trials), packages: rows(myPackages), wallet: wallet?.data() || { available: 0, pending: 0 }, users: rows(users), tutors: allTutors, subjects: rows(subjects), reviews: rows(reviews), settings: settings?.data() || { feeRate: 10 } });
  } catch (error) { return fail(error); }
}
