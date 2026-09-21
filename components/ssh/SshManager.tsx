"use client";

import { useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { HostList, type HostListMode } from "@/components/ssh/HostList";
import { ConfigEditorDialog } from "@/components/ssh/ConfigEditorDialog";
import { KeysExplorerDialog } from "@/components/ssh/KeysExplorerDialog";
import { HistoryDialog } from "@/components/ssh/HistoryDialog";
import { SftpConnectDialog } from "@/components/ssh/SftpConnectDialog";
import { ZoomGuard } from "@/components/ssh/ZoomGuard";
import { Button } from "@/components/ui/button";
import { useHistory } from "@/lib/use-history";
import { cn } from "@/lib/utils";
import type { HostEntry } from "@/types/ssh";
import type { SftpPasswordCredentials } from "@/types/sftp";

const SessionTabs = dynamic(
  () => import("@/components/ssh/SessionTabs").then((m) => m.SessionTabs),
  { ssr: false }
);

interface SshManagerProps {
  hosts: HostEntry[];
}

export function SshManager({ hosts: initialHosts }: SshManagerProps) {
  const tokenRef = useRef(0);
  const historyIdsRef = useRef<Map<number, string>>(new Map());
  const [hosts, setHosts] = useState(initialHosts);
  const [openSignal, setOpenSignal] = useState<{
    hostAlias: string;
    kind: "terminal" | "explorer" | "dashboard";
    credentials?: SftpPasswordCredentials;
    token: number;
  } | null>(null);
  const [configEditorOpen, setConfigEditorOpen] = useState(false);
  const [keysExplorerOpen, setKeysExplorerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sftpConnectOpen, setSftpConnectOpen] = useState(false);
  const [listMode, setListMode] = useState<HostListMode>("terminal");
  const { history, recordConnectionStart, updateConnectionStatus, clearHistory } =
    useHistory();
  const hostAliases = useMemo(() => hosts.map((h) => h.name), [hosts]);

  function handleOpenSession(hostAlias: string) {
    tokenRef.current += 1;
    const token = tokenRef.current;
    setOpenSignal({ hostAlias, kind: "terminal", token });
    historyIdsRef.current.set(token, recordConnectionStart(hostAlias, "terminal"));
  }

  function handleOpenExplorer(hostAlias: string) {
    tokenRef.current += 1;
    const token = tokenRef.current;
    setOpenSignal({ hostAlias, kind: "explorer", token });
    historyIdsRef.current.set(token, recordConnectionStart(hostAlias, "explorer"));
  }

  function handleOpenExternalSession(hostAlias: string) {
    const id = recordConnectionStart(hostAlias, "external");
    updateConnectionStatus(id, "connected");
  }

  function handleSftpConnect(label: string, credentials: SftpPasswordCredentials) {
    tokenRef.current += 1;
    const token = tokenRef.current;
    setOpenSignal({ hostAlias: label, kind: "explorer", credentials, token });
    historyIdsRef.current.set(token, recordConnectionStart(label, "explorer"));
  }

  function handleSessionStatusChange(
    hostAlias: string,
    token: number,
    status: "connecting" | "connected" | "disconnected" | "error",
    errorMessage?: string
  ) {
    const id = historyIdsRef.current.get(token);
    if (!id) return;
    updateConnectionStatus(id, status, errorMessage);
    if (status === "disconnected" || status === "error") {
      historyIdsRef.current.delete(token);
    }
  }

  async function handleConfigSaved() {
    const res = await fetch("/api/ssh/hosts");
    setHosts(await res.json());
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <ZoomGuard />
      <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b bg-card px-4">
        <div className="flex shrink-0 gap-1 rounded-md bg-muted p-1">
          <button
            onClick={() => setListMode("terminal")}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
              listMode === "terminal"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Shell
          </button>
          <button
            onClick={() => setListMode("explorer")}
            className={cn(
              "rounded-sm px-3 py-1 text-xs font-medium transition-colors",
              listMode === "explorer"
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            Explorer
          </button>
        </div>
        <div className="flex items-center justify-end gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setKeysExplorerOpen(true)}
          >
            <span aria-hidden>🔑</span>
            Cles SSH
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfigEditorOpen(true)}
          >
            <span aria-hidden>⚙️</span>
            Editer la config
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            <span aria-hidden>🕘</span>
            Historique
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSftpConnectOpen(true)}
          >
            <span aria-hidden>📁</span>
            Connexion SFTP
          </Button>
        </div>
      </header>
      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr]">
        <HostList
          hosts={hosts}
          mode={listMode}
          onOpenSession={handleOpenSession}
          onOpenExternalSession={handleOpenExternalSession}
          onOpenExplorer={handleOpenExplorer}
        />
        <div className="min-h-0 min-w-0 overflow-hidden">
          <SessionTabs
            openSignal={openSignal}
            hostAliases={hostAliases}
            onSessionStatusChange={handleSessionStatusChange}
          />
        </div>
      </div>
      <ConfigEditorDialog
        open={configEditorOpen}
        onClose={() => setConfigEditorOpen(false)}
        onSaved={handleConfigSaved}
      />
      <KeysExplorerDialog
        open={keysExplorerOpen}
        onClose={() => setKeysExplorerOpen(false)}
      />
      <HistoryDialog
        open={historyOpen}
        history={history}
        onClose={() => setHistoryOpen(false)}
        onClear={clearHistory}
        onOpenSession={handleOpenSession}
      />
      <SftpConnectDialog
        open={sftpConnectOpen}
        onClose={() => setSftpConnectOpen(false)}
        onConnect={handleSftpConnect}
      />
    </div>
  );
}
