import { invalid } from "./api-response.ts";

export const PAGE_SIZE = 20;

export type PageInfo = { page: number; totalPages: number; totalItems: number };

export function parsePage(value: string | null) {
  if (value === null) return 1;
  if (!/^\d{1,7}$/.test(value) || Number(value) < 1)
    throw invalid("Trang dữ liệu không hợp lệ.");
  return Number(value);
}

export function pageInfo(totalItems: number, requestedPage: number): PageInfo {
  const totalPages = Math.ceil(totalItems / PAGE_SIZE);
  return {
    page: Math.min(requestedPage, Math.max(1, totalPages)),
    totalPages,
    totalItems,
  };
}

export async function paginateQuery(
  query: FirebaseFirestore.Query,
  requestedPage: number,
) {
  const count = await query.count().get();
  const info = pageInfo(count.data().count, requestedPage);
  // shortcut: direct page jumps use offsets; move to stored cursor anchors if skipped reads become costly.
  const snapshot = await query
    .offset((info.page - 1) * PAGE_SIZE)
    .limit(PAGE_SIZE)
    .get();
  return { docs: snapshot.docs, ...info };
}
