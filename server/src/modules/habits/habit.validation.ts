import {z} from "zod";
export const createHabitSchema=z.object({
  name:z.string().trim().min(1).max(100),
  description:z.string().max(500).optional(),
  frequency:z.enum(["daily","weekly"]).default("daily"),
  weekdays:z.array(z.number().int().min(0).max(6)).max(7).default([]),
  targetCount:z.number().int().min(1).max(100).default(1),
  timezone:z.string().min(1).max(80).default("Asia/Kolkata")
}).superRefine((value,ctx)=>{if(value.frequency==="weekly"&&!value.weekdays.length)ctx.addIssue({code:"custom",message:"Select at least one weekday",path:["weekdays"]});});
export const updateHabitSchema=createHabitSchema.partial();
export const completionSchema=z.object({localDate:z.string().regex(/^\d{4}-\d{2}-\d{2}$/)});
