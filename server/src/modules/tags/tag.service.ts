import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { DiaryEntry } from "../diary/diary.model.js";
import { Project } from "../projects/project.model.js";
import { Task } from "../tasks/task.model.js";
import { Tag } from "./tag.model.js";

export async function listTags(userId: Types.ObjectId) {
  return Tag.find({ userId }).sort({ normalizedName: 1 }).lean();
}
export async function createTag(userId: Types.ObjectId, input: { name: string; color?: string; description?: string | null }) {
  const normalizedName = input.name.trim().toLocaleLowerCase("en");
  if (await Tag.exists({ userId, normalizedName })) throw new AppError("This tag already exists", 409, "TAG_EXISTS");
  return (await Tag.create({ ...input, name: input.name.trim(), normalizedName, userId })).toObject();
}
export async function updateTag(userId: Types.ObjectId, tagId: string, input: { name?: string; color?: string; description?: string | null }) {
  const update: { name?: string; color?: string; description?: string | null; normalizedName?: string } = { ...input };
  if (input.name) {
    update.name = input.name.trim();
    update.normalizedName = input.name.trim().toLocaleLowerCase("en");
  }
  if (update.normalizedName && await Tag.exists({ userId, normalizedName: update.normalizedName, _id: { $ne: tagId } })) {
    throw new AppError("This tag already exists", 409, "TAG_EXISTS");
  }
  const tag = await Tag.findOneAndUpdate({ _id: tagId, userId }, { $set: update }, { new: true, runValidators: true });
  if (!tag) throw new AppError("Tag not found", 404, "TAG_NOT_FOUND");
  return tag.toObject();
}
export async function deleteTag(userId: Types.ObjectId, tagId: string) {
  const tag = await Tag.findOne({ _id: tagId, userId });
  if (!tag) throw new AppError("Tag not found", 404, "TAG_NOT_FOUND");
  await Promise.all([
    Task.updateMany({ userId, tagIds: tag._id }, { $pull: { tagIds: tag._id } }),
    Project.updateMany({ userId, tagIds: tag._id }, { $pull: { tagIds: tag._id } }),
    DiaryEntry.updateMany({ userId, tagIds: tag._id }, { $pull: { tagIds: tag._id } })
  ]);
  await Tag.deleteOne({ _id: tag._id, userId });
}
