import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { TONE_CLASSES, type Tone } from "./brand";

/**
 * A small illustration: the section's icon as a sticker on a soft blob, with sparkles
 * and a heart scattered around it.
 */
export function EmptyState({
  icon: Icon,
  tone = "brand",
  title,
  description,
  children,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  title: string;
  description?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4 px-4 py-12 text-center", className)}>
      <div className="relative size-36" aria-hidden>
        <svg viewBox="0 0 160 160" className={cn("absolute inset-0 size-full", TONE_CLASSES[tone], "bg-transparent")}>
          <path
            fill="currentColor"
            opacity="0.14"
            d="M80 8c22 0 46 9 58 28s14 44 4 66-30 42-56 46-52-6-66-26S2 72 12 50 58 8 80 8z"
          />
          {/* sparkles */}
          <path fill="var(--pop)" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" d="M128 22l3 8 8 3-8 3-3 8-3-8-8-3 8-3z" />
          <path fill="var(--brand)" stroke="var(--foreground)" strokeWidth="2" strokeLinejoin="round" d="M26 110l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
          {/* heart */}
          <path
            fill="var(--brand)"
            stroke="var(--foreground)"
            strokeWidth="2"
            d="M134 116c-3-5-10-4-11 1-1 4 3 8 11 13 8-5 12-9 11-13-1-5-8-6-11-1z"
          />
          <circle cx="36" cy="34" r="4" fill="var(--foreground)" />
          <circle cx="118" cy="142" r="3" fill="var(--foreground)" />
        </svg>
        <span
          className={cn(
            "sticker absolute inset-1/2 flex size-18 -translate-x-1/2 -translate-y-1/2 -rotate-6 items-center justify-center rounded-3xl [&_svg]:size-9 [&_svg]:stroke-[2.25]",
            TONE_CLASSES[tone],
          )}
        >
          <Icon />
        </span>
      </div>
      <div className="max-w-sm space-y-1">
        <h3 className="text-lg font-bold">{title}</h3>
        {description && <p className="text-sm text-muted-foreground">{description}</p>}
      </div>
      {children && <div className="flex flex-wrap justify-center gap-2">{children}</div>}
    </div>
  );
}
