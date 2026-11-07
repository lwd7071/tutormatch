import { loadEnvConfig } from "@next/env";
import { db } from "../src/lib/firebase-admin";
import { buildListing, refreshListing } from "../src/lib/listing";
import { offerRows } from "../src/lib/listing-core";

if (process.argv.includes("--help")) {
  console.log(
    "npx tsx scripts/migrate-public-listings.ts [--apply] (dry run by default)",
  );
  process.exit(0);
}

async function main() {
  loadEnvConfig(process.cwd());
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
    throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
  const database = db();
  const [tutors, users, packages, reviews, listings, offers] =
    await Promise.all([
      database.collection("tutors").get(),
      database.collection("users").where("blocked", "==", true).get(),
      database.collection("packages").get(),
      database.collection("reviews").where("status", "==", "visible").get(),
      database.collection("publicListings").get(),
      database.collection("publicOffers").get(),
    ]);
  const blocked = new Set(users.docs.map((doc) => doc.id));
  const related = (
    docs: FirebaseFirestore.QueryDocumentSnapshot[],
    field: string,
  ) => {
    const result = new Map<string, Record<string, unknown>[]>();
    for (const doc of docs) {
      const value = { id: doc.id, ...doc.data() },
        id = String(doc.get(field));
      result.set(id, [...(result.get(id) || []), value]);
    }
    return result;
  };
  const packs = related(packages.docs, "tutorId"),
    opinions = related(reviews.docs, "tutorId");
  const existing = new Map(listings.docs.map((doc) => [doc.id, doc.data()]));
  const expected = new Map<string, Record<string, unknown>>();
  for (const tutor of tutors.docs) {
    if (tutor.data().status !== "approved" || blocked.has(tutor.id)) continue;
    expected.set(
      tutor.id,
      buildListing(
        tutor.id,
        tutor.data(),
        false,
        packs.get(tutor.id) || [],
        opinions.get(tutor.id) || [],
      ),
    );
  }
  const expectedOffers = new Map(
    [...expected.values()].flatMap((listing) =>
      [...offerRows(listing)].map(([id, offer]) => [id, offer] as const),
    ),
  );
  const currentOffers = new Map(offers.docs.map((doc) => [doc.id, doc.data()]));
  const stable = (value: Record<string, unknown> | undefined) =>
    JSON.stringify(value, (key, entry) =>
      key === "updatedAt" ? undefined : entry,
    );
  const changed = [...expected]
    .filter(
      ([id, listing]) =>
        stable(listing) !== stable(existing.get(id)) ||
        [...offerRows(listing)].some(
          ([offerId, offer]) =>
            stable(offer) !== stable(currentOffers.get(offerId)),
        ),
    )
    .map(([id]) => id);
  const stale = [...existing.keys()].filter((id) => !expected.has(id));
  const staleOffers = [...currentOffers.keys()].filter(
    (id) => !expectedOffers.has(id),
  );
  console.log(
    JSON.stringify({
      mode: process.argv.includes("--apply") ? "apply" : "dry-run",
      expected: expected.size,
      existing: existing.size,
      expectedOffers: expectedOffers.size,
      existingOffers: currentOffers.size,
      changedCount: changed.length,
      changed,
      staleCount: stale.length,
      stale,
      staleOfferCount: staleOffers.length,
      staleOffers,
    }),
  );

  if (process.argv.includes("--apply")) {
    for (const id of [
      ...new Set([
        ...changed,
        ...stale,
        ...(staleOffers
          .map((id) => currentOffers.get(id)?.tutorId)
          .filter(Boolean) as string[]),
      ]),
    ])
      await refreshListing(id);
    const [current, currentOfferSnap] = await Promise.all([
      database.collection("publicListings").get(),
      database.collection("publicOffers").get(),
    ]);
    const currentMap = new Map(current.docs.map((doc) => [doc.id, doc.data()]));
    const currentOfferMap = new Map(
      currentOfferSnap.docs.map((doc) => [doc.id, doc.data()]),
    );
    const missing = [...expected]
      .filter(([id, listing]) => stable(listing) !== stable(currentMap.get(id)))
      .map(([id]) => id);
    const extra = [...currentMap.keys()].filter((id) => !expected.has(id));
    const missingOffers = [...expectedOffers]
      .filter(
        ([id, offer]) => stable(offer) !== stable(currentOfferMap.get(id)),
      )
      .map(([id]) => id);
    const extraOffers = [...currentOfferMap.keys()].filter(
      (id) => !expectedOffers.has(id),
    );
    console.log(
      JSON.stringify({
        verified:
          missing.length === 0 &&
          extra.length === 0 &&
          missingOffers.length === 0 &&
          extraOffers.length === 0,
        expected: expected.size,
        actual: currentMap.size,
        expectedOffers: expectedOffers.size,
        actualOffers: currentOfferMap.size,
        missing,
        extra,
        missingOffers,
        extraOffers,
      }),
    );
    if (
      missing.length ||
      extra.length ||
      missingOffers.length ||
      extraOffers.length
    )
      process.exitCode = 1;
    else
      await database
        .doc("settings/main")
        .set(
          { publicListingReady: true, publicOfferReady: true },
          { merge: true },
        );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
