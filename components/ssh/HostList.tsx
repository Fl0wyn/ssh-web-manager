"use client";

import { useMemo, useState, type MouseEvent } from "react";
import { useFavorites } from "@/lib/use-favorites";
import { HostContextMenu } from "@/components/ssh/HostContextMenu";
import { HostDetailsPopover } from "@/components/ssh/HostDetailsPopover";
import type { HostEntry } from "@/types/ssh";

export type HostListMode = "terminal" | "explorer";

interface HostListProps {
  hosts: HostEntry[];
  mode: HostListMode;
  onOpenSession: (hostAlias: string) => void;
  onOpenExternalSession?: (hostAlias: string) => void;
  onOpenExplorer: (hostAlias: string) => void;
}

export function HostList({
  hosts,
  mode,
  onOpenSession,
  onOpenExternalSession,
  onOpenExplorer,
}: HostListProps) {
  const { isFavorite, toggleFavorite } = useFavorites();
  const [contextMenu, setContextMenu] = useState<{
    hostAlias: string;
    x: number;
    y: number;
  } | null>(null);
  const [detailsPopover, setDetailsPopover] = useState<{
    hostAlias: string;
    x: number;
    y: number;
  } | null>(null);

  function handleClick(hostAlias: string) {
    if (mode === "explorer") {
      onOpenExplorer(hostAlias);
    } else {
      onOpenSession(hostAlias);
    }
  }

  function handleOpenExternalTerminal(hostAlias: string) {
    fetch("/api/ssh/open-terminal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: hostAlias }),
    });
    onOpenExternalSession?.(hostAlias);
  }

  function handleContextMenu(e: MouseEvent, hostAlias: string) {
    e.preventDefault();
    setContextMenu({ hostAlias, x: e.clientX, y: e.clientY });
  }

  const filtered = useMemo(() => {
    return [...hosts].sort((a, b) => {
      const favA = isFavorite(a.name) ? 0 : 1;
      const favB = isFavorite(b.name) ? 0 : 1;
      return favA - favB;
    });
  }, [hosts, isFavorite]);

  return (
    <div className="flex min-h-0 flex-col gap-2 border-r bg-card p-2">
      <div className="sidebar-scroll min-h-0 flex-1 overflow-y-auto">
        <ul className="flex flex-col gap-px">
          {filtered.map((host, index) => {
            const favorite = isFavorite(host.name);
            const previousWasFavorite =
              index > 0 && isFavorite(filtered[index - 1].name);
            const showSeparator = index > 0 && previousWasFavorite && !favorite;
            return (
              <li key={host.name} className="contents">
                {showSeparator && <hr className="my-1 border-border" />}
                <div className="group flex items-center">
                  <button
                    onClick={() => handleClick(host.name)}
                    onContextMenu={(e) => handleContextMenu(e, host.name)}
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    <span className="shrink-0 text-sm leading-none">
                      {mode === "explorer" ? "📁" : "🖥️"}
                    </span>
                    <span className="flex min-w-0 flex-col leading-tight">
                      <span className="truncate font-medium">{host.name}</span>
                      {host.description && (
                        <span className="truncate text-xs text-muted-foreground">
                          {host.description}
                        </span>
                      )}
                    </span>
                    {favorite && (
                      <span className="ml-auto shrink-0 text-sm leading-none text-amber-500">
                        ⭐
                      </span>
                    )}
                  </button>
                </div>
              </li>
            );
          })}
          {filtered.length === 0 && (
            <li className="px-2 py-3 text-sm text-muted-foreground">
              Aucun host trouve.
            </li>
          )}
        </ul>
      </div>
      {contextMenu && (
        <HostContextMenu
          hostAlias={contextMenu.hostAlias}
          x={contextMenu.x}
          y={contextMenu.y}
          isFavorite={isFavorite(contextMenu.hostAlias)}
          onToggleFavorite={() => toggleFavorite(contextMenu.hostAlias)}
          onShowDetails={() =>
            setDetailsPopover({
              hostAlias: contextMenu.hostAlias,
              x: contextMenu.x,
              y: contextMenu.y,
            })
          }
          onOpenExternalTerminal={() => handleOpenExternalTerminal(contextMenu.hostAlias)}
          onClose={() => setContextMenu(null)}
        />
      )}
      {detailsPopover && (
        <HostDetailsPopover
          hostAlias={detailsPopover.hostAlias}
          x={detailsPopover.x}
          y={detailsPopover.y}
          onClose={() => setDetailsPopover(null)}
        />
      )}
    </div>
  );
}
