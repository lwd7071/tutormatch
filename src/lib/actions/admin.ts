import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase-admin";
import { mediaCloud } from "../cloudinary";
import { type Actor, integer, now, requireRole, str } from "../server";
import { conflict, success } from "../api-response";
import { moneyForSession } from "../money";
import { approvedTutorUpdate, type TutorMedia } from "../tutor-profile";
import { requireRefundBankCorrection } from "../refund-state";
import { queueListing, stageListing } from "../listing";
import { notify } from "./common";
import { type ActionInput } from "../action-schema";

export async function handleAdmin(
  user: Actor,
  data: Extract<ActionInput, { action: "admin" }>,
) {
  const database = db();
  requireRole(user, "admin");
  const kind = data.kind,
    id = "id" in data ? data.id : "";
  if (kind === "subject") {
    const name = str(data.name, 80);
    await database.collection("subjects").add({ name, active: true });
  } else if (kind === "toggleSubject") {
    const ref = database.doc(`subjects/${str(id, 100)}`),
      subject = (await ref.get()).data();
    if (!subject) throw conflict("Không tìm thấy môn học.");
    await ref.update({ active: !subject.active });
  } else if (kind === "fee") {
    await database
      .doc("settings/main")
      .set({ feeRate: integer(data.feeRate, 0, 100) }, { merge: true });
  } else if (kind === "approveTutor" || kind === "rejectTutor") {
    const uid = str(id, 100),
      reason = kind === "rejectTutor" ? str(data.reason, 500) : "";
    let verifiedPhoto = "",
      verifiedDocument = "";
    if (kind === "approveTutor") {
      const [liveSnap, submissionSnap, mediaSnap] = await Promise.all([
        database.doc(`tutors/${uid}`).get(),
        database.doc(`tutorSubmissions/${uid}`).get(),
        database.doc(`media/${uid}`).get(),
      ]);
      const candidate =
        submissionSnap.data() ||
        (liveSnap.data()?.status === "pending"
          ? {
              ...liveSnap.data(),
              photo: mediaSnap.data()?.photo,
              document: mediaSnap.data()?.document,
            }
          : null);
      if (
        !candidate ||
        candidate.status !== "pending" ||
        !candidate.photo ||
        !candidate.document
      )
        throw conflict(
          "Hồ sơ cần ảnh chân dung và giấy tờ hợp lệ trước khi duyệt.",
        );
      const cloud = mediaCloud();
      for (const asset of [
        candidate.photo,
        candidate.document,
      ] as TutorMedia[]) {
        const url = cloud.url(asset.publicId, {
          resource_type: asset.resourceType,
          type: "authenticated",
          format: asset.resourceType === "image" ? asset.format : undefined,
          sign_url: true,
        });
        if (!(await fetch(url, { method: "HEAD" })).ok)
          throw conflict(
            "Không mở được ảnh hoặc giấy tờ. Hãy yêu cầu gia sư tải lại tệp.",
          );
      }
      verifiedPhoto = candidate.photo.publicId;
      verifiedDocument = candidate.document.publicId;
    }
    const previous = await database.runTransaction(async (tx) => {
      const liveRef = database.doc(`tutors/${uid}`),
        submissionRef = database.doc(`tutorSubmissions/${uid}`),
        mediaRef = database.doc(`media/${uid}`),
        userRef = database.doc(`users/${uid}`);
      const [liveSnap, submissionSnap, mediaSnap, tutorUserSnap] =
        await Promise.all([
          tx.get(liveRef),
          tx.get(submissionRef),
          tx.get(mediaRef),
          tx.get(userRef),
        ]);
      const live = liveSnap.data(),
        submission = submissionSnap.data(),
        media = mediaSnap.data();
      const candidate =
        submission ||
        (live?.status === "pending"
          ? { ...live, photo: media?.photo, document: media?.document }
          : null);
      if (!candidate || candidate.status !== "pending")
        throw conflict("Hồ sơ không còn chờ duyệt.");
      if (kind === "rejectTutor") {
        tx.set(submissionRef, {
          ...candidate,
          status: "rejected",
          reviewReason: reason,
          reviewedAt: now(),
          reviewedBy: user.uid,
        });
        if (!submission && liveSnap.exists)
          tx.update(liveRef, { status: "rejected", reviewedAt: now() });
        if (!submission && liveSnap.exists) queueListing(tx, uid);
        notify(tx, uid, `Hồ sơ gia sư chưa được duyệt: ${reason}`);
        return null;
      }
      if (!candidate.photo || !candidate.document)
        throw conflict(
          "Cần ảnh chân dung và giấy tờ xác minh trước khi duyệt.",
        );
      if (
        candidate.photo.publicId !== verifiedPhoto ||
        candidate.document.publicId !== verifiedDocument
      )
        throw conflict("Hồ sơ vừa thay đổi. Vui lòng mở lại bản gửi duyệt.");
      const version = now();
      const approved = approvedTutorUpdate(candidate, live, uid, version);
      const nextTutor = {
        ...approved,
        status:
          tutorUserSnap.data()?.blocked === true
            ? "suspended"
            : approved.status,
      };
      await stageListing(tx, uid, { tutor: { ...live, ...nextTutor } });
      tx.set(liveRef, nextTutor, { merge: true });
      tx.set(
        mediaRef,
        {
          photo: candidate.photo,
          document: candidate.document,
          stagedPhoto: FieldValue.delete(),
          stagedDocument: FieldValue.delete(),
        },
        { merge: true },
      );
      if (submission) tx.delete(submissionRef);
      notify(tx, uid, "Hồ sơ gia sư đã được duyệt.");
      return {
        oldPhoto: media?.photo as TutorMedia | undefined,
        oldDocument: media?.document as TutorMedia | undefined,
        photo: candidate.photo as TutorMedia,
        document: candidate.document as TutorMedia,
      };
    });
    if (previous)
      try {
        const cloud = mediaCloud();
        for (const [oldAsset, newAsset] of [
          [previous.oldPhoto, previous.photo],
          [previous.oldDocument, previous.document],
        ] as [TutorMedia | undefined, TutorMedia][]) {
          if (oldAsset && oldAsset.publicId !== newAsset.publicId)
            await cloud.uploader.destroy(oldAsset.publicId, {
              resource_type: oldAsset.resourceType,
              type: "authenticated",
              invalidate: true,
            });
        }
      } catch (error) {
        console.error("Could not remove previous tutor media", error);
      }
  } else if (kind === "suspendTutor" || kind === "restoreTutor") {
    const uid = str(id, 100),
      ref = database.doc(`tutors/${uid}`),
      userRef = database.doc(`users/${uid}`);
    await database.runTransaction(async (tx) => {
      const [tutorSnap, userSnap] = await Promise.all([
        tx.get(ref),
        tx.get(userRef),
      ]);
      const status = tutorSnap.data()?.status;
      if (status !== (kind === "suspendTutor" ? "approved" : "suspended"))
        throw conflict("Trạng thái hồ sơ đã thay đổi.");
      if (kind === "restoreTutor" && userSnap.data()?.blocked === true)
        throw conflict("Cần mở khóa tài khoản trước khi khôi phục hồ sơ.");
      await stageListing(tx, uid, {
        tutor: {
          ...tutorSnap.data(),
          status: kind === "suspendTutor" ? "suspended" : "approved",
        },
      });
      tx.update(ref, {
        status: kind === "suspendTutor" ? "suspended" : "approved",
        updatedAt: now(),
      });
      notify(
        tx,
        uid,
        kind === "suspendTutor"
          ? "Hồ sơ gia sư đã được tạm ẩn."
          : "Hồ sơ gia sư đã được khôi phục.",
      );
    });
  } else if (kind === "blockUser" || kind === "unblockUser") {
    const uid = str(id, 128);
    if (uid === user.uid) throw conflict("Bạn không thể khóa chính mình.");
    await database.runTransaction(async (tx) => {
      const userRef = database.doc(`users/${uid}`),
        tutorRef = database.doc(`tutors/${uid}`);
      const [userSnap, tutorSnap] = await Promise.all([
        tx.get(userRef),
        tx.get(tutorRef),
      ]);
      if (!userSnap.exists) throw conflict("Không tìm thấy người dùng.");
      if (tutorSnap.exists)
        await stageListing(tx, uid, {
          user: { ...userSnap.data(), blocked: kind === "blockUser" },
          tutor: {
            ...tutorSnap.data(),
            status:
              kind === "blockUser" && tutorSnap.data()?.status === "approved"
                ? "suspended"
                : tutorSnap.data()?.status,
          },
        });
      tx.set(
        userRef,
        { blocked: kind === "blockUser", updatedAt: now() },
        { merge: true },
      );
      if (kind === "blockUser" && tutorSnap.data()?.status === "approved")
        tx.update(tutorRef, { status: "suspended", updatedAt: now() });
    });
  } else if (kind === "hideReview" || kind === "showReview") {
    const ref = database.doc(`reviews/${str(id, 100)}`);
    await database.runTransaction(async (tx) => {
      const review = (await tx.get(ref)).data();
      if (!review) throw conflict("Không tìm thấy đánh giá.");
      await stageListing(tx, review.tutorId, {
        review: {
          id: ref.id,
          value: {
            ...review,
            status: kind === "hideReview" ? "hidden" : "visible",
          },
        },
      });
      tx.update(ref, {
        status: kind === "hideReview" ? "hidden" : "visible",
        moderatedAt: now(),
      });
    });
  } else if (kind === "refundComplete") {
    const ref = database.doc(`refunds/${str(id, 100)}`);
    const reference = str(data.reference, 100);
    await database.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (
        !current ||
        current.status !== "pending" ||
        !current.bankAccount ||
        !current.accountHolder
      )
        throw conflict("Học viên chưa cung cấp đủ tài khoản nhận hoàn tiền.");
      tx.update(ref, { status: "completed", reference, completedAt: now() });
      tx.update(database.doc(`orders/${current.orderId}`), {
        status: "refunded",
      });
      tx.create(database.doc(`ledger/refund_${id}`), {
        type: "refund",
        orderId: current.orderId,
        amount: current.amount,
        reference,
        at: now(),
      });
      notify(tx, current.studentId, "Khoản hoàn tiền đã được chuyển khoản.");
    });
  } else if (kind === "refundReject") {
    const ref = database.doc(`refunds/${str(id, 100)}`),
      reason = str(data.reason, 500);
    await database.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (
        !current ||
        !["pending", "needs_details"].includes(current.status) ||
        current.source !== "student"
      )
        throw conflict("Yêu cầu này không thể từ chối.");
      const orderRef = database.doc(`orders/${current.orderId}`),
        order = (await tx.get(orderRef)).data();
      if (order?.status !== "refund_pending")
        throw conflict("Trạng thái gói đã thay đổi.");
      tx.update(ref, {
        status: "rejected",
        adminReason: reason,
        decidedAt: now(),
      });
      tx.update(orderRef, { status: "active" });
      notify(
        tx,
        current.studentId,
        "Yêu cầu hoàn tiền chưa được duyệt. Xem lý do trong mục Hoàn tiền.",
      );
    });
  } else if (kind === "requestRefundBankCorrection") {
    const ref = database.doc(`refunds/${str(id, 100)}`),
      reason = str(data.reason, 500);
    await database.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      requireRefundBankCorrection(current);
      tx.update(ref, {
        status: "needs_details",
        bankName: FieldValue.delete(),
        bankAccount: FieldValue.delete(),
        accountHolder: FieldValue.delete(),
        bankCorrectionReason: reason,
        updatedAt: now(),
      });
      notify(
        tx,
        current.studentId,
        `Vui lòng sửa tài khoản nhận hoàn tiền: ${reason}`,
      );
    });
  } else if (kind === "withdrawalComplete" || kind === "withdrawalReject") {
    const ref = database.doc(`withdrawals/${str(id, 100)}`),
      reference = kind === "withdrawalComplete" ? str(data.reference, 100) : "";
    await database.runTransaction(async (tx) => {
      const snap = await tx.get(ref),
        withdrawal = snap.data();
      if (!withdrawal || withdrawal.status !== "pending")
        throw conflict("Yêu cầu rút tiền không hợp lệ.");
      const walletRef = database.doc(`wallets/${withdrawal.tutorId}`),
        wallet = (await tx.get(walletRef)).data();
      tx.update(ref, {
        status: kind === "withdrawalComplete" ? "completed" : "rejected",
        reference,
        completedAt: now(),
      });
      tx.update(walletRef, {
        pending: (wallet?.pending || 0) - withdrawal.amount,
        available:
          (wallet?.available || 0) +
          (kind === "withdrawalReject" ? withdrawal.amount : 0),
      });
      if (kind === "withdrawalComplete")
        tx.create(database.doc(`ledger/withdrawal_${id}`), {
          type: "withdrawal",
          tutorId: withdrawal.tutorId,
          amount: withdrawal.amount,
          reference,
          at: now(),
        });
    });
  } else if (kind === "resolveSession") {
    const sessionRef = database.doc(`sessions/${str(id, 100)}`),
      taught = data.taught === true;
    await database.runTransaction(async (tx) => {
      const session = (await tx.get(sessionRef)).data();
      if (!session || session.status !== "dispute")
        throw conflict("Buổi học không còn chờ xử lý.");
      const reason = str(data.reason, 500);
      notify(tx, session.studentId, "Admin đã xử lý buổi học có tranh chấp.");
      notify(tx, session.tutorId, "Admin đã xử lý buổi học có tranh chấp.");
      if (session.trialId) {
        tx.update(sessionRef, {
          status: taught ? "confirmed" : "cancelled",
          adminReason: reason,
          resolvedAt: now(),
        });
        tx.update(database.doc(`trials/${session.trialId}`), {
          status: taught ? "completed" : "cancelled",
        });
        return;
      }
      const orderRef = database.doc(`orders/${session.orderId}`),
        order = (await tx.get(orderRef)).data();
      if (!order) throw conflict("Không tìm thấy gói học.");
      if (!taught) {
        tx.update(sessionRef, {
          status: "cancelled",
          adminReason: reason,
          resolvedAt: now(),
        });
        tx.update(orderRef, { reservedCount: order.reservedCount - 1 });
        return;
      }
      const walletRef = database.doc(`wallets/${session.tutorId}`),
        wallet = (await tx.get(walletRef)).data();
      const index = order.confirmedCount + 1,
        gross = moneyForSession(order.price, order.count, index),
        fee = moneyForSession(
          Math.floor((order.price * order.feeRate) / 100),
          order.count,
          index,
        );
      tx.update(orderRef, {
        confirmedCount: index,
        reservedCount: order.reservedCount - 1,
        status:
          index === order.count && order.reservedCount === 1
            ? "closed"
            : "active",
      });
      tx.update(sessionRef, {
        status: "confirmed",
        adminReason: reason,
        resolvedAt: now(),
        gross,
        fee,
        tutorAmount: gross - fee,
      });
      tx.set(
        walletRef,
        {
          available: (wallet?.available || 0) + gross - fee,
          pending: wallet?.pending || 0,
        },
        { merge: true },
      );
      tx.create(database.doc(`ledger/session_${id}`), {
        type: "lesson",
        sessionId: id,
        orderId: session.orderId,
        gross,
        fee,
        tutorAmount: gross - fee,
        at: now(),
        resolvedBy: user.uid,
      });
    });
  } else throw conflict("Thao tác admin không hợp lệ.");
  return success({ ok: true });
}
