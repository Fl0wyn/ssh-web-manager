"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Terminal, type ConnectionStatus } from "@/components/ssh/Terminal";
import { Explorer, type ExplorerStatus } from "@/components/ssh/Explorer";
import { Dashboard, type HostStatusResult, type HostStatusState } from "@/components/ssh/Dashboard";
import type { SftpPasswordCredentials } from "@/types/sftp";

type SessionKind = "terminal" | "explorer" | "dashboard";
type SessionStatus = ConnectionStatus | ExplorerStatus;

interface Session {
  id: string;
  kind: SessionKind;
  hostAlias: string;
  credentials?: SftpPasswordCredentials;
  token: number;
}

const DASHBOARD_SESSION_ID = "dashboard";
const DASHBOARD_SESSION: Session = {
  id: DASHBOARD_SESSION_ID,
  kind: "dashboard",
  hostAlias: "dashboard",
  token: -1,
};

interface SessionTabsProps {
  openSignal: {
    hostAlias: string;
    kind: SessionKind;
    credentials?: SftpPasswordCredentials;
    token: number;
  } | null;
  hostAliases: string[];
  onSessionStatusChange?: (
    hostAlias: string,
    token: number,
    status: SessionStatus,
    errorMessage?: string
  ) => void;
}

export function SessionTabs({ openSignal, hostAliases, onSessionStatusChange }: SessionTabsProps) {
  const [sessions, setSessions] = useState<Session[]>([DASHBOARD_SESSION]);
  const [activeId, setActiveId] = useState<string | null>(DASHBOARD_SESSION_ID);
  const [statuses, setStatuses] = useState<Record<string, SessionStatus>>({});
  const [lastHandledToken, setLastHandledToken] = useState<number | null>(null);
  const [dashboardStatuses, setDashboardStatuses] = useState<Record<string, HostStatusState>>({});
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardRefreshToken, setDashboardRefreshToken] = useState(0);

  useEffect(() => {
    setDashboardStatuses(
      Object.fromEntries(hostAliases.map((alias) => [alias, { status: "loading" as const }]))
    );
    setDashboardLoading(true);

    const eventSource = new EventSource("/api/dashboard/status");

    eventSource.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.done) {
        setDashboardLoading(false);
        eventSource.close();
        return;
      }
      const result = data as HostStatusResult;
      setDashboardStatuses((prev) => ({ ...prev, [result.alias]: { status: "done", result } }));
    };

    eventSource.onerror = () => {
      setDashboardLoading(false);
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dashboardRefreshToken]);

  if (openSignal && openSignal.token !== lastHandledToken) {
    setLastHandledToken(openSignal.token);

    const id = `${openSignal.kind}-${openSignal.hostAlias}-${openSignal.token}`;
    setSessions((prev) => [
      ...prev,
      {
        id,
        kind: openSignal.kind,
        hostAlias: openSignal.hostAlias,
        credentials: openSignal.credentials,
        token: openSignal.token,
      },
    ]);
    setActiveId(id);
  }

  function setStatus(session: Session, status: SessionStatus, errorMessage?: string) {
    setStatuses((prev) => ({ ...prev, [session.id]: status }));
    onSessionStatusChange?.(session.hostAlias, session.token, status, errorMessage);
  }

  function closeSession(id: string) {
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      setActiveId((current) =>
        current !== id
          ? current
          : remaining.length > 0
            ? remaining[remaining.length - 1].id
            : null
      );
      return remaining;
    });
    setStatuses((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 shrink-0 items-center gap-1 overflow-x-auto border-b bg-muted/40 px-2 py-1.5">
        {sessions.map((session) => (
          <div
            key={session.id}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-sm cursor-pointer transition-colors",
              session.id === activeId
                ? "bg-background font-medium shadow-sm"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            )}
            onClick={() => {
              setActiveId(session.id);
              if (session.kind === "dashboard") {
                setDashboardRefreshToken((t) => t + 1);
              }
            }}
            onDoubleClick={() => session.kind !== "dashboard" && closeSession(session.id)}
          >
            {session.kind !== "dashboard" && (
              <span
                className={cn(
                  "size-2 shrink-0 rounded-full",
                  statuses[session.id] === "connected" && "bg-green-500",
                  statuses[session.id] === "error" && "bg-red-500",
                  (statuses[session.id] === "connecting" ||
                    statuses[session.id] === "disconnected" ||
                    !statuses[session.id]) &&
                    "bg-muted-foreground/30"
                )}
              />
            )}
            <span className="shrink-0 text-xs">
              {session.kind === "dashboard" ? "📊" : session.kind === "explorer" ? "📁" : "🖥️"}
            </span>
            <span className="max-w-40 truncate select-none">
              {session.kind === "dashboard" ? "Dashboard" : session.hostAlias}
            </span>
            {session.kind !== "dashboard" && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeSession(session.id);
                }}
                className="cursor-pointer rounded p-0.5 hover:bg-accent"
              >
                <span className="text-xs leading-none">✕</span>
              </button>
            )}
          </div>
        ))}
      </div>
      <div
        className={cn("relative min-h-0 flex-1", {
          "bg-[#0a0a0a] p-2": sessions.find((s) => s.id === activeId)?.kind === "terminal",
          "p-2": sessions.find((s) => s.id === activeId)?.kind === "explorer",
        })}
      >
        {sessions.map((session) => {
          if (session.kind === "dashboard") {
            return (
              <Dashboard
                key={session.id}
                statuses={dashboardStatuses}
                loading={dashboardLoading}
                active={session.id === activeId}
              />
            );
          }
          return session.kind === "explorer" ? (
            <Explorer
              key={session.id}
              hostAlias={session.hostAlias}
              credentials={session.credentials}
              active={session.id === activeId}
              onStatusChange={(status, errorMessage) => setStatus(session, status, errorMessage)}
            />
          ) : (
            <Terminal
              key={session.id}
              hostAlias={session.hostAlias}
              active={session.id === activeId}
              onStatusChange={(status, errorMessage) => setStatus(session, status, errorMessage)}
            />
          );
        })}
      </div>
    </div>
  );
}
