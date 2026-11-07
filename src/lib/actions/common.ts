import { db } from "../firebase-admin";
import { now } from "../server";
import { conflict } from "../api-response";

export type Slot = { id: string; start: number; end: number };

export async function calendarReservation(
  tx: FirebaseFirestore.Transaction,
  uid: string,
  slot: Slot,
) {
  const ref = db().doc(`calendars/${uid}`);
  const current = (await tx.get(ref)).data()?.slots as Slot[] | undefined;
  const slots = (current || []).filter((s) => s.end > now());
  if (slots.some((s) => slot.start < s.end && slot.end > s.start))
    throw conflict("Lịch này trùng với một buổi đã tạo.");
  return { ref, slots: [...slots, slot] };
}

export function notify(
  tx: FirebaseFirestore.Transaction,
  userId: string,
  text: string,
) {
  tx.create(db().collection("notifications").doc(), {
    userId,
    text,
    at: now(),
  });
}
