"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { SftpPasswordCredentials } from "@/types/sftp";

interface SftpConnection {
  id: string;
  name: string;
  host: string;
  port: number;
  user: string;
  password: string;
}

interface SftpConnectDialogProps {
  open: boolean;
  onClose: () => void;
  onConnect: (label: string, credentials: SftpPasswordCredentials) => void;
}

export function SftpConnectDialog({ open, onClose, onConnect }: SftpConnectDialogProps) {
  const [connections, setConnections] = useState<SftpConnection[]>([]);
  const [loading, setLoading] = useState(true);

  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("22");
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [saveConnection, setSaveConnection] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    loadConnections();
  }, [open]);

  function loadConnections() {
    setLoading(true);
    fetch("/api/sftp/connections")
      .then((res) => res.json())
      .then(setConnections)
      .catch(() => setError("Impossible de charger les connexions enregistrees."))
      .finally(() => setLoading(false));
  }

  function resetForm() {
    setName("");
    setHost("");
    setPort("22");
    setUser("");
    setPassword("");
    setSaveConnection(false);
    setError(null);
  }

  async function handleSubmit() {
    if (!host.trim() || !user.trim() || !password) {
      setError("Host, utilisateur et mot de passe sont requis.");
      return;
    }

    const credentials: SftpPasswordCredentials = {
      host: host.trim(),
      port: Number(port) || 22,
      user: user.trim(),
      password,
    };
    const label = name.trim() || `${credentials.user}@${credentials.host}`;

    if (saveConnection) {
      await fetch("/api/sftp/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: label, ...credentials }),
      });
    }

    onConnect(label, credentials);
    resetForm();
    onClose();
  }

  function handleConnectSaved(connection: SftpConnection) {
    onConnect(connection.name, {
      host: connection.host,
      port: connection.port,
      user: connection.user,
      password: connection.password,
    });
    onClose();
  }

  async function handleDelete(id: string) {
    await fetch(`/api/sftp/connections/${id}`, { method: "DELETE" });
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-6">
      <div className="flex max-h-160 w-full max-w-md flex-col overflow-hidden rounded-lg border bg-card shadow-lg">
        <div className="flex h-11 shrink-0 items-center justify-between border-b px-3">
          <h2 className="text-sm font-semibold">📁 Connexion SFTP</h2>
          <button
            onClick={onClose}
            className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            aria-label="Fermer"
          >
            <span className="text-base leading-none">✕</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          {connections.length > 0 && (
            <div className="mb-4">
              <h3 className="mb-2 text-xs font-medium text-muted-foreground">
                Connexions enregistrees
              </h3>
              <ul className="flex flex-col gap-px">
                {loading ? null : (
                  connections.map((c) => (
                    <li key={c.id} className="group flex items-center gap-1">
                      <button
                        onClick={() => handleConnectSaved(c)}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent hover:text-accent-foreground"
                      >
                        <span className="shrink-0">📁</span>
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span className="truncate font-medium">{c.name}</span>
                          <span className="truncate text-xs text-muted-foreground">
                            {c.user}@{c.host}:{c.port}
                          </span>
                        </span>
                      </button>
                      <button
                        onClick={() => handleDelete(c.id)}
                        className="shrink-0 rounded p-1.5 text-muted-foreground opacity-0 hover:bg-accent hover:text-accent-foreground group-hover:opacity-100"
                        aria-label="Supprimer"
                      >
                        <span className="text-xs leading-none">🗑️</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
              <hr className="my-3 border-border" />
            </div>
          )}

          <h3 className="mb-2 text-xs font-medium text-muted-foreground">
            Nouvelle connexion
          </h3>
          <div className="flex flex-col gap-2">
            <Input
              placeholder="Nom (optionnel)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="h-8 text-sm"
            />
            <div className="flex gap-2">
              <Input
                placeholder="Adresse IP / host"
                value={host}
                onChange={(e) => setHost(e.target.value)}
                className="h-8 flex-1 text-sm"
              />
              <Input
                placeholder="Port"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="h-8 w-20 text-sm"
              />
            </div>
            <Input
              placeholder="Utilisateur"
              value={user}
              onChange={(e) => setUser(e.target.value)}
              className="h-8 text-sm"
            />
            <Input
              type="password"
              placeholder="Mot de passe"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              className="h-8 text-sm"
            />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={saveConnection}
                onChange={(e) => setSaveConnection(e.target.checked)}
              />
              Enregistrer cette connexion
            </label>
            {error && <p className="text-xs text-destructive">{error}</p>}
            <Button onClick={handleSubmit} size="sm" className="mt-1">
              Se connecter
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
