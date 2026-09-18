"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ExplorerPanel, type PanelEntry } from "@/components/ssh/ExplorerPanel";
import { TransferQueue, type TransferItem } from "@/components/ssh/TransferQueue";
import type {
  LocalFsEntry,
  SftpClientMessage,
  SftpEntry,
  SftpPasswordCredentials,
  SftpServerMessage,
  TransferDirection,
} from "@/types/sftp";

export type ExplorerStatus = "connecting" | "connected" | "disconnected" | "error";

interface ExplorerProps {
  hostAlias: string;
  credentials?: SftpPasswordCredentials;
  active: boolean;
  onStatusChange: (status: ExplorerStatus, errorMessage?: string) => void;
}

const WS_URL = `${process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:4101"}/sftp`;

function joinPath(base: string, name: string): string {
  const sep = base.includes("\\") && !base.includes("/") ? "\\" : "/";
  if (base === "/" ) return `/${name}`;
  return `${base.replace(/[/\\]+$/, "")}${sep}${name}`;
}

function parentPath(current: string): string {
  const sep = current.includes("\\") && !current.includes("/") ? "\\" : "/";
  const trimmed = current.replace(/[/\\]+$/, "");
  const idx = Math.max(trimmed.lastIndexOf("/"), trimmed.lastIndexOf("\\"));
  if (idx < 0) return current;
  if (sep === "\\" && idx === 2 && /^[A-Za-z]:$/.test(trimmed.slice(0, 2))) {
    return `${trimmed.slice(0, 2)}\\`;
  }
  return idx <= 0 ? "/" : trimmed.slice(0, idx);
}

function isRoot(currentPath: string): boolean {
  return currentPath === "/" || /^[A-Za-z]:\\?$/.test(currentPath);
}

export function Explorer({ hostAlias, credentials, active, onStatusChange }: ExplorerProps) {
  const wsRef = useRef<WebSocket | null>(null);
  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const [passphrasePrompt, setPassphrasePrompt] = useState<string | null>(null);
  const [passphraseInput, setPassphraseInput] = useState("");

  const [remotePath, setRemotePath] = useState("/");
  const [remoteEntries, setRemoteEntries] = useState<PanelEntry[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const [remoteError, setRemoteError] = useState<string | undefined>();
  const [remoteSelected, setRemoteSelected] = useState<Set<string>>(new Set());

  const [localPath, setLocalPath] = useState("");
  const [localEntries, setLocalEntries] = useState<PanelEntry[]>([]);
  const [localLoading, setLocalLoading] = useState(false);
  const [localError, setLocalError] = useState<string | undefined>();
  const [localSelected, setLocalSelected] = useState<Set<string>>(new Set());

  const [transfers, setTransfers] = useState<TransferItem[]>([]);
  const listRequestsRef = useRef<
    Map<string, { resolve: (entries: SftpEntry[] | LocalFsEntry[]) => void; reject: (err: Error) => void }>
  >(new Map());
  const retryContextRef = useRef<
    Map<string, { direction: TransferDirection; localPath: string; remotePath: string }>
  >(new Map());

  const requestIdRef = useRef(0);
  const transferIdRef = useRef(0);
  function nextId(prefix: string) {
    requestIdRef.current += 1;
    return `${prefix}-${Date.now()}-${requestIdRef.current}`;
  }
  function nextTransferId() {
    transferIdRef.current += 1;
    return `t-${Date.now()}-${transferIdRef.current}`;
  }

  function sendMessage(message: SftpClientMessage) {
    const ws = wsRef.current;
    if (ws && ws.readyState === ws.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  const listRemote = useCallback((path: string) => {
    const requestId = nextId("list");
    return new Promise<SftpEntry[]>((resolve, reject) => {
      listRequestsRef.current.set(requestId, {
        resolve: resolve as (entries: SftpEntry[] | LocalFsEntry[]) => void,
        reject,
      });
      sendMessage({ type: "list", requestId, path });
    });
  }, []);

  const listLocal = useCallback((path: string) => {
    const requestId = nextId("local-list");
    return new Promise<LocalFsEntry[]>((resolve, reject) => {
      listRequestsRef.current.set(requestId, {
        resolve: resolve as (entries: SftpEntry[] | LocalFsEntry[]) => void,
        reject,
      });
      sendMessage({ type: "local-list", requestId, path });
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    onStatusChangeRef.current("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.addEventListener("open", () => {
      if (credentials) {
        sendMessage({ type: "connect", credentials });
      } else {
        sendMessage({ type: "connect", host: hostAlias });
      }
    });

    ws.addEventListener("error", () => {
      if (cancelled) return;
      onStatusChangeRef.current("error", "Erreur de connexion au serveur WebSocket.");
    });

    ws.addEventListener("message", (event) => {
      if (cancelled) return;

      const message: SftpServerMessage = JSON.parse(event.data);
      switch (message.type) {
        case "ready":
          onStatusChangeRef.current("connected");
          setRemoteLoading(true);
          listRemote(message.homePath).then((entries) => {
            setRemotePath(message.homePath);
            setRemoteEntries(toRemotePanelEntries(entries));
            setRemoteLoading(false);
          });
          setLocalLoading(true);
          listLocal(message.localHomePath).then((entries) => {
            setLocalPath(message.localHomePath);
            setLocalEntries(toLocalPanelEntries(entries));
            setLocalLoading(false);
          });
          break;
        case "list-result": {
          const pending = listRequestsRef.current.get(message.requestId);
          listRequestsRef.current.delete(message.requestId);
          pending?.resolve(message.entries);
          break;
        }
        case "list-error": {
          const pending = listRequestsRef.current.get(message.requestId);
          listRequestsRef.current.delete(message.requestId);
          pending?.reject(new Error(message.message));
          setRemoteLoading(false);
          setRemoteError(message.message);
          break;
        }
        case "local-list-result": {
          const pending = listRequestsRef.current.get(message.requestId);
          listRequestsRef.current.delete(message.requestId);
          pending?.resolve(message.entries);
          break;
        }
        case "local-list-error": {
          const pending = listRequestsRef.current.get(message.requestId);
          listRequestsRef.current.delete(message.requestId);
          pending?.reject(new Error(message.message));
          setLocalLoading(false);
          setLocalError(message.message);
          break;
        }
        case "upload-progress":
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === message.transferId
                ? { ...t, transferred: message.bytesWritten, totalSize: message.totalSize }
                : t
            )
          );
          break;
        case "upload-complete":
          setTransfers((prev) =>
            prev.map((t) => (t.id === message.transferId ? { ...t, status: "complete" } : t))
          );
          break;
        case "upload-error":
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === message.transferId
                ? { ...t, status: "error", errorMessage: message.message }
                : t
            )
          );
          break;
        case "download-progress":
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === message.transferId
                ? { ...t, transferred: message.bytesRead, totalSize: message.totalSize }
                : t
            )
          );
          break;
        case "download-complete":
          setTransfers((prev) =>
            prev.map((t) => (t.id === message.transferId ? { ...t, status: "complete" } : t))
          );
          break;
        case "download-error":
          setTransfers((prev) =>
            prev.map((t) =>
              t.id === message.transferId
                ? { ...t, status: "error", errorMessage: message.message }
                : t
            )
          );
          break;
        case "keyboard-interactive-prompt": {
          const first = message.prompts[0];
          setPassphrasePrompt(first?.prompt ?? "Passphrase requise");
          break;
        }
        case "error":
          if (message.fatal) {
            onStatusChangeRef.current("error", message.message);
          } else {
            setRemoteError(message.message);
          }
          break;
        case "closed":
          onStatusChangeRef.current("disconnected");
          break;
      }
    });

    return () => {
      cancelled = true;
      ws.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hostAlias, credentials]);

  function toRemotePanelEntries(entries: SftpEntry[]): PanelEntry[] {
    return entries.map((e) => ({ name: e.name, type: e.type, size: e.size, mtime: e.mtime }));
  }

  function toLocalPanelEntries(entries: LocalFsEntry[]): PanelEntry[] {
    return entries.map((e) => ({ name: e.name, type: e.type, size: e.size, mtime: e.mtime }));
  }

  function navigateRemote(name: string) {
    const nextPath = joinPath(remotePath, name);
    setRemoteLoading(true);
    setRemoteSelected(new Set());
    listRemote(nextPath)
      .then((entries) => {
        setRemotePath(nextPath);
        setRemoteEntries(toRemotePanelEntries(entries));
        setRemoteLoading(false);
      })
      .catch((err: Error) => {
        setRemoteError(err.message);
        setRemoteLoading(false);
      });
  }

  function navigateRemoteUp() {
    const nextPath = parentPath(remotePath);
    setRemoteLoading(true);
    setRemoteSelected(new Set());
    listRemote(nextPath)
      .then((entries) => {
        setRemotePath(nextPath);
        setRemoteEntries(toRemotePanelEntries(entries));
        setRemoteLoading(false);
      })
      .catch((err: Error) => {
        setRemoteError(err.message);
        setRemoteLoading(false);
      });
  }

  function navigateLocal(name: string) {
    const nextPath = joinPath(localPath, name);
    setLocalLoading(true);
    setLocalSelected(new Set());
    listLocal(nextPath)
      .then((entries) => {
        setLocalPath(nextPath);
        setLocalEntries(toLocalPanelEntries(entries));
        setLocalLoading(false);
      })
      .catch((err: Error) => {
        setLocalError(err.message);
        setLocalLoading(false);
      });
  }

  function navigateLocalUp() {
    const nextPath = parentPath(localPath);
    setLocalLoading(true);
    setLocalSelected(new Set());
    listLocal(nextPath)
      .then((entries) => {
        setLocalPath(nextPath);
        setLocalEntries(toLocalPanelEntries(entries));
        setLocalLoading(false);
      })
      .catch((err: Error) => {
        setLocalError(err.message);
        setLocalLoading(false);
      });
  }

  function startTransfer(direction: TransferDirection, localFilePath: string, remoteFilePath: string, name: string) {
    const transferId = nextTransferId();
    retryContextRef.current.set(transferId, {
      direction,
      localPath: localFilePath,
      remotePath: remoteFilePath,
    });
    setTransfers((prev) => [
      {
        id: transferId,
        name,
        direction,
        totalSize: 0,
        transferred: 0,
        status: "in-progress",
      },
      ...prev,
    ]);
    sendMessage({
      type: "transfer-start",
      transferId,
      direction,
      localPath: localFilePath,
      remotePath: remoteFilePath,
    });
  }

  function handleUploadSelected() {
    if (localSelected.size === 0) return;
    for (const name of localSelected) {
      const entry = localEntries.find((e) => e.name === name);
      if (!entry || entry.type === "dir") continue;
      startTransfer("upload", joinPath(localPath, name), joinPath(remotePath, name), name);
    }
  }

  function handleDownloadSelected() {
    if (remoteSelected.size === 0) return;
    for (const name of remoteSelected) {
      const entry = remoteEntries.find((e) => e.name === name);
      if (!entry || entry.type === "dir") continue;
      startTransfer("download", joinPath(localPath, name), joinPath(remotePath, name), name);
    }
  }

  function handleCancelTransfer(id: string) {
    sendMessage({ type: "cancel-transfer", transferId: id });
    setTransfers((prev) => prev.map((t) => (t.id === id ? { ...t, status: "cancelled" } : t)));
  }

  function handleRetryTransfer(id: string) {
    const context = retryContextRef.current.get(id);
    setTransfers((prev) => prev.filter((t) => t.id !== id));
    retryContextRef.current.delete(id);
    if (!context) return;
    const name = context.localPath.split(/[/\\]/).pop() ?? context.localPath;
    startTransfer(context.direction, context.localPath, context.remotePath, name);
  }

  function handleDismissTransfer(id: string) {
    retryContextRef.current.delete(id);
    setTransfers((prev) => prev.filter((t) => t.id !== id));
  }

  function submitPassphrase() {
    sendMessage({ type: "keyboard-interactive-response", responses: [passphraseInput] });
    setPassphraseInput("");
    setPassphrasePrompt(null);
  }

  return (
    <div className={active ? "flex h-full w-full flex-col" : "hidden h-full w-full"}>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 p-2">
        <ExplorerPanel
          title="Local"
          currentPath={localPath}
          entries={localEntries}
          loading={localLoading}
          error={localError}
          selected={localSelected}
          onSelectionChange={setLocalSelected}
          onNavigate={navigateLocal}
          onNavigateUp={navigateLocalUp}
          canNavigateUp={!isRoot(localPath)}
          headerActions={
            <button
              onClick={handleUploadSelected}
              disabled={localSelected.size === 0}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
            >
              Envoyer ⬆️
            </button>
          }
        />
        <ExplorerPanel
          title="Distant"
          currentPath={remotePath}
          entries={remoteEntries}
          loading={remoteLoading}
          error={remoteError}
          selected={remoteSelected}
          onSelectionChange={setRemoteSelected}
          onNavigate={navigateRemote}
          onNavigateUp={navigateRemoteUp}
          canNavigateUp={!isRoot(remotePath)}
          headerActions={
            <button
              onClick={handleDownloadSelected}
              disabled={remoteSelected.size === 0}
              className="rounded px-1.5 py-0.5 text-xs hover:bg-accent disabled:opacity-40"
            >
              Recevoir ⬇️
            </button>
          }
        />
      </div>
      <TransferQueue
        transfers={transfers}
        onCancel={handleCancelTransfer}
        onRetry={handleRetryTransfer}
        onDismiss={handleDismissTransfer}
      />
      {passphrasePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-80 rounded-md border bg-card p-4 shadow-lg">
            <p className="mb-2 text-sm">{passphrasePrompt}</p>
            <input
              type="password"
              autoFocus
              value={passphraseInput}
              onChange={(e) => setPassphraseInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitPassphrase()}
              className="mb-3 w-full rounded border bg-background px-2 py-1 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={submitPassphrase}
                className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
              >
                Valider
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
