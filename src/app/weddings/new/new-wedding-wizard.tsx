"use client";

import { ArrowLeft, ArrowRight, CalendarHeart, Check, Clock, Heart, MapPin, Palette, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { IconChip, Logo } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CURRENCIES } from "@/lib/defaults";
import { daysUntil, formatDate } from "@/lib/format";
import { DEFAULT_PALETTE, normalizeHex, PALETTES, themeVars } from "@/lib/theme";
import { cn } from "@/lib/utils";
import { createWedding } from "../actions";

const STEPS = [
  { title: "Who's tying the knot?", icon: Heart },
  { title: "When's the big day?", icon: CalendarHeart },
  { title: "Pick your colors", icon: Palette },
] as const;

export function NewWeddingWizard({ userFirstName, canCancel }: { userFirstName: string; canCancel: boolean }) {
  const [step, setStep] = useState(0);
  const [partner1, setPartner1] = useState("");
  const [partner2, setPartner2] = useState("");
  const [date, setDate] = useState("");
  const [noDateYet, setNoDateYet] = useState(false);
  const [venue, setVenue] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [primary, setPrimary] = useState(DEFAULT_PALETTE.primary);
  const [accent, setAccent] = useState(DEFAULT_PALETTE.accent);
  const [timezone, setTimezone] = useState("America/New_York");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => setTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone), []);

  const names = `${partner1.trim() || "You"} & ${partner2.trim() || "Your love"}`;
  const days = date && !noDateYet ? daysUntil(date) : null;

  function next(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (step === 0 && (!partner1.trim() || !partner2.trim())) {
      setError("We need both names. Nicknames are fine!");
      return;
    }
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      const result = await createWedding({
        partner1Name: partner1,
        partner2Name: partner2,
        date: noDateYet ? "" : date,
        venueName: venue,
        currency,
        timezone,
        themePrimary: primary,
        themeAccent: accent,
      });
      // On success the server redirects to the new wedding.
      if (result?.errors) setError(Object.values(result.errors).flat().filter(Boolean)[0] ?? "Please check your answers.");
    });
  }

  const StepIcon = STEPS[step].icon;

  return (
    <div style={themeVars(primary, accent)} className="relative min-h-screen bg-brand-soft transition-colors">
      <div className="pointer-events-none absolute inset-0 bg-dots opacity-50" />
      <div className="relative mx-auto flex min-h-screen max-w-xl flex-col gap-6 px-4 py-6 md:py-10">
        <header className="flex items-center justify-between">
          <Logo />
          <Link href="/weddings" className="text-sm font-medium text-muted-foreground hover:text-foreground">
            {canCancel ? "Cancel" : "Back"}
          </Link>
        </header>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-brand-ink">
            {step === 0 ? `Congratulations, ${userFirstName}! 🎉` : `Step ${step + 1} of ${STEPS.length}`}
          </p>
          <div className="flex gap-1.5" aria-hidden>
            {STEPS.map((_, i) => (
              <span
                key={i}
                className={cn("h-2 flex-1 rounded-full transition-colors", i <= step ? "bg-brand" : "bg-background")}
              />
            ))}
          </div>
        </div>

        <form onSubmit={next} className="space-y-6 rounded-3xl bg-background p-6 sticker md:p-8">
          <div className="flex items-center gap-3">
            <IconChip icon={StepIcon} tone="brand" size="lg" sticker className="-rotate-6" />
            <h1 className="text-2xl font-extrabold md:text-3xl">{STEPS[step].title}</h1>
          </div>

          {step === 0 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">Let&apos;s set up your wedding HQ. First, the happy couple.</p>
              <div className="grid items-end gap-3 sm:grid-cols-[1fr_auto_1fr]">
                <div className="space-y-2">
                  <Label htmlFor="p1">Partner one</Label>
                  <Input id="p1" value={partner1} onChange={(e) => setPartner1(e.target.value)} autoFocus placeholder="First name" />
                </div>
                <Heart className="mx-auto hidden size-6 fill-brand text-foreground sm:mb-1.5 sm:block" aria-hidden />
                <div className="space-y-2">
                  <Label htmlFor="p2">Partner two</Label>
                  <Input id="p2" value={partner2} onChange={(e) => setPartner2(e.target.value)} placeholder="First name" />
                </div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-muted-foreground">No pressure. You can change all of this later.</p>
              <div className="space-y-2">
                <Label htmlFor="date">Wedding date</Label>
                <Input
                  id="date"
                  type="date"
                  value={date}
                  disabled={noDateYet}
                  onChange={(e) => setDate(e.target.value)}
                  autoFocus
                />
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox checked={noDateYet} onCheckedChange={(c) => setNoDateYet(c === true)} />
                  We haven&apos;t picked a date yet
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="venue">Venue (optional)</Label>
                  <Input id="venue" value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Venue name" />
                </div>
                <div className="space-y-2">
                  <Label>Currency</Label>
                  <Select value={currency} onValueChange={setCurrency}>
                    <SelectTrigger className="w-full sm:w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CURRENCIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <p className="text-muted-foreground">
                Your colors dress up the whole app, and your guests&apos; invitation pages too. Change them anytime in
                Settings.
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PALETTES.map((p) => {
                  const selected = p.primary === primary && p.accent === accent;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => {
                        setPrimary(p.primary);
                        setAccent(p.accent);
                      }}
                      className={cn(
                        "flex flex-col items-center gap-1.5 rounded-xl border-2 p-2 text-xs font-medium transition-colors hover:bg-muted",
                        selected ? "border-foreground bg-muted" : "border-transparent",
                      )}
                    >
                      <span className="relative flex">
                        <span className="size-8 rounded-full border-2 border-foreground" style={{ background: p.primary }} />
                        <span className="-ml-3 size-8 rounded-full border-2 border-foreground" style={{ background: p.accent }} />
                        {selected && (
                          <Check className="absolute -top-1 -right-1 size-4 rounded-full bg-foreground p-0.5 text-background" />
                        )}
                      </span>
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <div className="flex flex-wrap gap-4 text-sm">
                <ColorPick label="Main" value={primary} onChange={setPrimary} />
                <ColorPick label="Accent" value={accent} onChange={setAccent} />
              </div>

              {/* A peek at their Home page in these colors. */}
              <div className="relative overflow-hidden rounded-2xl bg-brand-soft p-5 sticker-sm">
                <div className="pointer-events-none absolute inset-0 bg-dots opacity-60" />
                <div className="relative space-y-1.5">
                  <p className="text-xs font-semibold tracking-wide text-brand-ink uppercase">{names}</p>
                  <p className="font-display text-2xl font-extrabold">
                    {days !== null && days >= 0 ? `${days} days to go!` : "Happily ever after starts here"}
                  </p>
                  <div className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                    {date && !noDateYet && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="size-3" /> {formatDate(date)}
                      </span>
                    )}
                    {venue && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {venue}
                      </span>
                    )}
                  </div>
                  <span className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3 text-sm font-semibold text-brand-foreground sticker-sm">
                    <Sparkles className="size-4" /> Ask your planner
                  </span>
                </div>
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-xl bg-late-soft p-3 text-sm font-medium text-late">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-2">
            {step > 0 ? (
              <Button type="button" variant="ghost" onClick={() => setStep(step - 1)} disabled={pending}>
                <ArrowLeft /> Back
              </Button>
            ) : (
              <span />
            )}
            <Button type="submit" disabled={pending} className="h-11 px-5 text-base">
              {step < STEPS.length - 1 ? (
                <>
                  Next <ArrowRight />
                </>
              ) : pending ? (
                "Setting things up…"
              ) : (
                <>
                  <Sparkles /> Create our wedding HQ
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ColorPick({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(normalizeHex(e.target.value) ?? value)}
        className="size-8 cursor-pointer rounded-lg border-2 border-foreground bg-transparent p-0.5"
        aria-label={`${label} color`}
      />
      <span className="font-medium">{label}</span>
      <span className="font-mono text-xs text-muted-foreground">{value}</span>
    </label>
  );
}
