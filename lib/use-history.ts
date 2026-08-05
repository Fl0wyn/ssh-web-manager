"use client";

import { useCallback, useSyncExternalStore } from "react";

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

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSnapshot: HistoryEntry[] = [];

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify() {
  for (const listener of listeners) listener();
}

function readHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function writeHistory(entries: HistoryEntry[]) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  notify();
}

function getSnapshot(): HistoryEntry[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = readHistory();
  }
  return cachedSnapshot;
}

function getServerSnapshot(): HistoryEntry[] {
  return [];
}

let idCounter = 0;
function nextId(): string {
  idCounter += 1;
  return `${Date.now()}-${idCounter}`;
}

export function useHistory() {
  const history = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const recordConnectionStart = useCallback(
    (hostAlias: string, method: HistoryMethod): string => {
      const id = nextId();
      const next = [
        {
          id,
          hostAlias,
          method,
          kind: "connection" as const,
          status: "connecting" as const,
          connectedAt: Date.now(),
        },
        ...readHistory(),
      ].slice(0, MAX_ENTRIES);
      writeHistory(next);
      return id;
    },
    []
  );

  const updateConnectionStatus = useCallback(
    (id: string, status: HistoryStatus, errorMessage?: string) => {
      const prev = readHistory();
      const source = prev.find((entry) => entry.id === id);
      if (!source) return;

      const updatedSource = {
        ...source,
        status,
        errorMessage: errorMessage ?? source.errorMessage,
      };
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

      writeHistory(next);
    },
    []
  );

  const clearHistory = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    notify();
  }, []);

  return {
    history,
    recordConnectionStart,
    updateConnectionStatus,
    clearHistory,
  };
}
