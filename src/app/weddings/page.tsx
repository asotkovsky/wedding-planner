import { desc, eq } from "drizzle-orm";
import { Heart } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { UserMenu } from "@/components/user-menu";
import { db } from "@/db";
import { weddingMembers, weddings } from "@/db/schema";
import { requireUser } from "@/lib/access";
import { daysUntil, formatDate } from "@/lib/format";
import { themeVars } from "@/lib/theme";
import { CreateWeddingForm } from "./create-wedding-form";

export default async function WeddingsPage() {
  const user = await requireUser();
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

      <div>
        <h1 className="text-3xl font-extrabold md:text-4xl">Hi, {user.name.split(" ")[0]}! 👋</h1>
        <p className="text-muted-foreground">
          {rows.length ? "Which celebration are we planning today?" : "Let's start planning something wonderful."}
        </p>
      </div>

      {rows.length > 0 && (
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
      )}

      <Card className="rounded-3xl">
        <CardHeader>
          <CardTitle className="font-display text-xl font-bold">
            {rows.length ? "Plan another wedding 💍" : "Plan your wedding 💍"}
          </CardTitle>
          <CardDescription>Just the basics for now. You can change everything later.</CardDescription>
        </CardHeader>
        <CardContent>
          <CreateWeddingForm />
        </CardContent>
      </Card>
    </main>
  );
}
