import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { mediaCloud } from "@/lib/cloudinary";
import { actor, DAY, fail, integer, now, requireRole, str } from "@/lib/server";
import { moneyForSession } from "@/lib/money";
import { createPaymentLink, paymentEnabled } from "@/lib/payos";
import { approvedTutorUpdate, prepareTutorSubmission, tutorAcceptsNewOrders, tutorFields, type TutorMedia } from "@/lib/tutor-profile";
import { canCancelSession } from "@/lib/public-data";
import { requireRefundBankCorrection, requireRefundBankSubmission } from "@/lib/refund-state";

export const runtime = "nodejs";
type Input = Record<string, unknown>;
type Slot = { id: string; start: number; end: number };
async function calendarReservation(tx: FirebaseFirestore.Transaction, uid: string, slot: Slot) {
  const ref = db().doc(`calendars/${uid}`);
  const current = (await tx.get(ref)).data()?.slots as Slot[] | undefined;
  const slots = (current || []).filter(s => s.end > now());
  if (slots.some(s => slot.start < s.end && slot.end > s.start)) throw new Error("Lịch này trùng với một buổi đã tạo.");
  return { ref, slots: [...slots, slot] };
}
async function notify(userId: string, text: string) {
  await db().collection("notifications").add({ userId, text, at: now() });
}

export async function POST(req: NextRequest) {
  try {
    const user = await actor(req);
    const data = await req.json() as Input;
    const action = str(data.action, 40);
    const database = db();

    if (action === "becomeTutor" || action === "saveTutor") {
      requireRole(user, "student", "tutor");
      const fields = tutorFields(data);
      await database.runTransaction(async tx => {
        const liveRef = database.doc(`tutors/${user.uid}`);
        const submissionRef = database.doc(`tutorSubmissions/${user.uid}`);
        const mediaRef = database.doc(`media/${user.uid}`);
        const [liveSnap, submissionSnap, mediaSnap] = await Promise.all([tx.get(liveRef), tx.get(submissionRef), tx.get(mediaRef)]);
        const live = liveSnap.data(), submission = submissionSnap.data(), media = mediaSnap.data();
        const candidate = prepareTutorSubmission(live, submission, media, fields);
        tx.set(submissionRef, { ...fields, ...candidate, status: "pending", email: user.email, submittedAt: now() });
        tx.set(database.doc(`users/${user.uid}`), { email: user.email, role: "tutor" }, { merge: true });
      });
      return Response.json({ ok: true });
    }

    if (action === "savePackage") {
      requireRole(user, "tutor");
      const tutor = await database.doc(`tutors/${user.uid}`).get();
      if (tutor.data()?.status !== "approved") throw new Error("Hồ sơ cần được duyệt trước khi mở bán gói.");
      const packageId = data.id ? str(data.id, 100) : database.collection("packages").doc().id;
      const ref = database.doc(`packages/${packageId}`);
      const old = await ref.get();
      if (old.exists && old.data()?.tutorId !== user.uid) throw new Error("Bạn không có quyền sửa gói này.");
      const subjectId = str(data.subjectId, 100);
      if ((await database.doc(`subjects/${subjectId}`).get()).data()?.active !== true) throw new Error("Môn học hiện không mở bán.");
      await ref.set({ tutorId: user.uid, title: str(data.title, 100), subjectId, price: integer(data.price, 1000, 100_000_000), count: integer(data.count, 1, 100), durationMinutes: integer(data.durationMinutes, 15, 240), mode: data.mode === "both" ? "both" : data.mode === "offline" ? "offline" : "online", active: data.active === true, updatedAt: now() }, { merge: true });
      return Response.json({ ok: true, id: packageId });
    }

    if (action === "togglePackage") {
      requireRole(user, "tutor");
      const ref = database.doc(`packages/${str(data.id, 100)}`), pack = (await ref.get()).data();
      if (!pack || pack.tutorId !== user.uid) throw new Error("Không tìm thấy gói học của bạn.");
      if (!pack.active) {
        if ((await database.doc(`tutors/${user.uid}`).get()).data()?.status !== "approved") throw new Error("Hồ sơ cần được duyệt để mở bán.");
        if ((await database.doc(`subjects/${pack.subjectId}`).get()).data()?.active !== true) throw new Error("Môn học hiện không mở bán.");
      }
      await ref.update({ active: !pack.active, updatedAt: now() });
      return Response.json({ ok: true });
    }

    if (action === "createOrder") {
      requireRole(user, "student", "tutor");
      if (!paymentEnabled()) throw new Error("Thanh toán payOS chưa được bật. Vui lòng thử lại sau.");
      const packageId = str(data.packageId, 100);
      const pack = (await database.doc(`packages/${packageId}`).get()).data();
      if (!pack?.active) throw new Error("Gói này hiện không mở bán.");
      if ((await database.doc(`subjects/${pack.subjectId}`).get()).data()?.active !== true) throw new Error("Môn học hiện không mở bán.");
      if (pack.tutorId === user.uid) throw new Error("Bạn không thể mua gói của chính mình.");
      const [tutorSnap, tutorUserSnap] = await Promise.all([database.doc(`tutors/${pack.tutorId}`).get(), database.doc(`users/${pack.tutorId}`).get()]);
      if (!tutorAcceptsNewOrders(tutorSnap.data()?.status, tutorUserSnap.data()?.blocked === true)) throw new Error("Gia sư hiện không nhận học viên.");
      const sourceId = typeof data.renewalOf === "string" ? data.renewalOf : "";
      let renewal = false;
      if (sourceId) {
        const source = (await database.doc(`orders/${sourceId}`).get()).data();
        if (!source || source.studentId !== user.uid || source.packageId !== packageId || !["active", "closed"].includes(source.status)) throw new Error("Không thể mua tiếp đơn này.");
        renewal = true;
      }
      const settings = (await database.doc("settings/main").get()).data();
      const feeRate = Number(settings?.feeRate ?? 10);
      const orderCode = Date.now() * 100 + Math.floor(Math.random() * 100);
      const origin = req.nextUrl.origin;
      const ref = database.doc(`orders/${orderCode}`);
      await ref.create({ studentId: user.uid, tutorId: pack.tutorId, packageId, title: pack.title, subjectId: pack.subjectId, price: pack.price, count: pack.count, durationMinutes: pack.durationMinutes, feeRate, status: "pending_payment", renewal, confirmedCount: 0, reservedCount: 0, createdAt: now() });
      try {
        const checkoutUrl = await createPaymentLink({ orderCode, amount: pack.price, description: "TUTORMAT", returnUrl: `${origin}/app?payment=return`, cancelUrl: `${origin}/app?payment=cancel` });
        await ref.update({ checkoutUrl });
        return Response.json({ ok: true, checkoutUrl });
      } catch (error) {
        await ref.update({ status: "payment_error" });
        throw error;
      }
    }

    if (action === "decideOrder") {
      requireRole(user, "tutor");
      const id = str(data.id, 100), accept = data.accept === true;
      const ref = database.doc(`orders/${id}`);
      await database.runTransaction(async tx => {
        const snap = await tx.get(ref); const order = snap.data();
        if (!order || order.tutorId !== user.uid || order.status !== "pending_tutor") throw new Error("Đơn không còn chờ phản hồi.");
        if (now() > order.decisionDue) throw new Error("Đơn đã quá hạn phản hồi.");
        tx.update(ref, { status: accept ? "active" : "refund_pending", decidedAt: now() });
        if (!accept) tx.create(database.doc(`refunds/order_${id}`), { orderId: id, studentId: order.studentId, amount: order.price, status: "needs_details", source: "tutor_rejected", reason: "Gia sư từ chối đơn", at: now() });
      });
      const order = (await ref.get()).data()!;
      await notify(order.studentId, accept ? "Gia sư đã nhận đơn. Bạn có thể thống nhất lịch học." : "Gia sư không nhận đơn. Admin sẽ hoàn toàn bộ tiền.");
      return Response.json({ ok: true });
    }

    if (action === "createSession") {
      requireRole(user, "tutor");
      const orderId = str(data.orderId, 100), start = Number(data.start);
      if (!Number.isFinite(start) || start < now() + 60_000) throw new Error("Giờ bắt đầu cần ở tương lai.");
      const orderRef = database.doc(`orders/${orderId}`);
      const sessionRef = database.collection("sessions").doc();
      await database.runTransaction(async tx => {
        const snap = await tx.get(orderRef); const order = snap.data();
        if (!order || order.tutorId !== user.uid || order.status !== "active") throw new Error("Gói chưa sẵn sàng để lên lịch.");
        if (order.confirmedCount + order.reservedCount >= order.count) throw new Error("Gói đã hết buổi.");
        const end = start + order.durationMinutes * 60_000;
        const tutorCalendar = await calendarReservation(tx, user.uid, { id: sessionRef.id, start, end });
        const studentCalendar = await calendarReservation(tx, order.studentId, { id: sessionRef.id, start, end });
        tx.update(orderRef, { reservedCount: order.reservedCount + 1 });
        tx.set(tutorCalendar.ref, { slots: tutorCalendar.slots });
        tx.set(studentCalendar.ref, { slots: studentCalendar.slots });
        tx.create(sessionRef, { orderId, tutorId: user.uid, studentId: order.studentId, start, end, durationMinutes: order.durationMinutes, status: "scheduled", confirmations: {}, createdAt: now() });
      });
      const session = (await sessionRef.get()).data()!;
      await notify(session.studentId, "Gia sư đã tạo buổi học mới. Hãy xem lịch học của bạn.");
      return Response.json({ ok: true, id: sessionRef.id });
    }

    if (action === "confirmSession") {
      const id = str(data.id, 100), answer = data.answer;
      if (answer !== "yes" && answer !== "no") throw new Error("Vui lòng chọn kết quả buổi học.");
      const ref = database.doc(`sessions/${id}`);
      await database.runTransaction(async tx => {
        const snap = await tx.get(ref); const session = snap.data();
        if (!session || ![session.studentId, session.tutorId].includes(user.uid)) throw new Error("Không tìm thấy buổi học.");
        if (session.status !== "scheduled" || now() < session.end || now() > session.end + DAY) throw new Error("Buổi học không còn trong thời hạn xác nhận.");
        const key = user.uid === session.studentId ? "student" : "tutor";
        if (session.confirmations?.[key]) throw new Error("Bạn đã xác nhận buổi này.");
        const confirmations = { ...session.confirmations, [key]: answer };
        if (!confirmations.student || !confirmations.tutor) { tx.update(ref, { confirmations }); return; }
        if (confirmations.student === "no" && confirmations.tutor === "no") {
          if (session.trialId) { tx.update(ref, { confirmations, status: "cancelled" }); tx.update(database.doc(`trials/${session.trialId}`), { status: "cancelled" }); return; }
          const orderRef = database.doc(`orders/${session.orderId}`), order = (await tx.get(orderRef)).data();
          if (!order) throw new Error("Không tìm thấy gói học.");
          tx.update(ref, { confirmations, status: "cancelled" });
          tx.update(orderRef, { reservedCount: order.reservedCount - 1 });
          return;
        }
        if (confirmations.student !== "yes" || confirmations.tutor !== "yes") { tx.update(ref, { confirmations, status: "dispute" }); return; }
        if (session.trialId) { tx.update(ref, { confirmations, status: "confirmed", confirmedAt: now() }); tx.update(database.doc(`trials/${session.trialId}`), { status: "completed" }); return; }
        const orderRef = database.doc(`orders/${session.orderId}`);
        const orderSnap = await tx.get(orderRef); const order = orderSnap.data();
        if (!order || order.status !== "active" || order.confirmedCount >= order.count) throw new Error("Gói không còn hợp lệ.");
        const index = order.confirmedCount + 1;
        const gross = moneyForSession(order.price, order.count, index);
        const fee = moneyForSession(Math.floor(order.price * order.feeRate / 100), order.count, index);
        const walletRef = database.doc(`wallets/${session.tutorId}`);
        const walletSnap = await tx.get(walletRef);
        tx.update(orderRef, { confirmedCount: index, reservedCount: order.reservedCount - 1, status: index === order.count && order.reservedCount === 1 ? "closed" : "active" });
        tx.update(ref, { confirmations, status: "confirmed", gross, fee, tutorAmount: gross - fee, confirmedAt: now() });
        tx.set(walletRef, { available: (walletSnap.data()?.available || 0) + gross - fee, pending: walletSnap.data()?.pending || 0 }, { merge: true });
        tx.create(database.doc(`ledger/session_${id}`), { type: "lesson", sessionId: id, orderId: session.orderId, gross, fee, tutorAmount: gross - fee, at: now() });
      });
      return Response.json({ ok: true });
    }

    if (action === "cancelSession") {
      requireRole(user, "tutor");
      const id = str(data.id, 100), ref = database.doc(`sessions/${id}`);
      await database.runTransaction(async tx => {
        const snap = await tx.get(ref); const session = snap.data();
        if (!session || session.tutorId !== user.uid || !canCancelSession(session, now())) throw new Error("Chỉ có thể hủy buổi học trước giờ bắt đầu. Sau đó hãy dùng xác nhận hoặc nhờ admin xử lý.");
        const orderRef = session.orderId ? database.doc(`orders/${session.orderId}`) : null;
        const order = orderRef ? (await tx.get(orderRef)).data() : null;
        const tutorCalendarRef = database.doc(`calendars/${session.tutorId}`), studentCalendarRef = database.doc(`calendars/${session.studentId}`);
        const tutorCalendar = (await tx.get(tutorCalendarRef)).data(), studentCalendar = (await tx.get(studentCalendarRef)).data();
        if (orderRef && !order) throw new Error("Không tìm thấy gói học.");
        tx.update(ref, { status: "cancelled", cancelledAt: now(), cancelReason: typeof data.reason === "string" ? data.reason.slice(0, 500) : "" });
        tx.set(tutorCalendarRef, { slots: ((tutorCalendar?.slots || []) as Slot[]).filter(s => s.id !== id) });
        tx.set(studentCalendarRef, { slots: ((studentCalendar?.slots || []) as Slot[]).filter(s => s.id !== id) });
        if (session.trialId) tx.update(database.doc(`trials/${session.trialId}`), { status: "cancelled" });
        if (orderRef && order) tx.update(orderRef, { reservedCount: Math.max(0, order.reservedCount - 1) });
      });
      const session = (await ref.get()).data()!;
      await notify(session.studentId, "Gia sư đã hủy buổi học. Lượt học của bạn không bị trừ.");
      return Response.json({ ok: true });
    }

    if (action === "requestRefund") {
      requireRole(user, "student", "tutor");
      const id = str(data.orderId, 100), order = (await database.doc(`orders/${id}`).get()).data();
      if (!order || order.studentId !== user.uid || order.status !== "active" || order.reservedCount !== 0) throw new Error("Hãy hủy các buổi đã đặt trước khi yêu cầu hoàn tiền.");
      await database.runTransaction(async tx => {
        const ref = database.doc(`orders/${id}`), snap = await tx.get(ref);
        const current = snap.data();
        if (current?.status !== "active" || current.reservedCount !== 0) throw new Error("Trạng thái gói đã thay đổi.");
        const amount = current.price - Array.from({ length: current.confirmedCount }, (_, i) => moneyForSession(current.price, current.count, i + 1)).reduce((a, b) => a + b, 0);
        if (amount <= 0) throw new Error("Gói không còn tiền để hoàn.");
        tx.update(ref, { status: "refund_pending" });
        tx.create(database.doc(`refunds/order_${id}`), { orderId: id, studentId: user.uid, amount, status: "needs_details", source: "student", reason: typeof data.reason === "string" ? data.reason.slice(0, 500) : "Học viên yêu cầu hoàn tiền", at: now() });
      });
      return Response.json({ ok: true });
    }

    if (action === "setRefundBank") {
      const id = str(data.id, 100), ref = database.doc(`refunds/${id}`);
      const bankName = str(data.bankName, 100), bankAccount = str(data.bankAccount, 50), accountHolder = str(data.accountHolder, 100);
      await database.runTransaction(async tx => {
        const refund = (await tx.get(ref)).data();
        requireRefundBankSubmission(refund, user.uid);
        tx.update(ref, { bankName, bankAccount, accountHolder, status: "pending", bankCorrectionReason: FieldValue.delete(), updatedAt: now() });
      });
      return Response.json({ ok: true });
    }

    if (action === "requestWithdrawal") {
      requireRole(user, "tutor");
      const amount = integer(data.amount, 1000, 100_000_000);
      const bankName = str(data.bankName, 100), bankAccount = str(data.bankAccount, 50);
      await database.runTransaction(async tx => {
        const ref = database.doc(`wallets/${user.uid}`), wallet = (await tx.get(ref)).data();
        if (!wallet || wallet.available < amount) throw new Error("Số dư có thể rút không đủ.");
        tx.update(ref, { available: wallet.available - amount, pending: (wallet.pending || 0) + amount });
        tx.create(database.collection("withdrawals").doc(), { tutorId: user.uid, amount, bankName, bankAccount, status: "pending", at: now() });
      });
      return Response.json({ ok: true });
    }

    if (action === "sendMessage") {
      const threadId = str(data.threadId, 220);
      const isTrial = threadId.startsWith("trial:");
      const thread = isTrial ? (await database.doc(`trials/${threadId.slice(6)}`).get()).data() : (await database.doc(`orders/${threadId}`).get()).data();
      if (!thread || ![thread.studentId, thread.tutorId].includes(user.uid) || (!isTrial && thread.status === "pending_payment")) throw new Error("Bạn chưa thể nhắn tin trong cuộc trò chuyện này.");
      await database.collection("messages").add({ threadId, participants: [thread.studentId, thread.tutorId], senderId: user.uid, text: str(data.text, 2000), at: now() });
      await notify(user.uid === thread.studentId ? thread.tutorId : thread.studentId, "Bạn có tin nhắn mới.");
      return Response.json({ ok: true });
    }

    if (action === "requestTrial") {
      const tutorId = str(data.tutorId, 100);
      const [tutorSnap, tutorUserSnap] = await Promise.all([database.doc(`tutors/${tutorId}`).get(), database.doc(`users/${tutorId}`).get()]);
      if (!tutorAcceptsNewOrders(tutorSnap.data()?.status, tutorUserSnap.data()?.blocked === true) || tutorId === user.uid) throw new Error("Gia sư chưa sẵn sàng nhận học thử.");
      const id = `${user.uid}_${tutorId}`;
      await database.doc(`trials/${id}`).create({ studentId: user.uid, tutorId, status: "requested", message: typeof data.message === "string" ? data.message.slice(0, 500) : "", at: now() });
      await notify(tutorId, "Có học viên yêu cầu học thử miễn phí.");
      return Response.json({ ok: true });
    }

    if (action === "decideTrial") {
      requireRole(user, "tutor");
      const id = str(data.id, 220), ref = database.doc(`trials/${id}`), trial = (await ref.get()).data();
      if (!trial || trial.tutorId !== user.uid || trial.status !== "requested") throw new Error("Yêu cầu học thử không hợp lệ.");
      const accept = data.accept === true;
      await ref.update({ status: accept ? "accepted" : "rejected", decidedAt: now() });
      await notify(trial.studentId, accept ? "Gia sư đã nhận buổi học thử. Hãy thống nhất lịch học." : "Gia sư chưa thể nhận buổi học thử.");
      return Response.json({ ok: true });
    }

    if (action === "createTrialSession") {
      requireRole(user, "tutor");
      const id = str(data.id, 220), start = Number(data.start);
      if (!Number.isFinite(start) || start < now() + 60_000) throw new Error("Lịch học thử không hợp lệ.");
      const durationMinutes = integer(data.durationMinutes, 15, 120);
      const trialRef = database.doc(`trials/${id}`);
      const trial = await database.runTransaction(async tx => {
        const current = (await tx.get(trialRef)).data();
        if (!current || current.tutorId !== user.uid || current.status !== "accepted") throw new Error("Yêu cầu học thử không hợp lệ.");
        const sessionRef = database.collection("sessions").doc(), end = start + durationMinutes * 60_000;
        const tutorCalendar = await calendarReservation(tx, user.uid, { id: sessionRef.id, start, end });
        const studentCalendar = await calendarReservation(tx, current.studentId, { id: sessionRef.id, start, end });
        tx.set(tutorCalendar.ref, { slots: tutorCalendar.slots });
        tx.set(studentCalendar.ref, { slots: studentCalendar.slots });
        tx.create(sessionRef, { trialId: id, tutorId: user.uid, studentId: current.studentId, start, end, durationMinutes, status: "scheduled", confirmations: {}, createdAt: now() });
        tx.update(trialRef, { status: "scheduled" });
        return current;
      });
      await notify(trial.studentId, "Gia sư đã tạo buổi học thử miễn phí.");
      return Response.json({ ok: true });
    }

    if (action === "reviewTutor") {
      requireRole(user, "student", "tutor");
      const orderId = str(data.orderId, 100), order = (await database.doc(`orders/${orderId}`).get()).data();
      if (!order || order.studentId !== user.uid || order.confirmedCount < 1) throw new Error("Bạn cần hoàn thành một buổi trả phí để đánh giá.");
      await database.doc(`reviews/${orderId}`).create({ orderId, tutorId: order.tutorId, studentId: user.uid, stars: integer(data.stars, 1, 5), text: str(data.text, 1000), at: now(), status: "visible" });
      return Response.json({ ok: true });
    }

    if (action === "admin") {
      requireRole(user, "admin");
      const kind = str(data.kind, 40), id = typeof data.id === "string" ? data.id : "";
      if (kind === "subject") { const name = str(data.name, 80); await database.collection("subjects").add({ name, active: true }); }
      else if (kind === "toggleSubject") {
        const ref = database.doc(`subjects/${str(id, 100)}`), subject = (await ref.get()).data();
        if (!subject) throw new Error("Không tìm thấy môn học.");
        await ref.update({ active: !subject.active });
      }
      else if (kind === "fee") { await database.doc("settings/main").set({ feeRate: integer(data.feeRate, 0, 100) }, { merge: true }); }
      else if (kind === "approveTutor" || kind === "rejectTutor") {
        const uid = str(id, 100), reason = kind === "rejectTutor" ? str(data.reason, 500) : "";
        let verifiedPhoto = "", verifiedDocument = "";
        if (kind === "approveTutor") {
          const [liveSnap, submissionSnap, mediaSnap] = await Promise.all([database.doc(`tutors/${uid}`).get(), database.doc(`tutorSubmissions/${uid}`).get(), database.doc(`media/${uid}`).get()]);
          const candidate = submissionSnap.data() || (liveSnap.data()?.status === "pending" ? { ...liveSnap.data(), photo: mediaSnap.data()?.photo, document: mediaSnap.data()?.document } : null);
          if (!candidate || candidate.status !== "pending" || !candidate.photo || !candidate.document) throw new Error("Hồ sơ cần ảnh chân dung và giấy tờ hợp lệ trước khi duyệt.");
          const cloud = mediaCloud();
          for (const asset of [candidate.photo, candidate.document] as TutorMedia[]) {
            const url = cloud.url(asset.publicId, { resource_type: asset.resourceType, type: "authenticated", format: asset.resourceType === "image" ? asset.format : undefined, sign_url: true });
            if (!(await fetch(url, { method: "HEAD" })).ok) throw new Error("Không mở được ảnh hoặc giấy tờ. Hãy yêu cầu gia sư tải lại tệp.");
          }
          verifiedPhoto = candidate.photo.publicId;
          verifiedDocument = candidate.document.publicId;
        }
        const previous = await database.runTransaction(async tx => {
          const liveRef = database.doc(`tutors/${uid}`), submissionRef = database.doc(`tutorSubmissions/${uid}`), mediaRef = database.doc(`media/${uid}`), userRef = database.doc(`users/${uid}`);
          const [liveSnap, submissionSnap, mediaSnap, tutorUserSnap] = await Promise.all([tx.get(liveRef), tx.get(submissionRef), tx.get(mediaRef), tx.get(userRef)]);
          const live = liveSnap.data(), submission = submissionSnap.data(), media = mediaSnap.data();
          const candidate = submission || (live?.status === "pending" ? { ...live, photo: media?.photo, document: media?.document } : null);
          if (!candidate || candidate.status !== "pending") throw new Error("Hồ sơ không còn chờ duyệt.");
          if (kind === "rejectTutor") {
            tx.set(submissionRef, { ...candidate, status: "rejected", reviewReason: reason, reviewedAt: now(), reviewedBy: user.uid });
            if (!submission && liveSnap.exists) tx.update(liveRef, { status: "rejected", reviewedAt: now() });
            return null;
          }
          if (!candidate.photo || !candidate.document) throw new Error("Cần ảnh chân dung và giấy tờ xác minh trước khi duyệt.");
          if (candidate.photo.publicId !== verifiedPhoto || candidate.document.publicId !== verifiedDocument) throw new Error("Hồ sơ vừa thay đổi. Vui lòng mở lại bản gửi duyệt.");
          const version = now();
          const approved = approvedTutorUpdate(candidate, live, uid, version);
          tx.set(liveRef, { ...approved, status: tutorUserSnap.data()?.blocked === true ? "suspended" : approved.status }, { merge: true });
          tx.set(mediaRef, { photo: candidate.photo, document: candidate.document, stagedPhoto: FieldValue.delete(), stagedDocument: FieldValue.delete() }, { merge: true });
          if (submission) tx.delete(submissionRef);
          return { oldPhoto: media?.photo as TutorMedia | undefined, oldDocument: media?.document as TutorMedia | undefined, photo: candidate.photo as TutorMedia, document: candidate.document as TutorMedia };
        });
        if (previous) try {
          const cloud = mediaCloud();
          for (const [oldAsset, newAsset] of [[previous.oldPhoto, previous.photo], [previous.oldDocument, previous.document]] as [TutorMedia | undefined, TutorMedia][]) {
            if (oldAsset && oldAsset.publicId !== newAsset.publicId) await cloud.uploader.destroy(oldAsset.publicId, { resource_type: oldAsset.resourceType, type: "authenticated", invalidate: true });
          }
        } catch (error) { console.error("Could not remove previous tutor media", error); }
        await notify(uid, kind === "approveTutor" ? "Hồ sơ gia sư đã được duyệt." : `Hồ sơ gia sư chưa được duyệt: ${reason}`);
      }
      else if (kind === "suspendTutor" || kind === "restoreTutor") {
        const uid = str(id, 100), ref = database.doc(`tutors/${uid}`), userRef = database.doc(`users/${uid}`);
        await database.runTransaction(async tx => {
          const [tutorSnap, userSnap] = await Promise.all([tx.get(ref), tx.get(userRef)]);
          const status = tutorSnap.data()?.status;
          if (status !== (kind === "suspendTutor" ? "approved" : "suspended")) throw new Error("Trạng thái hồ sơ đã thay đổi.");
          if (kind === "restoreTutor" && userSnap.data()?.blocked === true) throw new Error("Cần mở khóa tài khoản trước khi khôi phục hồ sơ.");
          tx.update(ref, { status: kind === "suspendTutor" ? "suspended" : "approved", updatedAt: now() });
        });
        await notify(uid, kind === "suspendTutor" ? "Hồ sơ gia sư đã được tạm ẩn." : "Hồ sơ gia sư đã được khôi phục.");
      }
      else if (kind === "blockUser" || kind === "unblockUser") {
        const uid = str(id, 128);
        if (uid === user.uid) throw new Error("Bạn không thể khóa chính mình.");
        await database.runTransaction(async tx => {
          const userRef = database.doc(`users/${uid}`), tutorRef = database.doc(`tutors/${uid}`);
          const [userSnap, tutorSnap] = await Promise.all([tx.get(userRef), tx.get(tutorRef)]);
          if (!userSnap.exists) throw new Error("Không tìm thấy người dùng.");
          tx.set(userRef, { blocked: kind === "blockUser", updatedAt: now() }, { merge: true });
          if (kind === "blockUser" && tutorSnap.data()?.status === "approved") tx.update(tutorRef, { status: "suspended", updatedAt: now() });
        });
      }
      else if (kind === "hideReview" || kind === "showReview") {
        const ref = database.doc(`reviews/${str(id, 100)}`);
        if (!(await ref.get()).exists) throw new Error("Không tìm thấy đánh giá.");
        await ref.update({ status: kind === "hideReview" ? "hidden" : "visible", moderatedAt: now() });
      }
      else if (kind === "refundComplete") {
        const ref = database.doc(`refunds/${str(id, 100)}`), refund = (await ref.get()).data();
        if (!refund || refund.status !== "pending" || !refund.bankAccount || !refund.accountHolder) throw new Error("Học viên chưa cung cấp đủ tài khoản nhận hoàn tiền.");
        const reference = str(data.reference, 100);
        await database.runTransaction(async tx => {
          const current = (await tx.get(ref)).data(); if (current?.status !== "pending") throw new Error("Yêu cầu đã được xử lý.");
          tx.update(ref, { status: "completed", reference, completedAt: now() });
          tx.update(database.doc(`orders/${refund.orderId}`), { status: "refunded" });
          tx.create(database.doc(`ledger/refund_${id}`), { type: "refund", orderId: refund.orderId, amount: refund.amount, reference, at: now() });
        });
        await notify(refund.studentId, "Khoản hoàn tiền đã được chuyển khoản.");
      }
      else if (kind === "refundReject") {
        const ref = database.doc(`refunds/${str(id, 100)}`), reason = str(data.reason, 500);
        const refund = await database.runTransaction(async tx => {
          const current = (await tx.get(ref)).data();
          if (!current || !["pending", "needs_details"].includes(current.status) || current.source !== "student") throw new Error("Yêu cầu này không thể từ chối.");
          const orderRef = database.doc(`orders/${current.orderId}`), order = (await tx.get(orderRef)).data();
          if (order?.status !== "refund_pending") throw new Error("Trạng thái gói đã thay đổi.");
          tx.update(ref, { status: "rejected", adminReason: reason, decidedAt: now() });
          tx.update(orderRef, { status: "active" });
          return current;
        });
        await notify(refund.studentId, "Yêu cầu hoàn tiền chưa được duyệt. Xem lý do trong mục Hoàn tiền.");
      }
      else if (kind === "requestRefundBankCorrection") {
        const ref = database.doc(`refunds/${str(id, 100)}`), reason = str(data.reason, 500);
        const refund = await database.runTransaction(async tx => {
          const current = (await tx.get(ref)).data();
          requireRefundBankCorrection(current);
          tx.update(ref, { status: "needs_details", bankName: FieldValue.delete(), bankAccount: FieldValue.delete(), accountHolder: FieldValue.delete(), bankCorrectionReason: reason, updatedAt: now() });
          return current;
        });
        await notify(refund.studentId, `Vui lòng sửa tài khoản nhận hoàn tiền: ${reason}`);
      }
      else if (kind === "withdrawalComplete" || kind === "withdrawalReject") {
        const ref = database.doc(`withdrawals/${str(id, 100)}`), reference = kind === "withdrawalComplete" ? str(data.reference, 100) : "";
        await database.runTransaction(async tx => {
          const snap = await tx.get(ref), withdrawal = snap.data();
          if (!withdrawal || withdrawal.status !== "pending") throw new Error("Yêu cầu rút tiền không hợp lệ.");
          const walletRef = database.doc(`wallets/${withdrawal.tutorId}`), wallet = (await tx.get(walletRef)).data();
          tx.update(ref, { status: kind === "withdrawalComplete" ? "completed" : "rejected", reference, completedAt: now() });
          tx.update(walletRef, { pending: (wallet?.pending || 0) - withdrawal.amount, available: (wallet?.available || 0) + (kind === "withdrawalReject" ? withdrawal.amount : 0) });
          if (kind === "withdrawalComplete") tx.create(database.doc(`ledger/withdrawal_${id}`), { type: "withdrawal", tutorId: withdrawal.tutorId, amount: withdrawal.amount, reference, at: now() });
        });
      }
      else if (kind === "resolveSession") {
        const sessionRef = database.doc(`sessions/${str(id, 100)}`), taught = data.taught === true;
        await database.runTransaction(async tx => {
          const session = (await tx.get(sessionRef)).data();
          if (!session || session.status !== "dispute") throw new Error("Buổi học không còn chờ xử lý.");
          const reason = str(data.reason, 500);
          if (session.trialId) { tx.update(sessionRef, { status: taught ? "confirmed" : "cancelled", adminReason: reason, resolvedAt: now() }); tx.update(database.doc(`trials/${session.trialId}`), { status: taught ? "completed" : "cancelled" }); return; }
          const orderRef = database.doc(`orders/${session.orderId}`), order = (await tx.get(orderRef)).data();
          if (!order) throw new Error("Không tìm thấy gói học.");
          if (!taught) { tx.update(sessionRef, { status: "cancelled", adminReason: reason, resolvedAt: now() }); tx.update(orderRef, { reservedCount: order.reservedCount - 1 }); return; }
          const walletRef = database.doc(`wallets/${session.tutorId}`), wallet = (await tx.get(walletRef)).data();
          const index = order.confirmedCount + 1, gross = moneyForSession(order.price, order.count, index), fee = moneyForSession(Math.floor(order.price * order.feeRate / 100), order.count, index);
          tx.update(orderRef, { confirmedCount: index, reservedCount: order.reservedCount - 1, status: index === order.count && order.reservedCount === 1 ? "closed" : "active" });
          tx.update(sessionRef, { status: "confirmed", adminReason: reason, resolvedAt: now(), gross, fee, tutorAmount: gross - fee });
          tx.set(walletRef, { available: (wallet?.available || 0) + gross - fee, pending: wallet?.pending || 0 }, { merge: true });
          tx.create(database.doc(`ledger/session_${id}`), { type: "lesson", sessionId: id, orderId: session.orderId, gross, fee, tutorAmount: gross - fee, at: now(), resolvedBy: user.uid });
        });
        const session = (await sessionRef.get()).data()!;
        await Promise.all([notify(session.studentId, "Admin đã xử lý buổi học có tranh chấp."), notify(session.tutorId, "Admin đã xử lý buổi học có tranh chấp.")]);
      }
      else throw new Error("Thao tác admin không hợp lệ.");
      return Response.json({ ok: true });
    }
    throw new Error("Thao tác không hợp lệ.");
  } catch (error) { return fail(error); }
}
