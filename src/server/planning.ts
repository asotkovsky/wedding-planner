import "server-only";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { subEvents, taskStatus, tasks, timelineItems, user, vendors, weddingMembers } from "@/db/schema";
import { localToUtc } from "@/lib/datetime";
import { assertOwned, localDateTime, log, optDate, optLocalDateTime, optText, UserError, type Ctx } from "./core";

// ---------- Tasks ----------

const optUserId = z
  .string()
  .nullish()
  .transform((v) => (v === undefined ? undefined : v || null));

const taskFields = {
  title: z.string().trim().min(1).max(300),
  description: optText(),
  category: optText(100),
  dueDate: optDate,
  status: z.enum(taskStatus.enumValues).optional(),
  assigneeUserId: optUserId,
  vendorId: z
    .union([z.literal(""), z.uuid()])
    .nullish()
    .transform((v) => (v === undefined ? undefined : v || null)),
};
export const taskCreateInput = z.object(taskFields);
export const taskUpdateInput = z.object(taskFields).partial();

export type TaskCreateInput = z.input<typeof taskCreateInput>;
export type TaskUpdateInput = z.input<typeof taskUpdateInput>;
export type Task = typeof tasks.$inferSelect;

export async function listTasks(ctx: Ctx) {
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.weddingId, ctx.weddingId))
    .orderBy(sql`${tasks.dueDate} asc nulls last`, asc(tasks.createdAt));
}

export async function createTasks(ctx: Ctx, raw: TaskCreateInput[]) {
  const list = z.array(taskCreateInput).min(1).max(200).parse(raw);
  for (const t of list) await assertTaskRefs(ctx, t);
  const rows = await db
    .insert(tasks)
    .values(
      list.map((t) => ({
        ...t,
        status: t.status ?? "todo",
        completedAt: t.status === "done" ? new Date() : null,
        weddingId: ctx.weddingId,
      })),
    )
    .returning({ id: tasks.id, title: tasks.title });
  await log(ctx, "create", "task", rows.length === 1 ? `Added task "${rows[0].title}"` : `Added ${rows.length} tasks`);
  return { taskIds: rows.map((r) => r.id) };
}

export async function updateTask(ctx: Ctx, taskId: string, raw: TaskUpdateInput) {
  const input = taskUpdateInput.parse(raw);
  await assertTaskRefs(ctx, input);
  const completedAt = input.status === undefined ? undefined : input.status === "done" ? new Date() : null;
  const [task] = await db
    .update(tasks)
    .set({ ...input, completedAt })
    .where(and(eq(tasks.id, taskId), eq(tasks.weddingId, ctx.weddingId)))
    .returning();
  if (!task) throw new UserError("Task not found");
  await log(ctx, "update", "task", `Updated task "${task.title}"`, taskId);
  return { title: task.title, status: task.status };
}

export async function deleteTasks(ctx: Ctx, taskIds: string[]) {
  const ids = z.array(z.uuid()).min(1).parse(taskIds);
  const rows = await db
    .delete(tasks)
    .where(and(eq(tasks.weddingId, ctx.weddingId), inArray(tasks.id, ids)))
    .returning({ title: tasks.title });
  if (!rows.length) throw new UserError("Task not found");
  await log(ctx, "delete", "task", rows.length === 1 ? `Deleted task "${rows[0].title}"` : `Deleted ${rows.length} tasks`);
  return { deleted: rows.length };
}

async function assertTaskRefs(ctx: Ctx, t: { assigneeUserId?: string | null; vendorId?: string | null }) {
  await assertOwned(ctx, vendors, t.vendorId, "Vendor");
  if (t.assigneeUserId) {
    const [m] = await db
      .select({ userId: weddingMembers.userId })
      .from(weddingMembers)
      .where(and(eq(weddingMembers.weddingId, ctx.weddingId), eq(weddingMembers.userId, t.assigneeUserId)));
    if (!m) throw new UserError("Assignee must be a collaborator on this wedding");
  }
}

// ---------- Day-of timeline ----------

const optUuidRef = z
  .union([z.literal(""), z.uuid()])
  .nullish()
  .transform((v) => (v === undefined ? undefined : v || null));

const timelineFields = {
  subEventId: optUuidRef,
  startsAt: localDateTime,
  endsAt: optLocalDateTime,
  title: z.string().trim().min(1).max(300),
  description: optText(),
  location: optText(200),
  vendorId: optUuidRef,
  guestVisible: z.boolean().optional(),
};
export const timelineCreateInput = z.object(timelineFields);
export const timelineUpdateInput = z.object(timelineFields).partial();

export type TimelineCreateInput = z.input<typeof timelineCreateInput>;
export type TimelineUpdateInput = z.input<typeof timelineUpdateInput>;
export type TimelineItem = typeof timelineItems.$inferSelect;

export async function listTimeline(ctx: Ctx) {
  return db
    .select()
    .from(timelineItems)
    .where(eq(timelineItems.weddingId, ctx.weddingId))
    .orderBy(asc(timelineItems.startsAt), asc(timelineItems.sortOrder));
}

export async function createTimelineItems(ctx: Ctx, raw: TimelineCreateInput[]) {
  const list = z.array(timelineCreateInput).min(1).max(200).parse(raw);
  for (const item of list) await assertTimelineRefs(ctx, item);
  const rows = await db
    .insert(timelineItems)
    .values(
      list.map((item, i) => ({
        ...item,
        ...toUtc(ctx, item),
        startsAt: localToUtc(item.startsAt, ctx.timezone),
        guestVisible: item.guestVisible ?? false,
        sortOrder: i,
        weddingId: ctx.weddingId,
      })),
    )
    .returning({ id: timelineItems.id });
  await log(ctx, "create", "timeline_item", `Added ${rows.length} timeline item(s)`);
  return { itemIds: rows.map((r) => r.id) };
}

export async function updateTimelineItem(ctx: Ctx, itemId: string, raw: TimelineUpdateInput) {
  const input = timelineUpdateInput.parse(raw);
  await assertTimelineRefs(ctx, input);
  const [item] = await db
    .update(timelineItems)
    .set({ ...input, ...toUtc(ctx, input) })
    .where(and(eq(timelineItems.id, itemId), eq(timelineItems.weddingId, ctx.weddingId)))
    .returning();
  if (!item) throw new UserError("Timeline item not found");
  await log(ctx, "update", "timeline_item", `Updated timeline item "${item.title}"`, itemId);
  return { title: item.title };
}

export async function deleteTimelineItems(ctx: Ctx, itemIds: string[]) {
  const ids = z.array(z.uuid()).min(1).parse(itemIds);
  const rows = await db
    .delete(timelineItems)
    .where(and(eq(timelineItems.weddingId, ctx.weddingId), inArray(timelineItems.id, ids)))
    .returning({ title: timelineItems.title });
  if (!rows.length) throw new UserError("Timeline item not found");
  await log(ctx, "delete", "timeline_item", `Deleted ${rows.length} timeline item(s)`);
  return { deleted: rows.length };
}

async function assertTimelineRefs(ctx: Ctx, t: { subEventId?: string | null; vendorId?: string | null }) {
  await assertOwned(ctx, subEvents, t.subEventId, "Event");
  await assertOwned(ctx, vendors, t.vendorId, "Vendor");
}

function toUtc(ctx: Ctx, input: { startsAt?: string; endsAt?: string | null }) {
  const startsAt = input.startsAt === undefined ? undefined : localToUtc(input.startsAt, ctx.timezone);
  const endsAt = input.endsAt == null ? input.endsAt : localToUtc(input.endsAt, ctx.timezone);
  if (startsAt && endsAt && endsAt < startsAt) throw new UserError("End time is before start time");
  return { startsAt, endsAt };
}

// ---------- Lookups for pickers ----------

export async function listPickers(ctx: Ctx) {
  const [members, events, vendorList] = await Promise.all([
    db
      .select({ id: user.id, name: user.name })
      .from(weddingMembers)
      .innerJoin(user, eq(user.id, weddingMembers.userId))
      .where(eq(weddingMembers.weddingId, ctx.weddingId)),
    db
      .select({ id: subEvents.id, name: subEvents.name })
      .from(subEvents)
      .where(eq(subEvents.weddingId, ctx.weddingId))
      .orderBy(asc(subEvents.sortOrder), asc(subEvents.startsAt)),
    db
      .select({ id: vendors.id, name: vendors.name })
      .from(vendors)
      .where(eq(vendors.weddingId, ctx.weddingId))
      .orderBy(asc(vendors.name)),
  ]);
  return { members, events, vendors: vendorList };
}
