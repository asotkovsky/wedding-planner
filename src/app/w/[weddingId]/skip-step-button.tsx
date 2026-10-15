"use client";

import { ChevronRight } from "lucide-react";
import { useAction } from "@/components/use-action";
import { setFirstStepSkipped } from "./actions";

export function SkipStepButton({ weddingId, step, skipped }: { weddingId: string; step: string; skipped: boolean }) {
  const { pending, run } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      className="inline-flex items-center rounded px-1 text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline disabled:opacity-50"
      onClick={() => run(() => setFirstStepSkipped(weddingId, step, !skipped))}
    >
      {skipped ? "Undo" : "Skip"}
      {!skipped && <ChevronRight className="size-3" aria-hidden />}
    </button>
  );
}
