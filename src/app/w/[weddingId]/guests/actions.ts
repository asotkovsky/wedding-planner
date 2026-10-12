"use server";

import { runAction } from "@/server/action";
import * as guests from "@/server/guests";

export async function createHousehold(weddingId: string, input: guests.HouseholdCreateInput) {
  return runAction(weddingId, (ctx) => guests.createHousehold(ctx, input));
}

export async function updateHousehold(weddingId: string, householdId: string, input: guests.HouseholdUpdateInput) {
  return runAction(weddingId, (ctx) => guests.updateHousehold(ctx, householdId, input));
}

export async function deleteHousehold(weddingId: string, householdId: string) {
  return runAction(weddingId, (ctx) => guests.deleteHousehold(ctx, householdId));
}

export async function regenerateInviteToken(weddingId: string, householdId: string) {
  return runAction(weddingId, (ctx) => guests.regenerateInviteToken(ctx, householdId));
}

export async function addGuest(weddingId: string, input: guests.AddGuestInput) {
  return runAction(weddingId, (ctx) => guests.addGuest(ctx, input));
}

export async function updateGuest(weddingId: string, guestId: string, input: guests.GuestUpdateInput) {
  return runAction(weddingId, (ctx) => guests.updateGuest(ctx, guestId, input));
}

export async function deleteGuest(weddingId: string, guestId: string) {
  return runAction(weddingId, (ctx) => guests.deleteGuest(ctx, guestId));
}

export async function setInvitations(weddingId: string, input: guests.InvitationInput) {
  return runAction(weddingId, (ctx) => guests.setInvitations(ctx, input));
}

export async function setRsvp(weddingId: string, input: guests.RsvpInput) {
  return runAction(weddingId, (ctx) => guests.setRsvp(ctx, input));
}

export async function setPlusOne(weddingId: string, guestId: string, on: boolean) {
  return runAction(weddingId, (ctx) => guests.setPlusOne(ctx, guestId, on));
}
