import { z } from "zod";

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().max(254),
  password: z.string().min(10).max(128)
});
export const loginSchema = z.object({
  email: z.email().max(254),
  password: z.string().min(1).max(128)
});
export const verifyEmailSchema = z.object({ token: z.string().min(20).max(256) });
export const emailSchema = z.object({ email: z.email().max(254) });
export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(256),
  password: z.string().min(10).max(128)
});
export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128)
});
export const preferencesSchema = z.object({
  theme: z.enum(["light", "dark", "system"]).optional(),
  timezone: z.string().min(1).max(80).optional(),
  currency: z.string().regex(/^[A-Za-z]{3}$/).optional()
});
