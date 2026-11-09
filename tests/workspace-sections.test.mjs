import test from "node:test";
import assert from "node:assert/strict";
import { selectedSection, workspaceResources, workspaceSections } from "../src/lib/workspace-sections.ts";

test("mỗi tab có mục con chọn mặc định và chặn section của vai trò khác", () => {
  for (const [role, tabs] of Object.entries(workspaceSections)) {
    for (const [tab, options] of Object.entries(tabs)) {
      assert.equal(selectedSection(role, tab, null), options[0][0]);
      assert.equal(selectedSection(role, tab, "invalid"), options[0][0]);
      for (const [section] of options)
        assert.equal(selectedSection(role, tab, section), section);
    }
  }
  assert.equal(selectedSection("student", "orders", "trials"), "packages");
  assert.equal(selectedSection("admin", "overview", "refunds"), "");
});

test("chỉ phân trang dữ liệu cần cho mục con hiện tại", () => {
  assert.deepEqual(workspaceResources("tutor", "orders", "purchases"), ["orders"]);
  assert.deepEqual(workspaceResources("tutor", "orders", "requests"), []);
  assert.deepEqual(workspaceResources("tutor", "orders", "trials"), ["trials"]);
  assert.deepEqual(workspaceResources("tutor", "sessions", "trial"), ["trials"]);
  assert.deepEqual(workspaceResources("student", "orders", "refunds"), ["refunds"]);
  assert.deepEqual(workspaceResources("admin", "tutors", "pending"), ["submissions", "tutors"]);
  assert.deepEqual(workspaceResources("admin", "money", "withdrawals"), ["withdrawals"]);
  assert.deepEqual(workspaceResources("admin", "settings", "fee"), []);
});
