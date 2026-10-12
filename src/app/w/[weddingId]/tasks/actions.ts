"use server";

import { runAction } from "@/server/action";
import * as planning from "@/server/planning";

export async function createTask(weddingId: string, input: planning.TaskCreateInput) {
  return runAction(weddingId, (ctx) => planning.createTasks(ctx, [input]));
}

export async function updateTask(weddingId: string, taskId: string, input: planning.TaskUpdateInput) {
  return runAction(weddingId, (ctx) => planning.updateTask(ctx, taskId, input));
}

export async function deleteTask(weddingId: string, taskId: string) {
  return runAction(weddingId, (ctx) => planning.deleteTasks(ctx, [taskId]));
}
