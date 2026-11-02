import { Schema, model, type InferSchemaType } from "mongoose";

const sessionSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  secretHash: { type: String, required: true, select: false },
  csrfHash: { type: String, required: true, select: false },
  expiresAt: { type: Date, required: true, index: true },
  revokedAt: { type: Date, default: null },
  lastUsedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  userAgent: { type: String, default: null },
  ipAddress: { type: String, default: null }
}, { versionKey: false });
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
sessionSchema.index({ userId: 1, revokedAt: 1 });

function tokenSchema() {
  const schema = new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true, index: true },
    usedAt: { type: Date, default: null }
  }, { timestamps: true, versionKey: false });
  schema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  return schema;
}

export type SessionDocument = InferSchemaType<typeof sessionSchema>;
export const Session = model("Session", sessionSchema);
export const EmailVerificationToken = model("EmailVerificationToken", tokenSchema());
export const PasswordResetToken = model("PasswordResetToken", tokenSchema());
