"use client";

import { MapPin, PartyPopper, Pencil, Plus, Shirt, Trash2, UsersRound } from "lucide-react";
import { useState } from "react";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { Field, TextareaField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formObject, useAction } from "@/components/use-action";
import type { MealSummary } from "@/server/events";
import * as actions from "./actions";

type EventRow = {
  id: string;
  name: string;
  description: string | null;
  locationName: string | null;
  address: string | null;
  mapUrl: string | null;
  dressCode: string | null;
  mealOptions: string[];
  startsAtLocal: string;
  endsAtLocal: string;
  when: string;
  invited: number;
  attending: number;
  declined: number;
  meals: MealSummary;
};

const SUGGESTIONS = ["Welcome drinks", "Rehearsal dinner", "Ceremony", "Cocktail hour", "Reception", "Farewell brunch"];

export function EventsView({
  weddingId,
  events,
  editable,
  defaultDate,
}: {
  weddingId: string;
  events: EventRow[];
  editable: boolean;
  defaultDate: string | null;
}) {
  const { run } = useAction();
  const [dialog, setDialog] = useState<{ event?: EventRow; name?: string } | null>(null);
  const missing = SUGGESTIONS.filter((s) => !events.some((e) => e.name.toLowerCase() === s.toLowerCase()));

  return (
    <div className="space-y-6">
      <PageHeader section="events">
        {editable && (
          <Button onClick={() => setDialog({})}>
            <Plus /> Add event
          </Button>
        )}
      </PageHeader>

      {editable && missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="font-medium">✨ Quick add:</span>
          {missing.map((name) => (
            <Button key={name} variant="outline" size="sm" className="rounded-full border-dashed" onClick={() => setDialog({ name })}>
              {name}
            </Button>
          ))}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {events.map((e) => (
          <Card key={e.id} className="overflow-hidden rounded-2xl pt-0">
            <div className="h-2 bg-[repeating-linear-gradient(-45deg,var(--brand)_0_10px,var(--pop)_10px_20px)]" aria-hidden />
            <CardHeader>
              <CardTitle className="font-display text-xl font-bold">{e.name}</CardTitle>
              <CardDescription className="font-medium text-brand-ink">{e.when}</CardDescription>
              {editable && (
                <CardAction className="flex">
                  <Button variant="ghost" size="icon" aria-label="Edit event" onClick={() => setDialog({ event: e })}>
                    <Pencil />
                  </Button>
                  <ConfirmButton
                    title={`Delete ${e.name}?`}
                    description="All invitations and RSVPs for this event will be deleted, along with its timeline items."
                    onConfirm={() => run(() => actions.deleteSubEvent(weddingId, e.id), "Event deleted")}
                  >
                    <Button variant="ghost" size="icon" aria-label="Delete event">
                      <Trash2 />
                    </Button>
                  </ConfirmButton>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {(e.locationName || e.address) && (
                <div className="flex gap-2">
                  <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  <div>
                    {e.locationName && <div>{e.locationName}</div>}
                    {e.address && <div className="text-muted-foreground">{e.address}</div>}
                  </div>
                </div>
              )}
              {e.dressCode && (
                <div className="flex gap-2">
                  <Shirt className="size-4 text-muted-foreground" /> {e.dressCode}
                </div>
              )}
              {e.description && <p className="text-muted-foreground">{e.description}</p>}
              {e.mealOptions.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">🍽 Meals</p>
                  <div className="flex flex-wrap gap-1.5">
                    {e.mealOptions.map((m) => {
                      const count = e.meals.meals.find((x) => x.meal === m)?.count ?? 0;
                      return (
                        <Badge key={m} variant="outline" className="gap-1.5">
                          {m}
                          <span className="font-display font-bold tabular-nums">{count}</span>
                        </Badge>
                      );
                    })}
                    {e.meals.unchosen > 0 && (
                      <Badge variant="outline" className="gap-1.5 border-dashed text-muted-foreground">
                        Not chosen yet <span className="font-bold tabular-nums">{e.meals.unchosen}</span>
                      </Badge>
                    )}
                  </div>
                </div>
              )}
              {e.meals.dietary.length > 0 && (
                <details className="group rounded-xl bg-muted/60 px-3 py-2">
                  <summary className="cursor-pointer list-none text-sm font-medium">
                    🥗 {e.meals.dietary.length} dietary need{e.meals.dietary.length === 1 ? "" : "s"}
                    <span className="text-muted-foreground"> · tap to see</span>
                  </summary>
                  <ul className="mt-2 space-y-0.5 text-sm">
                    {e.meals.dietary.map((d, i) => (
                      <li key={i}>
                        <span className="font-medium">{d.name}:</span> <span className="text-muted-foreground">{d.needs}</span>
                      </li>
                    ))}
                  </ul>
                </details>
              )}
              <div className="flex flex-wrap items-center gap-3 border-t pt-3">
                <UsersRound className="size-4 text-muted-foreground" />
                <span>
                  {e.invited} invited · {e.attending} attending · {e.declined} declined
                </span>
                {editable && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="ml-auto"
                    onClick={() => run(() => actions.inviteAllGuests(weddingId, e.id), "Invited all guests")}
                  >
                    Invite all guests
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {events.length === 0 && (
        <EmptyState
          icon={PartyPopper}
          tone="lilac"
          title="Let's plan the party"
          description="Start with the ceremony and reception, then sprinkle in welcome drinks or a farewell brunch. Use the quick-add buttons above."
        />
      )}

      {dialog && (
        <EventDialog
          weddingId={weddingId}
          event={dialog.event}
          initialName={dialog.name}
          defaultDate={defaultDate}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}

function EventDialog({
  weddingId,
  event,
  initialName,
  defaultDate,
  onClose,
}: {
  weddingId: string;
  event?: EventRow;
  initialName?: string;
  defaultDate: string | null;
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const [inviteAll, setInviteAll] = useState(true);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formObject(e.currentTarget);
    const input = {
      name: f.name,
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      locationName: f.locationName,
      address: f.address,
      mapUrl: f.mapUrl,
      dressCode: f.dressCode,
      description: f.description,
      mealOptions: f.mealOptions
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean),
    };
    const ok = event
      ? await run(() => actions.updateSubEvent(weddingId, event.id, input), "Event saved")
      : await run(() => actions.createSubEvent(weddingId, { ...input, inviteAllGuests: inviteAll }), "Event added");
    if (ok) onClose();
  }

  const defaultStart = defaultDate ? `${defaultDate}T16:00` : "";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{event ? `Edit ${event.name}` : "Add event"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field name="name" label="Name" required defaultValue={event?.name ?? initialName} className="sm:col-span-2" />
          <Field name="startsAt" label="Starts" type="datetime-local" defaultValue={event?.startsAtLocal ?? defaultStart} />
          <Field name="endsAt" label="Ends" type="datetime-local" defaultValue={event?.endsAtLocal ?? ""} />
          <Field name="locationName" label="Location" defaultValue={event?.locationName ?? ""} />
          <Field name="dressCode" label="Dress code" defaultValue={event?.dressCode ?? ""} />
          <Field name="address" label="Address" defaultValue={event?.address ?? ""} className="sm:col-span-2" />
          <Field name="mapUrl" label="Map link" type="url" defaultValue={event?.mapUrl ?? ""} className="sm:col-span-2" />
          <TextareaField
            name="description"
            label="Details for guests"
            defaultValue={event?.description ?? ""}
            className="sm:col-span-2"
          />
          <TextareaField
            name="mealOptions"
            label="Meal options (one per line, leave empty if guests don't choose)"
            defaultValue={event?.mealOptions.join("\n") ?? ""}
            className="sm:col-span-2"
          />
          {!event && (
            <label className="flex items-center gap-2 text-sm sm:col-span-2">
              <Checkbox checked={inviteAll} onCheckedChange={(c) => setInviteAll(c === true)} />
              Invite all current guests
            </label>
          )}
          <DialogFooter className="sm:col-span-2">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              Save
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
