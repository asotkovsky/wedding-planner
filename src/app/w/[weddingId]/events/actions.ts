"use server";

import { runAction } from "@/server/action";
import * as events from "@/server/events";

export async function createSubEvent(weddingId: string, input: events.SubEventCreateInput) {
  return runAction(weddingId, (ctx) => events.createSubEvent(ctx, input));
}

export async function updateSubEvent(weddingId: string, subEventId: string, input: events.SubEventUpdateInput) {
  return runAction(weddingId, (ctx) => events.updateSubEvent(ctx, subEventId, input));
}

export async function deleteSubEvent(weddingId: string, subEventId: string) {
  return runAction(weddingId, (ctx) => events.deleteSubEvent(ctx, subEventId));
}

export async function inviteAllGuests(weddingId: string, subEventId: string) {
  return runAction(weddingId, (ctx) => events.inviteAllGuests(ctx, subEventId));
}
