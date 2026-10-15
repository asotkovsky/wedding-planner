import "server-only";
import { and, eq } from "drizzle-orm";
import type { AnyPgColumn, PgTable } from "drizzle-orm/pg-core";
import { z } from "zod";
import { db } from "@/db";
import { logActivity } from "@/lib/activity";
import { formatPhone } from "@/lib/phone";

/**
 * An already-authorized request context. Services trust it, so only build one after
 * requireWeddingAccess() (server actions) or from the session-bound assistant route.
 */
export type Ctx = {
  weddingId: string;
  userId: string;
  timezone: string;
  currency: string;
  viaAssistant?: boolean;
};

/** An error whose message is safe to show the user (or the assistant). */
export class UserError extends Error {}

type OwnedTable = PgTable & { id: AnyPgColumn; weddingId: AnyPgColumn };

/** Throws unless `id` is a row of `table` belonging to the current wedding. */
export async function assertOwned(ctx: Ctx, table: OwnedTable, id: string | null | undefined, label: string) {
  if (!id) return;
  const rows = await db
    .select({ id: table.id })
    .from(table as PgTable)
    .where(and(eq(table.id, id), eq(table.weddingId, ctx.weddingId)));
  if (!rows.length) throw new UserError(`${label} not found`);
}

export function log(
  ctx: Ctx,
  action: "create" | "update" | "delete",
  entityType: string,
  summary: string,
  entityId?: string,
  tx?: Parameters<typeof logActivity>[1],
) {
  return logActivity(
    { weddingId: ctx.weddingId, actorUserId: ctx.userId, viaAssistant: ctx.viaAssistant ?? false, action, entityType, entityId, summary },
    tx,
  );
}

// ---- Shared input schemas. Forms send "" for empty fields; normalize to null. ----

export const optText = (max = 2000) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform(emptyToNull);

/** A phone number, formatted 555-555-5555 when it's a 10-digit US number. */
export const optPhone = optText(50).transform((v) => (v ? formatPhone(v) : v));

export const optEmail = z
  .union([z.literal(""), z.email()])
  .nullish()
  .transform(emptyToNull);

export const optUrl = z
  .union([z.literal(""), z.url()])
  .nullish()
  .transform(emptyToNull);

export const optDate = z
  .union([z.literal(""), z.iso.date()])
  .nullish()
  .transform(emptyToNull);

/** Wall-clock time in the wedding's timezone, e.g. "2027-06-12T16:30". */
export const localDateTime = z.iso.datetime({ local: true });
export const optLocalDateTime = z
  .union([z.literal(""), localDateTime])
  .nullish()
  .transform(emptyToNull);

export const optUuid = z
  .union([z.literal(""), z.uuid()])
  .nullish()
  .transform(emptyToNull);

/** Money in major units (e.g. dollars), converted to integer cents. */
export const money = z.coerce
  .number()
  .nonnegative()
  .max(10_000_000)
  .transform((n) => Math.round(n * 100));

export const optMoney = z
  .union([z.literal(""), money])
  .nullish()
  .transform(emptyToNull);

export function cents(n: number | null | undefined) {
  return n == null ? null : n / 100;
}

/** "" and null become null (clear the field); undefined stays undefined (leave unchanged). */
function emptyToNull<T>(v: T | "" | null | undefined): T | null | undefined {
  return v === undefined ? undefined : v === "" || v === null ? null : v;
}
