import { db } from "./firebase-admin";
import { FieldPath } from "firebase-admin/firestore";
import { buildListing, offerRows } from "./listing-core";
export { buildListing, matchingPackages, words } from "./listing-core";

export function queueListing(tx: FirebaseFirestore.Transaction, uid: string) {
  tx.set(db().doc(`listingJobs/${uid}`), { updatedAt: Date.now() });
}

type ListingChanges = {
  tutor?: Record<string, any>;
  user?: Record<string, any>;
  package?: { id: string; value: Record<string, any> };
  review?: { id: string; value: Record<string, any> };
};
export async function stageListing(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  changes: ListingChanges = {},
) {
  const database = db();
  const [tutor, user, packages, reviews, oldOffers] = await Promise.all([
    tx.get(database.doc(`tutors/${uid}`)),
    tx.get(database.doc(`users/${uid}`)),
    tx.get(database.collection("packages").where("tutorId", "==", uid)),
    tx.get(database.collection("reviews").where("tutorId", "==", uid)),
    tx.get(database.collection("publicOffers").where("tutorId", "==", uid)),
  ]);
  const ref = database.doc(`publicListings/${uid}`);
  const tutorData = changes.tutor || tutor.data(),
    userData = changes.user || user.data();
  const visible =
    tutorData?.status === "approved" && userData?.blocked !== true;
  const packageRows = packages.docs.map((doc) =>
    doc.id === changes.package?.id
      ? { id: doc.id, ...changes.package.value }
      : { id: doc.id, ...doc.data() },
  );
  if (
    changes.package &&
    !packages.docs.some((doc) => doc.id === changes.package?.id)
  )
    packageRows.push({ id: changes.package.id, ...changes.package.value });
  const reviewRows = reviews.docs.map((doc) =>
    doc.id === changes.review?.id ? changes.review.value : doc.data(),
  );
  if (
    changes.review &&
    !reviews.docs.some((doc) => doc.id === changes.review?.id)
  )
    reviewRows.push(changes.review.value);
  const listing = visible
    ? buildListing(uid, tutorData!, false, packageRows, reviewRows)
    : null;
  const offers = listing ? offerRows(listing) : new Map();
  if (listing) tx.set(ref, listing);
  else tx.delete(ref);
  for (const old of oldOffers.docs) if (!offers.has(old.id)) tx.delete(old.ref);
  for (const [id, offer] of offers)
    tx.set(database.doc(`publicOffers/${id}`), offer);
  tx.delete(database.doc(`listingJobs/${uid}`));
}

export async function refreshListing(uid: string) {
  const database = db();
  await database.runTransaction(async (tx) => {
    await stageListing(tx, uid);
  });
}

export async function refreshQueuedListings() {
  let changed = 0,
    failed = 0;
  const database = db(),
    stateRef = database.doc("cronCursors/listings");
  let cursor = String((await stateRef.get()).data()?.id || "");
  let exhausted = false;
  const deadline = Date.now() + 40_000;
  for (let page = 0; page < 5 && Date.now() < deadline; page++) {
    let query = database
      .collection("listingJobs")
      .orderBy(FieldPath.documentId())
      .limit(100);
    if (cursor) query = query.startAfter(cursor);
    const jobs = await query.get();
    if (!jobs.size) {
      exhausted = true;
      break;
    }
    for (const job of jobs.docs) {
      try {
        await refreshListing(job.id);
        changed++;
      } catch (error) {
        failed++;
        console.error(`Could not refresh queued listing ${job.id}`, error);
      }
      cursor = job.id;
      if (Date.now() >= deadline) break;
    }
    if (jobs.size < 100 && cursor === jobs.docs.at(-1)?.id) {
      exhausted = true;
      break;
    }
  }
  await stateRef.set({
    id: exhausted ? null : cursor || null,
    updatedAt: Date.now(),
  });
  if (!exhausted)
    console.warn("Public listing refresh has more work", { cursor });
  return { changed, failed, more: !exhausted };
}
