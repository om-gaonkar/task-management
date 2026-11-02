import { z } from "zod";

const objectId = z.string().regex(/^[a-f\d]{24}$/i, "Invalid record identifier");
const dateOrNull = z.string().datetime().nullable().optional();

export const createTaskSchema = z.object({
  title: z.string().trim().min(1).max(240),
  description: z.unknown().optional(),
  projectId: objectId.nullable().optional(),
  parentId: objectId.nullable().optional(),
  status: z.enum(["todo", "in-progress", "completed", "cancelled"]).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  startAt: dateOrNull,
  dueAt: dateOrNull,
  estimatedMinutes: z.number().int().min(0).nullable().optional(),
  tagIds: z.array(objectId).max(30).optional(),
  manualProgress: z.number().min(0).max(100).optional()
});

export const updateTaskSchema = createTaskSchema.partial();
export const taskListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(["todo", "in-progress", "completed", "cancelled"]).optional(),
  projectId: objectId.optional(),
  parentId: objectId.optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  search: z.string().trim().max(100).optional()
});
export const taskIdParamSchema = z.object({ taskId: objectId });
