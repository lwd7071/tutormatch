import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { mediaCloud } from "@/lib/cloudinary";
import { actor } from "@/lib/server";
import type { TutorMedia } from "@/lib/tutor-profile";

export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string; kind: string }> }) {
  try {
    const { uid, kind } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || !["photo", "document", "staged-photo", "staged-document"].includes(kind)) return new Response("Not found", { status: 404 });
    let publicPhoto = false;
    if (kind === "photo") {
      const [tutorSnap, userSnap] = await Promise.all([db().doc(`tutors/${uid}`).get(), db().doc(`users/${uid}`).get()]);
      publicPhoto = tutorSnap.data()?.status === "approved" && userSnap.data()?.blocked !== true;
    }
    if (!publicPhoto) {
      const user = await actor(req);
      if (user.uid !== uid && user.role !== "admin") return new Response("Forbidden", { status: 403 });
    }
    const field = kind === "staged-photo" ? "stagedPhoto" : kind === "staged-document" ? "stagedDocument" : kind;
    const file = (await db().doc(`media/${uid}`).get()).data()?.[field] as TutorMedia | undefined;
    if (!file) return new Response("Not found", { status: 404 });
    const cloud = mediaCloud();
    const url = cloud.url(file.publicId, { resource_type: file.resourceType, type: "authenticated", format: file.resourceType === "image" ? file.format : undefined, sign_url: true });
    const response = await fetch(url);
    if (!response.ok) return new Response("Not found", { status: 404 });
    return new Response(response.body, { headers: { "Content-Type": file.contentType, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
