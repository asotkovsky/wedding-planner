"use client";

import {
  BellRing,
  ChevronRight,
  Download,
  FileUp,
  Share2,
  ChevronsDownUp,
  ChevronsUpDown,
  Copy,
  Ellipsis,
  ExternalLink,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { OpenAssistantButton } from "@/components/assistant/open-assistant-button";
import { celebrateFrom } from "@/components/celebrate";
import { ConfirmButton, ConfirmDialog } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { Field, NONE, noneToEmpty, SelectField, TextareaField } from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RSVP_STATUS, StatusPill } from "@/components/status-pill";
import { formObject, useAction } from "@/components/use-action";
import { cn } from "@/lib/utils";
import type { RsvpStatus } from "@/db/schema";
import type { HouseholdWithGuests } from "@/server/guests";
import * as actions from "./actions";
import { ImportGuestsDialog } from "./import-guests-dialog";

type Event = { id: string; name: string; mealOptions: string[] };
type Guest = HouseholdWithGuests["guests"][number];
type Ctx = { weddingId: string; events: Event[]; partnerNames: [string, string]; editable: boolean };

const STATUS_LABEL: Record<RsvpStatus, string> = { pending: "Waiting", attending: "Attending", declined: "Can't make it" };
const STATUS_TRIGGER: Record<RsvpStatus, string> = {
  attending: "border-transparent bg-yes-soft text-yes",
  declined: "border-transparent bg-no-soft text-no",
  pending: "border-dashed border-input bg-transparent text-muted-foreground",
};

function sideLabel(side: Guest["side"], partners: [string, string]) {
  if (side === "partner1") return `${partners[0]}'s side`;
  if (side === "partner2") return `${partners[1]}'s side`;
  if (side === "both") return "Both sides";
  return null;
}

function initials(g: Guest) {
  if (!g.firstName) return "+1";
  return ((g.firstName[0] ?? "") + (g.lastName?.[0] ?? "")).toUpperCase();
}

function guestName(g: Pick<Guest, "firstName" | "lastName" | "isPlusOne">) {
  return [g.firstName, g.lastName].filter(Boolean).join(" ") || (g.isPlusOne ? "Plus-one" : "Unnamed guest");
}

export function GuestsView({
  weddingId,
  households,
  events,
  partnerNames,
  guestPageBase,
  editable,
}: Ctx & { households: HouseholdWithGuests[]; guestPageBase: string }) {
  const ctx: Ctx = { weddingId, events, partnerNames, editable };
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<GuestStatus | "all">("all");
  const [side, setSide] = useState<"all" | "partner1" | "partner2" | "both">("all");
  // Picking an event card narrows the status filters and counts to that event.
  const [eventId, setEventId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [importing, setImporting] = useState(false);
  // Households start collapsed. Searching or filtering opens the matches; each can still be collapsed.
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const filtering = status !== "all" || side !== "all" || eventId !== null;
  const searching = query.trim().length > 0 || filtering;
  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const allGuests = households.flatMap((h) => h.guests);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchesGuest = (g: Guest) => {
      const s = guestStatus(g, eventId);
      return (eventId === null || s !== null) && (status === "all" || s === status) && (side === "all" || g.side === side);
    };
    return households.filter((h) => {
      if (q && !h.name.toLowerCase().includes(q) && !h.guests.some((g) => guestName(g).toLowerCase().includes(q))) {
        return false;
      }
      return filtering ? h.guests.some(matchesGuest) : true;
    });
  }, [households, query, status, side, eventId, filtering]);
  const allExpanded = filtered.length > 0 && filtered.every((h) => expanded.has(h.id));

  // When the search or filters change, open what matches (or collapse everything once they're cleared).
  const filterKey = `${query.trim()}|${status}|${side}|${eventId}`;
  const [lastFilterKey, setLastFilterKey] = useState(filterKey);
  if (filterKey !== lastFilterKey) {
    setLastFilterKey(filterKey);
    setExpanded(new Set(searching ? filtered.map((h) => h.id) : []));
  }

  const countGuests = (s: GuestStatus) => allGuests.filter((g) => guestStatus(g, eventId) === s).length;
  const statusCounts = {
    all: eventId ? allGuests.filter((g) => guestStatus(g, eventId) !== null).length : allGuests.length,
    coming: countGuests("coming"),
    waiting: countGuests("waiting"),
    out: countGuests("out"),
  };

  /** Households with anyone still to reply, with their guest-page links, ready to paste into texts or emails. */
  async function copyReminderList() {
    const waiting = households.filter((h) => h.guests.some((g) => guestStatus(g) === "waiting"));
    if (!waiting.length) {
      toast.success("Everyone has replied! 🎉");
      return;
    }
    await navigator.clipboard.writeText(waiting.map((h) => `${h.name}: ${guestPageBase}${h.inviteToken}`).join("\n"));
    toast.success(`Copied ${waiting.length} household${waiting.length === 1 ? "" : "s"} still to reply, with their links`);
  }

  const children = allGuests.filter((g) => g.ageGroup !== "adult").length;

  return (
    <div className="space-y-6">
      <PageHeader
        section="guests"
        description={
          households.length
            ? `${allGuests.length} guest${allGuests.length === 1 ? "" : "s"} in ${households.length} household${households.length === 1 ? "" : "s"}${children ? ` · ${children} little one${children === 1 ? "" : "s"}` : ""}`
            : undefined
        }
      >
        {households.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline">
                <Share2 /> Share & export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem onSelect={copyReminderList}>
                <BellRing />
                <span>
                  Copy reminder list
                  <span className="block text-xs text-muted-foreground">Who hasn&apos;t replied, with their links</span>
                </span>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <a href={`/w/${weddingId}/guests/export`} download>
                  <Download />
                  <span>
                    Export guest list
                    <span className="block text-xs text-muted-foreground">CSV for your caterer or a spreadsheet</span>
                  </span>
                </a>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
        {editable && households.length > 0 && (
          <Button variant="outline" onClick={() => setImporting(true)}>
            <FileUp /> Import
          </Button>
        )}
        {editable && (
          <Button onClick={() => setCreating(true)}>
            <Plus /> Add household
          </Button>
        )}
      </PageHeader>

      {events.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {events.map((e) => {
            const invites = allGuests.flatMap((g) => g.invites.filter((i) => i.subEventId === e.id));
            const count = (s: RsvpStatus) => invites.filter((i) => i.status === s).length;
            const selected = eventId === e.id;
            return (
              <button
                key={e.id}
                type="button"
                aria-pressed={selected}
                title={selected ? "Show all events" : `Filter guests by ${e.name}`}
                onClick={() => setEventId(selected ? null : e.id)}
                className={cn(
                  "space-y-2 rounded-2xl border bg-card p-4 text-left transition-colors hover:bg-muted/50",
                  selected && "border-foreground ring-1 ring-foreground",
                )}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-display font-bold">{e.name}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">
                    <span className="font-display text-xl font-bold text-yes">{count("attending")}</span> / {invites.length}
                  </span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-maybe-soft">
                  <div className="bg-yes" style={{ width: `${invites.length ? (count("attending") / invites.length) * 100 : 0}%` }} />
                  <div className="bg-no" style={{ width: `${invites.length ? (count("declined") / invites.length) * 100 : 0}%` }} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {count("declined")} can&apos;t make it · {count("pending")} waiting
                </p>
              </button>
            );
          })}
        </div>
      )}
      {events.length === 0 && (
        <p className="rounded-xl border-2 border-dashed p-4 text-sm text-muted-foreground">
          💡 Tip: add your events (ceremony, reception…) on the Events page first, so you can invite guests to them.
        </p>
      )}

      {households.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-1 sm:max-w-sm">
            <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search guests"
              className="h-9 pl-8"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search guests"
            />
          </div>
          <div className="flex w-full flex-wrap gap-1.5 sm:order-last">
            <FilterChip active={status === "all"} onClick={() => setStatus("all")}>
              {eventId ? `Everyone at ${events.find((e) => e.id === eventId)?.name}` : "All"} · {statusCounts.all}
            </FilterChip>
            <FilterChip active={status === "coming"} dot="bg-yes" onClick={() => setStatus("coming")}>
              Coming · {statusCounts.coming}
            </FilterChip>
            <FilterChip active={status === "waiting"} dot="bg-maybe" onClick={() => setStatus("waiting")}>
              Waiting · {statusCounts.waiting}
            </FilterChip>
            <FilterChip active={status === "out"} dot="bg-no" onClick={() => setStatus("out")}>
              Can&apos;t make it · {statusCounts.out}
            </FilterChip>
            <span className="mx-1 hidden w-px bg-border sm:block" aria-hidden />
            {(
              [
                ["all", "Both sides"],
                ["partner1", `${partnerNames[0]}'s side`],
                ["partner2", `${partnerNames[1]}'s side`],
              ] as const
            ).map(([value, label]) => (
              <FilterChip key={value} active={side === value} onClick={() => setSide(value)}>
                {label}
              </FilterChip>
            ))}
          </div>
          {filtered.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(allExpanded ? new Set() : new Set(filtered.map((h) => h.id)))}
            >
              {allExpanded ? <ChevronsDownUp /> : <ChevronsUpDown />}
              {allExpanded ? "Collapse all" : "Expand all"}
            </Button>
          )}
        </div>
      )}

      <div className="space-y-2.5">
        {filtered.map((h) => (
          <HouseholdCard
            key={h.id}
            ctx={ctx}
            household={h}
            link={guestPageBase + h.inviteToken}
            eventId={eventId}
            expanded={expanded.has(h.id)}
            onToggle={() => toggle(h.id)}
          />
        ))}
        {households.length === 0 && (
          <EmptyState
            icon={UsersRound}
            tone="sky"
            title="The guest list is wide open"
            description="Add your first household, or tell your planner who's coming and it'll do the typing."
          >
            {editable && (
              <>
                <Button onClick={() => setCreating(true)}>
                  <Plus /> Add household
                </Button>
                <Button variant="outline" onClick={() => setImporting(true)}>
                  <FileUp /> Import a list or CSV
                </Button>
                <OpenAssistantButton variant="outline" prompt="I'd like to add some guests.">
                  Add with your planner
                </OpenAssistantButton>
              </>
            )}
          </EmptyState>
        )}
        {households.length > 0 && filtered.length === 0 && (
          <p className="py-8 text-center text-muted-foreground">
            No one matches{query.trim() ? <> &ldquo;{query}&rdquo;</> : " these filters"}.
          </p>
        )}
      </div>

      {creating && <HouseholdDialog ctx={ctx} onClose={() => setCreating(false)} />}
      {importing && (
        <ImportGuestsDialog
          weddingId={weddingId}
          events={events}
          partnerNames={partnerNames}
          onClose={() => setImporting(false)}
        />
      )}
    </div>
  );
}

function HouseholdCard({
  ctx,
  household,
  link,
  eventId,
  expanded,
  onToggle,
}: {
  ctx: Ctx;
  household: HouseholdWithGuests;
  link: string;
  /** The event picked on the page, if any; the summary then counts replies for that event only. */
  eventId: string | null;
  expanded: boolean;
  onToggle: () => void;
}) {
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  const [addingGuest, setAddingGuest] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const panelId = `household-${household.id}`;

  const copyLink = async () => {
    await navigator.clipboard.writeText(link);
    toast.success("Guest page link copied");
  };

  return (
    <div className="overflow-hidden rounded-2xl border bg-card">
      <div className="flex items-center gap-1 p-2 pl-3 sm:gap-2 sm:p-3 sm:pl-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg py-1 text-left"
        >
          <ChevronRight
            className={cn("size-4 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")}
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="truncate font-display font-bold">{household.name}</span>
              {household.rsvpSubmittedAt && <StatusPill status="yes">Replied</StatusPill>}
              {household.guestMessage && (
                <span title="Left a note for you" aria-label="Left a note for you">
                  💌
                </span>
              )}
            </div>
            <HouseholdSummary household={household} eventId={eventId} />
          </div>
        </button>

        {/* Wide screens: the actions inline. */}
        <div className="hidden items-center sm:flex">
          <Button variant="outline" size="sm" onClick={copyLink}>
            <Copy /> Guest link
          </Button>
          <Button asChild variant="ghost" size="icon" aria-label="Open guest page">
            <a href={link} target="_blank" rel="noreferrer">
              <ExternalLink />
            </a>
          </Button>
          {ctx.editable && (
            <>
              <Button variant="ghost" size="icon" aria-label="Add guest" onClick={() => setAddingGuest(true)}>
                <UserPlus />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Edit household" onClick={() => setEditing(true)}>
                <Pencil />
              </Button>
              <Button variant="ghost" size="icon" aria-label="Delete household" onClick={() => setConfirmingDelete(true)}>
                <Trash2 />
              </Button>
            </>
          )}
        </div>

        {/* Phones: the same actions in a menu. */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="size-9 sm:hidden" aria-label={`Actions for ${household.name}`}>
              <Ellipsis />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={copyLink}>
              <Copy /> Copy guest link
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <a href={link} target="_blank" rel="noreferrer">
                <ExternalLink /> Open guest page
              </a>
            </DropdownMenuItem>
            {ctx.editable && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => setAddingGuest(true)}>
                  <UserPlus /> Add guest
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> Edit household
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => setConfirmingDelete(true)}>
                  <Trash2 /> Delete household
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {expanded && (
        <div id={panelId} className="border-t px-3 sm:px-4">
          <p className="pt-2.5 text-sm text-muted-foreground">
            {[household.email, household.phone, household.city].filter(Boolean).join(" · ") || "No contact info yet"}
          </p>
          {household.personalNote && (
            <p className="mt-2 text-sm text-muted-foreground">
              📝 Your note on their page: <span className="italic">&ldquo;{household.personalNote}&rdquo;</span>
            </p>
          )}
          {household.guestMessage && (
            <p className="mt-2 rounded-xl bg-brand-soft px-3 py-2 text-sm">
              💌 <span className="italic">&ldquo;{household.guestMessage}&rdquo;</span>
            </p>
          )}
          <div className="divide-y">
            {household.guests.map((g) => (
              <GuestRow
                key={g.id}
                ctx={ctx}
                guest={g}
                host={hostOf(household, g)}
                hasPlusOne={household.guests.some((x) => x.plusOneOf === g.id)}
              />
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        title={`Delete ${household.name}?`}
        description="This removes the household, all its guests and their RSVPs."
        onConfirm={() => run(() => actions.deleteHousehold(ctx.weddingId, household.id), "Household deleted")}
      />
      {editing && <HouseholdDialog ctx={ctx} household={household} onClose={() => setEditing(false)} />}
      {addingGuest && <GuestDialog ctx={ctx} householdId={household.id} onClose={() => setAddingGuest(false)} />}
    </div>
  );
}

type GuestStatus = "coming" | "waiting" | "out";

/**
 * A guest's status for one event, or overall across the events they're invited to
 * (coming to any, out of all, otherwise waiting). Null if they aren't invited.
 */
function guestStatus(g: Guest, eventId: string | null = null): GuestStatus | null {
  const invites = eventId ? g.invites.filter((i) => i.subEventId === eventId) : g.invites;
  if (!invites.length) return null;
  if (invites.some((i) => i.status === "attending")) return "coming";
  if (invites.every((i) => i.status === "declined")) return "out";
  return "waiting";
}

function FilterChip({
  active,
  dot,
  onClick,
  children,
}: {
  active: boolean;
  dot?: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-sm font-medium whitespace-nowrap transition-colors aria-pressed:hover:bg-foreground",
        active ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
      )}
    >
      {dot && <span aria-hidden className={cn("size-2 rounded-full", dot)} />}
      {children}
    </button>
  );
}

/** "3 guests · 2 coming · 1 waiting", summarizing each guest across the events they're invited to. */
function HouseholdSummary({ household, eventId }: { household: HouseholdWithGuests; eventId: string | null }) {
  let coming = 0;
  let out = 0;
  let waiting = 0;
  for (const g of household.guests) {
    const s = guestStatus(g, eventId);
    if (s === "coming") coming++;
    else if (s === "out") out++;
    else if (s === "waiting") waiting++;
  }
  const n = household.guests.length;
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-xs text-muted-foreground">
      <span>
        {n} guest{n === 1 ? "" : "s"}
      </span>
      {coming > 0 && <Dot className="bg-yes" label={`${coming} coming`} />}
      {out > 0 && <Dot className="bg-no" label={`${out} can't make it`} />}
      {waiting > 0 && <Dot className="bg-maybe" label={`${waiting} waiting`} />}
    </div>
  );
}

function Dot({ className, label }: { className: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span aria-hidden className={cn("size-2 rounded-full", className)} />
      {label}
    </span>
  );
}

/** For a plus-one: the first name of the guest bringing them. */
function hostOf(household: HouseholdWithGuests, guest: Guest) {
  if (!guest.plusOneOf) return null;
  return household.guests.find((g) => g.id === guest.plusOneOf)?.firstName ?? null;
}

function plusOneLabel(guest: Guest, host: string | null) {
  // Unnamed: the row title already says whose guest it is.
  if (!guest.firstName) return "+1";
  return host ? `${host}'s +1` : "+1";
}

function GuestRow({
  ctx,
  guest,
  host,
  hasPlusOne,
}: {
  ctx: Ctx;
  guest: Guest;
  host: string | null;
  hasPlusOne: boolean;
}) {
  const { run } = useAction();
  const [editing, setEditing] = useState(false);
  const side = sideLabel(guest.side, ctx.partnerNames);

  return (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-2 py-2.5", guest.plusOneOf && "pl-6")}>
      <div className="flex min-w-48 flex-1 items-center gap-3">
        <span
          aria-hidden
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold text-muted-foreground"
        >
          {initials(guest)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5 font-medium">
            {guest.isPlusOne && !guest.firstName ? (
              <span className="text-muted-foreground italic">{host ? `${host}'s guest` : "Guest"}</span>
            ) : (
              guestName(guest)
            )}
            {guest.isPlusOne && (
              <Badge variant="outline" title="A plus-one: a guest the invitee brings, whose name they can fill in when they RSVP">
                {plusOneLabel(guest, host)}
              </Badge>
            )}
            {guest.ageGroup !== "adult" && <Badge variant="outline">{guest.ageGroup}</Badge>}
          </div>
          <div className="text-xs text-muted-foreground">
            {[
              guest.isPlusOne && !guest.firstName && "Name added when they RSVP",
              side,
              guest.dietaryRestrictions && `🍽 ${guest.dietaryRestrictions}`,
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {ctx.events.map((e) => {
          const invite = guest.invites.find((i) => i.subEventId === e.id);
          if (!invite) return null;
          return <RsvpCell key={e.id} ctx={ctx} event={e} guestId={guest.id} invite={invite} />;
        })}
      </div>
      {ctx.editable && (
        <div className="flex">
          {!guest.isPlusOne && !hasPlusOne && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs font-bold"
              aria-label={`Give ${guestName(guest)} an unnamed +1`}
              title="Add an unnamed +1 for this guest. They'll name their guest when they RSVP."
              onClick={() =>
                run(() => actions.setPlusOne(ctx.weddingId, guest.id, true), `Added a +1 for ${guest.firstName ?? "this guest"}`)
              }
            >
              +1
            </Button>
          )}
          <Button variant="ghost" size="icon-sm" aria-label="Edit guest" onClick={() => setEditing(true)}>
            <Pencil />
          </Button>
          <ConfirmButton
            title={`Remove ${guestName(guest)}?`}
            description="Their RSVPs will be deleted. If they're the last guest in the household, the household is removed too."
            onConfirm={() => run(() => actions.deleteGuest(ctx.weddingId, guest.id), "Guest removed")}
          >
            <Button variant="ghost" size="icon-sm" aria-label="Remove guest">
              <X />
            </Button>
          </ConfirmButton>
        </div>
      )}
      {editing && (
        <GuestDialog
          ctx={ctx}
          guest={guest}
          hasPlusOne={hasPlusOne}
          householdId={guest.householdId}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

function RsvpCell({
  ctx,
  event,
  guestId,
  invite,
}: {
  ctx: Ctx;
  event: Event;
  guestId: string;
  invite: Guest["invites"][number];
}) {
  const { pending, run } = useAction();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const update = async (status: RsvpStatus, mealChoice = invite.mealChoice) => {
    const ok = await run(() => actions.setRsvp(ctx.weddingId, { guestId, subEventId: event.id, status, mealChoice }));
    if (ok && status === "attending" && invite.status !== "attending") celebrateFrom(triggerRef.current);
  };

  if (!ctx.editable) {
    return (
      <StatusPill status={RSVP_STATUS[invite.status].status}>
        {event.name}: {STATUS_LABEL[invite.status]}
        {invite.mealChoice && ` · ${invite.mealChoice}`}
      </StatusPill>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <Select value={invite.status} disabled={pending} onValueChange={(v) => update(v as RsvpStatus)}>
        <SelectTrigger
          ref={triggerRef}
          size="sm"
          className={cn("h-7 rounded-full text-xs font-semibold [&_svg]:text-current!", STATUS_TRIGGER[invite.status])}
          aria-label={`${event.name} RSVP`}
        >
          <span className="font-normal opacity-75">{event.name}:</span>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {(Object.keys(STATUS_LABEL) as RsvpStatus[]).map((s) => (
            <SelectItem key={s} value={s}>
              {STATUS_LABEL[s]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {invite.status === "attending" && event.mealOptions.length > 0 && (
        <Select
          value={invite.mealChoice ?? undefined}
          disabled={pending}
          onValueChange={(meal) => update("attending", meal)}
        >
          <SelectTrigger size="sm" className="h-7 rounded-full text-xs" aria-label={`${event.name} meal`}>
            <SelectValue placeholder="Meal?" />
          </SelectTrigger>
          <SelectContent>
            {event.mealOptions.map((m) => (
              <SelectItem key={m} value={m}>
                {m}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

// ---------- Dialogs ----------

type GuestDraft = {
  key: number;
  firstName: string;
  lastName: string;
  ageGroup: "adult" | "child" | "infant";
  bringsPlusOne: boolean;
};

function HouseholdDialog({ ctx, household, onClose }: { ctx: Ctx; household?: HouseholdWithGuests; onClose: () => void }) {
  const { pending, run } = useAction();
  const [drafts, setDrafts] = useState<GuestDraft[]>([
    { key: 0, firstName: "", lastName: "", ageGroup: "adult", bringsPlusOne: false },
  ]);
  const [eventIds, setEventIds] = useState<string[]>(ctx.events.map((e) => e.id));
  const [side, setSide] = useState<string>(NONE);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const { name, email, phone, addressLine1, addressLine2, city, region, postalCode, country, notes, personalNote } =
      formObject(e.currentTarget);
    const fields = { name, email, phone, addressLine1, addressLine2, city, region, postalCode, country, notes, personalNote };
    const ok = household
      ? await run(() => actions.updateHousehold(ctx.weddingId, household.id, fields), "Household saved")
      : await run(
          () =>
            actions.createHousehold(ctx.weddingId, {
              ...fields,
              guests: drafts.map(({ firstName, lastName, ageGroup, bringsPlusOne }) => ({
                firstName,
                lastName,
                ageGroup,
                bringsPlusOne,
                side: noneToEmpty(side) as "",
              })),
              subEventIds: eventIds,
            }),
          "Household added",
        );
    if (ok) onClose();
  }

  const updateDraft = (key: number, patch: Partial<GuestDraft>) =>
    setDrafts((ds) => ds.map((d) => (d.key === key ? { ...d, ...patch } : d)));

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{household ? `Edit ${household.name}` : "Add household"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-6">
          <Field
            name="name"
            label="Household name"
            placeholder={household ? undefined : "e.g. The Garcia Family (leave blank to name it from the guests)"}
            defaultValue={household?.name}
            required={!!household}
            autoFocus={!household}
          />
          {!household && (
            <section className="space-y-3">
              <h3 className="text-sm font-medium">Guests</h3>
              {drafts.map((d, i) => (
                <div key={d.key} className="flex flex-wrap items-end gap-2">
                  <div className="min-w-32 flex-1 space-y-1">
                    {i === 0 && <Label className="text-xs">First name</Label>}
                    <Input
                      value={d.firstName}
                      required
                      onChange={(e) => updateDraft(d.key, { firstName: e.target.value })}
                      aria-label="First name"
                    />
                  </div>
                  <div className="min-w-32 flex-1 space-y-1">
                    {i === 0 && <Label className="text-xs">Last name</Label>}
                    <Input
                      value={d.lastName}
                      onChange={(e) => updateDraft(d.key, { lastName: e.target.value })}
                      aria-label="Last name"
                    />
                  </div>
                  <Select value={d.ageGroup} onValueChange={(v) => updateDraft(d.key, { ageGroup: v as GuestDraft["ageGroup"] })}>
                    <SelectTrigger className="w-24" aria-label="Age group">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="adult">Adult</SelectItem>
                      <SelectItem value="child">Child</SelectItem>
                      <SelectItem value="infant">Infant</SelectItem>
                    </SelectContent>
                  </Select>
                  <label className="flex h-8 items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={d.bringsPlusOne}
                      onCheckedChange={(c) => updateDraft(d.key, { bringsPlusOne: c === true })}
                    />
                    <span title="Adds a separate guest this person brings. They'll name their guest when they RSVP.">
                      + Unnamed guest
                    </span>
                  </label>
                  {drafts.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label="Remove row"
                      onClick={() => setDrafts((ds) => ds.filter((x) => x.key !== d.key))}
                    >
                      <X />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  setDrafts((ds) => [
                    ...ds,
                    { key: Date.now(), firstName: "", lastName: ds.at(-1)?.lastName ?? "", ageGroup: "adult", bringsPlusOne: false },
                  ])
                }
              >
                <Plus /> Another guest
              </Button>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Side</Label>
                  <Select value={side} onValueChange={setSide}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>Not set</SelectItem>
                      <SelectItem value="partner1">{ctx.partnerNames[0]}</SelectItem>
                      <SelectItem value="partner2">{ctx.partnerNames[1]}</SelectItem>
                      <SelectItem value="both">Both</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {ctx.events.length > 0 && (
                <EventCheckboxes events={ctx.events} value={eventIds} onChange={setEventIds} />
              )}
            </section>
          )}

          <section className="grid gap-3 sm:grid-cols-2">
            <Field name="email" label="Email" type="email" defaultValue={household?.email ?? ""} />
            <Field name="phone" label="Phone" defaultValue={household?.phone ?? ""} />
            <Field name="addressLine1" label="Address" defaultValue={household?.addressLine1 ?? ""} className="sm:col-span-2" />
            <Field name="addressLine2" label="Address line 2" defaultValue={household?.addressLine2 ?? ""} className="sm:col-span-2" />
            <Field name="city" label="City" defaultValue={household?.city ?? ""} />
            <Field name="region" label="State / province" defaultValue={household?.region ?? ""} />
            <Field name="postalCode" label="Postal code" defaultValue={household?.postalCode ?? ""} />
            <Field name="country" label="Country" defaultValue={household?.country ?? ""} />
            <TextareaField
              name="personalNote"
              label="Personal note on their guest page"
              placeholder="e.g. Grandma, we've saved you a seat right up front! 💕"
              defaultValue={household?.personalNote ?? ""}
              className="sm:col-span-2"
            />
            <TextareaField
              name="notes"
              label="Private notes (only your planning crew sees these)"
              defaultValue={household?.notes ?? ""}
              className="sm:col-span-2"
            />
          </section>
          <DialogFooter>
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

function GuestDialog({
  ctx,
  guest,
  hasPlusOne = false,
  householdId,
  onClose,
}: {
  ctx: Ctx;
  guest?: Guest;
  hasPlusOne?: boolean;
  householdId: string;
  onClose: () => void;
}) {
  const { pending, run } = useAction();
  const initialEvents = guest ? guest.invites.map((i) => i.subEventId) : undefined;
  const [eventIds, setEventIds] = useState<string[] | undefined>(initialEvents);
  const isPlusOne = guest?.isPlusOne ?? false;
  const [bringsPlusOne, setBringsPlusOne] = useState(hasPlusOne);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formObject(e.currentTarget);
    const fields = {
      firstName: f.firstName,
      lastName: f.lastName,
      email: f.email,
      phone: f.phone,
      side: noneToEmpty(f.side) as "",
      ageGroup: f.ageGroup as "adult",
      // Only send when it changed, so saving doesn't recreate a +1 that was just named.
      ...(!isPlusOne && bringsPlusOne !== hasPlusOne ? { bringsPlusOne } : {}),
      dietaryRestrictions: f.dietaryRestrictions,
      notes: f.notes,
    };

    if (!guest) {
      const ok = await run(() => actions.addGuest(ctx.weddingId, { ...fields, householdId, subEventIds: eventIds }), "Guest added");
      if (ok) onClose();
      return;
    }

    const ok = await run(() => actions.updateGuest(ctx.weddingId, guest.id, fields));
    if (!ok) return;
    const before = new Set(initialEvents);
    const after = new Set(eventIds);
    for (const e of ctx.events) {
      if (before.has(e.id) !== after.has(e.id)) {
        await run(() =>
          actions.setInvitations(ctx.weddingId, { subEventId: e.id, guestIds: [guest.id], invited: after.has(e.id) }),
        );
      }
    }
    toast.success("Guest saved");
    onClose();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{guest ? `Edit ${guestName(guest)}` : "Add guest"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field name="firstName" label="First name" defaultValue={guest?.firstName ?? ""} required={!isPlusOne} />
          <Field name="lastName" label="Last name" defaultValue={guest?.lastName ?? ""} />
          <Field name="email" label="Email" type="email" defaultValue={guest?.email ?? ""} />
          <Field name="phone" label="Phone" defaultValue={guest?.phone ?? ""} />
          <SelectField
            name="side"
            label="Side"
            defaultValue={guest?.side ?? NONE}
            options={[
              { value: NONE, label: "Not set" },
              { value: "partner1", label: ctx.partnerNames[0] },
              { value: "partner2", label: ctx.partnerNames[1] },
              { value: "both", label: "Both" },
            ]}
          />
          <SelectField
            name="ageGroup"
            label="Age group"
            defaultValue={guest?.ageGroup ?? "adult"}
            options={[
              { value: "adult", label: "Adult" },
              { value: "child", label: "Child" },
              { value: "infant", label: "Infant" },
            ]}
          />
          {isPlusOne ? (
            <p className="text-sm text-muted-foreground sm:col-span-2">
              This is a plus-one. Their host can fill in the name when they RSVP, or you can add it here.
            </p>
          ) : (
            <label className="flex items-start gap-2 text-sm sm:col-span-2">
              <Checkbox className="mt-0.5" checked={bringsPlusOne} onCheckedChange={(c) => setBringsPlusOne(c === true)} />
              <span>
                Bringing an unnamed +1
                <span className="block text-muted-foreground">
                  Adds a separate guest they bring, who they&apos;ll name when they RSVP.
                  {hasPlusOne && !bringsPlusOne && " Unchecking removes their +1 and its RSVP."}
                </span>
              </span>
            </label>
          )}
          <Field
            name="dietaryRestrictions"
            label="Dietary restrictions"
            defaultValue={guest?.dietaryRestrictions ?? ""}
            className="sm:col-span-2"
          />
          <TextareaField name="notes" label="Notes" defaultValue={guest?.notes ?? ""} className="sm:col-span-2" />
          {ctx.events.length > 0 && (
            <div className="sm:col-span-2">
              {eventIds === undefined ? (
                <p className="text-sm text-muted-foreground">
                  Invited to the same events as the rest of the household.{" "}
                  <button type="button" className="underline" onClick={() => setEventIds([])}>
                    Choose events
                  </button>
                </p>
              ) : (
                <EventCheckboxes events={ctx.events} value={eventIds} onChange={setEventIds} />
              )}
            </div>
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

function EventCheckboxes({ events, value, onChange }: { events: Event[]; value: string[]; onChange: (ids: string[]) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-medium">Invited to</legend>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {events.map((e) => (
          <label key={e.id} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={value.includes(e.id)}
              onCheckedChange={(c) => onChange(c ? [...value, e.id] : value.filter((id) => id !== e.id))}
            />
            {e.name}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
