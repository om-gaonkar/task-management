import { z } from "zod";
export const createTagSchema=z.object({name:z.string().trim().min(1).max(40),color:z.string().max(32).optional(),description:z.string().max(200).nullable().optional()});
export const updateTagSchema=createTagSchema.partial();
