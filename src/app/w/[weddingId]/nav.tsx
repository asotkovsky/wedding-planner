"use client";

import { ChevronsUpDown, Ellipsis, Heart, Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAssistant } from "@/components/assistant/assistant-shell";
import { IconChip } from "@/components/brand";
import { NAV_ORDER, SECTIONS, type SectionKey } from "@/components/sections";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

function useActive(weddingId: string) {
  const pathname = usePathname();
  const base = `/w/${weddingId}`;
  return (key: SectionKey) => {
    const href = base + SECTIONS[key].href;
    return key === "overview" ? pathname === base : pathname.startsWith(href);
  };
}

/** Desktop sidebar navigation. */
export function WeddingNav({ weddingId }: { weddingId: string }) {
  const isActive = useActive(weddingId);
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ORDER.map((key) => {
        const s = SECTIONS[key];
        const active = isActive(key);
        return (
          <Link
            key={key}
            href={`/w/${weddingId}${s.href}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-2 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              active && "bg-brand-soft font-semibold hover:bg-brand-soft",
            )}
          >
            <IconChip
              icon={s.icon}
              tone={s.tone}
              size="sm"
              sticker={active}
              className="transition-transform group-hover:-rotate-6"
            />
            {key === "timeline" ? "Day-of timeline" : s.label}
          </Link>
        );
      })}
    </nav>
  );
}

// The centre slot is the assistant ("Planner"), so it never floats over content on phones.
const MOBILE_LEFT: SectionKey[] = ["overview", "guests"];
const MOBILE_RIGHT: SectionKey[] = ["vendors"];
const MOBILE_MORE: SectionKey[] = ["tasks", "events", "budget", "timeline", "settings"];

/** Phone navigation: a bottom tab bar with a "More" menu. */
export function MobileTabBar({ weddingId }: { weddingId: string }) {
  const isActive = useActive(weddingId);
  const assistant = useAssistant();
  const moreActive = MOBILE_MORE.some(isActive);
  const tab = (key: SectionKey) => {
    const s = SECTIONS[key];
    const active = isActive(key);
    return (
      <Link
        key={key}
        href={`/w/${weddingId}${s.href}`}
        aria-current={active ? "page" : undefined}
        className={cn(
          "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
          active && "text-foreground",
        )}
      >
        <IconChip icon={s.icon} tone={active ? s.tone : "gray"} size="sm" sticker={active} />
        {s.label}
      </Link>
    );
  };
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
      {MOBILE_LEFT.map(tab)}
      <button
        type="button"
        onClick={assistant.toggle}
        aria-pressed={assistant.open}
        className="flex flex-col items-center gap-0.5 pb-2 text-[11px] font-semibold"
      >
        <span className="-mt-4 flex size-12 items-center justify-center rounded-2xl bg-brand text-brand-foreground sticker">
          <Sparkles className="size-5" />
        </span>
        Planner
      </button>
      {MOBILE_RIGHT.map(tab)}
      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            "flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium text-muted-foreground",
            moreActive && "text-foreground",
          )}
        >
          <IconChip icon={Ellipsis} tone={moreActive ? "brand" : "gray"} size="sm" sticker={moreActive} />
          More
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" side="top" className="w-52">
          {MOBILE_MORE.map((key) => {
            const s = SECTIONS[key];
            return (
              <DropdownMenuItem key={key} asChild>
                <Link href={`/w/${weddingId}${s.href}`}>
                  <IconChip icon={s.icon} tone={s.tone} size="sm" />
                  {key === "timeline" ? "Day-of timeline" : s.label}
                </Link>
              </DropdownMenuItem>
            );
          })}
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}

export function WeddingSwitcher({
  current,
  weddings,
  compact = false,
}: {
  current: { id: string; name: string };
  weddings: { id: string; name: string }[];
  compact?: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("justify-between rounded-xl", compact ? "max-w-52" : "h-10 w-full")}>
          <span className="flex min-w-0 items-center gap-2">
            <Heart className="size-4 fill-brand text-brand-ink" />
            <span className="truncate font-display font-semibold">{current.name}</span>
          </span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-60">
        {weddings.map((w) => (
          <DropdownMenuItem key={w.id} asChild>
            <Link href={`/w/${w.id}`}>{w.name}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/weddings">
            <Plus /> Plan another wedding
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
