import { spawn } from "child_process";
import { NextResponse } from "next/server";
import { resolveHost } from "@/lib/ssh-config";

export async function POST(request: Request) {
  const body = await request.json();
  const alias = body.host;

  if (typeof alias !== "string" || !alias) {
    return NextResponse.json({ error: "Host requis." }, { status: 400 });
  }

  const host = resolveHost(alias);
  if (!host) {
    return NextResponse.json(
      { error: `Aucun host "${alias}" trouve dans ~/.ssh/config.` },
      { status: 404 }
    );
  }

  const child = spawn("wt.exe", ["ssh", alias], {
    detached: true,
    stdio: "ignore",
    windowsHide: false,
  });
  child.unref();

  return NextResponse.json({ ok: true });
}
