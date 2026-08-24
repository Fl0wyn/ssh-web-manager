import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { type AdminUser, validateSessionToken } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function getSessionUser(): Promise<AdminUser | null> {
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value;
  return validateSessionToken(token);
}

export async function requireApiSession(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (user) return null;
  return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
}
