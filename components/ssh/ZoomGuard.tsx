"use client";

import { useEffect } from "react";

const ZOOM_KEYS = new Set(["=", "+", "-", "_", "0"]);

export function ZoomGuard() {
  useEffect(() => {
    function onWheel(e: WheelEvent) {
      if (e.ctrlKey) {
        e.preventDefault();
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && ZOOM_KEYS.has(e.key)) {
        e.preventDefault();
      }
    }

    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  return null;
}
