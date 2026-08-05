import { Client, type ClientChannel } from "ssh2";
import { connectAuthenticated } from "@/lib/ssh-auth";
import type { KeyboardInteractivePrompt } from "@/types/ssh";

export interface SshSessionCallbacks {
  onReady: () => void;
  onData: (data: string) => void;
  onKeyboardInteractive: (
    name: string,
    instructions: string,
    prompts: KeyboardInteractivePrompt[]
  ) => void;
  onError: (message: string, fatal: boolean) => void;
  onClosed: () => void;
}

export interface SshSession {
  write: (data: string) => void;
  resize: (cols: number, rows: number) => void;
  respondPrompt: (responses: string[]) => void;
  close: () => void;
}

export function createSshSession(
  alias: string,
  cols: number,
  rows: number,
  callbacks: SshSessionCallbacks
): SshSession {
  const conn = new Client();
  let stream: ClientChannel | null = null;
  let closed = false;

  const noop: SshSession = {
    write: () => {},
    resize: () => {},
    respondPrompt: () => {},
    close: () => {},
  };

  const auth = connectAuthenticated(conn, alias, {
    onKeyboardInteractive: callbacks.onKeyboardInteractive,
    onError: callbacks.onError,
  });
  if (!auth) return noop;

  conn.on("ready", () => {
    conn.shell({ term: "xterm-256color", cols, rows }, (err, shellStream) => {
      if (err) {
        callbacks.onError(err.message, true);
        conn.end();
        return;
      }
      stream = shellStream;
      callbacks.onReady();

      shellStream.on("data", (chunk: Buffer) => {
        callbacks.onData(chunk.toString("utf-8"));
      });
      shellStream.stderr.on("data", (chunk: Buffer) => {
        callbacks.onData(chunk.toString("utf-8"));
      });
      shellStream.on("close", () => {
        if (!closed) {
          closed = true;
          callbacks.onClosed();
        }
        conn.end();
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
    write(data: string) {
      stream?.write(data);
    },
    resize(newCols: number, newRows: number) {
      stream?.setWindow(newRows, newCols, 0, 0);
    },
    respondPrompt(responses: string[]) {
      auth.respondPrompt(responses);
    },
    close() {
      stream?.end();
      conn.end();
    },
  };
}
