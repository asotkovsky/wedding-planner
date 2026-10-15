"use client";

import { FileUp, Loader2, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { celebrate } from "@/components/celebrate";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";
import type { GuestListReading } from "@/server/guest-import";
import * as actions from "./actions";

/** A sample list for the placeholder, using the couple's own names for the side. */
const example = (partner: string) => `Maria & Luis Garcia, garcias@example.com, Austin TX (${partner}'s side)
  + their daughter Sofia, age 6
Jordan Lee +1
Margaret O'Brien – gluten-free`;

type Props = {
  weddingId: string;
  events: { id: string; name: string }[];
  partnerNames: [string, string];
  onClose: () => void;
};

/** Paste or upload a guest list in any format; the AI sorts it into households to review before adding. */
export function ImportGuestsDialog({ weddingId, events, partnerNames, onClose }: Props) {
  const { pending, run } = useAction();
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState<string | null>(null);
  const [reading, setReading] = useState<GuestListReading | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [eventIds, setEventIds] = useState<string[]>(events.map((e) => e.id));

  async function loadFile(file: File | undefined) {
    if (!file) return;
    setText(await file.text());
    setFileName(file.name);
  }

  async function read() {
    const result = await run(() => actions.readGuestList(weddingId, text));
    if (!result) return;
    if (!result.households.length) {
      toast.error(result.remarks ?? "Couldn't find any guests in that list.");
      return;
    }
    setReading(result);
    // Households that look like they're already on the list start unticked.
    setSelected(new Set(result.households.flatMap((h, i) => (h.alreadyOnList.length ? [] : [i]))));
  }

  async function add() {
    if (!reading) return;
    // The server ignores the preview-only alreadyOnList field.
    const chosen = reading.households.filter((_, i) => selected.has(i));
    const result = await run(() => actions.importGuests(weddingId, chosen, eventIds));
    if (!result) return;
    if (result.added) {
      celebrate();
      toast.success(
        `Added ${result.guests} guest${result.guests === 1 ? "" : "s"} in ${result.added} household${result.added === 1 ? "" : "s"} 🎉`,
      );
    }
    if (result.failed.length) toast.error(`Couldn't add: ${result.failed.join(", ")}`);
    onClose();
  }

  const chosen = reading?.households.filter((_, i) => selected.has(i)) ?? [];
  const guestCount = chosen.reduce((n, h) => n + h.guests.length + h.guests.filter((g) => g.bringsPlusOne).length, 0);
  const hasReplies = reading?.households.some((h) => h.guests.some((g) => g.rsvp !== "pending" || g.meal)) ?? false;
  const sideLabel = {
    partner1: `${partnerNames[0]}'s side`,
    partner2: `${partnerNames[1]}'s side`,
    both: "Both sides",
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        {!reading ? (
          <>
            <DialogHeader>
              <DialogTitle>Import guests</DialogTitle>
              <DialogDescription>
                Paste your list in any format (a spreadsheet, notes, an email) or upload a CSV. Your planner sorts it
                into households, and you check everything before it&apos;s added.
              </DialogDescription>
            </DialogHeader>
            <div
              className="space-y-2"
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                loadFile(e.dataTransfer.files[0]);
              }}
            >
              <Textarea
                value={text}
                onChange={(e) => {
                  setText(e.target.value);
                  setFileName(null);
                }}
                placeholder={example(partnerNames[0])}
                rows={10}
                className="max-h-80 font-mono text-xs"
                aria-label="Guest list"
                disabled={pending}
              />
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Button asChild variant="outline" size="sm" disabled={pending}>
                  <label className="cursor-pointer">
                    <FileUp /> Upload CSV
                    <input
                      type="file"
                      accept=".csv,.tsv,.txt,text/csv,text/plain"
                      className="sr-only"
                      onChange={(e) => {
                        loadFile(e.target.files?.[0]);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </Button>
                {fileName ? <span>Loaded {fileName}</span> : <span>or drop a file here</span>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={read} disabled={pending || !text.trim()}>
                {pending ? <Loader2 className="animate-spin" /> : <Sparkles />}
                {pending ? "Reading your list…" : "Read my list"}
              </Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle>Check before adding</DialogTitle>
              <DialogDescription>
                Found {reading.households.length} household
                {reading.households.length === 1 ? "" : "s"}. Untick anyone you don&apos;t want to add; you can edit
                details afterwards.
              </DialogDescription>
            </DialogHeader>

            {reading.remarks && (
              <p className="flex gap-2 rounded-xl bg-muted p-3 text-sm">
                <Sparkles className="mt-0.5 size-4 shrink-0 text-muted-foreground" /> {reading.remarks}
              </p>
            )}

            {hasReplies && eventIds.length === 0 && (
              <p className="flex gap-2 rounded-xl bg-maybe-soft p-3 text-sm text-maybe">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" />
                {events.length
                  ? "Tick at least one event to record the replies and meal choices from your list."
                  : "Your list has replies and meal choices, but RSVPs are kept per event and you haven't added any events yet. Add your events (ceremony, reception…) first, then import, so these aren't lost."}
              </p>
            )}

            {events.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                <span className="font-medium">Invite to:</span>
                {events.map((e) => (
                  <label key={e.id} className="flex items-center gap-1.5">
                    <Checkbox
                      checked={eventIds.includes(e.id)}
                      onCheckedChange={(c) =>
                        setEventIds((ids) => (c === true ? [...ids, e.id] : ids.filter((id) => id !== e.id)))
                      }
                    />
                    {e.name}
                  </label>
                ))}
                {hasReplies && (
                  <p className="w-full text-xs text-muted-foreground">
                    Replies and meal choices from your list are recorded for these events. A meal is only saved where
                    it&apos;s one of that event&apos;s options.
                  </p>
                )}
              </div>
            )}

            <ul className="divide-y rounded-xl border">
              {reading.households.map((h, i) => (
                <li key={i} className={cn("flex gap-3 p-3", !selected.has(i) && "opacity-50")}>
                  <Checkbox
                    className="mt-0.5"
                    aria-label={`Add ${h.name}`}
                    checked={selected.has(i)}
                    onCheckedChange={(c) =>
                      setSelected((s) => {
                        const next = new Set(s);
                        if (c === true) next.add(i);
                        else next.delete(i);
                        return next;
                      })
                    }
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{h.name}</span>
                      {h.alreadyOnList.length > 0 && (
                        <Badge variant="outline" className="gap-1 border-maybe/40 text-maybe">
                          <TriangleAlert /> Already on your list
                        </Badge>
                      )}
                    </div>
                    {(h.email || h.phone || h.city) && (
                      <p className="text-xs text-muted-foreground">
                        {[h.email, h.phone, h.city].filter(Boolean).join(" · ")}
                      </p>
                    )}
                    <ul className="space-y-0.5 text-sm">
                      {h.guests.map((g, j) => (
                        <li key={j}>
                          {[g.firstName, g.lastName].filter(Boolean).join(" ")}
                          <span className="text-muted-foreground">
                            {[
                              g.side && sideLabel[g.side],
                              g.ageGroup !== "adult" && g.ageGroup,
                              g.dietaryRestrictions,
                              g.notes,
                              g.email,
                              g.bringsPlusOne && "+1",
                              g.rsvp === "attending" && "Coming",
                              g.rsvp === "declined" && "Can't make it",
                              g.meal,
                            ]
                              .filter(Boolean)
                              .map((x) => ` · ${x}`)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </li>
              ))}
            </ul>

            <DialogFooter>
              <Button variant="outline" onClick={() => setReading(null)} disabled={pending}>
                Back
              </Button>
              <Button onClick={add} disabled={pending || chosen.length === 0}>
                {pending && <Loader2 className="animate-spin" />}
                Add {guestCount} guest{guestCount === 1 ? "" : "s"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
