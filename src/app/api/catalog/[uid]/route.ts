import { FieldPath } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { paymentEnabled } from "@/lib/payos";
import { fail } from "@/lib/server";
import { invalid, success, ApiError } from "@/lib/api-response";
import {
  publicPackage,
  publicReview,
  publicSubject,
  publicTutor,
} from "@/lib/public-data";
import {
  paginateQuery,
  parsePage,
  PAGE_SIZE,
  pageInfo,
} from "@/lib/pagination";

export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
      throw invalid("Hồ sơ không hợp lệ.");
    const packagePageNumber = parsePage(
      req.nextUrl.searchParams.get("packagePage"),
    );
    const reviewPageNumber = parsePage(
      req.nextUrl.searchParams.get("reviewPage"),
    );
    const database = db();
    const [tutorSnap, userSnap, packagesSnap, subjectsSnap, listingSnap] =
      await Promise.all([
        database.doc(`tutors/${uid}`).get(),
        database.doc(`users/${uid}`).get(),
        database
          .collection("packages")
          .where("tutorId", "==", uid)
          .where("active", "==", true)
          .get(),
        database.collection("subjects").where("active", "==", true).get(),
        database.doc(`publicListings/${uid}`).get(),
      ]);
    if (
      tutorSnap.data()?.status !== "approved" ||
      userSnap.data()?.blocked === true
    )
      throw new ApiError("NOT_FOUND", "Hồ sơ này hiện chưa công khai.", 404);
    const subjects = subjectsSnap.docs.map((doc) =>
      publicSubject({ id: doc.id, ...doc.data() }),
    );
    const subjectIds = new Set(subjects.map((subject) => subject.id));
    const eligiblePackages = packagesSnap.docs
      .filter((doc) => doc.data().visibility !== "private" && subjectIds.has(doc.data().subjectId))
      .sort((a, b) => a.id.localeCompare(b.id));
    const packageInfo = pageInfo(eligiblePackages.length, packagePageNumber);
    const packages = eligiblePackages
      .slice((packageInfo.page - 1) * PAGE_SIZE, packageInfo.page * PAGE_SIZE)
      .map((doc) => publicPackage({ id: doc.id, ...doc.data() }));
    const reviewQuery = database
      .collection("reviews")
      .where("tutorId", "==", uid)
      .where("status", "==", "visible")
      .orderBy(FieldPath.documentId());
    const reviewResult = await paginateQuery(reviewQuery, reviewPageNumber);
    return success({
      tutor: publicTutor({ id: uid, ...tutorSnap.data() }),
      packages,
      packagePage: packageInfo.page,
      packageTotalPages: packageInfo.totalPages,
      packageTotalItems: packageInfo.totalItems,
      subjects,
      reviews: reviewResult.docs.map((doc) =>
        publicReview({ id: doc.id, ...doc.data() }),
      ),
      reviewPage: reviewResult.page,
      reviewTotalPages: reviewResult.totalPages,
      reviewTotalItems: reviewResult.totalItems,
      rating: listingSnap.data()?.rating || 0,
      reviewCount: listingSnap.data()?.reviewCount || 0,
      purchaseEnabled: paymentEnabled(),
    });
  } catch (error) {
    return fail(error);
  }
}
