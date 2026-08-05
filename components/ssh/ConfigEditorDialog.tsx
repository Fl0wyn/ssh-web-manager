"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

interface ConfigEditorDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

export function ConfigEditorDialog({ open, onClose, onSaved }: ConfigEditorDialogProps) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    fetch("/api/ssh/config")
      .then((res) => res.json())
      .then((data) => setContent(data.content))
      .catch(() => setError("Impossible de charger le fichier de configuration."))
      .finally(() => setLoading(false));
  }, [open]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ssh/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erreur lors de l'enregistrement.");
        return;
      }
      onSaved();
      onClose();
    } catch {
      setError("Erreur lors de l'enregistrement.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex h-full max-h-[720px] w-full max-w-3xl flex-col rounded-lg border bg-card shadow-lg">
        <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-semibold">⚙️ ~/.ssh/config</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Fermer"
          >
            <span className="text-base leading-none">✕</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-hidden p-4">
          {loading ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              Chargement...
            </div>
          ) : (
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none rounded-md border bg-background p-3 font-mono text-xs leading-relaxed outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
            />
          )}
        </div>

        {error && (
          <div className="shrink-0 border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex shrink-0 items-center justify-end gap-2 border-t px-4 py-3">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={loading || saving}>
            {saving ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </div>
    </div>
  );
}
