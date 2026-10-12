"use client";

import { Copy, Trash2 } from "lucide-react";
import { useActionState, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { MoneyField } from "@/components/money-input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { MemberRole, weddings } from "@/db/schema";
import { CURRENCIES } from "@/lib/defaults";
import { changeMemberRole, createInvite, removeMember, revokeInvite, updateWeddingDetails } from "./actions";

const ROLES: MemberRole[] = ["owner", "editor", "viewer"];

export function WeddingDetailsForm({
  wedding,
  disabled,
}: {
  wedding: typeof weddings.$inferSelect;
  disabled: boolean;
}) {
  const [state, action, pending] = useActionState(updateWeddingDetails.bind(null, wedding.id), undefined);
  const [currency, setCurrency] = useState(wedding.currency);
  useEffect(() => {
    if (state?.ok) toast.success("Saved");
  }, [state]);

  const errors = state?.errors ?? {};
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <fieldset disabled={disabled} className="contents">
        <Field name="partner1Name" label="Partner 1" defaultValue={wedding.partner1Name} errors={errors.partner1Name} />
        <Field name="partner2Name" label="Partner 2" defaultValue={wedding.partner2Name} errors={errors.partner2Name} />
        <Field name="name" label="Wedding name" defaultValue={wedding.name} errors={errors.name} />
        <Field name="date" label="Date" type="date" defaultValue={wedding.date ?? ""} errors={errors.date} />
        <Field name="timezone" label="Timezone" defaultValue={wedding.timezone} errors={errors.timezone} />
        <div className="space-y-2">
          <Label>Currency</Label>
          <Select name="currency" value={currency} onValueChange={setCurrency}>
            <SelectTrigger className="w-full">
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
        <MoneyField
          currency={currency}
          name="totalBudget"
          label="Total budget"
          defaultValue={wedding.totalBudgetCents != null ? String(wedding.totalBudgetCents / 100) : ""}
          errors={errors.totalBudget}
        />
        <Field name="venueName" label="Venue" defaultValue={wedding.venueName ?? ""} />
        <div className="sm:col-span-2">
          <Field name="venueAddress" label="Venue address" defaultValue={wedding.venueAddress ?? ""} />
        </div>
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            Save
          </Button>
        </div>
      </fieldset>
    </form>
  );
}

export function MemberList({
  weddingId,
  members,
  meId,
  isOwner,
}: {
  weddingId: string;
  members: { userId: string; name: string; email: string; role: MemberRole }[];
  meId: string;
  isOwner: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const run = (fn: () => Promise<void>) =>
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  return (
    <ul className="divide-y">
      {members.map((m) => (
        <li key={m.userId} className="flex items-center gap-3 py-2">
          <div className="min-w-0 flex-1">
            <div className="truncate font-medium">
              {m.name} {m.userId === meId && <span className="text-muted-foreground">(you)</span>}
            </div>
            <div className="truncate text-sm text-muted-foreground">{m.email}</div>
          </div>
          {isOwner ? (
            <>
              <Select
                value={m.role}
                disabled={pending}
                onValueChange={(role) => run(() => changeMemberRole(weddingId, m.userId, role as MemberRole))}
              >
                <SelectTrigger className="w-28">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r}>
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                disabled={pending}
                aria-label={`Remove ${m.name}`}
                onClick={() => {
                  if (confirm(`Remove ${m.name} from this wedding?`)) run(() => removeMember(weddingId, m.userId));
                }}
              >
                <Trash2 />
              </Button>
            </>
          ) : (
            <Badge variant="secondary">{m.role}</Badge>
          )}
        </li>
      ))}
    </ul>
  );
}

export function InviteForm({ weddingId }: { weddingId: string }) {
  const [state, action, pending] = useActionState(createInvite.bind(null, weddingId), undefined);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <div className="min-w-48 flex-1 space-y-2">
        <Label htmlFor="invite-email">Invite by email</Label>
        <Input id="invite-email" name="email" type="email" required placeholder="planner@example.com" />
        {state?.errors?.email && <p className="text-sm text-destructive">{state.errors.email[0]}</p>}
      </div>
      <Select name="role" defaultValue="editor">
        <SelectTrigger className="w-28">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLES.map((r) => (
            <SelectItem key={r} value={r}>
              {r}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={pending}>
        Create invite link
      </Button>
    </form>
  );
}

export function InviteList({
  weddingId,
  invites,
}: {
  weddingId: string;
  invites: { id: string; email: string; role: MemberRole; link: string }[];
}) {
  if (!invites.length) return null;
  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium">Pending invites</h3>
      <p className="text-sm text-muted-foreground">
        Send these links yourself. They expire after 14 days and only work for the invited email address.
      </p>
      <ul className="divide-y">
        {invites.map((i) => (
          <li key={i.id} className="flex items-center gap-3 py-2">
            <div className="min-w-0 flex-1 truncate text-sm">
              {i.email} <Badge variant="outline">{i.role}</Badge>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                await navigator.clipboard.writeText(i.link);
                toast.success("Invite link copied");
              }}
            >
              <Copy /> Copy link
            </Button>
            <Button variant="ghost" size="icon" aria-label="Revoke invite" onClick={() => revokeInvite(weddingId, i.id)}>
              <Trash2 />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Field({
  name,
  label,
  type = "text",
  defaultValue,
  errors,
}: {
  name: string;
  label: string;
  type?: string;
  defaultValue?: string;
  errors?: string[];
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={defaultValue} step={type === "number" ? "0.01" : undefined} />
      {errors?.map((e) => (
        <p key={e} className="text-sm text-destructive">
          {e}
        </p>
      ))}
    </div>
  );
}
