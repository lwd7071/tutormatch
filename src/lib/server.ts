import { NextRequest } from "next/server";
import { adminAuth, db } from "./firebase-admin";
import { ApiError, failure, invalid } from "./api-response";

export type Actor = { uid: string; email: string; role: "student" | "tutor" | "admin" };

export async function actor(req: NextRequest): Promise<Actor> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new ApiError("UNAUTHENTICATED", "Vui lòng đăng nhập.", 401);
  const decoded = await adminAuth().verifyIdToken(token).catch(() => { throw new ApiError("UNAUTHENTICATED", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.", 401); });
  const email = decoded.email?.toLowerCase() || "";
  if (decoded.firebase?.sign_in_provider !== "google.com" || decoded.email_verified !== true) throw new ApiError("FORBIDDEN", "Vui lòng đăng nhập bằng tài khoản Google đã xác minh.", 403);
  const adminEmail = process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase();
  const profile = (await db().doc(`users/${decoded.uid}`).get()).data();
  if (profile?.blocked) throw new ApiError("FORBIDDEN", "Tài khoản của bạn đã bị khóa. Hãy liên hệ hỗ trợ.", 403);
  const role = adminEmail && email === adminEmail ? "admin" : profile?.role === "tutor" ? "tutor" : "student";
  return { uid: decoded.uid, email, role };
}

export function requireRole(user: Actor, ...roles: Actor["role"][]) {
  if (!roles.includes(user.role)) throw new ApiError("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này.", 403);
}

export function str(value: unknown, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw invalid("Thông tin nhập chưa hợp lệ.");
  return value.trim();
}

export function integer(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw invalid("Số nhập chưa hợp lệ.");
  return Number(value);
}

export const fail = failure;

export function now() { return Date.now(); }
export const DAY = 86_400_000;
