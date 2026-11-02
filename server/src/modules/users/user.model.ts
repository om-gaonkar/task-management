import { Schema, model } from "mongoose";

const preferencesSchema = new Schema({
  theme: { type: String, enum: ["light", "dark", "system"], default: "system" },
  timezone: { type: String, default: "Asia/Kolkata" },
  currency: { type: String, default: "INR" }
}, { _id: false });

const userSchema = new Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, lowercase: true, trim: true },
  passwordHash: { type: String, select: false },
  googleSub: { type: String, sparse: true, unique: true },
  avatarUrl: { type: String, default: null },
  emailVerifiedAt: { type: Date, default: null },
  isActive: { type: Boolean, default: true },
  preferences: { type: preferencesSchema, default: () => ({}) }
}, { timestamps: true, versionKey: false });

userSchema.index({ email: 1 }, { unique: true });
export const User = model("User", userSchema);
