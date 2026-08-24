import { NextResponse } from "next/server";
import { createSession, verifyCredentials } from "@/lib/auth";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const username = typeof body?.username === "string" ? body.username : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username || !password) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  const user = verifyCredentials(username, password);
  if (!user) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 401 });
  }

  const { token, expiresAt } = createSession(user.id);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    path: "/",
    expires: new Date(expiresAt),
  });
  return res;
}
