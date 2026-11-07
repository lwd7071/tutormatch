import { publicPackage, publicTutor } from "./public-data.ts";
import { matchesDiscovery } from "./discovery.ts";

type Row = Record<string, any>;

export function words(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/đ/g, "d")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .match(/[a-z0-9]+/g) || []
  );
}

export function searchTokens(name: string, bio: string) {
  const tokens = new Set([...words(name), ...words(bio)]);
  for (const word of words(name))
    for (let size = 1; size < word.length; size++)
      tokens.add(word.slice(0, size));
  return [...tokens];
}

export function buildListing(
  uid: string,
  tutor: Row,
  blocked: boolean,
  packages: Row[],
  reviews: Row[],
) {
  const activePackages = packages
    .filter((pack) => pack.active === true)
    .map(publicPackage);
  const visibleReviews = reviews.filter(
    (review) => review.status === "visible",
  );
  return {
    ...publicTutor({ id: uid, ...tutor }),
    status: tutor.status,
    blocked,
    packages: activePackages,
    weeklySlots: tutor.weeklySlots || [],
    subjectIds: [...new Set(activePackages.map((pack) => pack.subjectId))],
    searchTokens: searchTokens(
      String(tutor.name || ""),
      String(tutor.bio || ""),
    ),
    ratingSum: visibleReviews.reduce((sum, review) => sum + review.stars, 0),
    reviewCount: visibleReviews.length,
    rating: visibleReviews.length
      ? visibleReviews.reduce((sum, review) => sum + review.stars, 0) /
        visibleReviews.length
      : 0,
    updatedAt: Date.now(),
  };
}

export function offerRows(listing: Row) {
  const offers = new Map<
    string,
    {
      tutorId: string;
      subjectId: string;
      mode: string;
      minPrice: number;
      searchTokens: string[];
      status: string;
    }
  >();
  for (const pack of listing.packages || []) {
    if (
      !Number.isFinite(pack.price) ||
      !Number.isInteger(pack.count) ||
      pack.count < 1 ||
      !pack.subjectId
    )
      continue;
    for (const mode of pack.mode === "both"
      ? ["online", "offline"]
      : [pack.mode]) {
      const id = `${listing.id}__${pack.subjectId}__${mode}`;
      const price = pack.price / pack.count;
      const previous = offers.get(id);
      if (!previous || price < previous.minPrice)
        offers.set(id, {
          tutorId: listing.id,
          subjectId: pack.subjectId,
          mode,
          minPrice: price,
          searchTokens: listing.searchTokens,
          status: "approved",
        });
    }
  }
  return offers;
}

export function matchingPackages(
  listing: Row,
  activeSubjectIds: Set<string>,
  filters: {
    subjectId?: string;
    mode?: string;
    maxPrice?: number;
    query?: string;
    day?: number;
    period?: string;
    provinceCode?: string;
    wardCode?: string;
  },
) {
  if (listing.status !== "approved" || listing.blocked) return [];
  if (
    filters.query &&
    !words(filters.query).every((word) => listing.searchTokens?.includes(word))
  )
    return [];
  if (!matchesDiscovery(listing, filters)) return [];
  return (listing.packages || []).filter(
    (pack: Row) =>
      activeSubjectIds.has(pack.subjectId) &&
      (!filters.subjectId || pack.subjectId === filters.subjectId) &&
      (!filters.mode || pack.mode === filters.mode || pack.mode === "both") &&
      (filters.maxPrice === undefined ||
        pack.price / pack.count <= filters.maxPrice),
  );
}
