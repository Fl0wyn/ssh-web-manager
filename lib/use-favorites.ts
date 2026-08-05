"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "ssh-web-manager:favorites";

const listeners = new Set<() => void>();
let cachedRaw: string | null = null;
let cachedSnapshot: string[] = [];

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

function notify() {
  for (const listener of listeners) listener();
}

function readFavorites(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function getSnapshot(): string[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    cachedSnapshot = readFavorites();
  }
  return cachedSnapshot;
}

const EMPTY_SNAPSHOT: string[] = [];

function getServerSnapshot(): string[] {
  return EMPTY_SNAPSHOT;
}

export function useFavorites() {
  const favorites = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const toggleFavorite = useCallback((hostAlias: string) => {
    const current = readFavorites();
    const next = current.includes(hostAlias)
      ? current.filter((h) => h !== hostAlias)
      : [...current, hostAlias];
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    notify();
  }, []);

  const isFavorite = useCallback(
    (hostAlias: string) => favorites.includes(hostAlias),
    [favorites]
  );

  return { favorites, isFavorite, toggleFavorite };
}
