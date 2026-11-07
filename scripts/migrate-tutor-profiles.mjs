import { createRequire } from "node:module";
import { legacyTutorSubmission } from "../src/lib/legacy-tutor-migration.mjs";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (process.argv.includes("--help")) {
  console.log(
    "node scripts/migrate-tutor-profiles.mjs [--apply] (dry run by default)",
  );
  process.exit(0);
}

loadEnvConfig(process.cwd());
const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!credentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!getApps().length)
  initializeApp({ credential: cert(JSON.parse(credentials)) });
const database = getFirestore();
const [tutors, media, submissions, users] = await Promise.all([
  database.collection("tutors").get(),
  database.collection("media").get(),
  database.collection("tutorSubmissions").get(),
  database.collection("users").where("blocked", "==", true).get(),
]);
const mediaById = new Map(media.docs.map((doc) => [doc.id, doc.data()]));
const submittedIds = new Set(submissions.docs.map((doc) => doc.id));
const blockedIds = new Set(users.docs.map((doc) => doc.id));
const legacy = [];
const missingFiles = [];
const needsUpload = new Set(
  submissions.docs
    .filter((doc) => !doc.data().photo || !doc.data().document)
    .map((doc) => doc.id),
);
const photoBackfills = [];
const blockedApproved = [];

for (const doc of tutors.docs) {
  const tutor = doc.data(),
    assets = mediaById.get(doc.id);
  if (["pending", "rejected"].includes(tutor.status)) {
    legacy.push(doc.id);
    if (
      !submittedIds.has(doc.id) &&
      (!(assets?.photo || assets?.stagedPhoto) ||
        !(assets?.document || assets?.stagedDocument))
    ) {
      missingFiles.push(doc.id);
      needsUpload.add(doc.id);
    }
  }
  if (tutor.status === "approved" && !tutor.photoUrl && assets?.photo)
    photoBackfills.push(doc.id);
  if (tutor.status === "approved" && blockedIds.has(doc.id))
    blockedApproved.push(doc.id);
}

console.log(
  JSON.stringify({
    mode: process.argv.includes("--apply") ? "apply" : "dry-run",
    legacy,
    missingFiles,
    needsUpload: [...needsUpload],
    photoBackfills,
    blockedApproved,
    existingSubmissions: submissions.size,
  }),
);
if (process.argv.includes("--apply")) {
  for (const id of new Set([
    ...legacy,
    ...photoBackfills,
    ...blockedApproved,
  ])) {
    await database.runTransaction(async (tx) => {
      const tutorRef = database.doc(`tutors/${id}`),
        submissionRef = database.doc(`tutorSubmissions/${id}`);
      const [tutorSnap, submissionSnap, mediaSnap, userSnap] =
        await Promise.all([
          tx.get(tutorRef),
          tx.get(submissionRef),
          tx.get(database.doc(`media/${id}`)),
          tx.get(database.doc(`users/${id}`)),
        ]);
      const tutor = tutorSnap.data(),
        assets = mediaSnap.data();
      if (!tutor) return;
      if (["pending", "rejected"].includes(tutor.status)) {
        if (!submissionSnap.exists)
          tx.create(submissionRef, legacyTutorSubmission(tutor, assets));
        tx.delete(tutorRef);
        return;
      }
      const update = {};
      if (tutor.status === "approved" && !tutor.photoUrl && assets?.photo)
        update.photoUrl = `/api/media/${id}/photo?v=${Date.now()}`;
      if (tutor.status === "approved" && userSnap.data()?.blocked === true)
        update.status = "suspended";
      if (Object.keys(update).length) tx.update(tutorRef, update);
    });
  }
  const [remainingTutors, currentSubmissions] = await Promise.all([
    database.collection("tutors").get(),
    database.collection("tutorSubmissions").get(),
  ]);
  const remaining = remainingTutors.docs
    .filter((doc) => ["pending", "rejected"].includes(doc.data().status))
    .map((doc) => doc.id);
  const incomplete = currentSubmissions.docs
    .filter((doc) => !doc.data().photo || !doc.data().document)
    .map((doc) => doc.id);
  console.log(
    JSON.stringify({
      migrationComplete: remaining.length === 0,
      remainingLegacy: remaining,
      needsUpload: incomplete,
    }),
  );
}
