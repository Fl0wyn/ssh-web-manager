import { NextResponse } from "next/server";
import { listHosts } from "@/lib/ssh-config";

export async function GET() {
  return NextResponse.json(listHosts());
}
