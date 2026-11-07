import test from "node:test";
import assert from "node:assert/strict";
import { moneyForSession } from "../src/lib/money.ts";

test("phân bổ đúng toàn bộ giá gói, kể cả tiền lẻ", () => {
  const amounts = [1, 2, 10, 101, 1234567].map((total) => {
    const count = 7;
    return Array.from({ length: count }, (_, i) =>
      moneyForSession(total, count, i + 1),
    ).reduce((a, b) => a + b, 0);
  });
  assert.deepEqual(amounts, [1, 2, 10, 101, 1234567]);
  assert.deepEqual(
    [1, 2, 3].map((i) => moneyForSession(100, 3, i)),
    [33, 33, 34],
  );
});
