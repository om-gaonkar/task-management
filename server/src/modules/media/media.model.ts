import { Schema, model } from "mongoose";
const mediaAssetSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  parentType: { type: String, enum: ["task", "project", "diary"], required: true },
  parentId: { type: Schema.Types.ObjectId, required: true, index: true },
  publicId: { type: String, required: true, unique: true },
  assetId: { type: String, default: null },
  secureUrl: { type: String, default: null },
  resourceType: { type: String, enum: ["image"], default: "image" },
  format: { type: String, default: null },
  width: { type: Number, default: null },
  height: { type: Number, default: null },
  bytes: { type: Number, default: null },
  altText: { type: String, maxlength: 300, default: "" },
  caption: { type: String, maxlength: 500, default: "" },
  status: { type: String, enum: ["pending", "attached", "deletion_pending"], default: "pending", index: true },
  expiresAt: { type: Date, default: null },
  cleanupAttempts: { type: Number, default: 0 },
  lastCleanupError: { type: String, default: null }
}, { timestamps: true, versionKey: false });
mediaAssetSchema.index({ userId: 1, parentType: 1, parentId: 1, status: 1 });
mediaAssetSchema.index({ status: 1, expiresAt: 1 });
export const MediaAsset = model("MediaAsset", mediaAssetSchema);
