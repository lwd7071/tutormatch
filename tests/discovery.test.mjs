import test from "node:test";
import assert from "node:assert/strict";
import {
  availableStarts,
  localDate,
  matchesDiscovery,
  rankMatch,
  validPlace,
  validWeeklySlots,
} from "../src/lib/discovery.ts";

test("lịch tuần bỏ ngày ngoại lệ và giờ đã có buổi", () => {
  const monday = Date.parse("2026-11-09T00:00:00+07:00");
  const tutor = {
    weeklySlots: [{ day: 1, start: 540, end: 720 }],
    exceptions: [],
  };
  const starts = availableStarts(
    tutor,
    [{ start: monday + 9 * 3600_000, end: monday + 10 * 3600_000 }],
    monday,
  );
  assert.equal(starts.includes(monday + 9 * 3600_000), false);
  assert.equal(starts.includes(monday + 10 * 3600_000), true);
  assert.equal(
    availableStarts(
      { ...tutor, exceptions: [localDate(monday)] },
      [],
      monday,
    ).some((start) => localDate(start) === localDate(monday)),
    false,
  );
});

test("lọc lịch và địa điểm dùng dữ liệu có cấu trúc", () => {
  const tutor = {
    provinceCode: "01",
    wardCode: "00004",
    weeklySlots: [{ day: 1, start: 1080, end: 1200 }],
  };
  assert.equal(validPlace("01", "00004"), true);
  assert.equal(validPlace("01", "99999"), false);
  assert.equal(validWeeklySlots(tutor.weeklySlots), true);
  assert.equal(validWeeklySlots([{ day: 1, start: 1200, end: 1080 }]), false);
  assert.equal(
    matchesDiscovery(tutor, {
      day: 1,
      period: "evening",
      provinceCode: "01",
      wardCode: "00004",
      mode: "offline",
    }),
    true,
  );
  assert.equal(matchesDiscovery(tutor, { day: 2, period: "evening" }), false);
  assert.equal(
    matchesDiscovery(
      { weeklySlots: tutor.weeklySlots },
      { provinceCode: "01", mode: "online" },
    ),
    true,
  );
  assert.ok(
    rankMatch(tutor, {
      day: 1,
      period: "evening",
      provinceCode: "01",
      wardCode: "00004",
      mode: "offline",
    }) > rankMatch(tutor, { day: 2, provinceCode: "01", mode: "offline" }),
  );
});
