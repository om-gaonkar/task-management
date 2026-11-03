import { z } from "zod";

const calendarEventFields = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().max(2000).optional(),
  startAt: z.string().datetime(),
  endAt: z.string().datetime().nullable().optional(),
  allDay: z.boolean().optional(),
  timezone: z.string().min(1).max(80).default("Asia/Kolkata"),
  color: z.string().max(32).nullable().optional()
});

function validateEventRange(
  value: { startAt?: string; endAt?: string | null },
  ctx: z.RefinementCtx
) {
  if (value.startAt && value.endAt && new Date(value.endAt) < new Date(value.startAt)) {
    ctx.addIssue({
      code: "custom",
      message: "End must be after start",
      path: ["endAt"]
    });
  }
}

export const createCalendarEventSchema = calendarEventFields.superRefine(validateEventRange);
export const updateCalendarEventSchema = calendarEventFields.partial().superRefine(validateEventRange);
