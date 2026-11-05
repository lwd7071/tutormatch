import { createHash } from "node:crypto";
import { db } from "./firebase-admin";
import { ApiError } from "./api-response";

export async function rateLimit(scope: string, identity: string, limit: number, windowMs: number) {
  const key = createHash("sha256").update(identity).digest("hex").slice(0, 32);
  const ref = db().doc(`rateLimits/${scope}_${key}`);
  const timestamp = Date.now();
  await db().runTransaction(async tx => {
    const current = (await tx.get(ref)).data();
    const start = current && timestamp - current.windowStart < windowMs ? current.windowStart : timestamp;
    const count = current && start === current.windowStart ? current.count : 0;
    if (count >= limit) throw new ApiError("RATE_LIMITED", "Bạn thao tác quá nhanh. Vui lòng thử lại sau.", 429);
    tx.set(ref, { count: count + 1, windowStart: start, updatedAt: timestamp });
  });
}
