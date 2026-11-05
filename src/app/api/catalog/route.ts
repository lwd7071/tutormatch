import { FieldPath, type Query } from "firebase-admin/firestore";
import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { fail } from "@/lib/server";
import { invalid, success } from "@/lib/api-response";
import { buildListing, matchingPackages, words } from "@/lib/listing";
import { publicSubject, publicTutor } from "@/lib/public-data";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";
type Row = Record<string, any>;

function item(listing: Row, packages: Row[]) {
  return { tutor: publicTutor(listing), packages, rating: listing.rating || 0, reviewCount: listing.reviewCount || 0 };
}

export async function GET(req: NextRequest) {
  try {
    await rateLimit("catalog", req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown", 120, 60_000);
    const params = req.nextUrl.searchParams;
    const query = (params.get("query") || "").trim();
    const subjectId = params.get("subjectId") || "", mode = params.get("mode") || "", cursor = params.get("cursor") || "";
    const maxPrice = params.has("maxPrice") ? Number(params.get("maxPrice")) : undefined;
    if (query.length > 80 || words(query).length > 5 || subjectId && !/^[A-Za-z0-9_-]{1,128}$/.test(subjectId) || mode && !["online", "offline"].includes(mode) || cursor && !/^[A-Za-z0-9_-]{1,128}$/.test(cursor) || maxPrice !== undefined && (!Number.isFinite(maxPrice) || maxPrice < 0 || maxPrice > 100_000_000)) throw invalid("Bộ lọc tìm kiếm không hợp lệ.");
    const database = db();
    const [subjectsSnap, settingsSnap] = await Promise.all([database.collection("subjects").where("active", "==", true).get(), database.doc("settings/main").get()]);
    const subjects = subjectsSnap.docs.map(doc => publicSubject({ id: doc.id, ...doc.data() }));
    const activeSubjects = new Set(subjects.map(subject => subject.id));
    const filters = { query, subjectId, mode, maxPrice };
    const ready = settingsSnap.data()?.publicListingReady === true;
    let results: Row[] = [], nextCursor: string | null = null, featured: Row[] = [];

    if (!ready) {
      const [tutors, packages, reviews, blocked] = await Promise.all([
        database.collection("tutors").where("status", "==", "approved").get(), database.collection("packages").where("active", "==", true).get(),
        database.collection("reviews").where("status", "==", "visible").get(), database.collection("users").where("blocked", "==", true).get(),
      ]);
      const blockedIds = new Set(blocked.docs.map(doc => doc.id));
      const packagesByTutor = new Map<string, Row[]>(), reviewsByTutor = new Map<string, Row[]>();
      for (const doc of packages.docs) packagesByTutor.set(doc.data().tutorId, [...(packagesByTutor.get(doc.data().tutorId) || []), { id: doc.id, ...doc.data() }]);
      for (const doc of reviews.docs) reviewsByTutor.set(doc.data().tutorId, [...(reviewsByTutor.get(doc.data().tutorId) || []), doc.data()]);
      const listings = tutors.docs.map(doc => buildListing(doc.id, doc.data(), blockedIds.has(doc.id), packagesByTutor.get(doc.id) || [], reviewsByTutor.get(doc.id) || []));
      const matching = listings.filter(listing => matchingPackages(listing, activeSubjects, filters).length).sort((a, b) => a.id.localeCompare(b.id));
      const start = cursor ? matching.findIndex(listing => listing.id > cursor) : 0;
      const page = matching.slice(start < 0 ? matching.length : start, (start < 0 ? matching.length : start) + 24);
      results = page.map(listing => item(listing, matchingPackages(listing, activeSubjects, filters)));
      nextCursor = page.length === 24 ? page.at(-1)!.id : null;
      featured = listings.filter(listing => listing.reviewCount > 0 && matchingPackages(listing, activeSubjects, {}).length).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 3).map(listing => item(listing, matchingPackages(listing, activeSubjects, {})));
    } else {
      let scanned = 0, position = cursor;
      while (results.length < 24) {
        let search: Query = database.collection("publicListings").where("status", "==", "approved");
        const firstWord = words(query)[0];
        if (firstWord) search = search.where("searchTokens", "array-contains", firstWord);
        else if (subjectId) search = search.where("subjectIds", "array-contains", subjectId);
        search = search.orderBy(FieldPath.documentId()).limit(100);
        if (position) search = search.startAfter(position);
        const batch = await search.get();
        if (batch.empty) { nextCursor = null; break; }
        const tutors = await Promise.all(batch.docs.map(doc => database.doc(`tutors/${doc.id}`).get()));
        const users = await Promise.all(batch.docs.map(doc => database.doc(`users/${doc.id}`).get()));
        for (let index = 0; index < batch.docs.length; index++) {
          const doc = batch.docs[index]; position = doc.id; scanned++;
          const listing = { id: doc.id, ...doc.data(), status: tutors[index].data()?.status, blocked: users[index].data()?.blocked === true };
          const packages = matchingPackages(listing, activeSubjects, filters);
          if (packages.length) results.push(item(listing, packages));
          if (results.length === 24) break;
        }
        nextCursor = batch.size === 100 || results.length === 24 ? position : null;
        if (results.length === 24 || batch.size < 100) break;
      }
      if (scanned > 200) console.info("Catalog search read many listings", { scanned, query: !!query, subjectId: !!subjectId });
      if (!cursor) {
        const top = await database.collection("publicListings").where("status", "==", "approved").orderBy("rating", "desc").limit(20).get();
        const checked: Row[] = await Promise.all(top.docs.map(async doc => {
          const [tutor, user] = await Promise.all([database.doc(`tutors/${doc.id}`).get(), database.doc(`users/${doc.id}`).get()]);
          return { id: doc.id, ...doc.data(), status: tutor.data()?.status, blocked: user.data()?.blocked === true };
        }));
        featured = checked.filter(listing => listing.reviewCount > 0 && matchingPackages(listing, activeSubjects, {}).length).sort((a, b) => b.rating - a.rating || b.reviewCount - a.reviewCount).slice(0, 3).map(listing => item(listing, matchingPackages(listing, activeSubjects, {})));
      }
    }
    return success({ items: results, subjects, featured, nextCursor });
  } catch (error) { return fail(error); }
}
