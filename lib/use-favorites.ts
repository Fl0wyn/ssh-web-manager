"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "ssh-web-manager:favorites";

function readFavorites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);

  useEffect(() => {
    setFavorites(readFavorites());
  }, []);

  const toggleFavorite = useCallback((hostAlias: string) => {
    setFavorites((prev) => {
      const next = prev.includes(hostAlias)
        ? prev.filter((h) => h !== hostAlias)
        : [...prev, hostAlias];
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  const isFavorite = useCallback(
    (hostAlias: string) => favorites.includes(hostAlias),
    [favorites]
  );

  return { favorites, isFavorite, toggleFavorite };
}
