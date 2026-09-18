import fs from "fs";
import path from "path";
import { Client } from "ssh2";
import type { SFTPWrapper } from "ssh2";
import { connectAuthenticated, connectWithPassword } from "@/lib/ssh-auth";
import type { KeyboardInteractivePrompt } from "@/types/ssh";
import type { SftpEntry, SftpPasswordCredentials } from "@/types/sftp";

export interface SftpSessionCallbacks {
  onReady: (homePath: string) => void;
  onKeyboardInteractive: (
    name: string,
    instructions: string,
    prompts: KeyboardInteractivePrompt[]
  ) => void;
  onError: (message: string, fatal: boolean) => void;
  onClosed: () => void;
}

export interface TransferHandle {
  cancel: () => void;
}

export interface SftpSession {
  list: (remotePath: string) => Promise<SftpEntry[]>;
  pipeUpload: (
    localPath: string,
    remotePath: string,
    onProgress: (bytesTransferred: number, totalSize: number) => void,
    onDone: (error?: string) => void
  ) => TransferHandle;
  pipeDownload: (
    remotePath: string,
    localPath: string,
    onProgress: (bytesTransferred: number, totalSize: number) => void,
    onDone: (error?: string) => void
  ) => TransferHandle;
  respondPrompt: (responses: string[]) => void;
  close: () => void;
}

function permissionsFromMode(mode: number): string {
  const typeChar = "-";
  const perms = [
    mode & 0o400 ? "r" : "-",
    mode & 0o200 ? "w" : "-",
    mode & 0o100 ? "x" : "-",
    mode & 0o040 ? "r" : "-",
    mode & 0o020 ? "w" : "-",
    mode & 0o010 ? "x" : "-",
    mode & 0o004 ? "r" : "-",
    mode & 0o002 ? "w" : "-",
    mode & 0o001 ? "x" : "-",
  ].join("");
  return `${typeChar}${perms}`;
}

export function createSftpSession(
  target: string | SftpPasswordCredentials,
  callbacks: SftpSessionCallbacks
): SftpSession {
  const conn = new Client();
  let sftp: SFTPWrapper | null = null;
  let closed = false;

  const noop: SftpSession = {
    list: async () => [],
    pipeUpload: () => ({ cancel: () => {} }),
    pipeDownload: () => ({ cancel: () => {} }),
    respondPrompt: () => {},
    close: () => {},
  };

  const auth =
    typeof target === "string"
      ? connectAuthenticated(conn, target, {
          onKeyboardInteractive: callbacks.onKeyboardInteractive,
          onError: callbacks.onError,
        })
      : connectWithPassword(conn, target, {
          onKeyboardInteractive: callbacks.onKeyboardInteractive,
          onError: callbacks.onError,
        });
  if (!auth) return noop;

  conn.on("ready", () => {
    conn.sftp((err, sftpWrapper) => {
      if (err) {
        callbacks.onError(err.message, true);
        conn.end();
        return;
      }
      sftp = sftpWrapper;
      sftpWrapper.realpath(".", (realpathErr, homePath) => {
        callbacks.onReady(realpathErr ? "/" : homePath);
      });
    });
  });

  conn.on("error", (err) => {
    callbacks.onError(err.message, true);
  });

  conn.on("close", () => {
    if (!closed) {
      closed = true;
      callbacks.onClosed();
    }
  });

  return {
    list(remotePath: string) {
      return new Promise<SftpEntry[]>((resolve, reject) => {
        if (!sftp) {
          reject(new Error("Session SFTP non prete."));
          return;
        }
        sftp.readdir(remotePath, (err, list) => {
          if (err) {
            reject(new Error(err.message));
            return;
          }
          const entries: SftpEntry[] = list.map((item) => {
            const type = item.attrs.isDirectory()
              ? "dir"
              : item.attrs.isSymbolicLink()
                ? "symlink"
                : "file";
            return {
              name: item.filename,
              path: path.posix.join(remotePath, item.filename),
              type,
              size: item.attrs.size,
              mtime: item.attrs.mtime * 1000,
              permissions: permissionsFromMode(item.attrs.mode),
            };
          });
          resolve(entries);
        });
      });
    },

    pipeUpload(localPath, remotePath, onProgress, onDone) {
      if (!sftp) {
        onDone("Session SFTP non prete.");
        return { cancel: () => {} };
      }
      let cancelled = false;
      let bytesTransferred = 0;
      const transferCancelRef = { current: () => {} };

      fs.stat(localPath, (statErr, stats) => {
        if (statErr) {
          onDone(statErr.message);
          return;
        }
        if (cancelled) return;
        const totalSize = stats.size;

        const source = fs.createReadStream(localPath);
        const dest = sftp!.createWriteStream(remotePath);

        function fail(message: string) {
          if (cancelled) return;
          cancelled = true;
          source.destroy();
          dest.destroy();
          onDone(message);
        }

        source.on("data", (chunk: string | Buffer) => {
          if (cancelled) return;
          bytesTransferred += chunk.length;
          onProgress(bytesTransferred, totalSize);
        });
        source.on("error", (err: Error) => fail(err.message));
        dest.on("error", (err: Error) => fail(err.message));
        dest.on("close", () => {
          if (cancelled) return;
          onDone();
        });

        source.pipe(dest);
        transferCancelRef.current = () => {
          cancelled = true;
          source.destroy();
          dest.destroy();
        };
      });

      return {
        cancel() {
          cancelled = true;
          transferCancelRef.current();
        },
      };
    },

    pipeDownload(remotePath, localPath, onProgress, onDone) {
      if (!sftp) {
        onDone("Session SFTP non prete.");
        return { cancel: () => {} };
      }
      let cancelled = false;
      let bytesTransferred = 0;
      const transferCancelRef = { current: () => {} };

      sftp.stat(remotePath, (statErr, stats) => {
        if (statErr) {
          onDone(statErr.message);
          return;
        }
        if (cancelled) return;
        const totalSize = stats.size;

        const source = sftp!.createReadStream(remotePath);
        const dest = fs.createWriteStream(localPath);

        function fail(message: string) {
          if (cancelled) return;
          cancelled = true;
          source.destroy();
          dest.destroy();
          onDone(message);
        }

        source.on("data", (chunk: Buffer) => {
          if (cancelled) return;
          bytesTransferred += chunk.length;
          onProgress(bytesTransferred, totalSize);
        });
        source.on("error", (err: Error) => fail(err.message));
        dest.on("error", (err: Error) => fail(err.message));
        dest.on("close", () => {
          if (cancelled) return;
          onDone();
        });

        source.pipe(dest);
        transferCancelRef.current = () => {
          cancelled = true;
          source.destroy();
          dest.destroy();
        };
      });

      return {
        cancel() {
          cancelled = true;
          transferCancelRef.current();
        },
      };
    },

    respondPrompt(responses: string[]) {
      auth.respondPrompt(responses);
    },

    close() {
      sftp?.end();
      conn.end();
    },
  };
}
