import test from "node:test";
import assert from "node:assert/strict";
import {
  buildListing,
  matchingPackages,
  offerRows,
  searchTokens,
} from "../src/lib/listing-core.ts";

test("tìm từ đầy đủ hoặc đầu tên, không tìm chuỗi giữa phần giới thiệu", () => {
  const listing = buildListing(
    "teacher",
    { status: "approved", name: "Nguyễn Minh", bio: "Luyện thi đại học" },
    false,
    [
      {
        id: "math",
        tutorId: "teacher",
        subjectId: "math",
        active: true,
        price: 200000,
        count: 2,
        mode: "online",
      },
    ],
    [],
  );
  const active = new Set(["math"]);
  assert.equal(matchingPackages(listing, active, { query: "nguy" }).length, 1);
  assert.equal(
    matchingPackages(listing, active, { query: "luyen thi" }).length,
    1,
  );
  assert.equal(matchingPackages(listing, active, { query: "uyen" }).length, 0);
  assert.equal(
    matchingPackages(listing, active, { query: "minh", maxPrice: 99999 })
      .length,
    0,
  );
  assert.equal(matchingPackages(listing, new Set(), {}).length, 0);
  assert.equal(
    matchingPackages({ ...listing, blocked: true }, active, {}).length,
    0,
  );
  assert.equal(searchTokens("Đặng", "Toán").includes("dang"), true);
});

test("chỉ mục gói lấy giá mỗi buổi thấp nhất cho từng môn và hình thức", () => {
  const listing = buildListing(
    "teacher",
    { status: "approved", name: "Minh" },
    false,
    [
      {
        id: "a",
        subjectId: "math",
        active: true,
        price: 300000,
        count: 2,
        mode: "both",
      },
      {
        id: "b",
        subjectId: "math",
        active: true,
        price: 200000,
        count: 2,
        mode: "online",
      },
      {
        id: "c",
        subjectId: "math",
        active: false,
        price: 10000,
        count: 2,
        mode: "offline",
      },
    ],
    [],
  );
  const offers = offerRows(listing);
  assert.equal(offers.size, 2);
  assert.equal(offers.get("teacher__math__online")?.minPrice, 100000);
  assert.equal(offers.get("teacher__math__offline")?.minPrice, 150000);
});
