import { NextRequest } from "next/server";
import { db, storageBucket } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await actor(req);
    const form = await req.formData();
    const kind = form.get("kind"), file = form.get("file");
    if (kind !== "photo" && kind !== "document") throw new Error("Loại tệp không hợp lệ.");
    if (!(file instanceof File) || file.size > 5_000_000 || file.size === 0) throw new Error("Tệp phải nhỏ hơn 5 MB.");
    const allowed = kind === "photo" ? ["image/jpeg", "image/png", "image/webp"] : ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) throw new Error("Định dạng tệp không được hỗ trợ.");
    const path = `tutors/${user.uid}/${kind}`;
    await storageBucket().file(path).save(Buffer.from(await file.arrayBuffer()), { resumable: false, contentType: file.type, metadata: { cacheControl: kind === "photo" ? "public, max-age=3600" : "private, no-store" } });
    const tutorRef = db().doc(`tutors/${user.uid}`);
    if ((await tutorRef.get()).data()?.status === "approved") await tutorRef.update({ status: "pending", updatedAt: Date.now() });
    return Response.json({ url: `/api/media/${user.uid}/${kind}?v=${Date.now()}` });
  } catch (error) { return fail(error); }
}
