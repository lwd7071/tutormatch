import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { actor, fail } from "@/lib/server";
import { success } from "@/lib/api-response";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  try {
    const user = await actor(req),
      database = db();
    const ids = ((await database.doc(`users/${user.uid}`).get()).data()
      ?.favorites || []) as string[];
    const tutors = await Promise.all(
      ids.map((id) => database.doc(`tutors/${id}`).get()),
    );
    const users = await Promise.all(
      ids.map((id) => database.doc(`users/${id}`).get()),
    );
    const tutorIds = ids.filter(
      (_, i) =>
        tutors[i].data()?.status === "approved" &&
        users[i].data()?.blocked !== true,
    );
    if (tutorIds.length !== ids.length)
      await database
        .doc(`users/${user.uid}`)
        .set({ favorites: tutorIds }, { merge: true });
    return success({ tutorIds });
  } catch (error) {
    return fail(error);
  }
}
