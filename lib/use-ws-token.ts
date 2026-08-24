"use client";

import { useEffect, useState } from "react";

export function useWsToken() {
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/auth/ws-token")
      .then((res) => {
        if (!res.ok) throw new Error("unauthorized");
        return res.json();
      })
      .then((data) => {
        if (!cancelled) setToken(data.token);
      })
      .catch(() => {
        if (!cancelled) setError("Authentification impossible.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { token, error };
}
