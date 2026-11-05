import { db } from "./firebase-admin";
import { buildListing } from "./listing-core";
export { buildListing, matchingPackages, words } from "./listing-core";

export function queueListing(tx: FirebaseFirestore.Transaction, uid: string) {
  tx.set(db().doc(`listingJobs/${uid}`), { updatedAt: Date.now() });
}

export async function refreshListing(uid: string) {
  const database = db();
  await database.runTransaction(async tx => {
    const [tutor, user, packages, reviews] = await Promise.all([
      tx.get(database.doc(`tutors/${uid}`)), tx.get(database.doc(`users/${uid}`)),
      tx.get(database.collection("packages").where("tutorId", "==", uid)),
      tx.get(database.collection("reviews").where("tutorId", "==", uid)),
    ]);
    const ref = database.doc(`publicListings/${uid}`);
    if (tutor.data()?.status === "approved" && user.data()?.blocked !== true) tx.set(ref, buildListing(uid, tutor.data()!, false, packages.docs.map(doc => ({ id: doc.id, ...doc.data() })), reviews.docs.map(doc => doc.data())));
    else tx.delete(ref);
    tx.delete(database.doc(`listingJobs/${uid}`));
  });
}

export async function refreshListingSafely(uid: string) {
  try { await refreshListing(uid); }
  catch (error) { console.error(`Could not refresh public listing ${uid}`, error); }
}

export async function refreshQueuedListings() {
  let changed = 0, failed = 0;
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | undefined;
  const deadline = Date.now() + 60_000;
  for (let page = 0; page < 5 && Date.now() < deadline; page++) {
    let query = db().collection("listingJobs").limit(100);
    if (cursor) query = query.startAfter(cursor);
    const jobs = await query.get();
    if (!jobs.size) break;
    for (const job of jobs.docs) {
      try { await refreshListing(job.id); changed++; }
      catch (error) { failed++; console.error(`Could not refresh queued listing ${job.id}`, error); }
    }
    cursor = jobs.docs.at(-1);
    if (jobs.size < 100) break;
  }
  if (changed + failed >= 500) console.warn("Public listing refresh backlog exceeds 500 jobs");
  return { changed, failed };
}
