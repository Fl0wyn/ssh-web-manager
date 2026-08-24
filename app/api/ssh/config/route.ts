import { NextResponse } from "next/server";
import { readConfigFile, writeConfigFile } from "@/lib/ssh-config";
import { requireApiSession } from "@/lib/session";

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;
  return NextResponse.json({ content: readConfigFile() });
}

export async function PUT(request: Request) {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const body = await request.json();
  if (typeof body.content !== "string") {
    return NextResponse.json(
      { error: "Le champ 'content' est requis." },
      { status: 400 }
    );
  }

  try {
    writeConfigFile(body.content);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur d'ecriture." },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true });
}
