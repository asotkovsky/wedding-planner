"use client";

import { useLayoutEffect } from "react";

/**
 * Applies a wedding's color variables to <html> so they also reach portaled UI
 * (dialogs, menus, toasts, confetti). The server renders the same variables on the
 * layout wrapper, so the first paint is already themed.
 */
export function WeddingTheme({ vars }: { vars: React.CSSProperties }) {
  useLayoutEffect(() => {
    const root = document.documentElement;
    const entries = Object.entries(vars) as [string, string][];
    for (const [k, v] of entries) root.style.setProperty(k, v);
    return () => {
      for (const [k] of entries) root.style.removeProperty(k);
    };
  }, [vars]);
  return null;
}
