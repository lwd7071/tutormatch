import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { mediaCloud } from "@/lib/cloudinary";
import { actor } from "@/lib/server";

export const runtime = "nodejs";
export async function GET(req: NextRequest, { params }: { params: Promise<{ uid: string; kind: string }> }) {
  try {
    const { uid, kind } = await params;
    if (!/^[a-zA-Z0-9_-]{1,128}$/.test(uid) || !["photo", "document"].includes(kind)) return new Response("Not found", { status: 404 });
    if (kind === "photo") {
      const tutor = (await db().doc(`tutors/${uid}`).get()).data();
      if (tutor?.status !== "approved") return new Response("Not found", { status: 404 });
    } else {
      const user = await actor(req);
      if (user.uid !== uid && user.role !== "admin") return new Response("Forbidden", { status: 403 });
    }
    const file = (await db().doc(`media/${uid}`).get()).data()?.[kind] as { publicId: string; format: string; resourceType: "image" | "raw"; contentType: string } | undefined;
    if (!file) return new Response("Not found", { status: 404 });
    const cloud = mediaCloud();
    const url = cloud.url(file.publicId, { resource_type: file.resourceType, type: "authenticated", format: file.resourceType === "image" ? file.format : undefined, sign_url: true });
    const response = await fetch(url);
    if (!response.ok) return new Response("Not found", { status: 404 });
    return new Response(response.body, { headers: { "Content-Type": file.contentType, "Cache-Control": kind === "photo" ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
