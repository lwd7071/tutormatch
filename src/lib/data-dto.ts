type Row = Record<string, any>;

function pick(row: Row, keys: readonly string[]) {
  return Object.fromEntries(keys.filter(key => row[key] !== undefined).map(key => [key, row[key]]));
}

const fields = {
  profile: ["id", "name", "bio", "mode", "location", "availability", "photoUrl", "status", "reviewedAt", "updatedAt"],
  submission: ["id", "name", "bio", "mode", "location", "availability", "email", "status", "reviewReason", "submittedAt", "reviewedAt", "reviewedBy", "photoSource", "documentSource", "hasPhoto", "hasDocument", "legacy"],
  order: ["id", "studentId", "tutorId", "packageId", "title", "subjectId", "price", "count", "durationMinutes", "feeRate", "status", "renewal", "confirmedCount", "reservedCount", "createdAt", "decisionDue", "paidAt", "decidedAt"],
  session: ["id", "orderId", "trialId", "studentId", "tutorId", "start", "end", "durationMinutes", "status", "confirmations", "createdAt", "adminReason", "gross", "fee", "tutorAmount"],
  message: ["id", "threadId", "participants", "senderId", "text", "at"],
  withdrawal: ["id", "tutorId", "amount", "bankName", "bankAccount", "status", "reference", "at", "completedAt"],
  refund: ["id", "orderId", "studentId", "amount", "status", "source", "reason", "bankName", "bankAccount", "accountHolder", "adminReason", "bankCorrectionReason", "reference", "at", "completedAt"],
  notice: ["id", "userId", "text", "at"],
  trial: ["id", "studentId", "tutorId", "status", "message", "at", "decidedAt"],
  package: ["id", "tutorId", "title", "subjectId", "price", "count", "durationMinutes", "mode", "active", "updatedAt"],
  user: ["id", "email", "role", "blocked", "lastSeenAt"],
  tutor: ["id", "name", "bio", "mode", "location", "availability", "photoUrl", "status", "email", "updatedAt"],
  subject: ["id", "name", "active"],
  review: ["id", "orderId", "tutorId", "studentId", "stars", "text", "status", "at"],
} as const;

export type DataKind = keyof typeof fields;
export type ViewerRole = "student" | "tutor" | "admin";

export function dataDto(kind: DataKind, row: Row, role: ViewerRole): Row {
  const result = pick(row, fields[kind]);
  if (kind === "order" && role === "student" && row.checkoutUrl) result.checkoutUrl = row.checkoutUrl;
  return result;
}

export function dataDtos(kind: DataKind, rows: Row[], role: ViewerRole) {
  return rows.map(row => dataDto(kind, row, role));
}
