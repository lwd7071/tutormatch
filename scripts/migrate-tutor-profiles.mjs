import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { loadEnvConfig } = require("@next/env");
const { cert, getApps, initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

if (process.argv.includes("--help")) {
  console.log("node scripts/migrate-tutor-profiles.mjs [--apply] (dry run by default)");
  process.exit(0);
}

loadEnvConfig(process.cwd());
const credentials = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (!credentials) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON is required.");
if (!getApps().length) initializeApp({ credential: cert(JSON.parse(credentials)) });
const database = getFirestore();
const [tutors, media, submissions] = await Promise.all([
  database.collection("tutors").get(),
  database.collection("media").get(),
  database.collection("tutorSubmissions").get(),
]);
const mediaById = new Map(media.docs.map(doc => [doc.id, doc.data()]));
const submittedIds = new Set(submissions.docs.map(doc => doc.id));
const applications = [];
const missingFiles = [];
const photoBackfills = [];

for (const doc of tutors.docs) {
  const tutor = doc.data(), assets = mediaById.get(doc.id);
  if (["pending", "rejected"].includes(tutor.status) && !submittedIds.has(doc.id)) {
    if (!assets?.photo || !assets?.document) { missingFiles.push(doc.id); continue; }
    applications.push({ id: doc.id, value: {
      name: tutor.name, bio: tutor.bio, mode: tutor.mode || "online", location: tutor.location || "", availability: tutor.availability || "",
      photo: assets.photo, document: assets.document, photoSource: "photo", documentSource: "document",
      email: tutor.email || "", status: tutor.status, submittedAt: tutor.updatedAt || Date.now(),
      ...(tutor.reviewReason ? { reviewReason: tutor.reviewReason } : {}),
    } });
  }
  if (tutor.status === "approved" && !tutor.photoUrl && assets?.photo) photoBackfills.push(doc.id);
}

console.log(JSON.stringify({ mode: process.argv.includes("--apply") ? "apply" : "dry-run", applications: applications.length, missingFiles: missingFiles.length, photoBackfills: photoBackfills.length, existingSubmissions: submissions.size }));
if (process.argv.includes("--apply")) {
  for (const { id, value } of applications) {
    try { await database.doc(`tutorSubmissions/${id}`).create(value); }
    catch (error) { if (error.code !== 6) throw error; }
  }
  for (const id of photoBackfills) await database.doc(`tutors/${id}`).update({ photoUrl: `/api/media/${id}/photo?v=${Date.now()}` });
  console.log("Migration complete. Review missing-file profiles manually before approval.");
}
