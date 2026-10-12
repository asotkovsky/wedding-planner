import {
  BedDouble,
  CalendarPlus,
  CircleHelp,
  Clock,
  Heart,
  MapPin,
  Plane,
  Shirt,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { IconChip, LogoMark, type Tone } from "@/components/brand";
import { WeddingTheme } from "@/components/wedding-theme";
import { formatDateTime, formatDay, formatTime } from "@/lib/datetime";
import { daysUntil, formatDate } from "@/lib/format";
import { themeVars } from "@/lib/theme";
import { getGuestPage } from "@/server/guest-page";
import { RsvpForm } from "./rsvp-form";

type Params = { params: Promise<{ token: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { token } = await params;
  const page = await getGuestPage(token);
  return {
    title: page ? `${page.wedding.name} · You're invited!` : "Invitation",
    // Personal links: keep them out of search engines and referrer headers.
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

export default async function GuestPage({ params }: Params) {
  const { token } = await params;
  const page = await getGuestPage(token);
  if (!page) notFound();
  const { wedding, household, events, timeline } = page;
  const tz = wedding.timezone;
  const vars = themeVars(wedding.themePrimary, wedding.themeAccent);
  const days = wedding.date ? daysUntil(wedding.date) : null;
  const firstNames = page.guests.map((g) => g.firstName).filter(Boolean) as string[];
  const greeting = firstNames.length ? listNames(firstNames) : household.name;
  const scheduleDays = Map.groupBy(timeline, (t) => formatDay(t.startsAt, tz));

  const sections = [
    events.length && { id: "events", label: "Events" },
    timeline.length && { id: "schedule", label: "Schedule" },
    (wedding.travelInfo || wedding.accommodationInfo) && { id: "travel", label: "Travel & stay" },
    wedding.faq.length && { id: "faq", label: "FAQ" },
    { id: "rsvp", label: "RSVP" },
  ].filter(Boolean) as { id: string; label: string }[];

  return (
    <div style={vars} className="min-h-screen bg-background">
      <WeddingTheme vars={vars} />
      <main className="mx-auto max-w-2xl space-y-10 px-4 py-8 md:py-12">
        {/* Hero */}
        <header className="relative overflow-hidden rounded-3xl bg-brand-soft p-6 text-center sticker md:p-10">
          <div className="pointer-events-none absolute inset-0 bg-dots opacity-50" />
          <div className="relative space-y-4">
            <p className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1 text-sm font-semibold sticker-sm">
              <Sparkles className="size-4 text-brand-ink" /> You&apos;re invited!
            </p>
            <h1 className="text-4xl leading-tight font-extrabold md:text-6xl">
              {wedding.partner1Name}
              <Heart className="mx-2 inline size-8 -translate-y-1 fill-brand text-foreground md:size-11" aria-label="and" />
              {wedding.partner2Name}
            </h1>
            <div className="space-y-1 text-muted-foreground">
              {wedding.date && <p className="text-lg font-semibold text-foreground">{formatDate(wedding.date, { dateStyle: "full" })}</p>}
              {wedding.venueName && (
                <p className="inline-flex items-center gap-1.5">
                  <MapPin className="size-4" /> {wedding.venueName}
                </p>
              )}
            </div>
            {days !== null && days >= 0 && (
              <p className="font-display text-xl font-bold text-brand-ink">
                {days === 0 ? "It's today! 🎉" : days === 1 ? "Tomorrow! 🎉" : `${days} days to go`}
              </p>
            )}
          </div>
        </header>

        <section className="space-y-3 text-center">
          <h2 className="text-2xl font-bold">Hi {greeting}! 👋</h2>
          {wedding.welcomeMessage ? (
            <p className="whitespace-pre-line text-muted-foreground">{wedding.welcomeMessage}</p>
          ) : (
            <p className="text-muted-foreground">
              We can&apos;t wait to celebrate with you. Here&apos;s everything you need to know, and your RSVP is at the
              bottom.
            </p>
          )}
          <nav className="flex flex-wrap justify-center gap-2 pt-2">
            {sections.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className="rounded-full border px-3 py-1 text-sm font-medium transition-colors hover:border-foreground hover:bg-brand-soft"
              >
                {s.label}
              </a>
            ))}
          </nav>
        </section>

        {events.length > 0 && (
          <Section id="events" icon={Sparkles} tone="lilac" title={events.length === 1 ? "You're invited to" : "You're invited to…"}>
            <div className="space-y-4">
              {events.map((e) => (
                <article key={e.id} className="overflow-hidden rounded-2xl border bg-card">
                  <div className="h-1.5 bg-[repeating-linear-gradient(-45deg,var(--brand)_0_10px,var(--pop)_10px_20px)]" aria-hidden />
                  <div className="space-y-3 p-5">
                    <div>
                      <h3 className="text-xl font-bold">{e.name}</h3>
                      {e.startsAt && (
                        <p className="inline-flex items-center gap-1.5 font-medium text-brand-ink">
                          <Clock className="size-4" />
                          {formatDateTime(e.startsAt, tz)}
                          {e.endsAt && ` – ${formatTime(e.endsAt, tz)}`}
                        </p>
                      )}
                    </div>
                    {(e.locationName || e.address) && (
                      <p className="flex gap-2 text-sm">
                        <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                        <span>
                          {e.locationName && <span className="font-medium">{e.locationName}</span>}
                          {e.address && <span className="block text-muted-foreground">{e.address}</span>}
                          <a
                            href={e.mapUrl ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([e.locationName, e.address].filter(Boolean).join(", "))}`}
                            target="_blank"
                            rel="noreferrer"
                            className="mt-0.5 block w-fit text-sm font-medium underline"
                          >
                            Open map
                          </a>
                        </span>
                      </p>
                    )}
                    {e.dressCode && (
                      <p className="flex items-center gap-2 text-sm">
                        <Shirt className="size-4 text-muted-foreground" /> {e.dressCode}
                      </p>
                    )}
                    {e.description && <p className="text-sm whitespace-pre-line text-muted-foreground">{e.description}</p>}
                  </div>
                </article>
              ))}
              {events.some((e) => e.startsAt) && (
                <a
                  href={`/i/${token}/calendar.ics`}
                  className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted"
                >
                  <CalendarPlus className="size-4" /> Add to my calendar
                </a>
              )}
              {wedding.dressCode && (
                <div className="flex gap-3 rounded-2xl border bg-card p-4 text-sm">
                  <Shirt className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <p>
                    <span className="font-semibold">Dress code: </span>
                    {wedding.dressCode}
                  </p>
                </div>
              )}
            </div>
          </Section>
        )}

        {timeline.length > 0 && (
          <Section id="schedule" icon={Clock} tone="rose" title="The schedule">
            {[...scheduleDays].map(([day, items]) => (
              <div key={day} className="space-y-2">
                {scheduleDays.size > 1 && <h3 className="font-bold">{day}</h3>}
                <ol className="ml-1 space-y-3 border-l-2 border-dashed border-brand/50 pl-5">
                  {items.map((t) => (
                    <li key={t.id} className="relative">
                      <span className="absolute top-1 -left-[29px] size-3.5 rounded-full bg-brand sticker-sm" aria-hidden />
                      <p className="font-display text-sm font-bold">
                        {formatTime(t.startsAt, tz)}
                        {t.endsAt && ` – ${formatTime(t.endsAt, tz)}`}
                      </p>
                      <p className="font-medium">{t.title}</p>
                      {(t.location || t.description) && (
                        <p className="text-sm text-muted-foreground">{[t.location, t.description].filter(Boolean).join(" · ")}</p>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </Section>
        )}

        {(wedding.travelInfo || wedding.accommodationInfo) && (
          <Section id="travel" icon={Plane} tone="sky" title="Travel & stay">
            <div className="grid gap-4 sm:grid-cols-2">
              {wedding.travelInfo && <InfoCard icon={Plane} title="Getting there" body={wedding.travelInfo} />}
              {wedding.accommodationInfo && (
                <InfoCard icon={BedDouble} title="Where to stay" body={wedding.accommodationInfo} />
              )}
            </div>
          </Section>
        )}

        {wedding.faq.length > 0 && (
          <Section id="faq" icon={CircleHelp} tone="sun" title="Good questions">
            <div className="divide-y rounded-2xl border bg-card">
              {wedding.faq.map((f, i) => (
                <details key={i} className="group p-4">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-medium">
                    {f.question}
                    <span className="text-xl leading-none text-muted-foreground transition-transform group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-2 text-sm whitespace-pre-line text-muted-foreground">{f.answer}</p>
                </details>
              ))}
            </div>
          </Section>
        )}

        <Section id="rsvp" icon={Heart} tone="brand" title="RSVP">
          {events.length === 0 ? (
            <p className="text-muted-foreground">There&apos;s nothing to RSVP to just yet. Check back soon!</p>
          ) : (
            <RsvpForm
              token={token}
              open={wedding.rsvpOpen}
              deadline={wedding.rsvpDeadline}
              household={household}
              guests={page.guests}
              events={events.map((e) => ({ id: e.id, name: e.name, mealOptions: e.mealOptions }))}
            />
          )}
        </Section>

        <footer className="flex items-center justify-center gap-2 pb-4 text-sm text-muted-foreground">
          <LogoMark className="size-6" /> Made with ♥ for {wedding.partner1Name} &amp; {wedding.partner2Name}
        </footer>
      </main>
    </div>
  );
}

function Section({
  id,
  icon,
  tone,
  title,
  children,
}: {
  id: string;
  icon: LucideIcon;
  tone: Tone;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 space-y-4">
      <h2 className="flex items-center gap-3 text-2xl font-bold">
        <IconChip icon={icon} tone={tone} sticker />
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoCard({ icon: Icon, title, body }: { icon: LucideIcon; title: string; body: string }) {
  return (
    <div className="space-y-2 rounded-2xl border bg-card p-5">
      <h3 className="flex items-center gap-2 font-bold">
        <Icon className="size-4 text-muted-foreground" /> {title}
      </h3>
      <p className="text-sm whitespace-pre-line text-muted-foreground">{body}</p>
    </div>
  );
}

function listNames(names: string[]) {
  if (names.length <= 2) return names.join(" & ");
  return `${names.slice(0, -1).join(", ")} & ${names.at(-1)}`;
}
