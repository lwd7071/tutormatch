import { NextRequest } from "next/server";
import { adminAuth, db } from "./firebase-admin";

export type Actor = { uid: string; email: string; role: "student" | "tutor" | "admin" };

export async function actor(req: NextRequest): Promise<Actor> {
  const token = req.headers.get("authorization")?.replace(/^Bearer /, "");
  if (!token) throw new Error("Vui lòng đăng nhập.");
  const decoded = await adminAuth().verifyIdToken(token);
  const email = decoded.email?.toLowerCase() || "";
  if (decoded.firebase?.sign_in_provider !== "google.com" || decoded.email_verified !== true) throw new Error("Vui lòng đăng nhập bằng tài khoản Google đã xác minh.");
  const adminEmail = process.env.ADMIN_GOOGLE_EMAIL?.trim().toLowerCase();
  const profile = (await db().doc(`users/${decoded.uid}`).get()).data();
  if (profile?.blocked) throw new Error("Tài khoản của bạn đã bị khóa. Hãy liên hệ hỗ trợ.");
  const role = adminEmail && email === adminEmail ? "admin" : profile?.role === "tutor" ? "tutor" : "student";
  return { uid: decoded.uid, email, role };
}

export function requireRole(user: Actor, ...roles: Actor["role"][]) {
  if (!roles.includes(user.role)) throw new Error("Bạn không có quyền thực hiện thao tác này.");
}

export function str(value: unknown, max = 500): string {
  if (typeof value !== "string" || !value.trim() || value.length > max) throw new Error("Thông tin nhập chưa hợp lệ.");
  return value.trim();
}

export function integer(value: unknown, min: number, max: number): number {
  if (!Number.isInteger(value) || Number(value) < min || Number(value) > max) throw new Error("Số nhập chưa hợp lệ.");
  return Number(value);
}

export function fail(error: unknown) {
  const message = error instanceof Error ? error.message : "Đã có lỗi xảy ra.";
  return Response.json({ error: message }, { status: message.includes("quyền") ? 403 : 400 });
}

export function now() { return Date.now(); }
export const DAY = 86_400_000;
