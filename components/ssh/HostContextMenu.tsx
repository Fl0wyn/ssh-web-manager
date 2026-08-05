"use client";

import { useEffect } from "react";

interface HostContextMenuProps {
  hostAlias: string;
  x: number;
  y: number;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onShowDetails: () => void;
  onOpenExternalTerminal: () => void;
  onOpenExplorer: () => void;
  onClose: () => void;
}

export function HostContextMenu({
  hostAlias,
  x,
  y,
  isFavorite,
  onToggleFavorite,
  onShowDetails,
  onOpenExternalTerminal,
  onOpenExplorer,
  onClose,
}: HostContextMenuProps) {
  useEffect(() => {
    function handleClick() {
      onClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      className="fixed z-50 min-w-52 rounded-md border bg-popover p-1 text-sm shadow-lg"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
        {hostAlias}
      </div>
      <button
        onClick={() => {
          onToggleFavorite();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
      >
        <span className="w-4 text-center">{isFavorite ? "☆" : "⭐"}</span>
        {isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
      </button>
      <button
        onClick={() => {
          onShowDetails();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
      >
        <span className="w-4 text-center">ℹ️</span>
        Afficher les details
      </button>
      <button
        onClick={() => {
          onOpenExternalTerminal();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
      >
        <span className="w-4 text-center">🖥️</span>
        Ouvrir dans le terminal
      </button>
      <button
        onClick={() => {
          onOpenExplorer();
          onClose();
        }}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent hover:text-accent-foreground"
      >
        <span className="w-4 text-center">📁</span>
        Explorateur de fichiers
      </button>
    </div>
  );
}
