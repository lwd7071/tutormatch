import { NextRequest } from "next/server";
import { db } from "@/lib/firebase-admin";
import { availableStarts } from "@/lib/discovery";
import { fail } from "@/lib/server";
import { invalid, success, ApiError } from "@/lib/api-response";

export const runtime = "nodejs";
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ uid: string }> },
) {
  try {
    const { uid } = await params;
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(uid))
      throw invalid("Gia sư không hợp lệ.");
    const database = db();
    const [tutor, user, calendar] = await Promise.all([
      database.doc(`tutors/${uid}`).get(),
      database.doc(`users/${uid}`).get(),
      database.doc(`calendars/${uid}`).get(),
    ]);
    if (tutor.data()?.status !== "approved" || user.data()?.blocked === true)
      throw new ApiError("NOT_FOUND", "Gia sư chưa công khai.", 404);
    return success({
      starts: availableStarts(
        tutor.data() || {},
        calendar.data()?.slots || [],
        Date.now(),
      ),
    });
  } catch (error) {
    return fail(error);
  }
}
