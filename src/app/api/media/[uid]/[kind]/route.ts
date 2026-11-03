import { NextRequest } from "next/server";
import { db, storageBucket } from "@/lib/firebase-admin";
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
    const file = storageBucket().file(`tutors/${uid}/${kind}`);
    const [buffer] = await file.download();
    const [metadata] = await file.getMetadata();
    return new Response(new Uint8Array(buffer), { headers: { "Content-Type": metadata.contentType || "application/octet-stream", "Cache-Control": kind === "photo" ? "public, max-age=3600" : "private, no-store", "X-Content-Type-Options": "nosniff" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
