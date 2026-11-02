import { z } from "zod";
const id = z.string().regex(/^[a-f\d]{24}$/i);
export const createProjectSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.unknown().optional(),
  status: z.enum(["planning","active","on-hold","completed","archived"]).optional(),
  priority: z.enum(["low","medium","high","urgent"]).optional(),
  startDate: z.string().datetime().nullable().optional(),
  deadline: z.string().datetime().nullable().optional(),
  tagIds: z.array(id).max(30).optional(),
  color: z.string().max(32).nullable().optional()
});
export const updateProjectSchema = createProjectSchema.partial();
