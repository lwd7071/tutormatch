export const REVIEW_TAG_IDS = [
  "clear_explanation",
  "patient_tutor",
  "caring_tutor",
  "fun_learning",
  "detailed_feedback",
  "punctual_tutor",
] as const;

export type ReviewTagId = (typeof REVIEW_TAG_IDS)[number];

export const REVIEW_TAG_LABELS: Record<ReviewTagId, string> = {
  clear_explanation: "Giảng dễ hiểu",
  patient_tutor: "Kiên nhẫn xịn",
  caring_tutor: "Quan tâm có tâm",
  fun_learning: "Học vui dễ vào",
  detailed_feedback: "Feedback cực kỹ",
  punctual_tutor: "Đúng giờ chuẩn chỉnh",
};
