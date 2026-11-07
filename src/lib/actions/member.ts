import { FieldValue } from "firebase-admin/firestore";
import { db } from "../firebase-admin";
import { type Actor, integer, now, requireRole, str } from "../server";
import { conflict, success } from "../api-response";
import { moneyForSession } from "../money";
import { requireRefundBankSubmission } from "../refund-state";
import { stageListing } from "../listing";
import { type ActionInput } from "../action-schema";

type MemberAction = Extract<
  ActionInput,
  {
    action:
      | "requestRefund"
      | "setRefundBank"
      | "requestWithdrawal"
      | "sendMessage"
      | "reviewTutor";
  }
>;

export async function handleMember(user: Actor, data: MemberAction) {
  const database = db(),
    action = data.action;
  if (action === "requestRefund") {
    requireRole(user, "student", "tutor");
    const id = str(data.orderId, 100),
      order = (await database.doc(`orders/${id}`).get()).data();
    if (
      !order ||
      order.studentId !== user.uid ||
      order.status !== "active" ||
      order.reservedCount !== 0
    )
      throw conflict("Hãy hủy các buổi đã đặt trước khi yêu cầu hoàn tiền.");
    await database.runTransaction(async (tx) => {
      const ref = database.doc(`orders/${id}`),
        snap = await tx.get(ref);
      const current = snap.data();
      if (current?.status !== "active" || current.reservedCount !== 0)
        throw conflict("Trạng thái gói đã thay đổi.");
      const amount =
        current.price -
        Array.from({ length: current.confirmedCount }, (_, i) =>
          moneyForSession(current.price, current.count, i + 1),
        ).reduce((a, b) => a + b, 0);
      if (amount <= 0) throw conflict("Gói không còn tiền để hoàn.");
      tx.update(ref, { status: "refund_pending" });
      tx.create(database.doc(`refunds/order_${id}`), {
        orderId: id,
        studentId: user.uid,
        amount,
        status: "needs_details",
        source: "student",
        reason:
          typeof data.reason === "string"
            ? data.reason.slice(0, 500)
            : "Học viên yêu cầu hoàn tiền",
        at: now(),
      });
    });
    return success({ ok: true });
  }

  if (action === "setRefundBank") {
    const id = str(data.id, 100),
      ref = database.doc(`refunds/${id}`);
    const bankName = str(data.bankName, 100),
      bankAccount = str(data.bankAccount, 50),
      accountHolder = str(data.accountHolder, 100);
    await database.runTransaction(async (tx) => {
      const refund = (await tx.get(ref)).data();
      requireRefundBankSubmission(refund, user.uid);
      tx.update(ref, {
        bankName,
        bankAccount,
        accountHolder,
        status: "pending",
        bankCorrectionReason: FieldValue.delete(),
        updatedAt: now(),
      });
    });
    return success({ ok: true });
  }

  if (action === "requestWithdrawal") {
    requireRole(user, "tutor");
    const amount = integer(data.amount, 1000, 100_000_000);
    const bankName = str(data.bankName, 100),
      bankAccount = str(data.bankAccount, 50);
    await database.runTransaction(async (tx) => {
      const ref = database.doc(`wallets/${user.uid}`),
        wallet = (await tx.get(ref)).data();
      if (!wallet || wallet.available < amount)
        throw conflict("Số dư có thể rút không đủ.");
      tx.update(ref, {
        available: wallet.available - amount,
        pending: (wallet.pending || 0) + amount,
      });
      tx.create(database.collection("withdrawals").doc(), {
        tutorId: user.uid,
        amount,
        bankName,
        bankAccount,
        status: "pending",
        at: now(),
      });
    });
    return success({ ok: true });
  }

  if (action === "sendMessage") {
    const threadId = str(data.threadId, 220);
    const isTrial = threadId.startsWith("trial:");
    const thread = isTrial
      ? (await database.doc(`trials/${threadId.slice(6)}`).get()).data()
      : (await database.doc(`orders/${threadId}`).get()).data();
    if (
      !thread ||
      ![thread.studentId, thread.tutorId].includes(user.uid) ||
      (!isTrial && thread.status === "pending_payment")
    )
      throw conflict("Bạn chưa thể nhắn tin trong cuộc trò chuyện này.");
    const batch = database.batch();
    batch.create(database.collection("messages").doc(), {
      threadId,
      participants: [thread.studentId, thread.tutorId],
      senderId: user.uid,
      text: str(data.text, 2000),
      at: now(),
    });
    batch.create(database.collection("notifications").doc(), {
      userId: user.uid === thread.studentId ? thread.tutorId : thread.studentId,
      text: "Bạn có tin nhắn mới.",
      at: now(),
    });
    await batch.commit();
    return success({ ok: true });
  }

  if (action === "reviewTutor") {
    requireRole(user, "student", "tutor");
    const orderId = str(data.orderId, 100),
      order = (await database.doc(`orders/${orderId}`).get()).data();
    if (!order || order.studentId !== user.uid || order.confirmedCount < 1)
      throw conflict("Bạn cần hoàn thành một buổi trả phí để đánh giá.");
    const review = {
      orderId,
      tutorId: order.tutorId,
      studentId: user.uid,
      stars: integer(data.stars, 1, 5),
      text: str(data.text, 1000),
      at: now(),
      status: "visible",
    };
    await database.runTransaction(async (tx) => {
      const ref = database.doc(`reviews/${orderId}`);
      if ((await tx.get(ref)).exists)
        throw conflict("Bạn đã đánh giá đơn này.");
      await stageListing(tx, order.tutorId, {
        review: { id: orderId, value: review },
      });
      tx.create(ref, review);
    });
    return success({ ok: true });
  }

  throw conflict("Thao tác không hợp lệ.");
}
