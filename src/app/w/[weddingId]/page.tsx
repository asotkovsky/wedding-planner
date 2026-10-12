import { and, asc, desc, eq, isNull, ne } from "drizzle-orm";
import { ArrowRight, CircleDollarSign, ClipboardCheck, Clock, MapPin, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { IconChip } from "@/components/brand";
import { SECTIONS } from "@/components/sections";
import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { vendorIcon } from "@/components/vendor-icons";
import { db } from "@/db";
import { activityLog, guests, tasks, user, vendorPayments, vendors } from "@/db/schema";
import { canEdit } from "@/lib/access";
import { todayIn } from "@/lib/datetime";
import { daysUntil, formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { getCtx } from "@/server/action";
import { getBudgetSummary } from "@/server/budget";
import { listSubEvents } from "@/server/events";

export default async function OverviewPage({ params }: { params: Promise<{ weddingId: string }> }) {
  const { weddingId } = await params;
  const { ctx, wedding, role } = await getCtx(weddingId);
  const today = todayIn(wedding.timezone);
  const base = `/w/${weddingId}`;

  const [guestRows, events, budget, openTasks, duePayments, vendorRows, activity] = await Promise.all([
    db.select({ id: guests.id }).from(guests).where(eq(guests.weddingId, weddingId)),
    listSubEvents(ctx),
    getBudgetSummary(ctx),
    db
      .select({ id: tasks.id, title: tasks.title, dueDate: tasks.dueDate })
      .from(tasks)
      .where(and(eq(tasks.weddingId, weddingId), ne(tasks.status, "done")))
      .orderBy(asc(tasks.dueDate))
      .limit(5),
    db
      .select({
        id: vendorPayments.id,
        description: vendorPayments.description,
        amountCents: vendorPayments.amountCents,
        dueDate: vendorPayments.dueDate,
        vendor: vendors.name,
      })
      .from(vendorPayments)
      .innerJoin(vendors, eq(vendors.id, vendorPayments.vendorId))
      .where(and(eq(vendorPayments.weddingId, weddingId), isNull(vendorPayments.paidOn)))
      .orderBy(asc(vendorPayments.dueDate))
      .limit(5),
    db
      .select({ id: vendors.id, name: vendors.name, category: vendors.category, status: vendors.status })
      .from(vendors)
      .where(eq(vendors.weddingId, weddingId))
      .orderBy(asc(vendors.category)),
    db
      .select({
        id: activityLog.id,
        summary: activityLog.summary,
        viaAssistant: activityLog.viaAssistant,
        createdAt: activityLog.createdAt,
        actor: user.name,
      })
      .from(activityLog)
      .leftJoin(user, eq(user.id, activityLog.actorUserId))
      .where(eq(activityLog.weddingId, weddingId))
      .orderBy(desc(activityLog.createdAt))
      .limit(6),
  ]);

  const days = wedding.date ? daysUntil(wedding.date) : null;
  const money = (c: number) => formatMoney(c, wedding.currency);
  const booked = vendorRows.filter((v) => v.status === "booked");

  // Merge tasks and payments into one "Up next" list, soonest first.
  const upNext = [
    ...openTasks.map((t) => ({ kind: "task" as const, id: t.id, title: t.title, detail: null as string | null, due: t.dueDate })),
    ...duePayments.map((p) => ({
      kind: "payment" as const,
      id: p.id,
      title: `Pay ${p.vendor}`,
      detail: `${p.description} · ${money(p.amountCents)}`,
      due: p.dueDate,
    })),
  ]
    .sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999"))
    .slice(0, 6);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-soft p-6 sticker md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-dots opacity-60 mask-[linear-gradient(to_left,black,transparent_70%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="space-y-2">
            <p className="text-sm font-semibold tracking-wide text-brand-ink uppercase">
              {wedding.partner1Name} <span aria-hidden>♥</span> {wedding.partner2Name}
            </p>
            <h1 className="text-3xl leading-tight font-extrabold md:text-5xl">
              {days === null
                ? "Pick a date, any date!"
                : days > 1
                  ? `${days} days to go!`
                  : days === 1
                    ? "Tomorrow's the day!"
                    : days === 0
                      ? "Today's the day! 🎉"
                      : "Happily married ✦"}
            </h1>
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
              {wedding.date ? (
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="size-4" /> {formatDate(wedding.date, { dateStyle: "full" })}
                </span>
              ) : (
                <Link href={`${base}/settings`} className="underline">
                  Set your wedding date
                </Link>
              )}
              {wedding.venueName && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {wedding.venueName}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <OpenAssistantButton />
            {canEdit(role) && (
              <Button asChild variant="outline" className="bg-background">
                <Link href={`${base}/guests`}>
                  <UserPlus /> Add guests
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* RSVPs */}
        <Card href={`${base}/guests`} section="guests" title="RSVPs" className="lg:col-span-2">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {guestRows.length} guests so far. Add your events (ceremony, reception…) so guests can RSVP.
            </p>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                <span className="font-display text-2xl font-bold text-foreground">{guestRows.length}</span> guests invited
              </p>
              {events.map((e) => {
                const pending = Math.max(e.invited - e.attending - e.declined, 0);
                const pct = (n: number) => (e.invited ? (n / e.invited) * 100 : 0);
                return (
                  <div key={e.id} className="space-y-1.5">
                    <div className="flex flex-wrap justify-between gap-x-2 text-sm">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        {e.attending} yes · {e.declined} no · {pending} waiting
                      </span>
                    </div>
                    <div
                      className="flex h-2.5 overflow-hidden rounded-full bg-no-soft"
                      role="img"
                      aria-label={`${e.name}: ${e.attending} attending, ${e.declined} declined, ${pending} waiting`}
                    >
                      <div className="bg-yes" style={{ width: `${pct(e.attending)}%` }} />
                      <div className="bg-no" style={{ width: `${pct(e.declined)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Budget */}
        <Card href={`${base}/budget`} section="budget" title="Budget">
          {budget.totalBudgetCents ? (
            <div className="space-y-3">
              <p>
                <span className="font-display text-2xl font-bold">{money(budget.committedCents)}</span>
                <span className="text-sm text-muted-foreground"> of {money(budget.totalBudgetCents)} committed</span>
              </p>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div
                  className={cn(
                    "h-full rounded-full",
                    budget.committedCents > budget.totalBudgetCents ? "bg-late" : "bg-mint",
                  )}
                  style={{ width: `${Math.min(100, (budget.committedCents / budget.totalBudgetCents) * 100)}%` }}
                />
              </div>
              <p className="text-sm text-muted-foreground">
                {money(budget.paidCents)} paid ·{" "}
                {budget.committedCents <= budget.totalBudgetCents
                  ? `${money(budget.totalBudgetCents - budget.committedCents)} to play with`
                  : `${money(budget.committedCents - budget.totalBudgetCents)} over`}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Set a total budget to see how you&apos;re tracking.</p>
          )}
        </Card>

        {/* Up next */}
        <Card section="tasks" title="Up next" className="lg:col-span-2">
          {upNext.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing due. Enjoy the calm! ☕</p>
          ) : (
            <ul className="divide-y">
              {upNext.map((item) => {
                const overdue = item.due != null && item.due < today;
                return (
                  <li key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5">
                    <IconChip
                      icon={item.kind === "task" ? ClipboardCheck : CircleDollarSign}
                      tone={item.kind === "task" ? "sun" : "peach"}
                      size="sm"
                    />
                    <Link
                      href={`${base}/${item.kind === "task" ? "tasks" : "vendors"}`}
                      className="min-w-0 flex-1 hover:underline"
                    >
                      <div className="truncate font-medium">{item.title}</div>
                      {item.detail && <div className="truncate text-xs text-muted-foreground">{item.detail}</div>}
                    </Link>
                    {item.due ? (
                      <StatusPill status={overdue ? "late" : "maybe"} icon={overdue}>
                        {overdue ? "Overdue · " : ""}
                        {formatDate(item.due, { month: "short", day: "numeric" })}
                      </StatusPill>
                    ) : (
                      <span className="text-xs text-muted-foreground">No date</span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Vendors */}
        <Card href={`${base}/vendors`} section="vendors" title="Your dream team">
          <p className="mb-3 text-sm text-muted-foreground">
            <span className="font-display text-2xl font-bold text-foreground">{booked.length}</span> of{" "}
            {vendorRows.length} booked
          </p>
          <div className="flex flex-wrap gap-2">
            {vendorRows.map((v) => {
              const Icon = vendorIcon(v.category);
              return (
                <span
                  key={v.id}
                  title={`${v.name} · ${v.category} · ${v.status}`}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
                    v.status === "booked" ? "border-foreground bg-pop-soft" : "border-dashed text-muted-foreground",
                  )}
                >
                  <Icon className="size-3.5" /> {v.category}
                </span>
              );
            })}
            {vendorRows.length === 0 && <span className="text-sm text-muted-foreground">No vendors yet.</span>}
          </div>
        </Card>

        {/* Activity */}
        <Card section="overview" title="Recent activity" className="lg:col-span-3">
          <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
            {activity.map((a) => (
              <li key={a.id} className="flex items-start gap-2 text-sm">
                {a.viaAssistant ? (
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-brand-ink" aria-label="Via assistant" />
                ) : (
                  <span className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" aria-hidden />
                )}
                <span>
                  {/* Guest RSVPs have no signed-in actor; their summary names the household. */}
                  {a.actor ? (
                    <>
                      <span className="font-medium">{a.actor}</span> {lowerFirst(a.summary)}
                    </>
                  ) : (
                    <span className="font-medium">💌 {a.summary}</span>
                  )}
                  <span className="text-muted-foreground"> · {timeAgo(a.createdAt)}</span>
                </span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}

function Card({
  section,
  title,
  href,
  className,
  children,
}: {
  section: keyof typeof SECTIONS;
  title: string;
  href?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const s = SECTIONS[section];
  return (
    <section className={cn("min-w-0 rounded-2xl border bg-card p-5", className)}>
      <header className="mb-4 flex items-center gap-2.5">
        <IconChip icon={s.icon} tone={s.tone} size="sm" />
        <h2 className="flex-1 text-lg font-bold">{title}</h2>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            View <ArrowRight className="size-3.5" />
          </Link>
        )}
      </header>
      {children}
    </section>
  );
}

function lowerFirst(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}

function timeAgo(d: Date) {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.round(hrs / 24)}d ago`;
}
