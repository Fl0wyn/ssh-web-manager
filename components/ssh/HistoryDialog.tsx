"use client";

import type { HistoryEntry, HistoryStatus } from "@/lib/use-history";
import { cn } from "@/lib/utils";

interface HistoryDialogProps {
  open: boolean;
  history: HistoryEntry[];
  onClose: () => void;
  onClear: () => void;
  onOpenSession: (hostAlias: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(startedAt: number, closedAt?: number): string | null {
  if (!closedAt) return null;
  const seconds = Math.round((closedAt - startedAt) / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.round(minutes / 60);
  return `${hours}h`;
}

const STATUS_LABEL: Record<HistoryStatus, string> = {
  connecting: "Connexion...",
  connected: "Connecte",
  disconnected: "Deconnecte",
  error: "Erreur",
};

const STATUS_DOT: Record<HistoryStatus, string> = {
  connecting: "bg-muted-foreground/30",
  connected: "bg-green-500",
  disconnected: "bg-muted-foreground/30",
  error: "bg-red-500",
};

export function HistoryDialog({
  open,
  history,
  onClose,
  onClear,
  onOpenSession,
}: HistoryDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex h-full max-h-140 w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
        <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
          <h2 className="text-sm font-semibold">🕘 Historique</h2>
          <div className="flex items-center gap-1">
            {history.length > 0 && (
              <button
                onClick={onClear}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                aria-label="Vider l'historique"
              >
                <span className="text-base leading-none">🗑️</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
              aria-label="Fermer"
            >
              <span className="text-base leading-none">✕</span>
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
          {history.length === 0 ? (
            <div className="p-3 text-sm text-muted-foreground">
              Aucune connexion recente.
            </div>
          ) : (
            <ul className="flex flex-col gap-px">
              {history.map((entry) => {
                const duration =
                  entry.kind === "connection"
                    ? formatDuration(entry.connectedAt, entry.closedAt)
                    : null;
                return (
                  <li key={entry.id}>
                    <button
                      onClick={() => {
                        onOpenSession(entry.hostAlias);
                        onClose();
                      }}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      title={entry.errorMessage}
                    >
                      <span
                        className={cn(
                          "size-2 shrink-0 rounded-full",
                          STATUS_DOT[entry.status]
                        )}
                      />
                      <span className="min-w-0 flex-1 leading-tight">
                        <span className="flex items-center gap-1.5">
                          <span className="shrink-0">
                            {entry.kind === "disconnection" ? "🔌" : "🔗"}
                          </span>
                          <span className="truncate font-medium">
                            {entry.hostAlias}
                          </span>
                          <span className="shrink-0 text-xs text-muted-foreground">
                            {entry.method === "external" ? "🪟 externe" : "🖥️ integre"}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {entry.kind === "disconnection" ? "Deconnexion" : STATUS_LABEL[entry.status]}
                          {duration ? ` · ${duration}` : ""}
                          {entry.status === "error" && entry.errorMessage
                            ? ` · ${entry.errorMessage}`
                            : ""}
                        </span>
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatDate(entry.connectedAt)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
