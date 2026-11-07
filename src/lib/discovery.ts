import places from "./vietnam-places.ts";

export type WeeklySlot = { day: number; start: number; end: number };
export type DiscoveryTutor = {
  id?: string;
  mode?: string;
  provinceCode?: string;
  wardCode?: string;
  weeklySlots?: WeeklySlot[];
  exceptions?: string[];
};
export const provinces = places.provinces;
export const wards = places.wards;
export const placeName = (provinceCode?: string, wardCode?: string) => {
  const province = provinces.find((p) => p.code === provinceCode)?.name;
  const ward = wards.find(
    (w) => w.code === wardCode && w.provinceCode === provinceCode,
  )?.name;
  return [ward, province].filter(Boolean).join(", ");
};
export function validPlace(provinceCode: string, wardCode: string) {
  return (
    (!provinceCode && !wardCode) ||
    !!(
      provinces.some((p) => p.code === provinceCode) &&
      wards.some((w) => w.code === wardCode && w.provinceCode === provinceCode)
    )
  );
}
export function validWeeklySlots(value: unknown): value is WeeklySlot[] {
  return (
    Array.isArray(value) &&
    value.length <= 28 &&
    value.every(
      (s) =>
        Number.isInteger(s.day) &&
        s.day >= 0 &&
        s.day <= 6 &&
        Number.isInteger(s.start) &&
        Number.isInteger(s.end) &&
        s.start >= 0 &&
        s.end <= 1440 &&
        s.end - s.start >= 60 &&
        s.start % 30 === 0 &&
        s.end % 30 === 0,
    )
  );
}
export function localDate(timestamp: number) {
  return new Date(timestamp + 7 * 3600_000).toISOString().slice(0, 10);
}
export function localDay(timestamp: number) {
  return new Date(timestamp + 7 * 3600_000).getUTCDay();
}
export function localMinute(timestamp: number) {
  const date = new Date(timestamp + 7 * 3600_000);
  return date.getUTCHours() * 60 + date.getUTCMinutes();
}
export function availableStarts(
  tutor: DiscoveryTutor,
  reservations: { start: number; end: number }[],
  from: number,
  days = 14,
) {
  const starts: number[] = [];
  const first =
    Math.floor((from + 7 * 3600_000) / 86_400_000) * 86_400_000 - 7 * 3600_000;
  for (let offset = 0; offset < days; offset++) {
    const base = first + offset * 86_400_000;
    if (tutor.exceptions?.includes(localDate(base))) continue;
    for (const slot of tutor.weeklySlots || []) {
      if (slot.day !== localDay(base)) continue;
      for (let minute = slot.start; minute + 60 <= slot.end; minute += 30) {
        const start = base + minute * 60_000,
          end = start + 60 * 60_000;
        if (
          start > from + 60_000 &&
          !reservations.some((r) => start < r.end && end > r.start)
        )
          starts.push(start);
      }
    }
  }
  return [...new Set(starts)].sort((a, b) => a - b);
}
export function matchesDiscovery(
  tutor: DiscoveryTutor,
  filters: {
    day?: number;
    period?: string;
    provinceCode?: string;
    wardCode?: string;
    mode?: string;
  },
) {
  if (
    filters.provinceCode &&
    filters.mode !== "online" &&
    tutor.provinceCode !== filters.provinceCode
  )
    return false;
  if (
    filters.wardCode &&
    filters.mode !== "online" &&
    tutor.wardCode !== filters.wardCode
  )
    return false;
  if (filters.day === undefined && !filters.period) return true;
  const periods: Record<string, [number, number]> = {
    morning: [0, 720],
    afternoon: [720, 1080],
    evening: [1080, 1440],
  };
  return (tutor.weeklySlots || []).some(
    (slot) =>
      (filters.day === undefined || slot.day === filters.day) &&
      (!filters.period ||
        (!!periods[filters.period] &&
          slot.start < periods[filters.period][1] &&
          slot.end > periods[filters.period][0])),
  );
}
export function rankMatch(
  tutor: DiscoveryTutor,
  filters: {
    day?: number;
    period?: string;
    provinceCode?: string;
    wardCode?: string;
    mode?: string;
  },
) {
  const schedule =
    filters.day !== undefined || filters.period
      ? matchesDiscovery(tutor, { day: filters.day, period: filters.period })
      : false;
  const location =
    filters.mode !== "online" &&
    !!filters.provinceCode &&
    tutor.provinceCode === filters.provinceCode;
  return (
    (schedule ? 2 : 0) +
    (location ? 1 : 0) +
    (location && !!filters.wardCode && tutor.wardCode === filters.wardCode
      ? 1
      : 0)
  );
}
