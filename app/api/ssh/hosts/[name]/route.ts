import { NextResponse } from "next/server";
import { resolveHost } from "@/lib/ssh-config";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;
  const host = resolveHost(name);

  if (!host) {
    return NextResponse.json(
      { error: `Aucun host "${name}" trouve dans ~/.ssh/config.` },
      { status: 404 }
    );
  }

  return NextResponse.json(host);
}
