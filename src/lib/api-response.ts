import { randomUUID } from "node:crypto";
import { ZodError } from "zod";

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(code: string, message: string, status: number) { super(message); this.code = code; this.status = status; }
}

export const invalid = (message: string) => new ApiError("INVALID_INPUT", message, 400);
export const conflict = (message: string) => new ApiError("STATE_CONFLICT", message, 409);
export const unavailable = (message: string) => new ApiError("UNAVAILABLE", message, 503);

export function success<T>(data: T, status = 200) {
  return Response.json({ data }, { status });
}

export function failure(error: unknown) {
  const requestId = randomUUID();
  if (error instanceof ZodError) {
    const fieldErrors = Object.fromEntries(error.issues.map(issue => [issue.path.join("."), issue.message]));
    return Response.json({ error: { code: "INVALID_INPUT", message: "Thông tin nhập chưa hợp lệ.", fieldErrors }, requestId }, { status: 400 });
  }
  if (error instanceof ApiError) {
    return Response.json({ error: { code: error.code, message: error.message }, requestId }, { status: error.status });
  }
  const firestoreCode = typeof error === "object" && error !== null && "code" in error ? (error as { code: unknown }).code : null;
  if (firestoreCode === 6 || firestoreCode === 10) {
    return Response.json({ error: { code: "STATE_CONFLICT", message: "Dữ liệu vừa thay đổi. Vui lòng tải lại và thử lại." }, requestId }, { status: 409 });
  }
  console.error(`API error ${requestId}`, error);
  return Response.json({ error: { code: "INTERNAL_ERROR", message: "Đã có lỗi xảy ra. Vui lòng thử lại." }, requestId }, { status: 500 });
}
