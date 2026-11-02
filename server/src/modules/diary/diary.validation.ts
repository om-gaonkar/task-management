import {z} from "zod";
const id=z.string().regex(/^[a-f\d]{24}$/i);
export const createDiarySchema=z.object({
  title:z.string().trim().max(160).default(""),
  content:z.unknown(),
  entryDate:z.string().datetime(),
  timezone:z.string().min(1).max(80).default("Asia/Kolkata"),
  tagIds:z.array(id).max(30).optional(),
  mood:z.string().max(40).nullable().optional(),
  linkedTaskIds:z.array(id).max(50).optional(),
  linkedProjectIds:z.array(id).max(50).optional()
});
export const updateDiarySchema=createDiarySchema.partial().extend({version:z.number().int().positive()});
