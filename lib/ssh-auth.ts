import fs from "fs";
import { Client } from "ssh2";
import { utils as ssh2Utils } from "ssh2";
import { resolveHost } from "@/lib/ssh-config";
import type { KeyboardInteractivePrompt } from "@/types/ssh";

const CONNECT_TIMEOUT_MS = 15000;
const MAX_PASSPHRASE_ATTEMPTS = 3;

export interface SshAuthCallbacks {
  onKeyboardInteractive: (
    name: string,
    instructions: string,
    prompts: KeyboardInteractivePrompt[]
  ) => void;
  onError: (message: string, fatal: boolean) => void;
}

export interface SshAuthHandle {
  respondPrompt: (responses: string[]) => void;
}

export interface PasswordCredentials {
  host: string;
  port: number;
  user: string;
  password: string;
}

/**
 * Authentifie une Client ssh2 par mot de passe direct (pas de ~/.ssh/config
 * ni de cle privee) - utilise pour les connexions SFTP ponctuelles/enregistrees.
 */
export function connectWithPassword(
  conn: Client,
  credentials: PasswordCredentials,
  callbacks: SshAuthCallbacks
): SshAuthHandle {
  conn.on("keyboard-interactive", (name, instructions, _lang, prompts, finish) => {
    finish(prompts.map(() => credentials.password));
  });

  conn.connect({
    host: credentials.host,
    port: credentials.port,
    username: credentials.user,
    password: credentials.password,
    readyTimeout: CONNECT_TIMEOUT_MS,
    tryKeyboard: true,
  });

  return {
    respondPrompt: () => {},
  };
}

/**
 * Résout l'alias, authentifie une Client ssh2 par clé privée (avec retry de
 * passphrase via keyboard-interactive), et connecte. `conn` émettra ses
 * propres events "ready"/"error"/"close"/"keyboard-interactive" ; ce module
 * ne fait qu'amorcer l'authentification, il ne gère pas le canal applicatif
 * (shell, sftp, ...) qui reste à la charge de l'appelant sur `conn.on("ready")`.
 */
export function connectAuthenticated(
  conn: Client,
  alias: string,
  callbacks: SshAuthCallbacks
): SshAuthHandle | null {
  let pendingKeyboardFinish: ((responses: string[]) => void) | null = null;
  let passphraseAttempt = 0;

  const host = resolveHost(alias);
  if (!host) {
    callbacks.onError(`Aucun host "${alias}" trouve dans ~/.ssh/config.`, true);
    return null;
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
      callbacks.onError(`Aucune IdentityFile configuree pour "${alias}".`, true);
      return;
    }

    const missing = host!.identityFiles.filter((f) => !fs.existsSync(f));
    if (missing.length === host!.identityFiles.length) {
      callbacks.onError(`Cle privee introuvable: ${missing.join(", ")}`, true);
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
      callbacks.onKeyboardInteractive("passphrase", "", [
        { prompt: `Passphrase pour ${loaded.file}: `, echo: false },
      ]);
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

  connectWithPassphrase();

  return {
    respondPrompt(responses: string[]) {
      const finish = pendingKeyboardFinish;
      pendingKeyboardFinish = null;
      finish?.(responses);
    },
  };
}
