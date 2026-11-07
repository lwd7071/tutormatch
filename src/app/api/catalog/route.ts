import { FieldPath, type Query } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { fail } from "@/lib/server";
import { invalid, success } from "@/lib/api-response";
import { buildListing, matchingPackages, words } from "@/lib/listing";
import { publicSubject, publicTutor } from "@/lib/public-data";
import { rateLimit } from "@/lib/rate-limit";
import { pageInfo, parsePage, PAGE_SIZE } from "@/lib/pagination";

export const runtime = "nodejs";
type Row = Record<string, any>;

function item(listing: Row, packages: Row[]) {
  return {
    tutor: publicTutor(listing),
    packages,
    rating: listing.rating || 0,
    reviewCount: listing.reviewCount || 0,
  };
}

export async function GET(req: NextRequest) {
  try {
    await rateLimit(
      "catalog",
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown",
      120,
      60_000,
    );
    const params = req.nextUrl.searchParams;
    const query = (params.get("query") || "").trim();
    const subjectId = params.get("subjectId") || "",
      mode = params.get("mode") || "";
    const requestedPage = parsePage(params.get("page"));
    const day = params.has("day") ? Number(params.get("day")) : undefined;
    const period = params.get("period") || "",
      provinceCode = params.get("provinceCode") || "",
      wardCode = params.get("wardCode") || "";
    const maxPrice = params.has("maxPrice")
      ? Number(params.get("maxPrice"))
      : undefined;
    if (
      query.length > 80 ||
      words(query).length > 5 ||
      (subjectId && !/^[A-Za-z0-9_-]{1,128}$/.test(subjectId)) ||
      (mode && !["online", "offline"].includes(mode)) ||
      (maxPrice !== undefined &&
        (!Number.isFinite(maxPrice) ||
          maxPrice < 0 ||
          maxPrice > 100_000_000)) ||
      (day !== undefined && (!Number.isInteger(day) || day < 0 || day > 6)) ||
      (period && !["morning", "afternoon", "evening"].includes(period)) ||
      (provinceCode && !/^\d{2}$/.test(provinceCode)) ||
      (wardCode && !/^\d{5}$/.test(wardCode)) ||
      (wardCode && !provinceCode)
    )
      throw invalid("Bộ lọc tìm kiếm không hợp lệ.");
    const database = db();
    const [subjectsSnap, settingsSnap] = await Promise.all([
      database.collection("subjects").where("active", "==", true).get(),
      database.doc("settings/main").get(),
    ]);
    const subjects = subjectsSnap.docs.map((doc) =>
      publicSubject({ id: doc.id, ...doc.data() }),
    );
    const activeSubjects = new Set(subjects.map((subject) => subject.id));
    const filters = {
      query,
      subjectId,
      mode,
      maxPrice,
      day,
      period,
      provinceCode,
      wardCode,
    };
    const ready = settingsSnap.data()?.publicListingReady === true;
    let matching: Row[] = [],
      featured: Row[] = [];

    if (!ready) {
      const [tutors, packages, reviews, blocked] = await Promise.all([
        database.collection("tutors").where("status", "==", "approved").get(),
        database.collection("packages").where("active", "==", true).get(),
        database.collection("reviews").where("status", "==", "visible").get(),
        database.collection("users").where("blocked", "==", true).get(),
      ]);
      const blockedIds = new Set(blocked.docs.map((doc) => doc.id));
      const packagesByTutor = new Map<string, Row[]>(),
        reviewsByTutor = new Map<string, Row[]>();
      for (const doc of packages.docs)
        packagesByTutor.set(doc.data().tutorId, [
          ...(packagesByTutor.get(doc.data().tutorId) || []),
          { id: doc.id, ...doc.data() },
        ]);
      for (const doc of reviews.docs)
        reviewsByTutor.set(doc.data().tutorId, [
          ...(reviewsByTutor.get(doc.data().tutorId) || []),
          doc.data(),
        ]);
      const listings = tutors.docs.map((doc) =>
        buildListing(
          doc.id,
          doc.data(),
          blockedIds.has(doc.id),
          packagesByTutor.get(doc.id) || [],
          reviewsByTutor.get(doc.id) || [],
        ),
      );
      matching = listings
        .filter(
          (listing) =>
            matchingPackages(listing, activeSubjects, filters).length,
        )
        .sort((a, b) => a.id.localeCompare(b.id));
      featured = listings
        .filter(
          (listing) =>
            listing.reviewCount > 0 &&
            matchingPackages(listing, activeSubjects, {}).length,
        )
        .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
        .slice(0, 3)
        .map((listing) =>
          item(listing, matchingPackages(listing, activeSubjects, {})),
        );
    } else {
      const useOffers =
        settingsSnap.data()?.publicOfferReady === true &&
        Boolean(subjectId || mode || maxPrice !== undefined);
      let search: Query = database
        .collection(useOffers ? "publicOffers" : "publicListings")
        .where("status", "==", "approved");
      if (useOffers && subjectId)
        search = search.where("subjectId", "==", subjectId);
      if (useOffers && mode) search = search.where("mode", "==", mode);
      const firstWord = words(query)[0];
      if (firstWord)
        search = search.where("searchTokens", "array-contains", firstWord);
      else if (subjectId && !useOffers)
        search = search.where("subjectIds", "array-contains", subjectId);
      // shortcut: exact custom-filter totals scan every indexed candidate; denormalize filters if catalog reads become costly.
      const candidates = await search.orderBy(FieldPath.documentId()).get();
      const candidateDocs =
        useOffers && maxPrice !== undefined
          ? candidates.docs.filter(
              (doc) => Number(doc.data().minPrice) <= maxPrice,
            )
          : candidates.docs;
      const ids = [
        ...new Set(
          candidateDocs.map((doc) =>
            useOffers ? String(doc.data().tutorId) : doc.id,
          ),
        ),
      ];
      const [listingSnaps, tutorSnaps, userSnaps] = await Promise.all([
        useOffers
          ? Promise.all(
              ids.map((id) => database.doc(`publicListings/${id}`).get()),
            )
          : Promise.resolve(candidates.docs),
        Promise.all(ids.map((id) => database.doc(`tutors/${id}`).get())),
        Promise.all(ids.map((id) => database.doc(`users/${id}`).get())),
      ]);
      matching = ids
        .flatMap((id, index) => {
          const listingData = listingSnaps[index].data();
          if (!listingData) return [];
          const listing = {
            id,
            ...listingData,
            status: tutorSnaps[index].data()?.status,
            blocked: userSnaps[index].data()?.blocked === true,
          };
          const packages = matchingPackages(listing, activeSubjects, filters);
          return packages.length ? [item(listing, packages)] : [];
        })
        .sort((a, b) => a.tutor.id.localeCompare(b.tutor.id));
      console.info("Catalog search reads", {
        scanned: candidates.size,
        returned: matching.length,
        query: !!query,
        subjectId: !!subjectId,
        mode: !!mode,
        maxPrice: maxPrice !== undefined,
      });
      if (requestedPage === 1) {
        const top = await database
          .collection("publicListings")
          .where("status", "==", "approved")
          .orderBy("rating", "desc")
          .limit(20)
          .get();
        const checked: Row[] = await Promise.all(
          top.docs.map(async (doc) => {
            const [tutor, user] = await Promise.all([
              database.doc(`tutors/${doc.id}`).get(),
              database.doc(`users/${doc.id}`).get(),
            ]);
            return {
              id: doc.id,
              ...doc.data(),
              status: tutor.data()?.status,
              blocked: user.data()?.blocked === true,
            };
          }),
        );
        featured = checked
          .filter(
            (listing) =>
              listing.reviewCount > 0 &&
              matchingPackages(listing, activeSubjects, {}).length,
          )
          .sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount)
          .slice(0, 3)
          .map((listing) =>
            item(listing, matchingPackages(listing, activeSubjects, {})),
          );
      }
    }
    const pagination = pageInfo(matching.length, requestedPage);
    const items = matching.slice(
      (pagination.page - 1) * PAGE_SIZE,
      pagination.page * PAGE_SIZE,
    );
    return success({
      items,
      subjects,
      featured,
      page: pagination.page,
      totalPages: pagination.totalPages,
      totalItems: pagination.totalItems,
    });
  } catch (error) {
    return fail(error);
  }
}
