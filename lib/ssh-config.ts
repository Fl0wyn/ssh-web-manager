import fs from "fs";
import os from "os";
import path from "path";
import SSHConfig, { type Directive, type Line } from "ssh-config";
import type { HostEntry, ResolvedHost } from "@/types/ssh";

const EXCLUDED_HOSTS = new Set(["github", "github.com"]);

function sshConfigPath(): string {
  return path.join(os.homedir(), ".ssh", "config");
}

function readConfigText(): string {
  const configPath = sshConfigPath();
  if (!fs.existsSync(configPath)) return "";
  return fs.readFileSync(configPath, "utf-8");
}

export function readConfigFile(): string {
  return readConfigText();
}

export function writeConfigFile(content: string): void {
  SSHConfig.parse(content);
  fs.writeFileSync(sshConfigPath(), content, "utf-8");
}

function aliasesOf(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (Array.isArray(value)) {
    return value.map((v) => (typeof v === "string" ? v : v.val));
  }
  return [];
}

function isWildcard(alias: string): boolean {
  return alias.includes("*") || alias.includes("?");
}

function descriptionOf(section: Directive): string {
  const nested = (section as unknown as { config?: Line[] }).config;
  const first = nested?.[0];
  if (first && first.type === SSHConfig.COMMENT) {
    return first.content.replace(/^#\s*/, "").trim();
  }
  return "";
}

export function listHosts(): HostEntry[] {
  const text = readConfigText();
  if (!text) return [];

  const config = SSHConfig.parse(text);
  const entries = new Map<string, string>();

  for (const line of config) {
    if (line.type !== SSHConfig.DIRECTIVE) continue;
    if (line.param.toLowerCase() !== "host") continue;

    const description = descriptionOf(line);
    for (const alias of aliasesOf(line.value)) {
      if (isWildcard(alias)) continue;
      if (EXCLUDED_HOSTS.has(alias.toLowerCase())) continue;
      entries.set(alias, description);
    }
  }

  return Array.from(entries, ([name, description]) => ({ name, description })).sort(
    (a, b) =>
      a.description.localeCompare(b.description) || a.name.localeCompare(b.name)
  );
}

function expandHome(filePath: string): string {
  if (filePath.startsWith("~")) {
    return path.join(os.homedir(), filePath.slice(1));
  }
  return filePath;
}

export function resolveHost(alias: string): ResolvedHost | null {
  const text = readConfigText();
  if (!text) return null;

  const config = SSHConfig.parse(text);
  const knownAliases = new Set<string>();
  for (const line of config) {
    if (line.type !== SSHConfig.DIRECTIVE) continue;
    if (line.param.toLowerCase() !== "host") continue;
    for (const a of aliasesOf(line.value)) knownAliases.add(a);
  }
  if (!knownAliases.has(alias)) return null;

  const computed = config.compute(alias) as Record<string, unknown>;

  const identityFileRaw = computed.IdentityFile;
  const identityFiles = (
    Array.isArray(identityFileRaw)
      ? identityFileRaw
      : identityFileRaw
        ? [identityFileRaw]
        : []
  ).map((f) => expandHome(String(f)));

  const port = computed.Port ? Number(computed.Port) : 22;

  return {
    name: alias,
    hostname: String(computed.HostName ?? alias),
    user: computed.User ? String(computed.User) : undefined,
    port,
    identityFiles,
    proxyJump: computed.ProxyJump ? String(computed.ProxyJump) : undefined,
  };
}
