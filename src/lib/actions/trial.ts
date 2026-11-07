import { db } from "../firebase-admin";
import { type Actor, DAY, integer, now, requireRole, str } from "../server";
import { conflict, invalid, success } from "../api-response";
import { tutorAcceptsNewOrders } from "../tutor-profile";
import { availableStarts } from "../discovery";
import { calendarReservation, notify } from "./common";
import { type ActionInput } from "../action-schema";

type TrialAction = Extract<
  ActionInput,
  { action: "requestTrial" | "decideTrial" | "createTrialSession" }
>;

export async function handleTrial(user: Actor, data: TrialAction) {
  const database = db(),
    action = data.action;
  if (action === "requestTrial") {
    const tutorId = str(data.tutorId, 100);
    const id = `${user.uid}_${tutorId}`;
    const start = data.start === undefined ? undefined : Number(data.start);
    if (
      start !== undefined &&
      (!Number.isInteger(start) || start > now() + 14 * DAY)
    )
      throw invalid("Giờ học thử không hợp lệ.");
    await database.runTransaction(async (tx) => {
      const ref = database.doc(`trials/${id}`);
      const [oldSnap, tutorSnap, tutorUserSnap, calendarSnap] =
        await Promise.all([
          tx.get(ref),
          tx.get(database.doc(`tutors/${tutorId}`)),
          tx.get(database.doc(`users/${tutorId}`)),
          start !== undefined
            ? tx.get(database.doc(`calendars/${tutorId}`))
            : Promise.resolve(null),
        ]);
      if (
        !tutorAcceptsNewOrders(
          tutorSnap.data()?.status,
          tutorUserSnap.data()?.blocked === true,
        ) ||
        tutorId === user.uid
      )
        throw conflict("Gia sư chưa sẵn sàng nhận học thử.");
      const old = oldSnap.data();
      if (old && !["rejected", "cancelled"].includes(old.status))
        throw conflict("Bạn đã có yêu cầu học thử với gia sư này.");
      if (start !== undefined) {
        if (
          !availableStarts(
            tutorSnap.data() || {},
            calendarSnap?.data()?.slots || [],
            now(),
          ).includes(start)
        )
          throw conflict("Giờ này vừa hết chỗ. Hãy chọn giờ khác.");
      }
      tx.set(ref, {
        studentId: user.uid,
        tutorId,
        status: "requested",
        message: data.message || "",
        start: start || null,
        at: now(),
      });
      notify(tx, tutorId, "Có học viên yêu cầu học thử miễn phí.");
    });
    return success({ ok: true });
  }

  if (action === "decideTrial") {
    requireRole(user, "tutor");
    const id = str(data.id, 220),
      ref = database.doc(`trials/${id}`);
    const accept = data.accept === true;
    await database.runTransaction(async (tx) => {
      const trial = (await tx.get(ref)).data();
      if (!trial || trial.tutorId !== user.uid || trial.status !== "requested")
        throw conflict("Yêu cầu học thử không hợp lệ.");
      if (accept && trial.start) {
        const tutorRef = database.doc(`tutors/${user.uid}`),
          tutor = (await tx.get(tutorRef)).data();
        const sessionRef = database.collection("sessions").doc(),
          start = Number(trial.start),
          end = start + 60 * 60_000;
        const tutorCalendar = await calendarReservation(tx, user.uid, {
          id: sessionRef.id,
          start,
          end,
        });
        const studentCalendar = await calendarReservation(tx, trial.studentId, {
          id: sessionRef.id,
          start,
          end,
        });
        if (
          tutor?.status !== "approved" ||
          !availableStarts(
            tutor,
            tutorCalendar.slots.filter((s) => s.id !== sessionRef.id),
            now(),
          ).includes(start)
        )
          throw conflict(
            "Giờ này không còn trống. Hãy từ chối để học viên chọn giờ khác.",
          );
        tx.set(tutorCalendar.ref, { slots: tutorCalendar.slots });
        tx.set(studentCalendar.ref, { slots: studentCalendar.slots });
        tx.create(sessionRef, {
          trialId: id,
          tutorId: user.uid,
          studentId: trial.studentId,
          start,
          end,
          durationMinutes: 60,
          status: "scheduled",
          confirmations: {},
          createdAt: now(),
        });
        tx.update(ref, { status: "scheduled", decidedAt: now() });
      } else
        tx.update(ref, {
          status: accept ? "accepted" : "rejected",
          decidedAt: now(),
        });
      notify(
        tx,
        trial.studentId,
        accept
          ? "Gia sư đã xác nhận lịch học thử."
          : "Gia sư chưa thể nhận buổi học thử. Bạn có thể chọn giờ khác.",
      );
    });
    return success({ ok: true });
  }

  if (action === "createTrialSession") {
    requireRole(user, "tutor");
    const id = str(data.id, 220),
      start = Number(data.start);
    if (!Number.isFinite(start) || start < now() + 60_000)
      throw conflict("Lịch học thử không hợp lệ.");
    const durationMinutes = integer(data.durationMinutes, 15, 120);
    const trialRef = database.doc(`trials/${id}`);
    const trial = await database.runTransaction(async (tx) => {
      const current = (await tx.get(trialRef)).data();
      if (
        !current ||
        current.tutorId !== user.uid ||
        current.status !== "accepted"
      )
        throw conflict("Yêu cầu học thử không hợp lệ.");
      const sessionRef = database.collection("sessions").doc(),
        end = start + durationMinutes * 60_000;
      const tutorCalendar = await calendarReservation(tx, user.uid, {
        id: sessionRef.id,
        start,
        end,
      });
      const studentCalendar = await calendarReservation(tx, current.studentId, {
        id: sessionRef.id,
        start,
        end,
      });
      tx.set(tutorCalendar.ref, { slots: tutorCalendar.slots });
      tx.set(studentCalendar.ref, { slots: studentCalendar.slots });
      tx.create(sessionRef, {
        trialId: id,
        tutorId: user.uid,
        studentId: current.studentId,
        start,
        end,
        durationMinutes,
        status: "scheduled",
        confirmations: {},
        createdAt: now(),
      });
      tx.update(trialRef, { status: "scheduled" });
      notify(tx, current.studentId, "Gia sư đã tạo buổi học thử miễn phí.");
      return current;
    });
    return success({ ok: true });
  }

  throw invalid("Thao tác học thử không hợp lệ.");
}
