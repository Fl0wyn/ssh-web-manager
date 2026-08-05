import { NextResponse } from "next/server";
import { readConfigFile, writeConfigFile } from "@/lib/ssh-config";

export async function GET() {
  return NextResponse.json({ content: readConfigFile() });
}

export async function PUT(request: Request) {
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
