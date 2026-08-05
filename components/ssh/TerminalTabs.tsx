"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Terminal, type ConnectionStatus } from "@/components/ssh/Terminal";

interface Session {
  id: string;
  hostAlias: string;
  token: number;
}

interface TerminalTabsProps {
  openSignal: { hostAlias: string; token: number } | null;
  onSessionStatusChange?: (
    hostAlias: string,
    token: number,
    status: ConnectionStatus,
    errorMessage?: string
  ) => void;
}

export function TerminalTabs({ openSignal, onSessionStatusChange }: TerminalTabsProps) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [statuses, setStatuses] = useState<Record<string, ConnectionStatus>>({});
  const [lastHandledToken, setLastHandledToken] = useState<number | null>(null);

  if (openSignal && openSignal.token !== lastHandledToken) {
    const id = `${openSignal.hostAlias}-${openSignal.token}`;
    setLastHandledToken(openSignal.token);
    setSessions((prev) => [
      ...prev,
      { id, hostAlias: openSignal.hostAlias, token: openSignal.token },
    ]);
    setActiveId(id);
  }

  function setStatus(session: Session, status: ConnectionStatus, errorMessage?: string) {
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

  if (sessions.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Selectionnez un host pour ouvrir une session.
      </div>
    );
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
            onClick={() => setActiveId(session.id)}
            onDoubleClick={() => closeSession(session.id)}
          >
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
            <span className="max-w-40 truncate select-none">{session.hostAlias}</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                closeSession(session.id);
              }}
              className="cursor-pointer rounded p-0.5 hover:bg-accent"
            >
              <span className="text-xs leading-none">✕</span>
            </button>
          </div>
        ))}
      </div>
      <div className="relative min-h-0 flex-1 bg-[#0a0a0a] p-2">
        {sessions.map((session) => (
          <Terminal
            key={session.id}
            hostAlias={session.hostAlias}
            active={session.id === activeId}
            onStatusChange={(status, errorMessage) =>
              setStatus(session, status, errorMessage)
            }
          />
        ))}
      </div>
    </div>
  );
}
