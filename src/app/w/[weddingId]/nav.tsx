"use client";

import {
  CalendarClock,
  CalendarDays,
  ChevronsUpDown,
  ListChecks,
  LayoutDashboard,
  Plus,
  Settings,
  Sparkles,
  Store,
  Users,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

const sections = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/assistant", label: "Assistant", icon: Sparkles },
  { href: "/guests", label: "Guests", icon: Users },
  { href: "/events", label: "Events", icon: CalendarDays },
  { href: "/vendors", label: "Vendors", icon: Store },
  { href: "/budget", label: "Budget", icon: Wallet },
  { href: "/tasks", label: "Tasks", icon: ListChecks },
  { href: "/timeline", label: "Day-of timeline", icon: CalendarClock },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function WeddingNav({ weddingId }: { weddingId: string }) {
  const pathname = usePathname();
  const base = `/w/${weddingId}`;

  return (
    <nav className="flex gap-1 overflow-x-auto md:flex-col">
      {sections.map(({ href, label, icon: Icon }) => {
        const full = base + href;
        const active = href === "" ? pathname === base : pathname.startsWith(full);
        return (
          <Link
            key={href}
            href={full}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm whitespace-nowrap transition-colors hover:bg-muted",
              active && "bg-muted font-medium",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

export function WeddingSwitcher({
  current,
  weddings,
}: {
  current: { id: string; name: string };
  weddings: { id: string; name: string }[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="w-full justify-between">
          <span className="truncate">{current.name}</span>
          <ChevronsUpDown className="size-4 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {weddings.map((w) => (
          <DropdownMenuItem key={w.id} asChild>
            <Link href={`/w/${w.id}`}>{w.name}</Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/weddings">
            <Plus /> New wedding
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
