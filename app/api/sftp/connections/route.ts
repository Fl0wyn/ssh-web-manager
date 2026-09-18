import { NextResponse } from "next/server";
import { addSftpConnection, listSftpConnections } from "@/lib/sftp-connections";

export async function GET() {
  return NextResponse.json(listSftpConnections());
}

export async function POST(request: Request) {
  const body = await request.json();
  const { name, host, port, user, password } = body;

  if (typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Le champ 'name' est requis." }, { status: 400 });
  }
  if (typeof host !== "string" || !host.trim()) {
    return NextResponse.json({ error: "Le champ 'host' est requis." }, { status: 400 });
  }
  if (typeof user !== "string" || !user.trim()) {
    return NextResponse.json({ error: "Le champ 'user' est requis." }, { status: 400 });
  }
  if (typeof password !== "string") {
    return NextResponse.json({ error: "Le champ 'password' est requis." }, { status: 400 });
  }

  const parsedPort = Number(port) || 22;

  const connection = addSftpConnection({
    name: name.trim(),
    host: host.trim(),
    port: parsedPort,
    user: user.trim(),
    password,
  });

  return NextResponse.json(connection, { status: 201 });
}
