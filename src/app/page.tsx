import { CircleDollarSign, Sparkles, UsersRound, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { IconChip, Logo, type Tone } from "@/components/brand";
import { StickerScatter } from "@/components/sticker-scatter";
import { Button } from "@/components/ui/button";
import { getSession } from "@/lib/access";

const FEATURES: { icon: LucideIcon; tone: Tone; title: string; body: string }[] = [
  {
    icon: UsersRound,
    tone: "sky",
    title: "Guests & RSVPs",
    body: "Households, plus-ones, meal picks and per-event RSVPs, with a personal page for every party.",
  },
  {
    icon: CircleDollarSign,
    tone: "mint",
    title: "Vendors & budget",
    body: "Contracts, deposits and due dates in one place, so nothing sneaks up on you.",
  },
  {
    icon: Sparkles,
    tone: "brand",
    title: "A planner that types",
    body: "“Add the Garcias and draft our day-of timeline.” Done. Just approve anything big.",
  },
];

export default async function Home() {
  if (await getSession()) redirect("/weddings");

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between p-6">
        <Logo />
        <Button asChild variant="ghost">
          <Link href="/sign-in">Sign in</Link>
        </Button>
      </header>

      <section className="relative mx-auto max-w-6xl px-6 py-16 text-center md:py-24">
        <StickerScatter className="hidden md:block" />
        <div className="relative mx-auto max-w-2xl space-y-6">
          <p className="inline-flex items-center gap-2 rounded-full bg-pop-soft px-3 py-1 text-sm font-semibold sticker-sm">
            <Sparkles className="size-4" /> Wedding planning, minus the spreadsheets
          </p>
          <h1 className="text-5xl leading-[1.05] font-extrabold md:text-7xl">
            Plan the party,
            <br />
            <span className="relative inline-block">
              <span className="relative z-10">not the paperwork.</span>
              <span aria-hidden className="absolute inset-x-0 bottom-1 z-0 h-4 -rotate-1 rounded-full bg-brand/60" />
            </span>
          </h1>
          <p className="text-lg text-muted-foreground">
            Guests, vendors, budget and the big-day timeline in one cheerful place, plus an AI planner that does the
            busywork.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button asChild className="h-11 px-5 text-base">
              <Link href="/sign-up">Start planning, it&apos;s free</Link>
            </Button>
            <Button asChild variant="outline" className="h-11 px-5 text-base">
              <Link href="/sign-in">I have an account</Link>
            </Button>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-6 pb-20 md:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="space-y-3 rounded-2xl border bg-card p-6">
            <IconChip icon={f.icon} tone={f.tone} size="lg" sticker />
            <h2 className="text-xl font-bold">{f.title}</h2>
            <p className="text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
    </main>
  );
}
