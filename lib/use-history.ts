"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ssh-web-manager:history";
const MAX_ENTRIES = 100;

export type HistoryMethod = "terminal" | "external";
export type HistoryStatus = "connecting" | "connected" | "error" | "disconnected";
export type HistoryKind = "connection" | "disconnection";

export interface HistoryEntry {
  id: string;
  hostAlias: string;
  method: HistoryMethod;
  kind: HistoryKind;
  status: HistoryStatus;
  connectedAt: number;
  closedAt?: number;
  errorMessage?: string;
}

function readHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

export function useHistory() {
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => {
    setHistory(readHistory());
  }, []);

  const recordConnectionStart = useCallback(
    (hostAlias: string, method: HistoryMethod): string => {
      const id = nextId();
      setHistory((prev) => {
        const next = [
          {
            id,
            hostAlias,
            method,
            kind: "connection" as const,
            status: "connecting" as const,
            connectedAt: Date.now(),
          },
          ...prev,
        ].slice(0, MAX_ENTRIES);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
      return id;
    },
    []
  );

  const updateConnectionStatus = useCallback(
    (id: string, status: HistoryStatus, errorMessage?: string) => {
      setHistory((prev) => {
        const source = prev.find((entry) => entry.id === id);
        if (!source) return prev;

        const updatedSource = { ...source, status, errorMessage: errorMessage ?? source.errorMessage };
        const isClosing = status === "disconnected" || status === "error";

        let next = prev.map((entry) => (entry.id === id ? updatedSource : entry));

        if (isClosing) {
          next = [
            {
              id: nextId(),
              hostAlias: source.hostAlias,
              method: source.method,
              kind: "disconnection" as const,
              status,
              connectedAt: Date.now(),
              closedAt: Date.now(),
              errorMessage,
            },
            ...next,
          ].slice(0, MAX_ENTRIES);
        }

        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        return next;
      });
    },
    []
  );

  const clearHistory = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setHistory([]);
  }, []);

  return {
    history,
    recordConnectionStart,
    updateConnectionStatus,
    clearHistory,
  };
}
