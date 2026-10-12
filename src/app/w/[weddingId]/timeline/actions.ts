"use server";

import { runAction } from "@/server/action";
import * as planning from "@/server/planning";

export async function createTimelineItem(weddingId: string, input: planning.TimelineCreateInput) {
  return runAction(weddingId, (ctx) => planning.createTimelineItems(ctx, [input]));
}

export async function updateTimelineItem(weddingId: string, itemId: string, input: planning.TimelineUpdateInput) {
  return runAction(weddingId, (ctx) => planning.updateTimelineItem(ctx, itemId, input));
}

export async function deleteTimelineItem(weddingId: string, itemId: string) {
  return runAction(weddingId, (ctx) => planning.deleteTimelineItems(ctx, [itemId]));
}
