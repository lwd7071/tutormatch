import { z } from "zod";
import { invalid } from "./api-response.ts";
import { REVIEW_TAG_IDS } from "./review-tags.ts";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().trim().max(max).optional();
const id = text(128).regex(/^[A-Za-z0-9_-]+$/);
const amount = (min: number, max: number) => z.number().int().min(min).max(max);
const start = z.number().int().finite().positive();

const tutor = z.strictObject({
  name: text(80),
  bio: text(2000),
  mode: z.enum(["online", "offline", "both"]),
  location: optionalText(120),
  availability: optionalText(500),
  provinceCode: optionalText(2),
  wardCode: optionalText(5),
  videoUrl: optionalText(500),
});
const admin = z.discriminatedUnion("kind", [
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("subject"),
    name: text(80),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("toggleSubject"),
    id,
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("fee"),
    feeRate: amount(0, 100),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("matchFormUrl"),
    url: z.string().trim().max(500).refine((value) => {
      if (!value) return true;
      try {
        const url = new URL(value);
        return url.protocol === "https:" && url.hostname === "docs.google.com" && url.pathname.startsWith("/forms/");
      } catch {
        return false;
      }
    }, "Chỉ nhận link Google Forms hợp lệ."),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("approveTutor"),
    id,
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("rejectTutor"),
    id,
    reason: text(500),
  }),
  ...(
    [
      "suspendTutor",
      "restoreTutor",
      "blockUser",
      "unblockUser",
      "hideReview",
      "showReview",
      "withdrawalReject",
    ] as const
  ).map((kind) =>
    z.strictObject({ action: z.literal("admin"), kind: z.literal(kind), id }),
  ),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("refundComplete"),
    id,
    reference: text(100),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("refundReject"),
    id,
    reason: text(500),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("requestRefundBankCorrection"),
    id,
    reason: text(500),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("withdrawalComplete"),
    id,
    reference: text(100),
  }),
  z.strictObject({
    action: z.literal("admin"),
    kind: z.literal("resolveSession"),
    id,
    taught: z.boolean(),
    reason: text(500),
  }),
]);

const actions = z.discriminatedUnion("action", [
  z.strictObject({ action: z.literal("becomeTutor"), ...tutor.shape }),
  z.strictObject({ action: z.literal("saveTutor"), ...tutor.shape }),
  z.strictObject({
    action: z.literal("savePackage"),
    id: id.optional(),
    subjectId: id,
    title: text(100),
    price: amount(1000, 100_000_000),
    count: amount(1, 100),
    durationMinutes: amount(15, 240),
    mode: z.enum(["online", "offline", "both"]),
    active: z.boolean(),
  }),
  z.strictObject({ action: z.literal("togglePackage"), id }),
  z.strictObject({
    action: z.literal("createOrder"),
    packageId: id,
    renewalOf: id.optional(),
    idempotencyKey: z.uuid(),
  }),
  z.strictObject({
    action: z.literal("requestPackage"),
    tutorId: id,
    subjectId: id,
    purpose: text(300),
    topics: text(1000),
    count: amount(1, 100),
    durationMinutes: amount(15, 240),
    mode: z.enum(["online", "offline"]),
    timePreference: text(500),
    note: optionalText(1000),
  }),
  z.strictObject({ action: z.literal("declinePackageOffer"), id }),
  z.strictObject({ action: z.literal("declinePackageRequest"), id }),
  z.strictObject({
    action: z.literal("offerPackage"),
    id,
    title: text(100),
    subjectId: id,
    price: amount(1000, 100_000_000),
    count: amount(1, 100),
    durationMinutes: amount(15, 240),
    mode: z.enum(["online", "offline"]),
  }),
  z.strictObject({ action: z.literal("decideOrder"), id, accept: z.boolean() }),
  z.strictObject({ action: z.literal("createSession"), orderId: id, start }),
  z.strictObject({
    action: z.literal("confirmSession"),
    id,
    answer: z.enum(["yes", "no"]),
  }),
  z.strictObject({
    action: z.literal("cancelSession"),
    id,
    reason: optionalText(500),
  }),
  z.strictObject({
    action: z.literal("requestRefund"),
    orderId: id,
    reason: optionalText(500),
  }),
  z.strictObject({
    action: z.literal("setRefundBank"),
    id,
    bankName: text(100),
    bankAccount: text(50),
    accountHolder: text(100),
  }),
  z.strictObject({
    action: z.literal("requestWithdrawal"),
    amount: amount(1000, 100_000_000),
    bankName: text(100),
    bankAccount: text(50),
  }),
  z.strictObject({
    action: z.literal("sendMessage"),
    threadId: text(220).regex(/^(?:[A-Za-z0-9_-]+|trial:[A-Za-z0-9_-]+)$/),
    text: text(2000),
  }),
  z.strictObject({
    action: z.literal("requestTrial"),
    tutorId: id,
    start: start.optional(),
    message: optionalText(500),
  }),
  z.strictObject({ action: z.literal("decideTrial"), id, accept: z.boolean() }),
  z.strictObject({
    action: z.literal("saveAvailability"),
    weeklySlots: z
      .array(
        z.strictObject({
          day: amount(0, 6),
          start: amount(0, 1440),
          end: amount(0, 1440),
        }),
      )
      .max(28),
    exceptions: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60),
  }),
  z.strictObject({
    action: z.literal("setFavorites"),
    tutorIds: z.array(id).max(20),
  }),
  z.strictObject({
    action: z.literal("createTrialSession"),
    id,
    start,
    durationMinutes: amount(15, 120),
  }),
  z.strictObject({
    action: z.literal("reviewTutor"),
    orderId: id,
    stars: amount(1, 5),
    text: text(1000),
    tags: z
      .array(z.enum(REVIEW_TAG_IDS))
      .max(3)
      .refine((tags) => new Set(tags).size === tags.length, "Hashtag không được trùng.")
      .optional(),
  }),
]);

export const actionSchema = z.union([actions, admin]);

export type ActionInput = z.infer<typeof actionSchema>;

export async function parseActionRequest(req: Request): Promise<ActionInput> {
  if (Number(req.headers.get("content-length") || 0) > 32_768)
    throw invalid("Yêu cầu quá lớn.");
  const body = await req.text();
  if (new TextEncoder().encode(body).length > 32_768)
    throw invalid("Yêu cầu quá lớn.");
  let value: unknown;
  try {
    value = JSON.parse(body);
  } catch {
    throw invalid("JSON không hợp lệ.");
  }
  return actionSchema.parse(value);
}
