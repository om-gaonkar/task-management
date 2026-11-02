import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { User } from "./user.model.js";

function publicUser(user: { _id: Types.ObjectId; name: string; email: string; avatarUrl?: string | null; preferences?: unknown }) {
  return { id: user._id.toString(), name: user.name, email: user.email, avatarUrl: user.avatarUrl ?? null, preferences: user.preferences ?? {} };
}
export async function getProfile(userId: Types.ObjectId) {
  const user = await User.findOne({ _id: userId, isActive: true });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return publicUser(user);
}
export async function updateProfile(userId: Types.ObjectId, input: { name?: string }) {
  const user = await User.findOneAndUpdate({ _id: userId, isActive: true }, { $set: input }, { new: true, runValidators: true });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return publicUser(user);
}
export async function updatePreferences(userId: Types.ObjectId, input: { theme?: "light" | "dark" | "system"; timezone?: string; currency?: string }) {
  if (input.timezone) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: input.timezone }).format(); }
    catch { throw new AppError("Invalid IANA timezone", 400, "INVALID_TIMEZONE"); }
  }
  if (input.currency && !/^[A-Z]{3}$/i.test(input.currency)) throw new AppError("Invalid ISO currency code", 400, "INVALID_CURRENCY");
  const update: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(input)) update[`preferences.${key}`] = key === "currency" && typeof value === "string" ? value.toUpperCase() : value;
  const user = await User.findOneAndUpdate({ _id: userId, isActive: true }, { $set: update }, { new: true });
  if (!user) throw new AppError("User not found", 404, "USER_NOT_FOUND");
  return publicUser(user);
}
