"use client";

import {
  CircleAlert,
  CircleDollarSign,
  CircleCheck,
  ExternalLink,
  FileSignature,
  Pencil,
  Plus,
  Store,
  Trash2,
} from "lucide-react";
import { useState } from "react";
import { IconChip, type Tone } from "@/components/brand";
import { celebrate, celebrateFrom } from "@/components/celebrate";
import { ConfirmButton } from "@/components/confirm-button";
import { EmptyState } from "@/components/empty-state";
import { StatusPill } from "@/components/status-pill";
import { vendorIcon } from "@/components/vendor-icons";
import {
  Field,
  NONE,
  noneToEmpty,
  PhoneField,
  SelectField,
  TextareaField,
} from "@/components/form-field";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MoneyField, MoneyInput } from "@/components/money-input";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formObject, useAction } from "@/components/use-action";
import { VENDOR_CATEGORIES } from "@/lib/defaults";
import { formatDate, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { VendorWithPayments } from "@/server/vendors";
import * as actions from "./actions";

type Props = {
  weddingId: string;
  vendors: VendorWithPayments[];
  categories: { id: string; name: string }[];
  currency: string;
  today: string;
  editable: boolean;
};

const VENDOR_STATUS = {
  booked: { status: "yes", label: "Booked" },
  considering: { status: "maybe", label: "Considering" },
  declined: { status: "no", label: "Passed" },
} as const;

export function VendorsView(props: Props) {
  const { weddingId, vendors, currency, today, editable } = props;
  const { run } = useAction();
  const [editing, setEditing] = useState<VendorWithPayments | "new" | null>(
    null,
  );
  const [paymentsFor, setPaymentsFor] = useState<string | null>(null);
  const money = (c: number | null) =>
    c == null ? "—" : formatMoney(c, currency);

  const booked = vendors.filter((v) => v.status === "booked");
  const contracted = booked.reduce(
    (s, v) => s + (v.contractTotalCents ?? 0),
    0,
  );
  const paid = vendors.reduce((s, v) => s + v.paidCents, 0);
  const overdue = vendors.flatMap((v) =>
    v.payments.filter((p) => !p.paidOn && p.dueDate && p.dueDate < today),
  );

  return (
    <div className="space-y-6">
      <PageHeader section="vendors">
        {editable && (
          <Button onClick={() => setEditing("new")}>
            <Plus /> Add vendor
          </Button>
        )}
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat
          icon={CircleCheck}
          tone="mint"
          label="Booked"
          value={`${booked.length} of ${vendors.length}`}
        />
        <Stat
          icon={FileSignature}
          tone="peach"
          label="Contracted"
          value={money(contracted)}
        />
        <Stat
          icon={CircleDollarSign}
          tone="sky"
          label="Paid"
          value={money(paid)}
        />
        <Stat
          icon={CircleAlert}
          tone={overdue.length ? "rose" : "gray"}
          label="Overdue payments"
          value={String(overdue.length)}
          className={overdue.length ? "text-destructive" : undefined}
        />
      </div>

      {vendors.length === 0 ? (
        <EmptyState
          icon={Store}
          tone="peach"
          title="Assemble your dream team"
          description="Add the vendors you're talking to and track every deposit."
        />
      ) : (
        <>
          {/* Phones: one card per vendor. */}
          <ul className="space-y-2.5 md:hidden">
            {vendors.map((v) => {
              const overdue = !!(
                v.nextDue?.dueDate && v.nextDue.dueDate < today
              );
              return (
                <li
                  key={v.id}
                  className="space-y-3 rounded-2xl border bg-card p-3.5"
                >
                  <div className="flex items-start gap-3">
                    <IconChip
                      icon={vendorIcon(v.category)}
                      tone={v.status === "booked" ? "pop" : "gray"}
                      sticker={v.status === "booked"}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{v.name}</div>
                      <div className="truncate text-xs text-muted-foreground">
                        {[v.category, v.contactName]
                          .filter(Boolean)
                          .join(" · ")}
                      </div>
                    </div>
                    <StatusPill status={VENDOR_STATUS[v.status].status}>
                      {VENDOR_STATUS[v.status].label}
                    </StatusPill>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 text-center text-xs">
                    {[
                      ["Contract", v.contractTotalCents],
                      ["Paid", v.paidCents],
                      ["Balance", v.balanceCents],
                    ].map(([label, value]) => (
                      <div
                        key={label as string}
                        className="rounded-lg bg-muted px-1 py-1.5"
                      >
                        <dt className="text-muted-foreground">{label}</dt>
                        <dd className="font-semibold tabular-nums">
                          {money(value as number | null)}
                        </dd>
                      </div>
                    ))}
                  </dl>
                  {v.nextDue && (
                    <div className="text-sm">
                      {overdue ? (
                        <StatusPill status="late">
                          {money(v.nextDue.amountCents)} overdue since{" "}
                          {formatDate(v.nextDue.dueDate!, {
                            month: "short",
                            day: "numeric",
                          })}
                        </StatusPill>
                      ) : (
                        <span className="text-muted-foreground">
                          Next:{" "}
                          <span className="font-medium text-foreground">
                            {money(v.nextDue.amountCents)}
                          </span>
                          {v.nextDue.dueDate &&
                            ` · ${formatDate(v.nextDue.dueDate, { dateStyle: "medium" })}`}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex items-center gap-1 border-t pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setPaymentsFor(v.id)}
                    >
                      <CircleDollarSign /> Payments
                    </Button>
                    {editable && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-9"
                          aria-label={`Edit ${v.name}`}
                          onClick={() => setEditing(v)}
                        >
                          <Pencil />
                        </Button>
                        <ConfirmButton
                          title={`Delete ${v.name}?`}
                          description="Its payment history will be deleted too."
                          onConfirm={() =>
                            run(
                              () => actions.deleteVendor(weddingId, v.id),
                              "Vendor deleted",
                            )
                          }
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-9"
                            aria-label={`Delete ${v.name}`}
                          >
                            <Trash2 />
                          </Button>
                        </ConfirmButton>
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
          <div className="hidden overflow-hidden rounded-2xl border bg-card md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Contract</TableHead>
                  <TableHead className="text-right">Paid</TableHead>
                  <TableHead className="text-right">Balance</TableHead>
                  <TableHead>Next payment</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {vendors.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <IconChip
                          icon={vendorIcon(v.category)}
                          tone={v.status === "booked" ? "pop" : "gray"}
                          size="md"
                          sticker={v.status === "booked"}
                        />
                        <div>
                          <div className="flex items-center gap-1 font-medium">
                            {v.name}
                            {v.website && (
                              <a
                                href={v.website}
                                target="_blank"
                                rel="noreferrer"
                                aria-label="Website"
                              >
                                <ExternalLink className="size-3.5 text-muted-foreground" />
                              </a>
                            )}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {[v.category, v.contactName, v.email ?? v.phone]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <StatusPill status={VENDOR_STATUS[v.status].status}>
                        {VENDOR_STATUS[v.status].label}
                      </StatusPill>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(v.contractTotalCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(v.paidCents)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {money(v.balanceCents)}
                    </TableCell>
                    <TableCell>
                      {v.nextDue ? (
                        v.nextDue.dueDate && v.nextDue.dueDate < today ? (
                          <StatusPill status="late">
                            {money(v.nextDue.amountCents)} · overdue since{" "}
                            {formatDate(v.nextDue.dueDate, {
                              month: "short",
                              day: "numeric",
                            })}
                          </StatusPill>
                        ) : (
                          <span>
                            {money(v.nextDue.amountCents)}
                            {v.nextDue.dueDate &&
                              ` · ${formatDate(v.nextDue.dueDate, { dateStyle: "medium" })}`}
                          </span>
                        )
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex justify-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setPaymentsFor(v.id)}
                        >
                          <CircleDollarSign /> Payments
                        </Button>
                        {editable && (
                          <>
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label="Edit vendor"
                              onClick={() => setEditing(v)}
                            >
                              <Pencil />
                            </Button>
                            <ConfirmButton
                              title={`Delete ${v.name}?`}
                              description="Its payment history will be deleted too."
                              onConfirm={() =>
                                run(
                                  () => actions.deleteVendor(weddingId, v.id),
                                  "Vendor deleted",
                                )
                              }
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                aria-label="Delete vendor"
                              >
                                <Trash2 />
                              </Button>
                            </ConfirmButton>
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {editing && (
        <VendorDialog
          {...props}
          vendor={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}
      {paymentsFor && (
        <PaymentsDialog
          {...props}
          vendor={vendors.find((v) => v.id === paymentsFor)!}
          onClose={() => setPaymentsFor(null)}
        />
      )}
    </div>
  );
}

function Stat({
  icon,
  tone,
  label,
  value,
  className,
}: {
  icon: typeof Store;
  tone: Tone;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <Card size="sm" className="rounded-2xl">
      <CardHeader className="flex flex-row items-center gap-3">
        <IconChip icon={icon} tone={tone} />
        <div>
          <CardDescription>{label}</CardDescription>
          <CardTitle
            className={cn(
              "font-display text-2xl font-bold tabular-nums",
              className,
            )}
          >
            {value}
          </CardTitle>
        </div>
      </CardHeader>
    </Card>
  );
}

function VendorDialog({
  weddingId,
  categories,
  currency,
  vendor,
  onClose,
}: Props & { vendor?: VendorWithPayments; onClose: () => void }) {
  const { pending, run } = useAction();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = formObject(e.currentTarget);
    const input = {
      name: f.name,
      category: f.category,
      status: f.status as "booked",
      contactName: f.contactName,
      email: f.email,
      phone: f.phone,
      website: f.website,
      contractTotal: f.contractTotal,
      budgetCategoryId: noneToEmpty(f.budgetCategoryId),
      notes: f.notes,
    };
    const ok = vendor
      ? await run(
          () => actions.updateVendor(weddingId, vendor.id, input),
          "Vendor saved",
        )
      : await run(() => actions.createVendor(weddingId, input), "Vendor added");
    if (ok) onClose();
  }

  const categoryOptions = [
    ...new Set([...VENDOR_CATEGORIES, ...(vendor ? [vendor.category] : [])]),
  ];

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {vendor ? `Edit ${vendor.name}` : "Add vendor"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
          <Field
            name="name"
            label="Name"
            required
            defaultValue={vendor?.name}
            className="sm:col-span-2"
          />
          <SelectField
            name="category"
            label="Type"
            defaultValue={vendor?.category ?? "Photographer"}
            options={categoryOptions.map((c) => ({ value: c, label: c }))}
          />
          <SelectField
            name="status"
            label="Status"
            defaultValue={vendor?.status ?? "considering"}
            options={[
              { value: "considering", label: "Considering" },
              { value: "booked", label: "Booked" },
              { value: "declined", label: "Declined" },
            ]}
          />
          <MoneyField
            currency={currency}
            name="contractTotal"
            label="Contract total"
            defaultValue={
              vendor?.contractTotalCents != null
                ? vendor.contractTotalCents / 100
                : ""
            }
          />
          <SelectField
            name="budgetCategoryId"
            label="Budget category"
            defaultValue={vendor?.budgetCategoryId ?? NONE}
            options={[
              { value: NONE, label: vendor ? "None" : "Automatic" },
              ...categories.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          <Field
            name="contactName"
            label="Contact name"
            defaultValue={vendor?.contactName ?? ""}
          />
          <Field
            name="email"
            label="Email"
            type="email"
            defaultValue={vendor?.email ?? ""}
          />
          <PhoneField name="phone" label="Phone" defaultValue={vendor?.phone ?? ""} />
          <Field
            name="website"
            label="Website"
            type="url"
            defaultValue={vendor?.website ?? ""}
          />
          <TextareaField
            name="notes"
            label="Notes"
            defaultValue={vendor?.notes ?? ""}
            className="sm:col-span-2"
          />
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

function PaymentsDialog({
  weddingId,
  currency,
  today,
  editable,
  vendor,
  onClose,
}: Props & { vendor: VendorWithPayments; onClose: () => void }) {
  const { pending, run } = useAction();
  const money = (c: number | null) =>
    c == null ? "—" : formatMoney(c, currency);

  async function onAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const f = formObject(form);
    const ok = await run(
      () =>
        actions.addPayment(weddingId, {
          vendorId: vendor.id,
          description: f.description,
          amount: f.amount,
          dueDate: f.dueDate,
          paidOn: f.paid === "on" ? today : "",
        }),
      "Payment added",
    );
    if (ok) form.reset();
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{vendor.name} payments</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Contract {money(vendor.contractTotalCents)} · Paid{" "}
          {money(vendor.paidCents)} · Balance {money(vendor.balanceCents)}
        </p>
        <ul className="divide-y">
          {vendor.payments.map((p) => (
            <li key={p.id} className="flex items-center gap-3 py-2">
              <Checkbox
                checked={!!p.paidOn}
                disabled={!editable || pending}
                aria-label="Paid"
                onCheckedChange={async (c) => {
                  const el = document.activeElement;
                  if (
                    (await run(() =>
                      actions.setPaymentPaid(weddingId, p.id, c === true),
                    )) &&
                    c === true
                  )
                    celebrateFrom(el);
                }}
              />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{p.description}</div>
                <div
                  className={cn(
                    "text-xs text-muted-foreground",
                    !p.paidOn &&
                      p.dueDate &&
                      p.dueDate < today &&
                      "text-destructive",
                  )}
                >
                  {p.paidOn
                    ? `Paid ${formatDate(p.paidOn, { dateStyle: "medium" })}`
                    : p.dueDate
                      ? `Due ${formatDate(p.dueDate, { dateStyle: "medium" })}`
                      : "No due date"}
                </div>
              </div>
              <span className="tabular-nums">{money(p.amountCents)}</span>
              {editable && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete payment"
                  onClick={() =>
                    run(
                      () => actions.deletePayment(weddingId, p.id),
                      "Payment deleted",
                    )
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </li>
          ))}
          {vendor.payments.length === 0 && (
            <li className="py-4 text-sm text-muted-foreground">
              No payments scheduled.
            </li>
          )}
        </ul>
        {editable && (
          <form
            onSubmit={onAdd}
            className="flex flex-wrap items-end gap-2 border-t pt-4"
          >
            <Input
              name="description"
              placeholder="Deposit"
              required
              className="min-w-32 flex-1"
              aria-label="Description"
            />
            <MoneyInput
              currency={currency}
              name="amount"
              placeholder="Amount"
              required
              className="w-32"
              aria-label="Amount"
            />
            <Input
              name="dueDate"
              type="date"
              className="w-40"
              aria-label="Due date"
            />
            <label className="flex h-8 items-center gap-1.5 text-sm">
              <Checkbox name="paid" /> Paid
            </label>
            <Button type="submit" disabled={pending}>
              <Plus /> Add
            </Button>
          </form>
        )}
        {editable && (
          <DialogFooter>
            <ConfirmButton
              title={`Mark ${vendor.name} as paid in full?`}
              description="All unpaid payments are marked paid today. If the contract total is more than what's scheduled, the difference is recorded as a paid final balance."
              confirmLabel="Mark paid"
              destructive={false}
              onConfirm={async () => {
                if (
                  await run(
                    () => actions.markVendorPaidInFull(weddingId, vendor.id),
                    `${vendor.name} is paid in full! 🎉`,
                  )
                )
                  celebrate();
              }}
            >
              <Button variant="outline" disabled={pending}>
                Mark paid in full
              </Button>
            </ConfirmButton>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
