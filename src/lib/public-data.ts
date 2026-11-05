type Row = Record<string, any>;

export function publicTutor(tutor: Row) {
  const { id, name, bio, photoUrl, mode, location, availability } = tutor;
  return { id, name, bio, photoUrl: photoUrl || "", mode, location: location || "", availability: availability || "" };
}

export function publicPackage(pack: Row) {
  const { id, tutorId, title, subjectId, price, count, durationMinutes, mode } = pack;
  return { id, tutorId, title, subjectId, price, count, durationMinutes, mode };
}

export function publicSubject(subject: Row) {
  return { id: subject.id, name: subject.name };
}

export function publicReview(review: Row) {
  const { id, tutorId, stars, text } = review;
  return { id, tutorId, stars, text };
}

export function publicCatalog(tutors: Row[], packages: Row[], subjects: Row[], reviews: Row[], blockedIds: Set<string>) {
  const approved = tutors.filter(t => t.status === "approved" && !blockedIds.has(t.id));
  const approvedIds = new Set(approved.map(t => t.id));
  const activeSubjects = subjects.filter(s => s.active === true);
  const activeSubjectIds = new Set(activeSubjects.map(s => s.id));
  return {
    tutors: approved.map(publicTutor),
    packages: packages.filter(p => p.active === true && approvedIds.has(p.tutorId) && activeSubjectIds.has(p.subjectId)).map(publicPackage),
    subjects: activeSubjects.map(publicSubject),
    reviews: reviews.filter(r => r.status === "visible" && approvedIds.has(r.tutorId)).map(publicReview),
  };
}

export function canCancelSession(session: Row, timestamp: number) {
  return session.status === "scheduled" && timestamp < session.start && !session.confirmations?.student && !session.confirmations?.tutor;
}
