import crypto from "crypto";
import fs from "fs";
import path from "path";
import bcrypt from "bcrypt";
import Database, { type Database as DatabaseType } from "better-sqlite3";
import { SESSION_TTL_MS } from "@/lib/auth-constants";

const DB_PATH = path.join(process.cwd(), "data", "app.db");

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  revoked_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);
`;

const BCRYPT_ROUNDS = 12;

export interface AdminUser {
  id: number;
  username: string;
}

declare global {
  var __sshWebManagerDb: DatabaseType | undefined;
}

function getDb(): DatabaseType {
  if (!globalThis.__sshWebManagerDb) {
    fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
    const db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.exec(SCHEMA_SQL);
    globalThis.__sshWebManagerDb = db;
  }
  return globalThis.__sshWebManagerDb;
}

function cleanupExpiredSessions(): void {
  const now = Date.now();
  getDb()
    .prepare("DELETE FROM sessions WHERE expires_at < ? OR revoked_at IS NOT NULL")
    .run(now);
}

export function upsertAdmin(username: string, plainPassword: string): void {
  const passwordHash = bcrypt.hashSync(plainPassword, BCRYPT_ROUNDS);
  const now = Date.now();
  getDb()
    .prepare(
      `INSERT INTO users (username, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(username) DO UPDATE SET password_hash = excluded.password_hash, updated_at = excluded.updated_at`
    )
    .run(username, passwordHash, now, now);
}

export function verifyCredentials(username: string, plainPassword: string): AdminUser | null {
  const row = getDb()
    .prepare("SELECT id, username, password_hash FROM users WHERE username = ?")
    .get(username) as { id: number; username: string; password_hash: string } | undefined;
  if (!row) return null;
  if (!bcrypt.compareSync(plainPassword, row.password_hash)) return null;
  return { id: row.id, username: row.username };
}

export function createSession(userId: number): { token: string; expiresAt: number } {
  cleanupExpiredSessions();
  const token = crypto.randomBytes(32).toString("hex");
  const now = Date.now();
  const expiresAt = now + SESSION_TTL_MS;
  getDb()
    .prepare(
      "INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)"
    )
    .run(token, userId, now, expiresAt);
  return { token, expiresAt };
}

export function validateSessionToken(token: string | null | undefined): AdminUser | null {
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT users.id as id, users.username as username
       FROM sessions
       JOIN users ON users.id = sessions.user_id
       WHERE sessions.id = ?
         AND sessions.revoked_at IS NULL
         AND sessions.expires_at >= ?`
    )
    .get(token, Date.now()) as { id: number; username: string } | undefined;
  return row ?? null;
}

export function deleteSession(token: string): void {
  getDb().prepare("UPDATE sessions SET revoked_at = ? WHERE id = ?").run(Date.now(), token);
}
