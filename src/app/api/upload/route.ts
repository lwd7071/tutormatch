import { NextRequest } from "next/server";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/firebase-admin";
import { mediaCloud } from "@/lib/cloudinary";
import { actor, fail, requireRole } from "@/lib/server";
import { validTutorFile, type TutorMedia } from "@/lib/tutor-profile";

export const runtime = "nodejs";
export async function POST(req: NextRequest) {
  try {
    const user = await actor(req);
    requireRole(user, "student", "tutor");
    const form = await req.formData();
    const kind = form.get("kind"), file = form.get("file");
    if (kind !== "photo" && kind !== "document") throw new Error("Loại tệp không hợp lệ.");
    if (!(file instanceof File) || file.size > 4_000_000 || file.size === 0) throw new Error("Tệp phải nhỏ hơn 4 MB.");
    const allowed = kind === "photo" ? ["image/jpeg", "image/png", "image/webp"] : ["image/jpeg", "image/png", "application/pdf"];
    if (!allowed.includes(file.type)) throw new Error("Định dạng tệp không được hỗ trợ.");
    const database = db(), submissionRef = database.doc(`tutorSubmissions/${user.uid}`), liveRef = database.doc(`tutors/${user.uid}`);
    const [submissionSnap, liveSnap] = await Promise.all([submissionRef.get(), liveRef.get()]);
    if (submissionSnap.data()?.status === "pending" || (!submissionSnap.exists && liveSnap.data()?.status === "pending")) throw new Error("Hồ sơ đang chờ duyệt. Bạn có thể thay tệp sau khi admin phản hồi.");
    const cloud = mediaCloud();
    const resource_type = file.type === "application/pdf" ? "raw" : "image";
    const public_id = `tutors/${user.uid}/${kind}/${randomUUID()}${resource_type === "raw" ? ".pdf" : ""}`;
    const bytes = Buffer.from(await file.arrayBuffer());
    if (!validTutorFile(bytes, file.type)) throw new Error("Nội dung tệp không đúng định dạng đã chọn.");
    const uploaded = await new Promise<{ public_id: string; format: string; resource_type: string }>((resolve, reject) => {
      const stream = cloud.uploader.upload_stream({ public_id, resource_type, type: "authenticated" }, (error, result) => {
        if (error || !result) reject(error || new Error("Không thể tải tệp lên Cloudinary."));
        else resolve(result);
      });
      stream.end(bytes);
    });
    const mediaRef = database.doc(`media/${user.uid}`), field = kind === "photo" ? "stagedPhoto" : "stagedDocument";
    let previous: TutorMedia | undefined;
    try {
      await database.runTransaction(async tx => {
        const [currentSubmission, currentLive, currentMedia] = await Promise.all([tx.get(submissionRef), tx.get(liveRef), tx.get(mediaRef)]);
        if (currentSubmission.data()?.status === "pending" || (!currentSubmission.exists && currentLive.data()?.status === "pending")) throw new Error("Hồ sơ vừa được gửi duyệt. Vui lòng thử lại sau.");
        previous = currentMedia.data()?.[field] as TutorMedia | undefined;
        tx.set(mediaRef, { [field]: { publicId: uploaded.public_id, format: uploaded.format || "", resourceType: uploaded.resource_type, contentType: file.type } }, { merge: true });
      });
    } catch (error) {
      await cloud.uploader.destroy(uploaded.public_id, { resource_type: uploaded.resource_type, type: "authenticated" }).catch(() => {});
      throw error;
    }
    if (previous) {
      try { await cloud.uploader.destroy(previous.publicId, { resource_type: previous.resourceType, type: "authenticated", invalidate: true }); }
      catch (error) { console.error("Could not remove previous Cloudinary asset", error); }
    }
    return Response.json({ ok: true, kind });
  } catch (error) { return fail(error); }
}
