"use client";

import { Check, Heart, RotateCcw, Sparkles } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/celebrate";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DEFAULT_PALETTE, normalizeHex, PALETTES, themeVars } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { updateWeddingColors } from "./actions";

export function ColorsForm({
  weddingId,
  primary: savedPrimary,
  accent: savedAccent,
  disabled,
}: {
  weddingId: string;
  primary: string | null;
  accent: string | null;
  disabled: boolean;
}) {
  const [primary, setPrimary] = useState(savedPrimary ?? DEFAULT_PALETTE.primary);
  const [accent, setAccent] = useState(savedAccent ?? DEFAULT_PALETTE.accent);
  const [pending, startTransition] = useTransition();
  const selected = PALETTES.find((p) => p.primary === primary && p.accent === accent)?.id;
  const dirty =
    primary !== (savedPrimary ?? DEFAULT_PALETTE.primary) || accent !== (savedAccent ?? DEFAULT_PALETTE.accent);

  function save(next: { primary: string | null; accent: string | null }) {
    startTransition(async () => {
      const result = await updateWeddingColors(weddingId, next);
      if (result?.ok) {
        toast.success("Looking lovely! Colors saved.");
        // Let the refreshed theme land before the confetti picks up the new colors.
        setTimeout(() => celebrate(), 150);
      } else toast.error(result?.error ?? "Couldn't save colors");
    });
  }

  return (
    <div className="space-y-5">
      <fieldset disabled={disabled} className="space-y-5">
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {PALETTES.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={selected === p.id}
              onClick={() => {
                setPrimary(p.primary);
                setAccent(p.accent);
              }}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-xs font-medium transition-colors hover:bg-muted",
                selected === p.id ? "border-foreground bg-muted" : "border-transparent",
              )}
            >
              <span className="relative flex">
                <span className="size-8 rounded-full border-2 border-foreground" style={{ background: p.primary }} />
                <span className="-ml-3 size-8 rounded-full border-2 border-foreground" style={{ background: p.accent }} />
                {selected === p.id && (
                  <Check className="absolute -top-1 -right-1 size-4 rounded-full bg-foreground p-0.5 text-background" />
                )}
              </span>
              {p.name}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-6">
          <ColorInput label="Main color" value={primary} onChange={setPrimary} />
          <ColorInput label="Accent color" value={accent} onChange={setAccent} />
        </div>
      </fieldset>

      {/* Live preview, themed with the unsaved colors. */}
      <div style={themeVars(primary, accent)} className="rounded-2xl border-2 border-dashed p-4">
        <p className="mb-3 text-xs font-semibold tracking-wide text-muted-foreground uppercase">Preview</p>
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground sticker-sm">
            <Sparkles className="size-4" /> Ask your planner
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand-ink">
            <Heart className="size-3.5 fill-current" /> 244 days to go!
          </span>
          <span className="inline-flex items-center rounded-full border border-foreground bg-pop-soft px-3 py-1 text-xs font-medium">
            Photographer · booked
          </span>
          <span className="h-2.5 w-28 overflow-hidden rounded-full bg-muted">
            <span className="block h-full w-2/3 rounded-full bg-brand" />
          </span>
        </div>
      </div>

      {!disabled && (
        <div className="flex flex-wrap gap-2">
          <Button disabled={!dirty || pending} onClick={() => save({ primary, accent })}>
            Save colors
          </Button>
          <Button
            variant="ghost"
            disabled={pending || (!savedPrimary && !savedAccent)}
            onClick={() => {
              setPrimary(DEFAULT_PALETTE.primary);
              setAccent(DEFAULT_PALETTE.accent);
              save({ primary: null, accent: null });
            }}
          >
            <RotateCcw /> Reset to default
          </Button>
        </div>
      )}
    </div>
  );
}

function ColorInput({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  // While typing, show the draft; otherwise show the current color (e.g. after a palette pick).
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          aria-label={`${label} picker`}
          className="size-9 cursor-pointer rounded-lg border-2 border-foreground bg-transparent p-0.5"
        />
        <input
          value={draft ?? value}
          onFocus={() => setDraft(value)}
          onBlur={() => setDraft(null)}
          onChange={(e) => {
            setDraft(e.target.value);
            const hex = normalizeHex(e.target.value);
            if (hex) onChange(hex);
          }}
          aria-label={`${label} hex`}
          className="h-9 w-28 rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm uppercase"
        />
      </div>
    </div>
  );
}
