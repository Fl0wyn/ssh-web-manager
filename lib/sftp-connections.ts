import fs from "fs";
import path from "path";
import crypto from "crypto";

export interface SftpConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

export type SftpConnectionInput = Omit<SftpConnection, "id">;

const DATA_PATH = path.join(process.cwd(), "data", "sftp.json");

function readAll(): SftpConnection[] {
  if (!fs.existsSync(DATA_PATH)) return [];
  try {
    const raw = fs.readFileSync(DATA_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(connections: SftpConnection[]): void {
  fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
  fs.writeFileSync(DATA_PATH, JSON.stringify(connections, null, 2), "utf-8");
}

export function listSftpConnections(): SftpConnection[] {
  return readAll().sort((a, b) => a.name.localeCompare(b.name));
}

export function addSftpConnection(input: SftpConnectionInput): SftpConnection {
  const connection: SftpConnection = { id: crypto.randomUUID(), ...input };
  const connections = readAll();
  connections.push(connection);
  writeAll(connections);
  return connection;
}

export function deleteSftpConnection(id: string): void {
  const connections = readAll().filter((c) => c.id !== id);
  writeAll(connections);
}
