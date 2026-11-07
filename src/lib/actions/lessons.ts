import { db } from "../firebase-admin";
import { type Actor, DAY, now, requireRole, str } from "../server";
import { conflict, success } from "../api-response";
import { moneyForSession } from "../money";
import { canCancelSession } from "../public-data";
import { calendarReservation, notify, type Slot } from "./common";
import { type ActionInput } from "../action-schema";

type LessonAction = Extract<
  ActionInput,
  {
    action:
      | "decideOrder"
      | "createSession"
      | "confirmSession"
      | "cancelSession";
  }
>;

export async function handleLessons(user: Actor, data: LessonAction) {
  const database = db(),
    action = data.action;
  if (action === "decideOrder") {
    requireRole(user, "tutor");
    const id = str(data.id, 100),
      accept = data.accept === true;
    const ref = database.doc(`orders/${id}`);
    await database.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const order = snap.data();
      if (
        !order ||
        order.tutorId !== user.uid ||
        order.status !== "pending_tutor"
      )
        throw conflict("Đơn không còn chờ phản hồi.");
      if (now() > order.decisionDue) throw conflict("Đơn đã quá hạn phản hồi.");
      tx.update(ref, {
        status: accept ? "active" : "refund_pending",
        decidedAt: now(),
      });
      if (!accept)
        tx.create(database.doc(`refunds/order_${id}`), {
          orderId: id,
          studentId: order.studentId,
          amount: order.price,
          status: "needs_details",
          source: "tutor_rejected",
          reason: "Gia sư từ chối đơn",
          at: now(),
        });
      notify(
        tx,
        order.studentId,
        accept
          ? "Gia sư đã nhận đơn. Bạn có thể thống nhất lịch học."
          : "Gia sư không nhận đơn. Admin sẽ hoàn toàn bộ tiền.",
      );
    });
    return success({ ok: true });
  }

  if (action === "createSession") {
    requireRole(user, "tutor");
    const orderId = str(data.orderId, 100),
      start = Number(data.start);
    if (!Number.isFinite(start) || start < now() + 60_000)
      throw conflict("Giờ bắt đầu cần ở tương lai.");
    const orderRef = database.doc(`orders/${orderId}`);
    const sessionRef = database.collection("sessions").doc();
    await database.runTransaction(async (tx) => {
      const snap = await tx.get(orderRef);
      const order = snap.data();
      if (!order || order.tutorId !== user.uid || order.status !== "active")
        throw conflict("Gói chưa sẵn sàng để lên lịch.");
      if (order.confirmedCount + order.reservedCount >= order.count)
        throw conflict("Gói đã hết buổi.");
      const end = start + order.durationMinutes * 60_000;
      const tutorCalendar = await calendarReservation(tx, user.uid, {
        id: sessionRef.id,
        start,
        end,
      });
      const studentCalendar = await calendarReservation(tx, order.studentId, {
        id: sessionRef.id,
        start,
        end,
      });
      tx.update(orderRef, { reservedCount: order.reservedCount + 1 });
      tx.set(tutorCalendar.ref, { slots: tutorCalendar.slots });
      tx.set(studentCalendar.ref, { slots: studentCalendar.slots });
      tx.create(sessionRef, {
        orderId,
        tutorId: user.uid,
        studentId: order.studentId,
        start,
        end,
        durationMinutes: order.durationMinutes,
        status: "scheduled",
        confirmations: {},
        createdAt: now(),
      });
      notify(
        tx,
        order.studentId,
        "Gia sư đã tạo buổi học mới. Hãy xem lịch học của bạn.",
      );
    });
    return success({ id: sessionRef.id });
  }

  if (action === "confirmSession") {
    const id = str(data.id, 100),
      answer = data.answer;
    if (answer !== "yes" && answer !== "no")
      throw conflict("Vui lòng chọn kết quả buổi học.");
    const ref = database.doc(`sessions/${id}`);
    await database.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const session = snap.data();
      if (!session || ![session.studentId, session.tutorId].includes(user.uid))
        throw conflict("Không tìm thấy buổi học.");
      if (
        session.status !== "scheduled" ||
        now() < session.end ||
        now() > session.end + DAY
      )
        throw conflict("Buổi học không còn trong thời hạn xác nhận.");
      const key = user.uid === session.studentId ? "student" : "tutor";
      if (session.confirmations?.[key])
        throw conflict("Bạn đã xác nhận buổi này.");
      const confirmations = { ...session.confirmations, [key]: answer };
      if (!confirmations.student || !confirmations.tutor) {
        tx.update(ref, { confirmations });
        return;
      }
      if (confirmations.student === "no" && confirmations.tutor === "no") {
        if (session.trialId) {
          tx.update(ref, { confirmations, status: "cancelled" });
          tx.update(database.doc(`trials/${session.trialId}`), {
            status: "cancelled",
          });
          return;
        }
        const orderRef = database.doc(`orders/${session.orderId}`),
          order = (await tx.get(orderRef)).data();
        if (!order) throw conflict("Không tìm thấy gói học.");
        tx.update(ref, { confirmations, status: "cancelled" });
        tx.update(orderRef, { reservedCount: order.reservedCount - 1 });
        return;
      }
      if (confirmations.student !== "yes" || confirmations.tutor !== "yes") {
        tx.update(ref, { confirmations, status: "dispute" });
        return;
      }
      if (session.trialId) {
        tx.update(ref, {
          confirmations,
          status: "confirmed",
          confirmedAt: now(),
        });
        tx.update(database.doc(`trials/${session.trialId}`), {
          status: "completed",
        });
        return;
      }
      const orderRef = database.doc(`orders/${session.orderId}`);
      const orderSnap = await tx.get(orderRef);
      const order = orderSnap.data();
      if (
        !order ||
        order.status !== "active" ||
        order.confirmedCount >= order.count
      )
        throw conflict("Gói không còn hợp lệ.");
      const index = order.confirmedCount + 1;
      const gross = moneyForSession(order.price, order.count, index);
      const fee = moneyForSession(
        Math.floor((order.price * order.feeRate) / 100),
        order.count,
        index,
      );
      const walletRef = database.doc(`wallets/${session.tutorId}`);
      const walletSnap = await tx.get(walletRef);
      tx.update(orderRef, {
        confirmedCount: index,
        reservedCount: order.reservedCount - 1,
        status:
          index === order.count && order.reservedCount === 1
            ? "closed"
            : "active",
      });
      tx.update(ref, {
        confirmations,
        status: "confirmed",
        gross,
        fee,
        tutorAmount: gross - fee,
        confirmedAt: now(),
      });
      tx.set(
        walletRef,
        {
          available: (walletSnap.data()?.available || 0) + gross - fee,
          pending: walletSnap.data()?.pending || 0,
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
      });
    });
    return success({ ok: true });
  }

  if (action === "cancelSession") {
    requireRole(user, "tutor");
    const id = str(data.id, 100),
      ref = database.doc(`sessions/${id}`);
    await database.runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      const session = snap.data();
      if (
        !session ||
        session.tutorId !== user.uid ||
        !canCancelSession(session, now())
      )
        throw conflict(
          "Chỉ có thể hủy buổi học trước giờ bắt đầu. Sau đó hãy dùng xác nhận hoặc nhờ admin xử lý.",
        );
      const orderRef = session.orderId
        ? database.doc(`orders/${session.orderId}`)
        : null;
      const order = orderRef ? (await tx.get(orderRef)).data() : null;
      const tutorCalendarRef = database.doc(`calendars/${session.tutorId}`),
        studentCalendarRef = database.doc(`calendars/${session.studentId}`);
      const tutorCalendar = (await tx.get(tutorCalendarRef)).data(),
        studentCalendar = (await tx.get(studentCalendarRef)).data();
      if (orderRef && !order) throw conflict("Không tìm thấy gói học.");
      tx.update(ref, {
        status: "cancelled",
        cancelledAt: now(),
        cancelReason:
          typeof data.reason === "string" ? data.reason.slice(0, 500) : "",
      });
      tx.set(tutorCalendarRef, {
        slots: ((tutorCalendar?.slots || []) as Slot[]).filter(
          (s) => s.id !== id,
        ),
      });
      tx.set(studentCalendarRef, {
        slots: ((studentCalendar?.slots || []) as Slot[]).filter(
          (s) => s.id !== id,
        ),
      });
      if (session.trialId)
        tx.update(database.doc(`trials/${session.trialId}`), {
          status: "cancelled",
        });
      if (orderRef && order)
        tx.update(orderRef, {
          reservedCount: Math.max(0, order.reservedCount - 1),
        });
      notify(
        tx,
        session.studentId,
        "Gia sư đã hủy buổi học. Lượt học của bạn không bị trừ.",
      );
    });
    return success({ ok: true });
  }

  throw conflict("Thao tác không hợp lệ.");
}
