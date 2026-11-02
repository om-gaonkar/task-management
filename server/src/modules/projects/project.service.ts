import { Types } from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { Tag } from "../tags/tag.model.js";
import { Task } from "../tasks/task.model.js";
import { Project } from "./project.model.js";

async function assertTags(userId: Types.ObjectId, tagIds: string[] = []) {
  if (!tagIds.length) return;
  const count = await Tag.countDocuments({ _id: { $in: tagIds }, userId });
  if (count !== new Set(tagIds).size) throw new AppError("One or more tags are invalid", 400, "INVALID_TAGS");
}
export async function listProjects(userId: Types.ObjectId, page = 1, limit = 20) {
  const filter = { userId, archivedAt: null };
  const [items,total] = await Promise.all([
    Project.find(filter).sort({ updatedAt: -1 }).skip((page-1)*limit).limit(limit).lean(),
    Project.countDocuments(filter)
  ]);
  return { items, page, limit, total, pages: Math.ceil(total/limit) };
}
export async function getProject(userId: Types.ObjectId, projectId: string) {
  const project = await Project.findOne({ _id: projectId, userId, archivedAt: null }).lean();
  if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  const tasks = await Task.find({ userId, projectId: project._id, deletedAt: null }).select("_id parentId status dueAt").lean();
  const parents = new Set(tasks.map(task => task.parentId?.toString()).filter(Boolean));
  const leaves = tasks.filter(task => !parents.has(task._id.toString()));
  const completed = leaves.filter(task => task.status === "completed").length;
  const overdue = leaves.filter(task => task.dueAt && task.dueAt < new Date() && task.status !== "completed" && task.status !== "cancelled").length;
  const upcoming = leaves.filter(task => task.dueAt && task.dueAt >= new Date() && task.status !== "completed" && task.status !== "cancelled").length;
  return { ...project, progress: leaves.length ? Math.round(completed/leaves.length*100) : 0, completedTasks: completed, totalEligibleTasks: leaves.length, overdueTasks: overdue, upcomingTasks: upcoming };
}
export async function createProject(userId: Types.ObjectId, input: Record<string, any>) {
  await assertTags(userId, input.tagIds);
  const data = { ...input, userId, tagIds: (input.tagIds ?? []).map((id: string) => new Types.ObjectId(id)), startDate: input.startDate ? new Date(input.startDate) : null, deadline: input.deadline ? new Date(input.deadline) : null };
  return (await Project.create(data)).toObject();
}
export async function updateProject(userId: Types.ObjectId, projectId: string, input: Record<string, any>) {
  await assertTags(userId, input.tagIds);
  const update = { ...input };
  if (input.tagIds) update.tagIds = input.tagIds.map((id: string) => new Types.ObjectId(id));
  if (input.startDate !== undefined) update.startDate = input.startDate ? new Date(input.startDate) : null;
  if (input.deadline !== undefined) update.deadline = input.deadline ? new Date(input.deadline) : null;
  const project = await Project.findOneAndUpdate({ _id: projectId, userId, archivedAt: null }, { $set: update }, { new: true, runValidators: true });
  if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  return project.toObject();
}
export async function archiveProject(userId: Types.ObjectId, projectId: string) {
  const project = await Project.findOneAndUpdate({ _id: projectId, userId, archivedAt: null }, { $set: { archivedAt: new Date(), status: "archived" } }, { new: true });
  if (!project) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  return project.toObject();
}
export async function getProjectTasks(userId: Types.ObjectId, projectId: string) {
  if (!(await Project.exists({ _id: projectId, userId, archivedAt: null }))) throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
  return Task.find({ userId, projectId, deletedAt: null }).sort({ dueAt: 1, createdAt: -1 }).lean();
}
