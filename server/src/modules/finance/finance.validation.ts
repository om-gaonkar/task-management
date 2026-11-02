import {z} from "zod";
const id=z.string().regex(/^[a-f\d]{24}$/i);
export const categorySchema=z.object({name:z.string().trim().min(1).max(60),type:z.enum(["income","expense"]),color:z.string().max(32).optional()});
export const transactionSchema=z.object({
  type:z.enum(["income","expense"]),
  amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  currency:z.string().regex(/^[A-Za-z]{3}$/).transform(v=>v.toUpperCase()).default("INR"),
  categoryId:id.nullable().optional(),
  projectId:id.nullable().optional(),
  occurredAt:z.string().datetime(),
  paymentMethod:z.string().max(50).nullable().optional(),
  note:z.string().max(1000).optional(),
  tagIds:z.array(id).max(30).optional()
});
export const updateTransactionSchema=transactionSchema.partial();
export const budgetSchema=z.object({
  periodMonth:z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/),
  currency:z.string().regex(/^[A-Za-z]{3}$/).transform(v=>v.toUpperCase()).default("INR"),
  categoryId:id.nullable().optional(),
  amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)
});
