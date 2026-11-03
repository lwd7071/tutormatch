import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { expireDue } from "@/lib/expiry";

export const runtime = "nodejs";

function rows(snapshot: FirebaseFirestore.QuerySnapshot): Record<string, any>[] {
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

export async function GET(req: NextRequest) {
  try {
    const scope = req.nextUrl.searchParams.get("scope") || "public";
    if (scope === "public" && !process.env.FIREBASE_SERVICE_ACCOUNT_JSON) return Response.json({ tutors: [], packages: [], subjects: [], reviews: [] });
    const database = db();
    if (scope === "public") {
      const [tutors, packages, subjects, reviews] = await Promise.all([
        database.collection("tutors").where("status", "==", "approved").get(),
        database.collection("packages").where("active", "==", true).get(),
        database.collection("subjects").get(),
        database.collection("reviews").where("status", "==", "visible").get(),
      ]);
      return Response.json({ tutors: rows(tutors).map(({ documentUrl, email, ...safe }) => safe), packages: rows(packages), subjects: rows(subjects).filter(s => s.active), reviews: rows(reviews) });
    }
    const user = await actor(req);
    await Promise.all([
      database.doc(`users/${user.uid}`).set({ email: user.email, role: user.role, lastSeenAt: Date.now() }, { merge: true }),
      expireDue(),
    ]);
    const extra = Promise.all([
      user.role === "tutor" ? database.collection("packages").where("tutorId", "==", user.uid).get() : database.collection("packages").limit(0).get(),
      user.role === "tutor" ? database.doc(`wallets/${user.uid}`).get() : Promise.resolve(null),
      user.role === "admin" ? database.collection("users").get() : database.collection("users").limit(0).get(),
      user.role === "admin" ? database.collection("tutors").get() : database.collection("tutors").limit(0).get(),
      user.role === "admin" ? database.collection("subjects").get() : user.role === "tutor" ? database.collection("subjects").where("active", "==", true).get() : database.collection("subjects").limit(0).get(),
      user.role === "admin" ? database.collection("reviews").get() : database.collection("reviews").limit(0).get(),
      user.role === "admin" ? database.doc("settings/main").get() : Promise.resolve(null),
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
    ]);
    const [
      [profile, orders, sessions, messages, withdrawals, refunds, notices, trials],
      [myPackages, wallet, users, tutors, subjects, reviews, settings],
    ] = await Promise.all([primary, extra]);
    return Response.json({ user, profile: profile.exists ? { id: profile.id, ...profile.data() } : null, orders: rows(orders), sessions: rows(sessions), messages: rows(messages), withdrawals: rows(withdrawals), refunds: rows(refunds), notices: rows(notices), trials: rows(trials), packages: rows(myPackages), wallet: wallet?.data() || { available: 0, pending: 0 }, users: rows(users), tutors: rows(tutors), subjects: rows(subjects), reviews: rows(reviews), settings: settings?.data() || { feeRate: 10 } });
  } catch (error) { return fail(error); }
}
