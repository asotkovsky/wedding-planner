import { Cormorant_Garamond } from "next/font/google";
import { formatTime } from "@/lib/datetime";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PhotoGallery } from "./photo-gallery";
import { RsvpForm } from "./rsvp-form";
import type { GuestView } from "./view";

// Only loaded on guest pages that use this style.
const serif = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-elegant",
});

// All-caps labels: small, so a little extra letterspacing (typography guidance is 0.05–0.12em; a touch
// more reads as refined at this size).
const eyebrow = "text-[13px] font-medium tracking-[0.15em] uppercase text-muted-foreground";
const link =
  "text-[13px] font-medium tracking-[0.12em] uppercase underline decoration-border underline-offset-4 hover:decoration-foreground";
/** Paragraphs stay narrow so centered lines don't run long. */
const prose = "mx-auto max-w-lg leading-relaxed whitespace-pre-line text-muted-foreground";

// This style's own section names, used for both the menu and the headings.
const TITLES: Record<string, string> = {
  events: "Celebrations",
  schedule: "Order of the Day",
  photos: "Gallery",
  travel: "Travel & Stay",
  registry: "Registry",
  faq: "Questions",
  rsvp: "RSVP",
};

/** "Friday, June 11 · 7:00 – 10:00 PM": written out in full, as on an invitation. */
function eventWhen(startsAt: Date, endsAt: Date | null, timeZone: string) {
  const day = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone }).format(
    startsAt,
  );
  const start = formatTime(startsAt, timeZone);
  if (!endsAt) return `${day} · ${start}`;
  const end = formatTime(endsAt, timeZone);
  // Drop the first AM/PM when both times share it: "7:00 – 10:00 PM".
  const [startTime, startPeriod] = start.split(/\s/);
  const sharedPeriod = startPeriod && end.endsWith(startPeriod);
  return `${day} · ${sharedPeriod ? startTime : start} – ${end}`;
}

/**
 * The traditional style: serif type, a full-width cover photo, centered sections with fine
 * dividers and plenty of white space. Shared pieces (the RSVP form) restyle through the
 * .elegant scope in globals.css.
 */
export function ElegantGuestPage({ view }: { view: GuestView }) {
  const {
    wedding,
    household,
    events,
    timeline,
    token,
    tz,
    cover,
    gallery,
    photoSrc,
    days,
    greeting,
    scheduleDays,
    sections,
  } = view;
  const p1 = wedding.partner1Name;
  const p2 = wedding.partner2Name;
  const date = wedding.date ? formatDate(wedding.date, { dateStyle: "full" }) : null;
  const names = (
    <>
      {p1} <span className="font-normal text-brand-ink italic">&amp;</span> {p2}
    </>
  );

  return (
    <div className={cn(serif.variable, "elegant min-h-screen bg-background text-foreground")}>
      {/* Monogram and menu (one row that scrolls sideways on small screens) */}
      <nav className="mx-auto flex max-w-5xl flex-col items-center gap-4 pt-8 pb-6">
        <p className="font-display text-3xl tracking-wide">
          {p1[0]}
          <span className="mx-1 text-brand-ink italic">&amp;</span>
          {p2[0]}
        </p>
        <ul className="flex max-w-full gap-6 overflow-x-auto px-4 pb-1 whitespace-nowrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className={cn(eyebrow, "transition-colors hover:text-foreground")}>
                {TITLES[s.id] ?? s.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-5xl px-4">
        {cover ? (
          <div className="relative flex min-h-[70vh] items-end justify-center overflow-hidden rounded-sm">
            {/* eslint-disable-next-line @next/next/no-img-element -- served from our own route, already resized */}
            <img src={photoSrc(cover.id)} alt={`${p1} and ${p2}`} className="absolute inset-0 size-full object-cover" />
            <div className="absolute inset-0 bg-linear-to-t from-black/70 via-black/25 to-transparent" aria-hidden />
            <div className="relative space-y-4 px-6 pb-12 text-center text-white [text-shadow:0_1px_16px_rgb(0_0_0/0.4)]">
              <p className="text-[13px] font-medium tracking-[0.15em] uppercase">We&apos;re getting married</p>
              <h1 className="font-display text-6xl leading-none font-medium md:text-8xl">
                {p1} <span className="font-normal italic">&amp;</span> {p2}
              </h1>
              {date && <p className="text-sm tracking-[0.12em] uppercase">{date}</p>}
              {wedding.venueName && <p className="font-display text-xl italic">{wedding.venueName}</p>}
            </div>
          </div>
        ) : (
          <div className="border border-border p-2">
            <div className="space-y-5 border border-border px-6 py-20 text-center md:py-28">
              <p className={eyebrow}>We&apos;re getting married</p>
              <h1 className="font-display text-6xl leading-none font-medium md:text-8xl">{names}</h1>
              {date && <p className="text-sm tracking-[0.12em] uppercase">{date}</p>}
              {wedding.venueName && (
                <p className="font-display text-xl text-muted-foreground italic">{wedding.venueName}</p>
              )}
            </div>
          </div>
        )}
        {days !== null && days >= 0 && (
          <p className={cn(eyebrow, "mt-6 text-center")}>
            {days === 0 ? "Today is the day" : days === 1 ? "Tomorrow is the day" : `${days} days to go`}
          </p>
        )}
      </header>

      <main className="mx-auto max-w-2xl space-y-16 px-4 py-16 md:space-y-24 md:py-20">
        {/* Welcome */}
        <section className="space-y-6 text-center">
          <p className="font-display text-3xl italic">Dear {greeting},</p>
          <p className={prose}>
            {wedding.welcomeMessage ??
              "We can't wait to celebrate with you. Here is everything you need to know, and your reply card is at the end."}
          </p>
          {household.personalNote && (
            <figure className="mx-auto max-w-lg space-y-3 border-y border-border py-6">
              <blockquote className="font-display text-2xl leading-snug whitespace-pre-line italic">
                &ldquo;{household.personalNote}&rdquo;
              </blockquote>
              <figcaption className={eyebrow}>
                With love, {p1} &amp; {p2}
              </figcaption>
            </figure>
          )}
        </section>

        {events.length > 0 && (
          <Section id="events" eyebrow="Join us" title={TITLES.events}>
            <div className="divide-y divide-border">
              {events.map((e) => (
                <article key={e.id} className="space-y-3 py-8 text-center first:pt-0 last:pb-0 md:py-10">
                  <h3 className="font-display text-3xl font-medium">{e.name}</h3>
                  {e.startsAt && <p className="text-[15px]">{eventWhen(e.startsAt, e.endsAt, tz)}</p>}
                  {e.locationName && <p className="font-display text-xl italic">{e.locationName}</p>}
                  {e.address && <p className="text-[15px] text-muted-foreground">{e.address}</p>}
                  {e.dressCode && <p className="text-[15px] text-muted-foreground">Attire: {e.dressCode}</p>}
                  {e.description && <p className={cn(prose, "text-[15px]")}>{e.description}</p>}
                  <p className="flex flex-wrap justify-center gap-x-5 gap-y-2 pt-2">
                    {(e.locationName || e.address) && (
                      <a href={view.mapUrl(e)} target="_blank" rel="noreferrer" className={link}>
                        Map
                      </a>
                    )}
                    {e.startsAt && (
                      <>
                        <a href={view.googleCalendarUrl(e)} target="_blank" rel="noreferrer" className={link}>
                          Google Calendar
                        </a>
                        <a href={`/i/${token}/calendar.ics?event=${e.id}`} className={link}>
                          Apple / Outlook
                        </a>
                      </>
                    )}
                  </p>
                </article>
              ))}
            </div>
            {wedding.dressCode && (
              <p className={cn(prose, "text-center text-[15px]")}>
                <span className={cn(eyebrow, "mr-2")}>Attire</span>
                {wedding.dressCode}
              </p>
            )}
          </Section>
        )}

        {timeline.length > 0 && (
          <Section id="schedule" eyebrow="The day" title={TITLES.schedule}>
            {[...scheduleDays].map(([day, items]) => (
              <div key={day} className="space-y-3">
                {scheduleDays.size > 1 && <p className={cn(eyebrow, "text-center")}>{day}</p>}
                <ol className="mx-auto max-w-md">
                  {items.map((t) => (
                    <li
                      key={t.id}
                      className="grid grid-cols-[6.5rem_1fr] gap-4 border-b border-dotted border-border py-3"
                    >
                      <span className="text-right font-display text-lg">{formatTime(t.startsAt, tz)}</span>
                      <span>
                        <span className="block">{t.title}</span>
                        {(t.location || t.description) && (
                          <span className="block text-[15px] text-muted-foreground">
                            {[t.location, t.description].filter(Boolean).join(" · ")}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </Section>
        )}

        {gallery.length > 0 && (
          <Section id="photos" eyebrow="Moments" title={TITLES.photos}>
            <PhotoGallery photos={gallery.map((ph) => ({ ...ph, src: photoSrc(ph.id) }))} />
          </Section>
        )}

        {(wedding.travelInfo || wedding.accommodationInfo) && (
          <Section id="travel" eyebrow="Plan your trip" title={TITLES.travel}>
            <div className="grid gap-10 text-center sm:grid-cols-2">
              {wedding.travelInfo && <Info title="Getting there" body={wedding.travelInfo} />}
              {wedding.accommodationInfo && <Info title="Where to stay" body={wedding.accommodationInfo} />}
            </div>
          </Section>
        )}

        {wedding.registry.length > 0 && (
          <Section id="registry" eyebrow="Gifts" title={TITLES.registry}>
            <p className={cn(prose, "text-center")}>
              Your presence is the greatest gift. Should you wish to honor us with a gift, you&apos;ll find our registry
              below.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {wedding.registry.map((r, i) => (
                <a
                  key={i}
                  href={r.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="border border-foreground px-6 py-3 text-[13px] font-medium tracking-[0.12em] uppercase transition-colors hover:bg-foreground hover:text-background"
                >
                  {r.label}
                </a>
              ))}
            </div>
          </Section>
        )}

        {wedding.faq.length > 0 && (
          <Section id="faq" eyebrow="Good to know" title={TITLES.faq}>
            <div className="divide-y divide-border border-y border-border">
              {wedding.faq.map((f, i) => (
                <details key={i} className="group py-5">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-xl">
                    {f.question}
                    <span className="text-muted-foreground transition-transform group-open:rotate-45" aria-hidden>
                      +
                    </span>
                  </summary>
                  <p className="mt-3 leading-relaxed whitespace-pre-line text-muted-foreground">{f.answer}</p>
                </details>
              ))}
            </div>
          </Section>
        )}

        <Section id="rsvp" eyebrow="RSVP" title="Kindly Reply">
          {events.length === 0 ? (
            <p className={cn(prose, "text-center")}>
              There&apos;s nothing to reply to just yet. Please check back soon.
            </p>
          ) : (
            <RsvpForm
              token={token}
              open={wedding.rsvpOpen}
              deadline={wedding.rsvpDeadline}
              household={household}
              guests={view.guests}
              events={events.map((e) => ({ id: e.id, name: e.name, mealOptions: e.mealOptions }))}
              variant="elegant"
            />
          )}
          {wedding.contact && (
            <p className={cn(prose, "text-center text-[15px]")}>
              For any questions, please contact <span className="text-foreground">{wedding.contact.name}</span>
              {wedding.contact.phone && (
                <>
                  {" "}
                  at{" "}
                  <a
                    href={`tel:${wedding.contact.phone.replace(/[^\d+]/g, "")}`}
                    className="text-foreground underline underline-offset-4"
                  >
                    {wedding.contact.phone}
                  </a>
                </>
              )}
              {wedding.contact.email && (
                <>
                  {wedding.contact.phone ? " or " : " at "}
                  <a href={`mailto:${wedding.contact.email}`} className="text-foreground underline underline-offset-4">
                    {wedding.contact.email}
                  </a>
                </>
              )}
              .
            </p>
          )}
        </Section>
      </main>

      <footer className="space-y-2 border-t border-border py-12 text-center">
        <p className="font-display text-3xl">{names}</p>
        {date && <p className={eyebrow}>{date}</p>}
      </footer>
    </div>
  );
}

function Section({
  id,
  eyebrow: label,
  title,
  children,
}: {
  id: string;
  eyebrow: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-8 space-y-8 md:space-y-10">
      <div className="space-y-3 text-center">
        <p className={eyebrow}>{label}</p>
        <h2 className="font-display text-4xl font-medium md:text-5xl">{title}</h2>
        <Flourish />
      </div>
      {children}
    </section>
  );
}

/** A fine line-diamond-line divider under section titles. */
function Flourish() {
  return (
    <div className="flex items-center justify-center gap-3 text-brand-ink" aria-hidden>
      <span className="h-px w-12 bg-current opacity-40" />
      <span className="text-xs">✦</span>
      <span className="h-px w-12 bg-current opacity-40" />
    </div>
  );
}

function Info({ title, body }: { title: string; body: string }) {
  return (
    <div className="space-y-3">
      <h3 className="font-display text-2xl italic">{title}</h3>
      <p className={cn(prose, "max-w-xs")}>{body}</p>
    </div>
  );
}
