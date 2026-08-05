import fs from "fs";
import { Client, type ClientChannel } from "ssh2";
import { utils as ssh2Utils } from "ssh2";
import { resolveHost } from "@/lib/ssh-config";
import type { KeyboardInteractivePrompt } from "@/types/ssh";

const CONNECT_TIMEOUT_MS = 15000;
const MAX_PASSPHRASE_ATTEMPTS = 3;

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
  let pendingKeyboardFinish:
    | ((responses: string[]) => void)
    | null = null;
  let passphraseAttempt = 0;
  let closed = false;

  const noop: SshSession = {
    write: () => {},
    resize: () => {},
    respondPrompt: () => {},
    close: () => {},
  };

  const host = resolveHost(alias);
  if (!host) {
    callbacks.onError(`Aucun host "${alias}" trouve dans ~/.ssh/config.`, true);
    return noop;
  }

  function tryLoadKey(
    identityFiles: string[],
    passphrase?: string
  ): { key: Buffer; needsPassphrase: false } | { needsPassphrase: true; file: string } | null {
    for (const file of identityFiles) {
      if (!fs.existsSync(file)) continue;
      const buffer = fs.readFileSync(file);
      const parsed = ssh2Utils.parseKey(buffer, passphrase);
      if (parsed instanceof Error) {
        if (/passphrase/i.test(parsed.message)) {
          return { needsPassphrase: true, file };
        }
        continue;
      }
      return { key: buffer, needsPassphrase: false };
    }
    return null;
  }

  function connectWithPassphrase(passphrase?: string) {
    if (host!.identityFiles.length === 0) {
      callbacks.onError(
        `Aucune IdentityFile configuree pour "${alias}".`,
        true
      );
      return;
    }

    const missing = host!.identityFiles.filter((f) => !fs.existsSync(f));
    if (missing.length === host!.identityFiles.length) {
      callbacks.onError(
        `Cle privee introuvable: ${missing.join(", ")}`,
        true
      );
      return;
    }

    const loaded = tryLoadKey(host!.identityFiles, passphrase);

    if (loaded && "needsPassphrase" in loaded && loaded.needsPassphrase) {
      passphraseAttempt += 1;
      if (passphraseAttempt > MAX_PASSPHRASE_ATTEMPTS) {
        callbacks.onError("Nombre maximal de tentatives de passphrase atteint.", true);
        return;
      }
      pendingKeyboardFinish = (responses: string[]) => {
        connectWithPassphrase(responses[0]);
      };
      callbacks.onKeyboardInteractive(
        "passphrase",
        "",
        [{ prompt: `Passphrase pour ${loaded.file}: `, echo: false }]
      );
      return;
    }

    if (!loaded) {
      callbacks.onError(
        `Impossible de charger une cle privee valide pour "${alias}".`,
        true
      );
      return;
    }

    conn.connect({
      host: host!.hostname,
      port: host!.port,
      username: host!.user,
      privateKey: loaded.key,
      passphrase,
      readyTimeout: CONNECT_TIMEOUT_MS,
      tryKeyboard: true,
    });
  }

  conn.on("keyboard-interactive", (name, instructions, _lang, prompts, finish) => {
    pendingKeyboardFinish = finish;
    callbacks.onKeyboardInteractive(
      name,
      instructions,
      prompts.map((p) => ({ prompt: p.prompt, echo: p.echo ?? true }))
    );
  });

  conn.on("ready", () => {
    conn.shell(
      { term: "xterm-256color", cols, rows },
      (err, shellStream) => {
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
      }
    );
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

  connectWithPassphrase();

  return {
    write(data: string) {
      stream?.write(data);
    },
    resize(newCols: number, newRows: number) {
      stream?.setWindow(newRows, newCols, 0, 0);
    },
    respondPrompt(responses: string[]) {
      const finish = pendingKeyboardFinish;
      pendingKeyboardFinish = null;
      finish?.(responses);
    },
    close() {
      stream?.end();
      conn.end();
    },
  };
}
