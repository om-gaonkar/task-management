import { randomUUID } from "node:crypto";
import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { env } from "../../config/env.js";
import { cloudinary } from "../../config/cloudinary.js";
import { DiaryEntry } from "../diary/diary.model.js";
import { Project } from "../projects/project.model.js";
import { Task } from "../tasks/task.model.js";
import { MediaAsset } from "./media.model.js";

const MAX_BYTES = 8 * 1024 * 1024;
const FORMATS = new Set(["jpg", "jpeg", "png", "webp", "gif"]);
const MAX_BY_PARENT = { task: 8, project: 16, diary: 8 } as const;
type ParentType = "task" | "project" | "diary";

function ensureCloudinary() {
  if (!env.cloudinaryConfigured || !env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY) {
    throw new AppError("Image storage is not configured", 503, "MEDIA_NOT_CONFIGURED");
  }
}
async function assertParent(userId: Types.ObjectId, parentType: ParentType, parentId: string) {
  const exists = parentType === "task"
    ? await Task.exists({ _id: parentId, userId, deletedAt: null })
    : parentType === "project"
      ? await Project.exists({ _id: parentId, userId, archivedAt: null })
      : await DiaryEntry.exists({ _id: parentId, userId });
  if (!exists) throw new AppError("Parent record not found", 404, "MEDIA_PARENT_NOT_FOUND");
}
async function attachToParent(userId: Types.ObjectId, parentType: ParentType, parentId: Types.ObjectId, mediaId: Types.ObjectId) {
  const update = { $addToSet: { ...(parentType === "diary" ? { imageMediaIds: mediaId } : { mediaIds: mediaId }) } };
  const result = parentType === "task"
    ? await Task.updateOne({ _id: parentId, userId, deletedAt: null }, update)
    : parentType === "project"
      ? await Project.updateOne({ _id: parentId, userId, archivedAt: null }, update)
      : await DiaryEntry.updateOne({ _id: parentId, userId }, update);
  return result.matchedCount > 0;
}
async function detachFromParent(userId: Types.ObjectId, parentType: ParentType, parentId: Types.ObjectId, mediaId: Types.ObjectId) {
  const update = { $pull: { ...(parentType === "diary" ? { imageMediaIds: mediaId } : { mediaIds: mediaId }) } };
  if (parentType === "task") await Task.updateOne({ _id: parentId, userId }, update);
  else if (parentType === "project") await Project.updateOne({ _id: parentId, userId }, update);
  else await DiaryEntry.updateOne({ _id: parentId, userId }, update);
}

export async function createUploadSignature(userId: Types.ObjectId, input: { parentType: ParentType; parentId: string }) {
  ensureCloudinary();
  await assertParent(userId, input.parentType, input.parentId);
  const activeCount = await MediaAsset.countDocuments({
    userId, parentType: input.parentType, parentId: input.parentId, status: { $in: ["pending", "attached"] }
  });
  if (activeCount >= MAX_BY_PARENT[input.parentType]) throw new AppError("Attachment limit reached for this item", 400, "MEDIA_LIMIT_REACHED");

  const folder = `${env.CLOUDINARY_UPLOAD_FOLDER}/${userId.toString()}`;
  const publicId = randomUUID();
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { timestamp, folder, public_id: publicId, overwrite: false, allowed_formats: [...FORMATS].join(",") };
  const signature = cloudinary.utils.api_sign_request(params, env.CLOUDINARY_API_SECRET!);
  const pending = await MediaAsset.create({
    userId, parentType: input.parentType, parentId: new Types.ObjectId(input.parentId),
    publicId: `${folder}/${publicId}`, status: "pending", expiresAt: new Date(Date.now() + 20 * 60 * 1000)
  });
  return {
    mediaId: pending._id.toString(), cloudName: env.CLOUDINARY_CLOUD_NAME, apiKey: env.CLOUDINARY_API_KEY,
    timestamp, signature, folder, publicId, resourceType: "image",
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    maxBytes: MAX_BYTES
  };
}

export async function confirmUpload(userId: Types.ObjectId, input: { mediaId: string; altText?: string; caption?: string }) {
  ensureCloudinary();
  const pending = await MediaAsset.findOne({ _id: input.mediaId, userId });
  if (!pending) throw new AppError("Upload authorization not found", 404, "MEDIA_NOT_FOUND");
  if (pending.status === "attached") return pending.toObject();
  if (pending.status !== "pending" || !pending.expiresAt || pending.expiresAt <= new Date()) {
    throw new AppError("Upload authorization expired", 410, "UPLOAD_EXPIRED");
  }
  await assertParent(userId, pending.parentType as ParentType, pending.parentId.toString());
  const uploaded = await cloudinary.api.resource(pending.publicId, { resource_type: "image", type: "upload" });
  if (uploaded.public_id !== pending.publicId || uploaded.resource_type !== "image") {
    throw new AppError("Uploaded asset could not be verified", 400, "UPLOAD_VERIFICATION_FAILED");
  }
  if (!FORMATS.has(String(uploaded.format).toLowerCase()) || Number(uploaded.bytes) > MAX_BYTES) {
    await cloudinary.uploader.destroy(pending.publicId, { resource_type: "image", invalidate: true });
    await MediaAsset.deleteOne({ _id: pending._id, userId });
    throw new AppError("Image format or file size is not allowed", 400, "INVALID_IMAGE");
  }

  const attached = await MediaAsset.findOneAndUpdate(
    { _id: pending._id, userId, status: "pending", expiresAt: { $gt: new Date() } },
    { $set: {
      status: "attached", assetId: uploaded.asset_id, secureUrl: uploaded.secure_url,
      resourceType: "image", format: uploaded.format, width: uploaded.width, height: uploaded.height,
      bytes: uploaded.bytes, altText: input.altText ?? "", caption: input.caption ?? "", expiresAt: null
    } },
    { new: true }
  );
  if (!attached) {
    const existing = await MediaAsset.findOne({ _id: pending._id, userId, status: "attached" });
    if (existing) return existing.toObject();
    throw new AppError("Upload could not be attached", 409, "UPLOAD_CONFIRM_CONFLICT");
  }
  const parentUpdated = await attachToParent(userId, attached.parentType as ParentType, attached.parentId, attached._id);
  if (!parentUpdated) {
    await MediaAsset.updateOne({ _id: attached._id, userId }, { $set: { status: "deletion_pending", lastCleanupError: "Parent record no longer exists" } });
    throw new AppError("Parent record no longer exists; asset queued for cleanup", 409, "MEDIA_PARENT_REMOVED");
  }
  return attached.toObject();
}

export async function listAttachment(userId: Types.ObjectId, mediaId: string) {
  const media = await MediaAsset.findOne({ _id: mediaId, userId, status: "attached" }).lean();
  if (!media) throw new AppError("Attachment not found", 404, "MEDIA_NOT_FOUND");
  return media;
}

export async function deleteAttachment(userId: Types.ObjectId, mediaId: string) {
  ensureCloudinary();
  const media = await MediaAsset.findOne({ _id: mediaId, userId, status: "attached" });
  if (!media) throw new AppError("Attachment not found", 404, "MEDIA_NOT_FOUND");
  await detachFromParent(userId, media.parentType as ParentType, media.parentId, media._id);
  try {
    const result = await cloudinary.uploader.destroy(media.publicId, { resource_type: "image", invalidate: true });
    if (result.result !== "ok" && result.result !== "not found") throw new Error("Cloudinary did not confirm deletion");
    await MediaAsset.deleteOne({ _id: media._id, userId });
    return { deleted: true };
  } catch {
    media.status = "deletion_pending";
    media.lastCleanupError = "Remote asset deletion failed; retry cleanup";
    await media.save();
    return { deleted: false, cleanupPending: true };
  }
}

export async function runMediaCleanup() {
  if (!env.cloudinaryConfigured) return;
  const candidates = await MediaAsset.find({
    $or: [
      { status: "pending", expiresAt: { $lte: new Date() } },
      { status: "deletion_pending", updatedAt: { $lte: new Date(Date.now() - 5 * 60 * 1000) } }
    ]
  }).limit(100);
  for (const media of candidates) {
    try {
      const result = await cloudinary.uploader.destroy(media.publicId, { resource_type: "image", invalidate: true });
      if (result.result !== "ok" && result.result !== "not found") throw new Error("Cloudinary cleanup did not complete");
      await MediaAsset.deleteOne({ _id: media._id });
    } catch {
      media.cleanupAttempts += 1;
      media.lastCleanupError = "Cloudinary cleanup attempt failed";
      media.updatedAt = new Date();
      await media.save();
    }
  }
}
