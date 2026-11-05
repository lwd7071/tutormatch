export function requireRefundBankSubmission(refund: Record<string, any> | undefined, studentId: string): asserts refund is Record<string, any> {
  if (!refund || refund.studentId !== studentId || refund.status !== "needs_details") throw new Error("Tài khoản nhận tiền đã được gửi cho admin. Hãy liên hệ hỗ trợ nếu cần sửa.");
}

export function requireRefundBankCorrection(refund: Record<string, any> | undefined): asserts refund is Record<string, any> {
  if (!refund || refund.status !== "pending") throw new Error("Yêu cầu hoàn tiền không còn chờ xử lý.");
}
