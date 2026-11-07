import { db } from "../firebase-admin";
import { type Actor, integer, now, requireRole, str } from "../server";
import { conflict, invalid, success } from "../api-response";
import { prepareTutorSubmission, tutorFields } from "../tutor-profile";
import { stageListing } from "../listing";
import { validWeeklySlots } from "../discovery";
import { type ActionInput } from "../action-schema";

type TutorAction = Extract<
  ActionInput,
  {
    action:
      | "saveAvailability"
      | "setFavorites"
      | "becomeTutor"
      | "saveTutor"
      | "savePackage"
      | "togglePackage";
  }
>;

export async function handleTutor(user: Actor, data: TutorAction) {
  const database = db(),
    action = data.action;
  if (action === "saveAvailability") {
    requireRole(user, "tutor");
    const weeklySlots = data.weeklySlots,
      exceptions = data.exceptions as string[];
    if (
      !validWeeklySlots(weeklySlots) ||
      !exceptions.every(
        (value) =>
          /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)),
      )
    )
      throw invalid("Lịch rảnh chưa hợp lệ.");
    const ref = database.doc(`tutors/${user.uid}`);
    await database.runTransaction(async (tx) => {
      const tutor = (await tx.get(ref)).data();
      if (tutor?.status !== "approved")
        throw conflict("Hồ sơ cần được duyệt trước khi cập nhật lịch rảnh.");
      const update = {
        weeklySlots,
        exceptions: [...new Set(exceptions)],
        updatedAt: now(),
      };
      await stageListing(tx, user.uid, { tutor: { ...tutor, ...update } });
      tx.update(ref, update);
    });
    return success({ ok: true });
  }
  if (action === "setFavorites") {
    const ids = [...new Set(data.tutorIds as string[])];
    const snaps = await Promise.all(
      ids.map((id) => database.doc(`tutors/${id}`).get()),
    );
    const users = await Promise.all(
      ids.map((id) => database.doc(`users/${id}`).get()),
    );
    const valid = ids.filter(
      (id, index) =>
        snaps[index].data()?.status === "approved" &&
        users[index].data()?.blocked !== true,
    );
    await database
      .doc(`users/${user.uid}`)
      .set({ favorites: valid }, { merge: true });
    return success({ tutorIds: valid });
  }

  if (action === "becomeTutor" || action === "saveTutor") {
    requireRole(user, "student", "tutor");
    await database.runTransaction(async (tx) => {
      const liveRef = database.doc(`tutors/${user.uid}`);
      const submissionRef = database.doc(`tutorSubmissions/${user.uid}`);
      const mediaRef = database.doc(`media/${user.uid}`);
      const [liveSnap, submissionSnap, mediaSnap] = await Promise.all([
        tx.get(liveRef),
        tx.get(submissionRef),
        tx.get(mediaRef),
      ]);
      const live = liveSnap.data(),
        submission = submissionSnap.data(),
        media = mediaSnap.data();
      const fields = tutorFields({
        ...data,
        provinceCode: data.provinceCode ?? live?.provinceCode ?? "",
        wardCode: data.wardCode ?? live?.wardCode ?? "",
      });
      const candidate = prepareTutorSubmission(live, submission, media, fields);
      tx.set(submissionRef, {
        ...fields,
        ...candidate,
        status: "pending",
        email: user.email,
        submittedAt: now(),
      });
      tx.set(
        database.doc(`users/${user.uid}`),
        { email: user.email, role: "tutor" },
        { merge: true },
      );
    });
    return success({ ok: true });
  }

  if (action === "savePackage") {
    requireRole(user, "tutor");
    const packageId = data.id
      ? str(data.id, 100)
      : database.collection("packages").doc().id;
    const ref = database.doc(`packages/${packageId}`);
    const subjectId = str(data.subjectId, 100);
    const value = {
      tutorId: user.uid,
      title: str(data.title, 100),
      subjectId,
      price: integer(data.price, 1000, 100_000_000),
      count: integer(data.count, 1, 100),
      durationMinutes: integer(data.durationMinutes, 15, 240),
      mode: data.mode,
      active: data.active,
      updatedAt: now(),
    };
    await database.runTransaction(async (tx) => {
      const [tutor, old, subject] = await Promise.all([
        tx.get(database.doc(`tutors/${user.uid}`)),
        tx.get(ref),
        tx.get(database.doc(`subjects/${subjectId}`)),
      ]);
      if (tutor.data()?.status !== "approved")
        throw conflict("Hồ sơ cần được duyệt trước khi mở bán gói.");
      if (old.exists && old.data()?.tutorId !== user.uid)
        throw conflict("Bạn không có quyền sửa gói này.");
      if (subject.data()?.active !== true)
        throw conflict("Môn học hiện không mở bán.");
      await stageListing(tx, user.uid, {
        package: { id: packageId, value: { ...old.data(), ...value } },
      });
      tx.set(ref, value, { merge: true });
    });
    return success({ id: packageId });
  }

  if (action === "togglePackage") {
    requireRole(user, "tutor");
    const ref = database.doc(`packages/${str(data.id, 100)}`);
    await database.runTransaction(async (tx) => {
      const current = (await tx.get(ref)).data();
      if (!current || current.tutorId !== user.uid)
        throw conflict("Không tìm thấy gói học của bạn.");
      if (!current.active) {
        const [tutor, subject] = await Promise.all([
          tx.get(database.doc(`tutors/${user.uid}`)),
          tx.get(database.doc(`subjects/${current.subjectId}`)),
        ]);
        if (tutor.data()?.status !== "approved")
          throw conflict("Hồ sơ cần được duyệt để mở bán.");
        if (subject.data()?.active !== true)
          throw conflict("Môn học hiện không mở bán.");
      }
      await stageListing(tx, user.uid, {
        package: { id: ref.id, value: { ...current, active: !current.active } },
      });
      tx.update(ref, { active: !current.active, updatedAt: now() });
    });
    return success({ ok: true });
  }

  throw conflict("Thao tác không hợp lệ.");
}
