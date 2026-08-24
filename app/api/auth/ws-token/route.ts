import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { SESSION_COOKIE_NAME } from "@/lib/auth-constants";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifie." }, { status: 401 });
  }
  const token = (await cookies()).get(SESSION_COOKIE_NAME)!.value;
  return NextResponse.json({ token });
}
