import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { fail } from "@/lib/server";
import { invalid, success } from "@/lib/api-response";
import { buildListing, matchingPackages } from "@/lib/listing";
import { rankMatch } from "@/lib/discovery";
import { publicSubject, publicTutor } from "@/lib/public-data";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Row = Record<string, any>;
export async function GET(req: NextRequest) {
  try {
    await rateLimit(
      "match",
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      10,
      60_000,
    );
    const params = req.nextUrl.searchParams;
    const subjectId = params.get("subjectId") || "",
      mode = params.get("mode") || "";
    const maxPrice = params.has("maxPrice")
      ? Number(params.get("maxPrice"))
      : undefined;
    const day = params.has("day") ? Number(params.get("day")) : undefined;
    const period = params.get("period") || "",
      provinceCode = params.get("provinceCode") || "",
      wardCode = params.get("wardCode") || "";
    if (
      !/^[A-Za-z0-9_-]{1,128}$/.test(subjectId) ||
      !["online", "offline"].includes(mode) ||
      (maxPrice !== undefined &&
        (!Number.isFinite(maxPrice) ||
          maxPrice < 0 ||
          maxPrice > 100_000_000)) ||
      (day !== undefined && (!Number.isInteger(day) || day < 0 || day > 6)) ||
      (period && !["morning", "afternoon", "evening"].includes(period)) ||
      (provinceCode && !/^\d{2}$/.test(provinceCode)) ||
      (wardCode && !/^\d{5}$/.test(wardCode))
    )
      throw invalid("Tiêu chí gợi ý không hợp lệ.");
    const database = db();
    const [subject, settings] = await Promise.all([
      database.doc(`subjects/${subjectId}`).get(),
      database.doc("settings/main").get(),
    ]);
    if (subject.data()?.active !== true) return success({ items: [] });
    let listings: Row[];
    if (settings.data()?.publicListingReady === true) {
      const snapshot = await database
        .collection("publicListings")
        .where("status", "==", "approved")
        .where("subjectIds", "array-contains", subjectId)
        .get();
      listings = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } else {
      const [tutors, packages, reviews] = await Promise.all([
        database.collection("tutors").where("status", "==", "approved").get(),
        database.collection("packages").where("active", "==", true).get(),
        database.collection("reviews").where("status", "==", "visible").get(),
      ]);
      listings = tutors.docs.map((doc) =>
        buildListing(
          doc.id,
          doc.data(),
          false,
          packages.docs
            .filter((pack) => pack.data().tutorId === doc.id)
            .map((pack) => ({ id: pack.id, ...pack.data() })),
          reviews.docs
            .filter((review) => review.data().tutorId === doc.id)
            .map((review) => review.data()),
        ),
      );
    }
    const checked: Row[] = await Promise.all(
      listings.map(async (listing) => {
        const [tutor, user] = await Promise.all([
          database.doc(`tutors/${listing.id}`).get(),
          database.doc(`users/${listing.id}`).get(),
        ]);
        return {
          ...listing,
          status: tutor.data()?.status,
          blocked: user.data()?.blocked === true,
        };
      }),
    );
    const filters = { subjectId, mode, maxPrice };
    const items = checked
      .map((listing) => ({
        listing,
        packages: matchingPackages(listing, new Set([subjectId]), filters),
      }))
      .filter((item) => item.packages.length)
      .sort(
        (a, b) =>
          rankMatch(b.listing, { day, period, provinceCode, wardCode, mode }) -
            rankMatch(a.listing, {
              day,
              period,
              provinceCode,
              wardCode,
              mode,
            }) ||
          b.listing.reviewCount - a.listing.reviewCount ||
          a.listing.id.localeCompare(b.listing.id),
      )
      .slice(0, 3)
      .map(({ listing, packages }) => ({
        tutor: publicTutor(listing),
        packages,
        rating: listing.rating || 0,
        reviewCount: listing.reviewCount || 0,
      }));
    return success({
      items,
      subject: publicSubject({ id: subject.id, ...subject.data() }),
    });
  } catch (error) {
    return fail(error);
  }
}
