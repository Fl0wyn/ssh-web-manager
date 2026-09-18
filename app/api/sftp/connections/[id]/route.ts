import { NextResponse } from "next/server";
import { deleteSftpConnection } from "@/lib/sftp-connections";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  deleteSftpConnection(id);
  return NextResponse.json({ ok: true });
}
