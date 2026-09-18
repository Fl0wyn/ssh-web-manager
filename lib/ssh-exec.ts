import { Client } from "ssh2";
import { connectAuthenticated } from "@/lib/ssh-auth";

const EXEC_TIMEOUT_MS = 10000;

export interface DiskUsage {
  sizeBytes: number;
  usedBytes: number;
  availBytes: number;
  usedPercent: number;
}

export interface MemoryUsage {
  totalBytes: number;
  usedBytes: number;
  availableBytes: number;
}

export interface HostStatusResult {
  alias: string;
  ok: boolean;
  osDescription?: string;
  disk?: DiskUsage;
  memory?: MemoryUsage;
  error?: string;
}

function execCommand(conn: Client, command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    conn.exec(command, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      let output = "";
      stream.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf-8");
      });
      stream.stderr.on("data", (chunk: Buffer) => {
        output += chunk.toString("utf-8");
      });
      stream.on("close", () => resolve(output.trim()));
      stream.on("error", (streamErr: Error) => reject(streamErr));
    });
  });
}

function parseDiskUsage(output: string): DiskUsage | undefined {
  const line = output.split("\n").at(-1)?.trim();
  if (!line) return undefined;
  const parts = line.split(/\s+/);
  if (parts.length < 4) return undefined;
  const [sizeBytes, usedBytes, availBytes, pcent] = parts;
  return {
    sizeBytes: Number(sizeBytes),
    usedBytes: Number(usedBytes),
    availBytes: Number(availBytes),
    usedPercent: Number(pcent.replace("%", "")),
  };
}

function parseMemoryUsage(output: string): MemoryUsage | undefined {
  const memLine = output.split("\n").find((l) => l.startsWith("Mem:"));
  if (!memLine) return undefined;
  const parts = memLine.split(/\s+/);
  if (parts.length < 4) return undefined;
  const [, totalBytes, usedBytes, , , availableBytes] = parts;
  return {
    totalBytes: Number(totalBytes),
    usedBytes: Number(usedBytes),
    availableBytes: Number(availableBytes ?? 0),
  };
}

export function fetchHostStatus(alias: string): Promise<HostStatusResult> {
  return new Promise((resolve) => {
    const conn = new Client();
    let settled = false;

    function finish(result: HostStatusResult) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      conn.end();
      resolve(result);
    }

    const timeoutId = setTimeout(() => {
      finish({ alias, ok: false, error: "Delai d'execution depasse." });
    }, EXEC_TIMEOUT_MS);

    const auth = connectAuthenticated(conn, alias, {
      onKeyboardInteractive: () => {
        finish({ alias, ok: false, error: "Authentification interactive requise." });
      },
      onError: (message) => {
        finish({ alias, ok: false, error: message });
      },
    });

    if (!auth) return;

    conn.on("ready", async () => {
      try {
        const [dfOutput, freeOutput, osDescription] = await Promise.all([
          execCommand(conn, "df -B1 --output=size,used,avail,pcent /"),
          execCommand(conn, "free -b"),
          execCommand(conn, "lsb_release -ds 2>/dev/null || uname -sr").then((out) =>
            out.replace(/^"|"$/g, "").trim()
          ),
        ]);
        finish({
          alias,
          ok: true,
          osDescription,
          disk: parseDiskUsage(dfOutput),
          memory: parseMemoryUsage(freeOutput),
        });
      } catch (err) {
        finish({
          alias,
          ok: false,
          error: err instanceof Error ? err.message : "Erreur d'execution.",
        });
      }
    });

    conn.on("error", (err) => {
      finish({ alias, ok: false, error: err.message });
    });
  });
}
