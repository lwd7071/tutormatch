import test from "node:test";
import assert from "node:assert/strict";
import { ApiError } from "../src/lib/api-response.ts";
import { PAGE_SIZE, pageInfo, paginateQuery, parsePage } from "../src/lib/pagination.ts";

test("phân trang chỉ tính trang có nội dung", () => {
  assert.equal(PAGE_SIZE, 20);
  for (const [items, pages] of [[0, 0], [1, 1], [20, 1], [21, 2], [40, 2], [41, 3]]) {
    assert.equal(pageInfo(items, 1).totalPages, pages);
  }
  assert.deepEqual(pageInfo(41, 99), { page: 3, totalPages: 3, totalItems: 41 });
});

test("số trang phải là số nguyên dương", () => {
  assert.equal(parsePage(null), 1);
  assert.equal(parsePage("3"), 3);
  for (const value of ["0", "-1", "1.5", "abc"]) assert.throws(() => parsePage(value), ApiError);
});

test("truy vấn trả đúng lát cắt 20 mục và tổng chính xác", async () => {
  let offset = 0, limit = 0;
  const query = {
    count: () => ({ get: async () => ({ data: () => ({ count: 41 }) }) }),
    offset(value) { offset = value; return this; },
    limit(value) { limit = value; return this; },
    get: async () => ({ docs: Array.from({ length: Math.min(limit, 41 - offset) }, (_, index) => ({ id: offset + index })) }),
  };
  const result = await paginateQuery(query, 3);
  assert.equal(offset, 40);
  assert.equal(limit, 20);
  assert.deepEqual(result.docs.map(doc => doc.id), [40]);
  assert.deepEqual({ page: result.page, totalPages: result.totalPages, totalItems: result.totalItems }, { page: 3, totalPages: 3, totalItems: 41 });
});
