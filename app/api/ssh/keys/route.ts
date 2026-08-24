import fs from "fs";
import os from "os";
import path from "path";
import { NextResponse } from "next/server";
import { requireApiSession } from "@/lib/session";

function sshDir(): string {
  return path.join(os.homedir(), ".ssh");
}

interface KeyEntry {
  name: string;
}

export async function GET() {
  const unauthorized = await requireApiSession();
  if (unauthorized) return unauthorized;

  const dir = sshDir();
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ entries: [] });
  }

  const files = fs.readdirSync(dir, { withFileTypes: true }).filter((f) => f.isFile());

  const entries: KeyEntry[] = files
    .filter((f) => f.name !== "config" && f.name !== "known_hosts")
    .map((f) => ({ name: f.name }));

  entries.sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ entries });
}
