"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import type { ActionResult } from "@/server/action";

/**
 * Runs a server action that returns an ActionResult, with a pending flag and toasts.
 * Resolves to the data on success, or undefined on failure.
 */
export function useAction() {
  const [pending, startTransition] = useTransition();

  function run<T>(fn: () => Promise<ActionResult<T>>, success?: string): Promise<T | undefined> {
    return new Promise((resolve) => {
      startTransition(async () => {
        try {
          const result = await fn();
          if (result.ok) {
            if (success) toast.success(success);
            resolve(result.data);
          } else {
            toast.error(result.error);
            resolve(undefined);
          }
        } catch {
          toast.error("Something went wrong");
          resolve(undefined);
        }
      });
    });
  }

  return { pending, run };
}

/** Reads a form into a plain object of strings (checkboxes: "on" when checked). */
export function formObject(form: HTMLFormElement): Record<string, string> {
  return Object.fromEntries([...new FormData(form).entries()].map(([k, v]) => [k, String(v)]));
}
