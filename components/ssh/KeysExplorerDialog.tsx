"use client";

import { cn } from "@/lib/utils";
import { useEffect, useState } from "react";

interface KeysExplorerDialogProps {
  open: boolean;
  onClose: () => void;
}

interface KeyEntry {
  name: string;
}

export function KeysExplorerDialog({ open, onClose }: KeysExplorerDialogProps) {
  const [entries, setEntries] = useState<KeyEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [contentLoading, setContentLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setSelected(null);
      setContent("");
      setError(null);
      try {
        const res = await fetch("/api/ssh/keys");
        const data = await res.json();
        if (cancelled) return;
        setEntries(data.entries);
      } catch {
        if (cancelled) return;
        setError("Impossible de lister le repertoire ~/.ssh.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open]);

  function selectEntry(name: string) {
    setSelected(name);
    setContent("");
    setError(null);
    setContentLoading(true);
    fetch(`/api/ssh/keys/${encodeURIComponent(name)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setContent(data.content);
      })
      .catch(() => setError("Impossible de lire ce fichier."))
      .finally(() => setContentLoading(false));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex h-full max-h-160 w-full max-w-3xl overflow-hidden rounded-lg border bg-card shadow-lg">
        <div className="flex w-56 shrink-0 flex-col border-r">
          <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
            <h2 className="text-sm font-semibold">🔑 Cles SSH</h2>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {loading ? (
              <div className="p-3 text-sm text-muted-foreground">Chargement...</div>
            ) : entries.length === 0 ? (
              <div className="p-3 text-sm text-muted-foreground">Aucun fichier.</div>
            ) : (
              <ul className="flex flex-col gap-px">
                {entries.map((entry) => (
                  <li key={entry.name}>
                    <button
                      onClick={() => selectEntry(entry.name)}
                      className={cn(
                        "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground",
                        selected === entry.name && "bg-accent text-accent-foreground"
                      )}
                    >
                      <span className="shrink-0">🔑</span>
                      <span className="truncate">{entry.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
            <span className="truncate text-sm font-medium text-muted-foreground">
              {selected ?? "Selectionnez un fichier"}
            </span>
            <div className="flex items-center gap-1">
              {selected && content && (
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  aria-label="Copier"
                >
                  <span className="text-base leading-none">{copied ? "✅" : "📋"}</span>
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
          <div className="min-h-0 flex-1 overflow-auto p-3">
            {!selected ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Choisissez une cle publique a gauche pour l&apos;afficher.
              </div>
            ) : contentLoading ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                Chargement...
              </div>
            ) : error ? (
              <div className="text-sm text-destructive">{error}</div>
            ) : (
              <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed">
                {content}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
