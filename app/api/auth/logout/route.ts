import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { deleteSession } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function POST() {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  if (token) deleteSession(token);
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE_NAME);
  return res;
}
