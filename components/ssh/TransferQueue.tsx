"use client";

import { cn } from "@/lib/utils";

export interface TransferItem {
  id: string;
  name: string;
  direction: "upload" | "download";
  totalSize: number;
  transferred: number;
  status: "in-progress" | "complete" | "error" | "cancelled";
  errorMessage?: string;
}

interface TransferQueueProps {
  transfers: TransferItem[];
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onDismiss: (id: string) => void;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["Ko", "Mo", "Go", "To"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}

export function TransferQueue({ transfers, onCancel, onRetry, onDismiss }: TransferQueueProps) {
  if (transfers.length === 0) return null;

  return (
    <div className="flex max-h-40 shrink-0 flex-col gap-1 overflow-y-auto border-t bg-muted/30 p-2">
      {transfers.map((t) => {
        const pct = t.totalSize > 0 ? Math.min(100, (t.transferred / t.totalSize) * 100) : 0;
        return (
          <div key={t.id} className="flex items-center gap-2 rounded-md bg-card px-2 py-1 text-xs">
            <span className="shrink-0">{t.direction === "upload" ? "⬆️" : "⬇️"}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{t.name}</span>
                <span className="shrink-0 text-muted-foreground">
                  {t.status === "error"
                    ? t.errorMessage ?? "Erreur"
                    : `${formatSize(t.transferred)} / ${formatSize(t.totalSize)}`}
                </span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    t.status === "error"
                      ? "bg-red-500"
                      : t.status === "complete"
                        ? "bg-green-500"
                        : "bg-primary"
                  )}
                  style={{ width: `${t.status === "complete" ? 100 : pct}%` }}
                />
              </div>
            </div>
            {t.status === "in-progress" && (
              <button
                onClick={() => onCancel(t.id)}
                className="shrink-0 rounded px-1.5 py-0.5 hover:bg-accent"
              >
                Annuler
              </button>
            )}
            {t.status === "error" && (
              <button
                onClick={() => onRetry(t.id)}
                className="shrink-0 rounded px-1.5 py-0.5 hover:bg-accent"
              >
                Reessayer
              </button>
            )}
            {(t.status === "complete" || t.status === "error" || t.status === "cancelled") && (
              <button
                onClick={() => onDismiss(t.id)}
                className="shrink-0 rounded p-0.5 hover:bg-accent"
                aria-label="Fermer"
              >
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
