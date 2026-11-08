import { db } from "../firebase-admin";
import { type Actor, integer, now, requireRole, str } from "../server";
import { conflict, success } from "../api-response";
import { tutorAcceptsNewOrders } from "../tutor-profile";
import { notify } from "./common";
import { type ActionInput } from "../action-schema";

type RequestAction = Extract<ActionInput, { action: "requestPackage" | "declinePackageRequest" | "declinePackageOffer" | "offerPackage" }>;

export async function handlePackageRequest(user: Actor, data: RequestAction) {
  const database = db();
  if (data.action === "requestPackage") {
    requireRole(user, "student");
    const ref = database.doc(`packageRequests/${user.uid}_${str(data.tutorId, 128)}_${str(data.subjectId, 128)}`);
    await database.runTransaction(async (tx) => {
      const [oldSnap, tutorSnap, tutorUserSnap, subjectSnap] = await Promise.all([
        tx.get(ref),
        tx.get(database.doc(`tutors/${data.tutorId}`)),
        tx.get(database.doc(`users/${data.tutorId}`)),
        tx.get(database.doc(`subjects/${data.subjectId}`)),
      ]);
      const old = oldSnap.data();
      if (old && !["declined", "purchased"].includes(old.status)) throw conflict("Bạn đã có yêu cầu đang xử lý với gia sư này.");
      if (!tutorAcceptsNewOrders(tutorSnap.data()?.status, tutorUserSnap.data()?.blocked === true) || data.tutorId === user.uid || subjectSnap.data()?.active !== true)
        throw conflict("Gia sư hoặc môn học hiện không nhận yêu cầu.");
      tx.set(ref, {
        studentId: user.uid,
        tutorId: data.tutorId,
        subjectId: data.subjectId,
        purpose: str(data.purpose, 300),
        topics: str(data.topics, 1000),
        count: integer(data.count, 1, 100),
        durationMinutes: integer(data.durationMinutes, 15, 240),
        mode: data.mode,
        timePreference: str(data.timePreference, 500),
        note: data.note || "",
        status: "requested",
        currentOfferId: null,
        createdAt: now(),
        updatedAt: now(),
      });
      notify(tx, data.tutorId, "Bạn có yêu cầu gói học mới.");
    });
    return success({ ok: true });
  }

  if (data.action === "declinePackageRequest") {
    requireRole(user, "tutor");
    const ref = database.doc(`packageRequests/${str(data.id, 220)}`);
    await database.runTransaction(async (tx) => {
      const request = (await tx.get(ref)).data();
      if (!request || request.tutorId !== user.uid || request.status !== "requested") throw conflict("Yêu cầu không còn hiệu lực.");
      tx.update(ref, { status: "declined", updatedAt: now() });
      notify(tx, request.studentId, "Gia sư hiện chưa thể nhận yêu cầu gói học này.");
    });
    return success({ ok: true });
  }

  if (data.action === "declinePackageOffer") {
    requireRole(user, "student");
    const ref = database.doc(`packageRequests/${str(data.id, 220)}`);
    await database.runTransaction(async (tx) => {
      const request = (await tx.get(ref)).data();
      if (!request || request.studentId !== user.uid || request.status !== "offered" || !request.currentOfferId) throw conflict("Đề nghị không còn hiệu lực.");
      const pending = await tx.get(database.collection("orders").where("packageRequestId", "==", ref.id).where("status", "==", "pending_payment").limit(1));
      if (!pending.empty) throw conflict("Đang có một giao dịch thanh toán. Hãy hoàn tất hoặc chờ giao dịch đóng trước.");
      tx.update(database.doc(`packages/${request.currentOfferId}`), { active: false });
      tx.update(ref, { status: "declined", currentOfferId: null, updatedAt: now() });
      notify(tx, request.tutorId, "Học viên chưa nhận đề nghị gói học.");
    });
    return success({ ok: true });
  }

  requireRole(user, "tutor");
  const ref = database.doc(`packageRequests/${str(data.id, 220)}`),
    packageRef = database.collection("packages").doc();
  await database.runTransaction(async (tx) => {
    const request = (await tx.get(ref)).data();
    if (!request || request.tutorId !== user.uid || !["requested", "offered"].includes(request.status)) throw conflict("Yêu cầu không còn hiệu lực.");
    if (request.subjectId !== data.subjectId) throw conflict("Môn học của đề nghị không khớp yêu cầu.");
    if (request.status === "offered") {
      const pending = await tx.get(database.collection("orders").where("packageRequestId", "==", ref.id).where("status", "==", "pending_payment").limit(1));
      if (!pending.empty) throw conflict("Học viên đang thanh toán đề nghị hiện tại.");
    }
    const previousId = request.currentOfferId;
    if (previousId) tx.update(database.doc(`packages/${previousId}`), { active: false });
    tx.create(packageRef, {
      tutorId: user.uid,
      studentId: request.studentId,
      requestId: ref.id,
      visibility: "private",
      title: str(data.title, 100),
      subjectId: data.subjectId,
      price: integer(data.price, 1000, 100_000_000),
      count: integer(data.count, 1, 100),
      durationMinutes: integer(data.durationMinutes, 15, 240),
      mode: data.mode,
      active: true,
      updatedAt: now(),
    });
    tx.update(ref, { status: "offered", currentOfferId: packageRef.id, updatedAt: now() });
    notify(tx, request.studentId, "Gia sư đã gửi đề nghị gói học. Xem và chọn thanh toán.");
  });
  return success({ ok: true });
}
