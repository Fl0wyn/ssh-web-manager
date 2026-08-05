import fs from "fs";
import os from "os";

export interface LocalEntry {
  name: string;
  type: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
}

export async function listLocalDir(dirPath: string): Promise<LocalEntry[]> {
  const dirents = await fs.promises.readdir(dirPath, { withFileTypes: true });
  const entries: LocalEntry[] = [];

  for (const dirent of dirents) {
    const type = dirent.isDirectory()
      ? "dir"
      : dirent.isSymbolicLink()
        ? "symlink"
        : "file";
    try {
      const stats = await fs.promises.stat(`${dirPath}/${dirent.name}`);
      entries.push({
        name: dirent.name,
        type,
        size: stats.size,
        mtime: stats.mtimeMs,
      });
    } catch {
      entries.push({ name: dirent.name, type, size: 0, mtime: 0 });
    }
  }

  return entries;
}

export function defaultLocalHome(): string {
  return os.homedir();
}
