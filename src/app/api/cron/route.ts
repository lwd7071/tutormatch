import { NextRequest } from "next/server";
import { expireDue } from "@/lib/expiry";

export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET || req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const result = await expireDue();
  return Response.json(result, { status: result.failed ? 500 : 200 });
}
