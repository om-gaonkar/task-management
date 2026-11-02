import {z} from "zod";
export const createCalendarEventSchema=z.object({
  title:z.string().trim().min(1).max(160),
  description:z.string().max(2000).optional(),
  startAt:z.string().datetime(),
  endAt:z.string().datetime().nullable().optional(),
  allDay:z.boolean().optional(),
  timezone:z.string().min(1).max(80).default("Asia/Kolkata"),
  color:z.string().max(32).nullable().optional()
}).superRefine((value,ctx)=>{if(value.endAt&&new Date(value.endAt)<new Date(value.startAt))ctx.addIssue({code:"custom",message:"End must be after start",path:["endAt"]});});
export const updateCalendarEventSchema=createCalendarEventSchema.partial();
