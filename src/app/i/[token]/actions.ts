"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { UserError } from "@/server/core";
import { submitRsvp, type RsvpSubmission } from "@/server/guest-page";

export type RsvpResult = { ok: true; attending: number; declined: number } | { ok: false; error: string };

// Public action: the token is the only credential, and submitRsvp scopes everything to it.
export async function submitRsvpAction(token: string, input: RsvpSubmission): Promise<RsvpResult> {
  try {
    const { attending, declined, weddingId } = await submitRsvp(token, input);
    revalidatePath(`/i/${token}`);
    revalidatePath(`/w/${weddingId}`, "layout");
    return { ok: true, attending, declined };
  } catch (e) {
    if (e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof z.ZodError) return { ok: false, error: "Please check your answers and try again." };
    throw e;
  }
}
