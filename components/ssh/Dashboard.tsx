"use client";

import { cn } from "@/lib/utils";

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

export type HostStatusState =
  | { status: "loading" }
  | { status: "done"; result: HostStatusResult };

interface DashboardProps {
  statuses: Record<string, HostStatusState>;
  loading: boolean;
  active: boolean;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 o";
  const units = ["o", "Ko", "Mo", "Go", "To"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(value >= 10 || exponent === 0 ? 0 : 1)} ${units[exponent]}`;
}

function barColor(percent: number): string {
  if (percent >= 90) return "bg-red-500";
  if (percent >= 75) return "bg-amber-500";
  return "bg-green-500";
}

export function Dashboard({ statuses, loading, active }: DashboardProps) {
  const entries = Object.entries(statuses).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className={cn("flex h-full min-h-0 flex-col", !active && "hidden")}>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {entries.length === 0 && (
          <div className="p-3 text-sm text-muted-foreground">
            {loading ? "Interrogation des hosts en cours..." : "Aucun host."}
          </div>
        )}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {entries.map(([alias, state]) => (
            <HostCard key={alias} alias={alias} state={state} />
          ))}
        </div>
      </div>
    </div>
  );
}

function HostCard({ alias, state }: { alias: string; state: HostStatusState }) {
  const result = state.status === "done" ? state.result : null;

  return (
    <div className="flex flex-col gap-3 rounded-lg border bg-background p-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-2 shrink-0 rounded-full",
            state.status === "loading"
              ? "animate-pulse bg-muted-foreground/30"
              : result?.ok
                ? "bg-green-500"
                : "bg-red-500"
          )}
        />
        <span className="truncate text-sm font-medium">{alias}</span>
        {result?.osDescription && (
          <span
            className="ml-auto truncate text-xs text-muted-foreground"
            title={result.osDescription}
          >
            {result.osDescription}
          </span>
        )}
      </div>

      {state.status === "loading" ? (
        <p className="text-xs text-muted-foreground">Connexion en cours...</p>
      ) : !result?.ok ? (
        <p className="text-xs text-destructive">{result?.error ?? "Erreur inconnue."}</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            {result.disk && <UsageBar label="Disque /" usage={result.disk} />}
            {result.memory && (
              <UsageBar
                label="Memoire"
                usage={{
                  sizeBytes: result.memory.totalBytes,
                  usedBytes: result.memory.usedBytes,
                  availBytes: result.memory.availableBytes,
                  usedPercent: Math.round(
                    (result.memory.usedBytes / result.memory.totalBytes) * 100
                  ),
                }}
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function UsageBar({ label, usage }: { label: string; usage: DiskUsage }) {
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-1 text-xs">
        <span className="font-medium">{label}</span>
        <span className="shrink-0 text-muted-foreground">{usage.usedPercent}%</span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", barColor(usage.usedPercent))}
          style={{ width: `${Math.min(usage.usedPercent, 100)}%` }}
        />
      </div>
      <p
        className="mt-1 truncate text-[11px] text-muted-foreground"
        title={`${formatBytes(usage.usedBytes)} / ${formatBytes(usage.sizeBytes)}`}
      >
        {formatBytes(usage.usedBytes)} / {formatBytes(usage.sizeBytes)}
      </p>
    </div>
  );
}
