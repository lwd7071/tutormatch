import { randomInt } from "node:crypto";
import { NextRequest } from "next/server";
import { db } from "../firebase-admin";
import { type Actor, now, requireRole, str } from "../server";
import { conflict, success, unavailable } from "../api-response";
import { createPaymentLink, getPaymentLink, paymentEnabled } from "../payos";
import { applyPaidOrder, saveCheckoutLink } from "../payment-flow";
import { tutorAcceptsNewOrders } from "../tutor-profile";
import { type ActionInput } from "../action-schema";

export async function handleCreateOrder(
  req: NextRequest,
  user: Actor,
  data: Extract<ActionInput, { action: "createOrder" }>,
) {
  const database = db();
  requireRole(user, "student", "tutor");
  if (!paymentEnabled())
    throw unavailable("Thanh toán payOS chưa được bật. Vui lòng thử lại sau.");
  const packageId = str(data.packageId, 100);
  const sourceId = typeof data.renewalOf === "string" ? data.renewalOf : "";
  const requestRef = database.doc(
    `orderAttempts/${user.uid}_${str(data.idempotencyKey, 36)}`,
  );
  let orderCode = 0,
    created = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = Date.now() * 1000 + randomInt(1000);
    const reservation = await database.runTransaction(async (tx) => {
      const previous = (await tx.get(requestRef)).data();
      if (previous) {
        if (previous.packageId !== packageId || previous.sourceId !== sourceId)
          throw conflict("Yêu cầu thanh toán đã dùng cho gói khác.");
        return {
          orderCode: previous.orderCode as number,
          created: false,
          collision: false,
        };
      }
      const pack = (await tx.get(database.doc(`packages/${packageId}`))).data();
      if (!pack?.active) throw conflict("Gói này hiện không mở bán.");
      const [
        subjectSnap,
        tutorSnap,
        tutorUserSnap,
        sourceSnap,
        requestSnap,
        settingsSnap,
        codeSnap,
        registrySnap,
        testSnap,
      ] = await Promise.all([
        tx.get(database.doc(`subjects/${pack.subjectId}`)),
        tx.get(database.doc(`tutors/${pack.tutorId}`)),
        tx.get(database.doc(`users/${pack.tutorId}`)),
        sourceId
          ? tx.get(database.doc(`orders/${sourceId}`))
          : Promise.resolve(null),
        pack.visibility === "private" && pack.requestId
          ? tx.get(database.doc(`packageRequests/${pack.requestId}`))
          : Promise.resolve(null),
        tx.get(database.doc("settings/main")),
        tx.get(database.doc(`orders/${candidate}`)),
        tx.get(database.doc(`paymentCodes/${candidate}`)),
        tx.get(database.doc(`paymentTests/${candidate}`)),
      ]);
      if (codeSnap.exists || registrySnap.exists || testSnap.exists)
        return { orderCode: 0, created: false, collision: true };
      if (subjectSnap.data()?.active !== true)
        throw conflict("Môn học hiện không mở bán.");
      const packageRequest = requestSnap?.data();
      if (pack.visibility === "private" &&
        (!packageRequest || pack.studentId !== user.uid || packageRequest.studentId !== user.uid || packageRequest.tutorId !== pack.tutorId || packageRequest.status !== "offered" || packageRequest.currentOfferId !== packageId))
        throw conflict("Đề nghị gói học không còn hiệu lực.");
      if (
        pack.tutorId === user.uid ||
        !tutorAcceptsNewOrders(
          tutorSnap.data()?.status,
          tutorUserSnap.data()?.blocked === true,
        )
      )
        throw conflict("Gia sư hiện không nhận học viên.");
      const source = sourceSnap?.data();
      if (
        sourceId &&
        (!source ||
          source.studentId !== user.uid ||
          source.packageId !== packageId ||
          !["active", "closed"].includes(source.status))
      )
        throw conflict("Không thể mua tiếp đơn này.");
      const feeRate = Number(settingsSnap.data()?.feeRate ?? 10);
      if (!Number.isInteger(feeRate) || feeRate < 0 || feeRate > 100)
        throw unavailable("Cấu hình phí chưa hợp lệ.");
      tx.create(database.doc(`orders/${candidate}`), {
        studentId: user.uid,
        tutorId: pack.tutorId,
        packageId,
        packageRequestId: packageRequest ? pack.requestId : null,
        title: pack.title,
        subjectId: pack.subjectId,
        price: pack.price,
        count: pack.count,
        durationMinutes: pack.durationMinutes,
        feeRate,
        status: "pending_payment",
        renewal: !!sourceId,
        confirmedCount: 0,
        reservedCount: 0,
        createdAt: now(),
        linkLeaseUntil: now() + 30_000,
      });
      tx.create(database.doc(`paymentCodes/${candidate}`), {
        kind: "order",
        createdAt: now(),
      });
      tx.create(requestRef, {
        orderCode: candidate,
        packageId,
        sourceId,
        studentId: user.uid,
        createdAt: now(),
      });
      return { orderCode: candidate, created: true, collision: false };
    });
    if (reservation.collision) continue;
    orderCode = reservation.orderCode;
    created = reservation.created;
    break;
  }
  if (!orderCode) throw unavailable("Chưa tạo được mã đơn. Vui lòng thử lại.");
  const origin = req.nextUrl.origin;
  const ref = database.doc(`orders/${orderCode}`);
  const order = (await ref.get()).data();
  if (!order || order.studentId !== user.uid)
    throw conflict("Không tìm thấy đơn thanh toán.");
  if (order.status !== "pending_payment")
    return success({ status: order.status });
  if (order.checkoutUrl) return success({ checkoutUrl: order.checkoutUrl });
  if (!created && order.linkLeaseUntil > now())
    throw conflict("Liên kết thanh toán đang được tạo. Vui lòng thử lại sau.");
  if (!created)
    await database.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (
        current?.status !== "pending_payment" ||
        current.checkoutUrl ||
        current.linkLeaseUntil > now()
      )
        throw conflict("Trạng thái thanh toán vừa thay đổi. Vui lòng tải lại.");
      tx.update(ref, { linkLeaseUntil: now() + 30_000 });
    });
  try {
    const existing = created ? null : await getPaymentLink(orderCode);
    if (existing?.status === "PAID") {
      await applyPaidOrder(
        orderCode,
        existing.amountPaid,
        "payos-reconciliation",
      );
      return success({ status: (await ref.get()).data()?.status });
    }
    if (existing && existing.status !== "PENDING")
      throw conflict("Liên kết thanh toán đã đóng. Vui lòng tạo đơn mới.");
    const link =
      existing?.status === "PENDING" && existing.paymentLinkId
        ? {
            checkoutUrl:
              existing.checkoutUrl ||
              `https://pay.payos.vn/web/${existing.paymentLinkId}`,
            paymentLinkId: existing.paymentLinkId,
          }
        : await createPaymentLink({
            orderCode,
            amount: order.price,
            description: "TUTORMAT",
            returnUrl: `${origin}/app?payment=return`,
            cancelUrl: `${origin}/app?payment=cancel`,
          });
    const checkoutUrl = link.checkoutUrl;
    return success(
      await saveCheckoutLink(orderCode, checkoutUrl, link.paymentLinkId || ""),
    );
  } catch (error) {
    if (
      error instanceof Error &&
      "code" in error &&
      error.code === "STATE_CONFLICT"
    )
      throw error;
    try {
      const link = await getPaymentLink(orderCode);
      if (link?.status === "PAID") {
        await applyPaidOrder(
          orderCode,
          link.amountPaid,
          "payos-reconciliation",
        );
        return success({ status: (await ref.get()).data()?.status });
      }
      if (link?.status === "PENDING" && link.paymentLinkId) {
        const checkoutUrl =
          link.checkoutUrl || `https://pay.payos.vn/web/${link.paymentLinkId}`;
        return success(
          await saveCheckoutLink(orderCode, checkoutUrl, link.paymentLinkId),
        );
      }
    } catch (lookupError) {
      console.error("Could not reconcile payment link", {
        orderCode,
        lookupError,
      });
    }
    console.error("Could not create payment link", { orderCode, error });
    throw unavailable(
      "Chưa xác nhận được liên kết thanh toán. Vui lòng thử lại sau.",
    );
  }
}
