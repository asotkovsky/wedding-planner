import { CakeSlice, Gem, Heart, Mail, PartyPopper, Wine, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { IconChip, type Tone } from "./brand";

type Sticker = { icon: LucideIcon; tone: Tone; className: string };

// Spread around a centered hero.
const SPREAD: Sticker[] = [
  { icon: Gem, tone: "sky", className: "top-[8%] left-[10%] rotate-[-12deg]" },
  { icon: Heart, tone: "rose", className: "top-[18%] right-[12%] rotate-[10deg]" },
  { icon: CakeSlice, tone: "peach", className: "bottom-[22%] left-[14%] rotate-[8deg]" },
  { icon: Wine, tone: "lilac", className: "bottom-[10%] right-[18%] rotate-[-8deg]" },
  { icon: Mail, tone: "sun", className: "top-[48%] left-[4%] rotate-[14deg]" },
  { icon: PartyPopper, tone: "mint", className: "top-[44%] right-[4%] rotate-[-14deg]" },
];

// Hugging the right and bottom edges, leaving the top-left for a logo and copy.
const EDGE: Sticker[] = [
  { icon: Gem, tone: "sky", className: "top-[7%] right-[10%] rotate-[-12deg]" },
  { icon: Heart, tone: "rose", className: "top-[24%] right-[26%] rotate-[10deg]" },
  { icon: PartyPopper, tone: "mint", className: "top-[40%] right-[6%] rotate-[-14deg]" },
  { icon: CakeSlice, tone: "peach", className: "bottom-[24%] right-[22%] rotate-[8deg]" },
  { icon: Wine, tone: "lilac", className: "bottom-[9%] right-[8%] rotate-[-8deg]" },
  { icon: Mail, tone: "sun", className: "bottom-[16%] left-[46%] rotate-[14deg]" },
];

/** Decorative wedding stickers scattered over a hero area. */
export function StickerScatter({ className, layout = "spread" }: { className?: string; layout?: "spread" | "edge" }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {(layout === "edge" ? EDGE : SPREAD).map(({ icon, tone, className: pos }, i) => (
        <IconChip key={i} icon={icon} tone={tone} size="lg" sticker className={cn("absolute", pos)} />
      ))}
    </div>
  );
}
