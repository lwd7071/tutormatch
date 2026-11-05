import { FieldPath } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { fail } from "@/lib/server";
import { invalid, success, ApiError } from "@/lib/api-response";
import { publicPackage, publicReview, publicSubject, publicTutor } from "@/lib/public-data";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string }> }) {
  try {
    const { uid } = await params, cursor = req.nextUrl.searchParams.get("cursor");
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid) || cursor && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor)) throw invalid("Hồ sơ không hợp lệ.");
    const database = db();
    const [tutorSnap, userSnap, packagesSnap, subjectsSnap] = await Promise.all([
      database.doc(`tutors/${uid}`).get(), database.doc(`users/${uid}`).get(),
      database.collection("packages").where("tutorId", "==", uid).where("active", "==", true).get(),
      database.collection("subjects").where("active", "==", true).get(),
    ]);
    if (tutorSnap.data()?.status !== "approved" || userSnap.data()?.blocked === true) throw new ApiError("NOT_FOUND", "Hồ sơ này hiện chưa công khai.", 404);
    const subjects = subjectsSnap.docs.map(doc => publicSubject({ id: doc.id, ...doc.data() }));
    const subjectIds = new Set(subjects.map(subject => subject.id));
    let reviews = database.collection("reviews").where("tutorId", "==", uid).where("status", "==", "visible").orderBy(FieldPath.documentId()).limit(51);
    if (cursor) reviews = reviews.startAfter(cursor);
    const reviewsSnap = await reviews.get(), page = reviewsSnap.docs.slice(0, 50);
    return success({ tutor: publicTutor({ id: uid, ...tutorSnap.data() }), packages: packagesSnap.docs.filter(doc => subjectIds.has(doc.data().subjectId)).map(doc => publicPackage({ id: doc.id, ...doc.data() })), subjects, reviews: page.map(doc => publicReview({ id: doc.id, ...doc.data() })), nextCursor: reviewsSnap.size > 50 ? page.at(-1)!.id : null });
  } catch (error) { return fail(error); }
}
