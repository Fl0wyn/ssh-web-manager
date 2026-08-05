"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { cn } from "@/lib/utils";

export interface PanelEntry {
  name: string;
  type: "file" | "dir" | "symlink";
  size: number;
  mtime: number;
}

interface ExplorerPanelProps {
  title: string;
  currentPath: string;
  entries: PanelEntry[];
  loading: boolean;
  error?: string;
  selected: Set<string>;
  onSelectionChange: (selected: Set<string>) => void;
  onNavigate: (name: string) => void;
  onNavigateUp: () => void;
  canNavigateUp: boolean;
  headerActions?: React.ReactNode;
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

function formatDate(timestamp: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ExplorerPanel({
  title,
  currentPath,
  entries,
  loading,
  error,
  selected,
  onSelectionChange,
  onNavigate,
  onNavigateUp,
  canNavigateUp,
  headerActions,
}: ExplorerPanelProps) {
  const [lastClickedIndex, setLastClickedIndex] = useState<number | null>(null);

  const sorted = useMemo(
    () =>
      [...entries].sort((a, b) => {
        if (a.type !== b.type) return a.type === "dir" ? -1 : 1;
        return a.name.localeCompare(b.name);
      }),
    [entries]
  );

  function handleRowClick(e: MouseEvent, entry: PanelEntry, index: number) {
    const next = new Set(selected);
    if (e.shiftKey && lastClickedIndex !== null) {
      const [start, end] = [lastClickedIndex, index].sort((a, b) => a - b);
      for (let i = start; i <= end; i++) next.add(sorted[i].name);
    } else if (e.ctrlKey || e.metaKey) {
      if (next.has(entry.name)) next.delete(entry.name);
      else next.add(entry.name);
    } else {
      next.clear();
      next.add(entry.name);
    }
    setLastClickedIndex(index);
    onSelectionChange(next);
  }

  return (
    <div className="flex min-h-0 flex-col overflow-hidden rounded-md border bg-card">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b bg-muted/40 px-2 py-1.5">
        <span className="text-xs font-semibold text-muted-foreground">{title}</span>
        {headerActions}
      </div>
      <div className="flex shrink-0 items-center gap-1 border-b px-2 py-1">
        <button
          onClick={onNavigateUp}
          disabled={!canNavigateUp}
          className="rounded p-1 text-xs hover:bg-accent disabled:opacity-40"
          aria-label="Dossier parent"
        >
          ⬆️
        </button>
        <span className="truncate text-xs text-muted-foreground" title={currentPath}>
          {currentPath}
        </span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading ? (
          <div className="p-3 text-sm text-muted-foreground">Chargement...</div>
        ) : error ? (
          <div className="p-3 text-sm text-red-500">{error}</div>
        ) : sorted.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">Dossier vide.</div>
        ) : (
          <table className="w-full text-sm">
            <tbody>
              {sorted.map((entry, index) => (
                <tr
                  key={entry.name}
                  onClick={(e) => handleRowClick(e, entry, index)}
                  onDoubleClick={() => entry.type === "dir" && onNavigate(entry.name)}
                  className={cn(
                    "cursor-pointer select-none",
                    selected.has(entry.name)
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-accent/50"
                  )}
                >
                  <td className="flex items-center gap-1.5 px-2 py-1">
                    <span className="shrink-0">
                      {entry.type === "dir" ? "📁" : entry.type === "symlink" ? "🔗" : "📄"}
                    </span>
                    <span className="truncate">{entry.name}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right text-xs text-muted-foreground">
                    {entry.type === "dir" ? "" : formatSize(entry.size)}
                  </td>
                  <td className="whitespace-nowrap px-2 py-1 text-right text-xs text-muted-foreground">
                    {formatDate(entry.mtime)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
