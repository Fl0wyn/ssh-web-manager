import fs from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";

function sshDir(): string {
  return path.join(os.homedir(), ".ssh");
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> }
) {
  const { name } = await params;

  if (name.includes("/") || name.includes("\\") || name.includes("..")) {
    return NextResponse.json({ error: "Nom de fichier invalide." }, { status: 400 });
  }

  const filePath = path.join(sshDir(), name);
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return NextResponse.json({ error: "Fichier introuvable." }, { status: 404 });
  }

  const content = fs.readFileSync(filePath, "utf-8");
  return NextResponse.json({ content });
}
