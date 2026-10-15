import { desc, eq } from "drizzle-orm";
import { ArrowRight, Gem, Heart, Link2, Plus, UsersRound } from "lucide-react";
import Link from "next/link";
import { IconChip, Logo } from "@/components/brand";
import { StickerScatter } from "@/components/sticker-scatter";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { weddingMembers, weddings } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { daysUntil, formatDate } from "@/lib/format";
import { themeVars } from "@/lib/theme";

export default async function WeddingsPage() {
  const user = await requireUser();
  const firstName = user.name.split(" ")[0];
  const rows = await db
    .select({
      id: weddings.id,
      name: weddings.name,
      date: weddings.date,
      venueName: weddings.venueName,
      themePrimary: weddings.themePrimary,
      themeAccent: weddings.themeAccent,
      role: weddingMembers.role,
    })
    .from(weddingMembers)
    .innerJoin(weddings, eq(weddings.id, weddingMembers.weddingId))
    .where(eq(weddingMembers.userId, user.id))
    .orderBy(desc(weddings.createdAt));

  return (
    <main className="mx-auto max-w-4xl space-y-8 p-6">
      <header className="flex items-center justify-between">
        <Logo />
        <UserMenu name={user.name} email={user.email} />
      </header>

      {rows.length === 0 ? (
        <Welcome firstName={firstName} />
      ) : (
        <>
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-extrabold md:text-4xl">Hi, {firstName}! 👋</h1>
              <p className="text-muted-foreground">Which celebration are we planning today?</p>
            </div>
            <Button asChild>
              <Link href="/weddings/new">
                <Plus /> Plan another wedding
              </Link>
            </Button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {rows.map((w) => {
              const days = w.date ? daysUntil(w.date) : null;
              return (
                // Each card wears its own wedding's colors.
                <Link key={w.id} href={`/w/${w.id}`} style={themeVars(w.themePrimary, w.themeAccent)} className="group">
                  <div className="relative overflow-hidden rounded-3xl bg-brand-soft p-5 transition-transform sticker group-hover:-translate-y-0.5 group-hover:rotate-[-0.5deg]">
                    <div className="absolute inset-0 bg-dots opacity-40 mask-[linear-gradient(to_left,black,transparent_60%)]" />
                    <div className="relative space-y-1">
                      <div className="flex items-center justify-between">
                        <Heart className="size-5 fill-brand text-foreground" />
                        <span className="rounded-full bg-background px-2 py-0.5 text-xs font-semibold capitalize">
                          {w.role}
                        </span>
                      </div>
                      <h2 className="pt-2 text-2xl font-extrabold">{w.name}</h2>
                      <p className="text-sm text-muted-foreground">
                        {w.date ? formatDate(w.date) : "Date to be decided"}
                        {w.venueName && ` · ${w.venueName}`}
                      </p>
                      {days !== null && days >= 0 && (
                        <p className="pt-2 font-display text-lg font-bold text-brand-ink">
                          {days === 0 ? "It's today! 🎉" : `${days} days to go`}
                        </p>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>

          <p className="text-sm text-muted-foreground">
            Looking for a wedding you&apos;re helping with? Ask its organizer to send you an invite link.
          </p>
        </>
      )}
    </main>
  );
}

/** First visit: are you the couple, or helping someone else plan? */
function Welcome({ firstName }: { firstName: string }) {
  return (
    <div className="space-y-8">
      <section className="relative overflow-hidden rounded-3xl bg-brand-soft px-6 py-12 text-center sticker md:py-16">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-50" />
        <StickerScatter className="hidden md:block" />
        <div className="relative mx-auto max-w-lg space-y-3">
          <p className="text-sm font-semibold tracking-wide text-brand-ink uppercase">Welcome to the crew</p>
          <h1 className="text-4xl leading-tight font-extrabold md:text-5xl">So glad you&apos;re here, {firstName}! 🥂</h1>
          <p className="text-lg text-muted-foreground">Let&apos;s get you to the right place.</p>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <Link href="/weddings/new" className="group">
          <div className="flex h-full flex-col gap-4 rounded-3xl border-2 border-foreground bg-card p-6 transition-transform group-hover:-translate-y-0.5 group-hover:shadow-[4px_4px_0_0_var(--foreground)]">
            <IconChip icon={Gem} tone="brand" size="lg" sticker className="-rotate-6" />
            <div className="space-y-1">
              <h2 className="text-2xl font-extrabold">We&apos;re getting married! 💍</h2>
              <p className="text-muted-foreground">
                Set up your wedding HQ in about a minute: names, the date and your colors.
              </p>
            </div>
            <span className="mt-auto inline-flex items-center gap-1.5 font-semibold text-brand-ink">
              Start planning <ArrowRight className="size-4 transition-transform group-hover:translate-x-1" />
            </span>
          </div>
        </Link>

        <div className="flex h-full flex-col gap-4 rounded-3xl border-2 border-dashed bg-card p-6">
          <IconChip icon={UsersRound} tone="sky" size="lg" sticker className="rotate-6" />
          <div className="space-y-1">
            <h2 className="text-2xl font-extrabold">I&apos;m helping plan a wedding</h2>
            <p className="text-muted-foreground">
              Planner, maid of honor, mom? Ask the couple (or whoever set things up) to send you an{" "}
              <span className="font-semibold text-foreground">invite link</span>. They&apos;ll find it in{" "}
              <span className="font-semibold text-foreground">Settings → Your planning crew</span>.
            </p>
          </div>
          <p className="mt-auto inline-flex items-start gap-2 rounded-xl bg-muted p-3 text-sm">
            <Link2 className="mt-0.5 size-4 shrink-0" />
            Got the link already? Just open it while signed in and you&apos;ll join their planning crew.
          </p>
        </div>
      </div>
    </div>
  );
}
