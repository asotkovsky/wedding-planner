import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type Tone = "brand" | "pop" | "rose" | "sun" | "mint" | "sky" | "lilac" | "peach" | "gray";

export const TONE_CLASSES: Record<Tone, string> = {
  brand: "bg-brand-soft text-brand-ink",
  pop: "bg-pop-soft text-foreground",
  rose: "bg-rose-soft text-rose",
  sun: "bg-sun-soft text-sun",
  mint: "bg-mint-soft text-mint",
  sky: "bg-sky-soft text-sky",
  lilac: "bg-lilac-soft text-lilac",
  peach: "bg-peach-soft text-peach",
  gray: "bg-muted text-muted-foreground",
};

const CHIP_SIZES = {
  sm: "size-7 rounded-lg [&_svg]:size-4",
  md: "size-9 rounded-xl [&_svg]:size-[18px]",
  lg: "size-12 rounded-2xl [&_svg]:size-6",
};

/** A tinted rounded square holding an icon; `sticker` adds the outlined pop look. */
export function IconChip({
  icon: Icon,
  tone = "brand",
  size = "md",
  sticker = false,
  className,
}: {
  icon: LucideIcon;
  tone?: Tone;
  size?: keyof typeof CHIP_SIZES;
  sticker?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex shrink-0 items-center justify-center [&_svg]:stroke-[2.25]",
        CHIP_SIZES[size],
        TONE_CLASSES[tone],
        sticker && "sticker-sm",
        className,
      )}
    >
      <Icon />
    </span>
  );
}

/** The app mark: two interlocking wedding rings, one with a sparkly diamond, in a sticker badge. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex size-8 items-center justify-center rounded-xl bg-brand sticker-sm", className)}
    >
      <svg viewBox="1 1 22 22" className="size-6 text-brand-foreground" fill="none">
        <circle cx="9" cy="15" r="5.2" stroke="currentColor" strokeWidth="2" />
        <circle cx="15" cy="15" r="5.2" stroke="currentColor" strokeWidth="2" />
        {/* A classic cut diamond set on the left ring: crown, girdle and pavilion facets. */}
        <path d="M7.2 4.4h3.6L12.6 7 9 11 5.4 7z" fill="#EAF7FF" stroke="#1F1F23" strokeWidth=".9" strokeLinejoin="round" />
        <path d="M5.4 7h7.2L9 11z" fill="#C9ECFF" />
        <path
          d="M5.4 7h7.2M7.2 4.4 8.1 7 9 4.4l.9 2.6.9-2.6M8.1 7 9 11l.9-4"
          stroke="#1F1F23"
          strokeWidth=".55"
          strokeLinejoin="round"
          opacity=".7"
        />
        <path d="M7.7 5.1h1" stroke="#fff" strokeWidth=".7" strokeLinecap="round" />
        {/* sparkle */}
        <path d="M15.3 1.9l.5 1.4 1.4.5-1.4.5-.5 1.4-.5-1.4-1.4-.5 1.4-.5z" fill="#fff" stroke="#1F1F23" strokeWidth=".5" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-display text-lg font-bold tracking-tight", className)}>
      <LogoMark />
      I&nbsp;Do&nbsp;Crew
    </span>
  );
}
