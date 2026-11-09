export const workspaceSections: Record<string, Record<string, [string, string][]>> = {
  admin: {
    work: [["payments", "Thanh toán"], ["orders", "Đơn quá hạn"], ["sessions", "Buổi học"], ["listings", "Tìm kiếm"]],
    tutors: [["pending", "Hồ sơ chờ duyệt"], ["approved", "Gia sư đã duyệt"]],
    money: [["refunds", "Hoàn tiền"], ["withdrawals", "Rút tiền"]],
    settings: [["subjects", "Môn học"], ["fee", "Phí nền tảng"], ["matchForm", "Form tìm gia sư"]],
  },
  tutor: {
    profile: [["details", "Hồ sơ"], ["availability", "Lịch rảnh"], ["packages", "Gói đang bán"], ["create", "Tạo gói"]],
    orders: [["purchases", "Học viên và đơn mua"], ["requests", "Yêu cầu gói học mới"], ["trials", "Yêu cầu học thử"]],
    sessions: [["create", "Tạo buổi học"], ["trial", "Tạo buổi học thử"], ["calendar", "Lịch học"]],
    wallet: [["request", "Yêu cầu rút tiền"], ["history", "Lịch sử rút tiền"]],
  },
  student: {
    orders: [["packages", "Gói học của tôi"], ["requests", "Yêu cầu gói học"], ["refunds", "Hoàn tiền"]],
  },
};

export function selectedSection(role: string, tab: string, requested: string | null) {
  const options = workspaceSections[role]?.[tab] || [];
  return options.some(([key]) => key === requested) ? requested! : options[0]?.[0] || "";
}

export function workspaceResources(role: string, tab: string, section: string): string[] {
  if (role === "admin") {
    if (tab === "tutors") return section === "pending" ? ["submissions", "tutors"] : ["tutors"];
    if (tab === "money") return [section];
    if (tab === "settings") return section === "subjects" ? ["subjects"] : [];
    const single: Record<string, string[]> = { disputes: ["sessions"], users: ["users"], reviews: ["reviews"] };
    return single[tab] || [];
  }
  if (tab === "chat") return ["orders", "trials"];
  if (tab === "notices") return ["notices"];
  if (role === "tutor") {
    if (tab === "profile") return section === "packages" ? ["packages"] : section === "create" ? ["subjects"] : [];
    if (tab === "orders") return section === "purchases" ? ["orders"] : section === "trials" ? ["trials"] : [];
    if (tab === "sessions") return section === "create" ? ["orders"] : section === "trial" ? ["trials"] : ["sessions"];
    if (tab === "wallet") return section === "history" ? ["withdrawals"] : [];
  }
  if (role === "student") {
    if (tab === "orders") return section === "packages" ? ["orders"] : section === "refunds" ? ["refunds"] : [];
    if (tab === "sessions") return ["sessions"];
  }
  return [];
}
