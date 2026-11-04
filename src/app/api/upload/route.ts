import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/firebase-admin";
import { mediaCloud } from "@/lib/cloudinary";
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
    const cloud = mediaCloud();
    const resource_type = file.type === "application/pdf" ? "raw" : "image";
    const public_id = `tutors/${user.uid}/${kind}/${randomUUID()}${resource_type === "raw" ? ".pdf" : ""}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    const uploaded = await new Promise<{ public_id: string; format: string; resource_type: string }>((resolve, reject) => {
      const stream = cloud.uploader.upload_stream({ public_id, resource_type, type: "authenticated" }, (error, result) => {
        if (error || !result) reject(error || new Error("Không thể tải tệp lên Cloudinary."));
        else resolve(result);
      });
      stream.end(bytes);
    });
    const mediaRef = db().doc(`media/${user.uid}`);
    const previous = (await mediaRef.get()).data()?.[kind] as { publicId: string; resourceType: "image" | "raw" } | undefined;
    await mediaRef.set({ [kind]: { publicId: uploaded.public_id, format: uploaded.format || "", resourceType: uploaded.resource_type, contentType: file.type } }, { merge: true });
    if (previous) {
      try { await cloud.uploader.destroy(previous.publicId, { resource_type: previous.resourceType, type: "authenticated", invalidate: true }); }
      catch (error) { console.error("Could not remove previous Cloudinary asset", error); }
    }
    const tutorRef = db().doc(`tutors/${user.uid}`);
    if ((await tutorRef.get()).data()?.status === "approved") await tutorRef.update({ status: "pending", updatedAt: Date.now() });
    return Response.json({ url: `/api/media/${user.uid}/${kind}?v=${Date.now()}` });
  } catch (error) { return fail(error); }
}
