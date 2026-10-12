"use client";

import { CalendarClock, Eye, MapPin, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { Field, NONE, noneToEmpty, SelectField, TextareaField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formObject, useAction } from "@/components/use-action";
import * as actions from "./actions";

type Option = { id: string; name: string };
type Item = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  subEventId: string | null;
  vendorId: string | null;
  guestVisible: boolean;
  startsAtLocal: string;
  endsAtLocal: string;
  day: string;
  time: string;
};
type Props = {
  weddingId: string;
  editable: boolean;
  defaultDate: string | null;
  timezone: string;
  events: Option[];
  vendors: Option[];
  items: Item[];
};

export function TimelineView(props: Props) {
  const { weddingId, editable, events, vendors, items, timezone } = props;
  const { run } = useAction();
  const [dialog, setDialog] = useState<Item | "new" | null>(null);
  const days = Map.groupBy(items, (i) => i.day);
  const name = (list: Option[], id: string | null) => list.find((o) => o.id === id)?.name;

  return (
    <div className="space-y-6">
      <PageHeader section="timeline" description={`The run of show for you, your crew and your vendors. Times in ${timezone}.`}>
        {editable && (
          <Button onClick={() => setDialog("new")}>
            <Plus /> Add item
          </Button>
        )}
      </PageHeader>

      {[...days].map(([day, list]) => (
        <section key={day} className="space-y-2">
          <h2 className="text-lg font-bold">{day}</h2>
          <ol className="relative ml-1 space-y-1 border-l-2 border-dashed border-brand/50 pl-6">
            {list.map((i) => (
              <li key={i.id} className="relative flex flex-wrap items-start gap-x-3 gap-y-0.5 rounded-md py-2 pr-2 sm:flex-nowrap">
                <span className="absolute top-3 -left-[33px] size-4 rounded-full bg-brand sticker-sm" />
                <div className="w-full shrink-0 font-display text-sm font-bold tabular-nums sm:w-36">{i.time}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 font-medium">
                    {i.title}
                    {i.subEventId && <Badge variant="outline">{name(events, i.subEventId)}</Badge>}
                    {i.guestVisible && (
                      <Badge variant="secondary">
                        <Eye /> Guests
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {i.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="size-3" /> {i.location}
                      </span>
                    )}
                    {i.vendorId && <span> · {name(vendors, i.vendorId)}</span>}
                  </div>
                  {i.description && <p className="mt-1 text-sm text-muted-foreground">{i.description}</p>}
                </div>
                {editable && (
                  <div className="flex">
                    <Button variant="ghost" size="icon-sm" aria-label="Edit item" onClick={() => setDialog(i)}>
                      <Pencil />
                    </Button>
                    <ConfirmButton
                      title="Delete this item?"
                      description={i.title}
                      onConfirm={() => run(() => actions.deleteTimelineItem(weddingId, i.id), "Item deleted")}
                    >
                      <Button variant="ghost" size="icon-sm" aria-label="Delete item">
                        <Trash2 />
                      </Button>
                    </ConfirmButton>
                  </div>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}
      {items.length === 0 && (
        <EmptyState
          icon={CalendarClock}
          tone="rose"
          title="The big day, minute by minute"
          description="Hair and makeup, first look, ceremony, first dance: build the run of show yourself, or let your planner draft it."
        >
          <OpenAssistantButton prompt="Draft a day-of timeline for our wedding day.">Draft my timeline</OpenAssistantButton>
        </EmptyState>
      )}

      {editable && dialog && (
        <TimelineDialog {...props} item={dialog === "new" ? undefined : dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}

function TimelineDialog({
  weddingId,
  events,
  vendors,
  defaultDate,
  items,
  item,
  onClose,
}: Props & { item?: Item; onClose: () => void }) {
  const { pending, run } = useAction();
  const [guestVisible, setGuestVisible] = useState(item?.guestVisible ?? false);
  const lastStart = items.at(-1)?.startsAtLocal;
  const defaultStart = lastStart ?? (defaultDate ? `${defaultDate}T12:00` : "");

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formObject(e.currentTarget);
    const input = {
      title: f.title,
      startsAt: f.startsAt,
      endsAt: f.endsAt,
      location: f.location,
      description: f.description,
      subEventId: noneToEmpty(f.subEventId),
      vendorId: noneToEmpty(f.vendorId),
      guestVisible,
    };
    const ok = item
      ? await run(() => actions.updateTimelineItem(weddingId, item.id, input), "Item saved")
      : await run(() => actions.createTimelineItem(weddingId, input), "Item added");
    if (ok) onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{item ? "Edit timeline item" : "Add timeline item"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field name="title" label="Title" required defaultValue={item?.title} className="sm:col-span-2" />
          <Field name="startsAt" label="Starts" type="datetime-local" required defaultValue={item?.startsAtLocal ?? defaultStart} />
          <Field name="endsAt" label="Ends" type="datetime-local" defaultValue={item?.endsAtLocal ?? ""} />
          <Field name="location" label="Location" defaultValue={item?.location ?? ""} />
          <SelectField
            name="subEventId"
            label="Part of event"
            defaultValue={item?.subEventId ?? NONE}
            options={[{ value: NONE, label: "None" }, ...events.map((e) => ({ value: e.id, label: e.name }))]}
          />
          <SelectField
            name="vendorId"
            label="Vendor responsible"
            defaultValue={item?.vendorId ?? NONE}
            options={[{ value: NONE, label: "None" }, ...vendors.map((v) => ({ value: v.id, label: v.name }))]}
            className="sm:col-span-2"
          />
          <TextareaField name="description" label="Notes" defaultValue={item?.description ?? ""} className="sm:col-span-2" />
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <Checkbox checked={guestVisible} onCheckedChange={(c) => setGuestVisible(c === true)} />
            Show on guest pages
          </label>
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
