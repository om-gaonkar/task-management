import { z } from "zod";
export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128)
});
export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter at least 2 characters").max(80),
  email: z.email("Enter a valid email address").max(254),
  password: z.string().min(10, "Use at least 10 characters").max(128)
});
export const emailSchema = z.object({ email: z.email("Enter a valid email address") });
export const resetPasswordSchema = z.object({
  password: z.string().min(10, "Use at least 10 characters").max(128),
  confirmPassword: z.string()
}).refine(value => value.password === value.confirmPassword, {
  path: ["confirmPassword"], message: "Passwords do not match"
});
export type LoginValues = z.infer<typeof loginSchema>;
export type RegisterValues = z.infer<typeof registerSchema>;
