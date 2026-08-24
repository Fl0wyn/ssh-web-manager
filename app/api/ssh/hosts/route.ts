import { NextResponse } from "next/server";
import { listHosts } from "@/lib/ssh-config";
import { requireApiSession } from "@/lib/session";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return NextResponse.json(listHosts());
}
