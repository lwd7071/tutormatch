import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

export function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT_JSON chưa được cấu hình trên server.");
  const credentials = JSON.parse(raw);
  return initializeApp({ credential: cert(credentials), storageBucket: process.env.FIREBASE_STORAGE_BUCKET });
}

export function db() { return getFirestore(adminApp()); }
export function adminAuth() { return getAuth(adminApp()); }
export function storageBucket() {
  if (!process.env.FIREBASE_STORAGE_BUCKET) throw new Error("FIREBASE_STORAGE_BUCKET chưa được cấu hình.");
  return getStorage(adminApp()).bucket();
}
