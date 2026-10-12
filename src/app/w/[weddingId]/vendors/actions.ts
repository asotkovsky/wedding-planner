"use server";

import { runAction } from "@/server/action";
import * as vendors from "@/server/vendors";

export async function createVendor(weddingId: string, input: vendors.VendorCreateInput) {
  return runAction(weddingId, (ctx) => vendors.createVendor(ctx, input));
}

export async function updateVendor(weddingId: string, vendorId: string, input: vendors.VendorUpdateInput) {
  return runAction(weddingId, (ctx) => vendors.updateVendor(ctx, vendorId, input));
}

export async function deleteVendor(weddingId: string, vendorId: string) {
  return runAction(weddingId, (ctx) => vendors.deleteVendor(ctx, vendorId));
}

export async function markVendorPaidInFull(weddingId: string, vendorId: string) {
  return runAction(weddingId, (ctx) => vendors.markVendorPaidInFull(ctx, vendorId));
}

export async function addPayment(weddingId: string, input: vendors.PaymentCreateInput) {
  return runAction(weddingId, (ctx) => vendors.addPayment(ctx, input));
}

export async function setPaymentPaid(weddingId: string, paymentId: string, paid: boolean) {
  return runAction(weddingId, (ctx) => vendors.setPaymentPaid(ctx, paymentId, paid));
}

export async function deletePayment(weddingId: string, paymentId: string) {
  return runAction(weddingId, (ctx) => vendors.deletePayment(ctx, paymentId));
}
