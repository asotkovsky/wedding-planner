"use client";

import { Check, PartyPopper, Pencil, X } from "lucide-react";
import { useState, useTransition } from "react";
import { celebrate } from "@/components/celebrate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { GuestPageData } from "@/server/guest-page";
import { submitRsvpAction } from "./actions";

type Guest = GuestPageData["guests"][number];
type Event = { id: string; name: string; mealOptions: string[] };
type Answer = { status?: "attending" | "declined"; mealChoice?: string | null };
type GuestDraft = {
  firstName: string;
  lastName: string;
  dietaryRestrictions: string;
  answers: Record<string, Answer>;
};

function initialDraft(g: Guest): GuestDraft {
  return {
    firstName: g.firstName ?? "",
    lastName: g.lastName ?? "",
    dietaryRestrictions: g.dietaryRestrictions ?? "",
    answers: Object.fromEntries(
      g.invites.map((i) => [
        i.subEventId,
        { status: i.status === "pending" ? undefined : i.status, mealChoice: i.mealChoice },
      ]),
    ),
  };
}

export function RsvpForm({
  token,
  open,
  deadline,
  household,
  guests,
  events,
}: {
  token: string;
  open: boolean;
  deadline: string | null;
  household: GuestPageData["household"];
  guests: Guest[];
  events: Event[];
}) {
  const [drafts, setDrafts] = useState<Record<string, GuestDraft>>(() =>
    Object.fromEntries(guests.map((g) => [g.id, initialDraft(g)])),
  );
  const [email, setEmail] = useState(household.email ?? "");
  const [message, setMessage] = useState(household.guestMessage ?? "");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ attending: number; declined: number } | null>(null);
  const [editing, setEditing] = useState(!household.rsvpSubmittedAt);
  const [pending, startTransition] = useTransition();
  const eventById = new Map(events.map((e) => [e.id, e]));

  const update = (guestId: string, patch: Partial<GuestDraft>) =>
    setDrafts((d) => ({ ...d, [guestId]: { ...d[guestId], ...patch } }));
  const answer = (guestId: string, eventId: string, patch: Answer) =>
    setDrafts((d) => ({
      ...d,
      [guestId]: { ...d[guestId], answers: { ...d[guestId].answers, [eventId]: { ...d[guestId].answers[eventId], ...patch } } },
    }));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const missing = guests.some((g) => g.invites.some((i) => !drafts[g.id].answers[i.subEventId]?.status));
    if (missing) {
      setError("Please answer yes or no for everyone and every event.");
      return;
    }
    startTransition(async () => {
      const result = await submitRsvpAction(token, {
        email,
        message,
        guests: guests.map((g) => {
          const d = drafts[g.id];
          return {
            guestId: g.id,
            ...(g.isPlusOne ? { firstName: d.firstName, lastName: d.lastName } : {}),
            dietaryRestrictions: d.dietaryRestrictions,
            responses: g.invites.map((i) => ({
              subEventId: i.subEventId,
              status: d.answers[i.subEventId].status!,
              mealChoice: d.answers[i.subEventId].status === "attending" ? (d.answers[i.subEventId].mealChoice ?? "") : "",
            })),
          };
        }),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setDone(result);
      setEditing(false);
      if (result.attending > 0) celebrate();
    });
  }

  // ---- Closed or already answered: show a summary ----
  if (!editing) {
    const attendingAny = guests.some((g) => Object.values(drafts[g.id].answers).some((a) => a.status === "attending"));
    return (
      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-full bg-brand text-brand-foreground sticker-sm">
            <PartyPopper className="size-5" />
          </span>
          <div>
            <p className="font-display text-xl font-bold">
              {done ? (attendingAny ? "Yay! See you there! 🎉" : "Thanks for letting us know 💌") : "Thanks for your RSVP!"}
            </p>
            <p className="text-sm text-muted-foreground">
              {done ? "Your reply is in." : "Here's what you told us."}{" "}
              {open && deadline && `You can change it until ${formatDate(deadline, { dateStyle: "long" })}.`}
            </p>
          </div>
        </div>
        <ul className="divide-y">
          {guests.map((g) => (
            <li key={g.id} className="py-2">
              <p className="font-medium">{displayName(g, drafts[g.id])}</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {g.invites.map((i) => {
                  const a = drafts[g.id].answers[i.subEventId];
                  const yes = a?.status === "attending";
                  return (
                    <span
                      key={i.subEventId}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold",
                        yes ? "bg-yes-soft text-yes" : a?.status ? "bg-no-soft text-no" : "bg-maybe-soft text-maybe",
                      )}
                    >
                      {yes ? <Check className="size-3" /> : <X className="size-3" />}
                      {eventById.get(i.subEventId)?.name}
                      {yes && a?.mealChoice && ` · ${a.mealChoice}`}
                    </span>
                  );
                })}
              </div>
            </li>
          ))}
        </ul>
        {open ? (
          <Button variant="outline" onClick={() => setEditing(true)}>
            <Pencil /> Change my response
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">RSVPs are closed. Need to change something? Reach out to the couple.</p>
        )}
      </div>
    );
  }

  if (!open) {
    return (
      <p className="rounded-2xl border bg-card p-5 text-muted-foreground">
        RSVPs are closed. If you still need to reply, please reach out to the couple directly. 💌
      </p>
    );
  }

  // ---- The form ----
  return (
    <form onSubmit={submit} className="space-y-4">
      {deadline && (
        <p className="text-sm text-muted-foreground">
          Kindly reply by <span className="font-semibold text-foreground">{formatDate(deadline, { dateStyle: "long" })}</span>.
        </p>
      )}
      {guests.map((g) => {
        const d = drafts[g.id];
        const needsName = g.isPlusOne && !g.firstName;
        return (
          <fieldset key={g.id} className="space-y-4 rounded-2xl border bg-card p-5">
            <legend className="sr-only">{displayName(g, d)}</legend>
            {needsName ? (
              <div className="space-y-2">
                <p className="font-display text-lg font-bold">
                  {g.hostFirstName ? `${g.hostFirstName}'s guest` : "Your plus-one"}
                </p>
                <p className="text-sm text-muted-foreground">
                  Bringing someone? Tell us their name. Not bringing anyone? Just tap &ldquo;Regretfully declines&rdquo;.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <Input
                    placeholder="First name"
                    value={d.firstName}
                    onChange={(e) => update(g.id, { firstName: e.target.value })}
                    aria-label="Plus-one first name"
                  />
                  <Input
                    placeholder="Last name"
                    value={d.lastName}
                    onChange={(e) => update(g.id, { lastName: e.target.value })}
                    aria-label="Plus-one last name"
                  />
                </div>
              </div>
            ) : (
              <p className="font-display text-lg font-bold">{displayName(g, d)}</p>
            )}

            {g.invites.map((i) => {
              const event = eventById.get(i.subEventId);
              if (!event) return null;
              const a = d.answers[i.subEventId] ?? {};
              return (
                <div key={i.subEventId} className="space-y-2">
                  <p className="text-sm font-medium">{event.name}</p>
                  <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={`${displayName(g, d)}: ${event.name}`}>
                    <Choice
                      selected={a.status === "attending"}
                      tone="yes"
                      onClick={() => answer(g.id, i.subEventId, { status: "attending" })}
                    >
                      🎉 Joyfully accepts
                    </Choice>
                    <Choice
                      selected={a.status === "declined"}
                      tone="no"
                      onClick={() => answer(g.id, i.subEventId, { status: "declined" })}
                    >
                      💌 Regretfully declines
                    </Choice>
                  </div>
                  {a.status === "attending" && event.mealOptions.length > 0 && (
                    <div className="flex flex-wrap gap-2 pt-1" role="radiogroup" aria-label={`Meal for ${event.name}`}>
                      {event.mealOptions.map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={a.mealChoice === m}
                          onClick={() => answer(g.id, i.subEventId, { mealChoice: m })}
                          className={cn(
                            "rounded-full border px-3 py-1 text-sm transition-colors",
                            a.mealChoice === m ? "border-foreground bg-pop-soft font-semibold" : "hover:bg-muted",
                          )}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            <div className="space-y-1.5">
              <Label htmlFor={`diet-${g.id}`} className="text-sm">
                Allergies or dietary needs <span className="font-normal text-muted-foreground">(optional)</span>
              </Label>
              <Input
                id={`diet-${g.id}`}
                value={d.dietaryRestrictions}
                onChange={(e) => update(g.id, { dietaryRestrictions: e.target.value })}
                placeholder="e.g. vegetarian, nut allergy"
              />
            </div>
          </fieldset>
        );
      })}

      <div className="space-y-4 rounded-2xl border bg-card p-5">
        <div className="space-y-1.5">
          <Label htmlFor="rsvp-email">Email for updates <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Input id="rsvp-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rsvp-message">A note for the couple <span className="font-normal text-muted-foreground">(optional)</span></Label>
          <Textarea
            id="rsvp-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Song requests, well-wishes, terrible puns…"
          />
        </div>
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-late-soft p-3 text-sm font-medium text-late">
          {error}
        </p>
      )}
      <Button type="submit" disabled={pending} className="h-12 w-full text-base">
        {pending ? "Sending…" : "Send my RSVP"}
      </Button>
    </form>
  );
}

function Choice({
  selected,
  tone,
  onClick,
  children,
}: {
  selected: boolean;
  tone: "yes" | "no";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        "rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-all",
        selected
          ? tone === "yes"
            ? "border-foreground bg-yes-soft text-yes sticker-sm"
            : "border-foreground bg-no-soft text-foreground sticker-sm"
          : "border-dashed text-muted-foreground hover:border-solid hover:bg-muted",
      )}
    >
      {children}
    </button>
  );
}

function displayName(g: Guest, d: GuestDraft) {
  const name = [d.firstName || g.firstName, d.lastName || g.lastName].filter(Boolean).join(" ");
  return name || (g.isPlusOne ? (g.hostFirstName ? `${g.hostFirstName}'s guest` : "Your plus-one") : "Guest");
}
