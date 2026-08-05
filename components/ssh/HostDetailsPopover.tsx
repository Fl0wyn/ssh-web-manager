"use client";

import { useEffect, useState } from "react";

interface HostDetailsPopoverProps {
  hostAlias: string;
  x: number;
  y: number;
  onClose: () => void;
}

interface HostDetails {
  hostname: string;
  user?: string;
  port: number;
  identityFiles: string[];
}

export function HostDetailsPopover({ hostAlias, x, y, onClose }: HostDetailsPopoverProps) {
  const [details, setDetails] = useState<HostDetails | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ssh/hosts/${encodeURIComponent(hostAlias)}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setDetails(data);
      })
      .catch(() => setError("Impossible de charger les details."));
  }, [hostAlias]);

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
      className="fixed z-50 min-w-80 select-text rounded-lg border bg-popover p-4 text-sm shadow-lg"
      style={{ top: y, left: x }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="mb-2 text-base font-semibold">{hostAlias}</div>
      {error ? (
        <div className="text-sm text-destructive">{error}</div>
      ) : !details ? (
        <div className="text-sm text-muted-foreground">Chargement...</div>
      ) : (
        <dl className="flex flex-col gap-2 text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Hote</dt>
            <dd className="truncate font-mono">{details.hostname}</dd>
          </div>
          {details.user && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Utilisateur</dt>
              <dd className="truncate font-mono">{details.user}</dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Port</dt>
            <dd className="font-mono">{details.port}</dd>
          </div>
          {details.identityFiles.length > 0 && (
            <div className="flex flex-col gap-1">
              <dt className="text-muted-foreground">Cle(s)</dt>
              {details.identityFiles.map((file) => (
                <dd key={file} className="truncate font-mono">
                  {file.split(/[/\\]/).pop()}
                </dd>
              ))}
            </div>
          )}
        </dl>
      )}
    </div>
  );
}
