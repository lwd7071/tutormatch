import { placeName, type WeeklySlot } from "./discovery.ts";
type Row = Record<string, any>;
export type PublicTutorDto = {
  id: string;
  name: string;
  bio: string;
  photoUrl: string;
  mode: "online" | "offline" | "both";
  location: string;
  availability: string;
  provinceCode: string;
  wardCode: string;
  weeklySlots: WeeklySlot[];
};
export type PublicPackageDto = {
  id: string;
  tutorId: string;
  title: string;
  subjectId: string;
  price: number;
  count: number;
  durationMinutes: number;
  mode: "online" | "offline" | "both";
};
export type PublicSubjectDto = { id: string; name: string };
export type PublicReviewDto = {
  id: string;
  tutorId: string;
  stars: number;
  text: string;
};
export type CatalogItemDto = {
  tutor: PublicTutorDto;
  packages: PublicPackageDto[];
  rating: number;
  reviewCount: number;
};
export type CatalogPageDto = {
  items: CatalogItemDto[];
  subjects: PublicSubjectDto[];
  featured: CatalogItemDto[];
  page: number;
  totalPages: number;
  totalItems: number;
  matchFormUrl: string;
};
export type TutorDetailDto = {
  tutor: PublicTutorDto;
  packages: PublicPackageDto[];
  packagePage: number;
  packageTotalPages: number;
  packageTotalItems: number;
  subjects: PublicSubjectDto[];
  reviews: PublicReviewDto[];
  reviewPage: number;
  reviewTotalPages: number;
  reviewTotalItems: number;
  rating: number;
  reviewCount: number;
  purchaseEnabled: boolean;
};

export function publicTutor(tutor: Row): PublicTutorDto {
  const {
    id,
    name,
    bio,
    photoUrl,
    mode,
    location,
    availability,
    provinceCode,
    wardCode,
  } = tutor;
  return {
    id,
    name,
    bio,
    photoUrl: photoUrl || "",
    mode,
    location: placeName(provinceCode, wardCode) || location || "",
    availability: availability || "",
    provinceCode: provinceCode || "",
    wardCode: wardCode || "",
    weeklySlots: tutor.weeklySlots || [],
  };
}

export function publicPackage(pack: Row): PublicPackageDto {
  const { id, tutorId, title, subjectId, price, count, durationMinutes, mode } =
    pack;
  return { id, tutorId, title, subjectId, price, count, durationMinutes, mode };
}

export function publicSubject(subject: Row): PublicSubjectDto {
  return { id: subject.id, name: subject.name };
}

export function publicReview(review: Row): PublicReviewDto {
  const { id, tutorId, stars, text } = review;
  return { id, tutorId, stars, text };
}

export function publicCatalog(
  tutors: Row[],
  packages: Row[],
  subjects: Row[],
  reviews: Row[],
  blockedIds: Set<string>,
) {
  const approved = tutors.filter(
    (t) => t.status === "approved" && !blockedIds.has(t.id),
  );
  const approvedIds = new Set(approved.map((t) => t.id));
  const activeSubjects = subjects.filter((s) => s.active === true);
  const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));
  return {
    tutors: approved.map(publicTutor),
    packages: packages
      .filter(
        (p) =>
          p.active === true &&
          approvedIds.has(p.tutorId) &&
          activeSubjectIds.has(p.subjectId),
      )
      .map(publicPackage),
    subjects: activeSubjects.map(publicSubject),
    reviews: reviews
      .filter((r) => r.status === "visible" && approvedIds.has(r.tutorId))
      .map(publicReview),
  };
}

export function canCancelSession(session: Row, timestamp: number) {
  return (
    session.status === "scheduled" &&
    timestamp < session.start &&
    !session.confirmations?.student &&
    !session.confirmations?.tutor
  );
}
