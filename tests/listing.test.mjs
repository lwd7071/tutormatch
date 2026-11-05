import test from "node:test";
import assert from "node:assert/strict";
import { buildListing, matchingPackages, searchTokens } from "../src/lib/listing-core.ts";

test("tìm từ đầy đủ hoặc đầu tên, không tìm chuỗi giữa phần giới thiệu", () => {
  const listing = buildListing("teacher", { status: "approved", name: "Nguyễn Minh", bio: "Luyện thi đại học" }, false,
    [{ id: "math", tutorId: "teacher", subjectId: "math", active: true, price: 200000, count: 2, mode: "online" }], []);
  const active = new Set(["math"]);
  assert.equal(matchingPackages(listing, active, { query: "nguy" }).length, 1);
  assert.equal(matchingPackages(listing, active, { query: "luyen thi" }).length, 1);
  assert.equal(matchingPackages(listing, active, { query: "uyen" }).length, 0);
  assert.equal(matchingPackages(listing, active, { query: "minh", maxPrice: 99999 }).length, 0);
  assert.equal(matchingPackages(listing, new Set(), {}).length, 0);
  assert.equal(matchingPackages({ ...listing, blocked: true }, active, {}).length, 0);
  assert.equal(searchTokens("Đặng", "Toán").includes("dang"), true);
});
